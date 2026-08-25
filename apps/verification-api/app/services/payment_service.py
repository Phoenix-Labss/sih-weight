"""Service layer for Payment Initiation, Webhooks, Reconciliation, and Receipts.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import UserContext
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from app.core.permissions import verify_tenant_access
from app.core.state_machines import ApplicationStateMachine, UserContext as SmUserContext
from app.models.application import (
    ApplicationStatusEnum,
    FeeAssessment,
    PaymentStatusEnum,
    VerificationApplication,
)
from app.models.payment import PaymentLifecycleEnum, PaymentTransaction
from app.models.stakeholder import RoleEnum
from app.schemas.payment import (
    MockCompletePaymentRequest,
    PaymentInitiateRequest,
    PaymentInitiateResponse,
    PaymentTransactionResponse,
    StatutoryReceiptResponse,
)
from packages.verification_payments import (
    DuplicatePaymentError,
    IdempotencyConflictError,
    IllegalPaymentStateTransitionError,
    InvalidWebhookSignatureError,
    MockPaymentGateway,
    PaymentIntentRequest as PkgPaymentIntentRequest,
    PaymentLifecycleState,
    PaymentStateMachine,
    StatutoryReceiptGenerator,
    WebhookVerifier,
    default_idempotency_manager,
)


class PaymentService:
    """Business logic for payment intents, callbacks, and statutory receipts."""

    @staticmethod
    def initiate_payment(
        db: Session,
        req: PaymentInitiateRequest,
        actor: UserContext,
    ) -> PaymentInitiateResponse:
        """Initiate payment checkout session with idempotency guard."""
        # 1. Fetch application
        app = db.execute(
            select(VerificationApplication)
            .options(
                joinedload(VerificationApplication.fee_assessment),
                joinedload(VerificationApplication.applicant),
            )
            .where(
                (VerificationApplication.application_id == req.application_id)
                | (VerificationApplication.application_number == req.application_id)
            )
        ).unique().scalar_one_or_none()

        if not app:
            raise NotFoundError(f"Verification application [{req.application_id}] not found")

        verify_tenant_access(actor, app.tenant_id)

        # 2. Check fee assessment
        if not app.fee_assessment:
            raise UnprocessableError(
                f"Application [{app.application_number}] does not have an issued fee assessment. "
                "Fee must be assessed prior to checkout initiation."
            )

        fee = app.fee_assessment
        if fee.payment_status == PaymentStatusEnum.SUCCESS or app.current_status == ApplicationStatusEnum.FEE_PAID:
            raise ConflictError("Statutory fee for this application has already been paid and reconciled.")

        # 3. Idempotency handling
        idempotency_key = req.idempotency_key or f"idem_{uuid.uuid4().hex}"
        try:
            is_new, cached = default_idempotency_manager.acquire(idempotency_key, app.tenant_id)
        except IdempotencyConflictError as exc:
            raise ConflictError(str(exc)) from exc

        if not is_new and cached:
            if isinstance(cached, dict):
                return PaymentInitiateResponse(**cached)
            elif isinstance(cached, PaymentInitiateResponse):
                return cached

        # Check if transaction exists in DB
        existing_tx = db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.tenant_id == app.tenant_id,
                PaymentTransaction.idempotency_key == idempotency_key,
            )
        ).scalar_one_or_none()

        if existing_tx:
            pkg_resp = PaymentInitiateResponse(
                payment_id=existing_tx.payment_id,
                application_id=existing_tx.application_id,
                fee_assessment_id=existing_tx.fee_assessment_id,
                idempotency_key=existing_tx.idempotency_key,
                amount=existing_tx.amount,
                currency=existing_tx.currency,
                status=PaymentLifecycleEnum(existing_tx.status.value if hasattr(existing_tx.status, "value") else str(existing_tx.status)),
                checkout_url=f"https://gateway.mock.gov.in/checkout/ORDER-MOCK-{existing_tx.payment_id[:8].upper()}",
                gateway_order_id=f"ORDER-MOCK-{existing_tx.payment_id[:8].upper()}",
                gateway_session_token=f"tok_mock_{existing_tx.payment_id[:16]}",
                created_at=existing_tx.created_at or datetime.now(timezone.utc),
                expires_at=datetime.now(timezone.utc),
            )
            return pkg_resp

        # 4. Create new PaymentTransaction
        payment_id = str(uuid.uuid4())
        amount = fee.total_assessed_amount
        payer_name = actor.full_name or (app.applicant.legal_name if app.applicant else "Applicant")

        tx = PaymentTransaction(
            payment_id=payment_id,
            tenant_id=app.tenant_id,
            application_id=app.application_id,
            fee_assessment_id=fee.fee_assessment_id,
            idempotency_key=idempotency_key,
            gateway_provider="MOCK_TREASURY_GATEWAY",
            amount=amount,
            currency="INR",
            status=PaymentLifecycleEnum.PENDING,
            payment_method=req.payment_method,
            payer_id=actor.user_id,
            payer_name=payer_name,
        )
        db.add(tx)

        # 5. Gateway intent creation
        gateway = MockPaymentGateway()
        pkg_req = PkgPaymentIntentRequest(
            tenant_id=app.tenant_id,
            application_id=app.application_id,
            fee_assessment_id=fee.fee_assessment_id,
            amount=amount,
            currency="INR",
            payer_id=actor.user_id,
            payer_name=payer_name,
            payer_email=actor.email,
            payment_method=req.payment_method,
            idempotency_key=idempotency_key,
        )
        gateway_resp = gateway.create_checkout_session(pkg_req, payment_id, idempotency_key)

        db.flush()
        db.commit()

        resp_obj = PaymentInitiateResponse(
            payment_id=gateway_resp.payment_id,
            application_id=gateway_resp.application_id,
            fee_assessment_id=gateway_resp.fee_assessment_id,
            idempotency_key=gateway_resp.idempotency_key,
            amount=gateway_resp.amount,
            currency=gateway_resp.currency,
            status=PaymentLifecycleEnum.PENDING,
            checkout_url=gateway_resp.checkout_url,
            gateway_order_id=gateway_resp.gateway_order_id,
            gateway_session_token=gateway_resp.gateway_session_token,
            created_at=gateway_resp.created_at,
            expires_at=gateway_resp.expires_at,
        )

        default_idempotency_manager.record_success(idempotency_key, app.tenant_id, resp_obj.model_dump())
        return resp_obj

    @staticmethod
    def process_webhook(
        db: Session,
        raw_body: str,
        signature_header: Optional[str] = None,
    ) -> PaymentTransactionResponse:
        """Verify webhook signature and execute state transitions and settlement."""
        verifier = WebhookVerifier()
        try:
            webhook = verifier.verify(raw_body, signature_header=signature_header)
        except Exception as exc:
            raise UnprocessableError(f"Webhook verification failed: {exc}") from exc

        tx = db.execute(
            select(PaymentTransaction)
            .options(
                joinedload(PaymentTransaction.fee_assessment),
                joinedload(PaymentTransaction.application),
            )
            .where(PaymentTransaction.payment_id == webhook.payment_id)
        ).unique().scalar_one_or_none()

        if not tx:
            raise NotFoundError(f"Payment transaction [{webhook.payment_id}] not found")

        curr_state_val = tx.status.value if hasattr(tx.status, "value") else str(tx.status)
        current_state = PaymentLifecycleState(curr_state_val)

        # Idempotent replay for already reconciled transaction
        if current_state == PaymentLifecycleState.RECONCILED:
            return PaymentTransactionResponse.model_validate(tx)

        now_utc = datetime.now(timezone.utc)

        if webhook.status.upper() == "SUCCESS":
            # 1. State machine validation: PENDING -> AUTHORIZED -> RECONCILED
            PaymentStateMachine.validate_transition(current_state, PaymentLifecycleState.AUTHORIZED, tx.payment_id)
            PaymentStateMachine.validate_transition(PaymentLifecycleState.AUTHORIZED, PaymentLifecycleState.RECONCILED, tx.payment_id)

            tx.status = PaymentLifecycleEnum.RECONCILED
            tx.gateway_transaction_id = webhook.gateway_transaction_id
            tx.signature_payload = webhook.signature or signature_header
            tx.completed_at = now_utc

            # 2. Statutory Receipt Generation
            fee_obj = tx.fee_assessment
            itemized_breakdown = []
            if fee_obj:
                itemized_breakdown = [
                    {"code": "BASE_FEE", "name": "Base Statutory Fee", "amount": str(fee_obj.base_verification_fee)},
                    {"code": "USER_CHARGE", "name": "Portal User Charge", "amount": str(fee_obj.user_charge)},
                    {"code": "LATE_FEE", "name": "Late Submission Penalty", "amount": str(fee_obj.late_fee)},
                ]

            receipt = StatutoryReceiptGenerator.create_receipt(
                payment_id=tx.payment_id,
                application_id=tx.application_id,
                tenant_id=tx.tenant_id,
                payer_name=tx.payer_name,
                amount=tx.amount,
                gateway_reference=webhook.gateway_transaction_id,
                payment_method=tx.payment_method,
                application_number=tx.application.application_number if tx.application else None,
                itemized_breakdown=itemized_breakdown,
                paid_at=now_utc,
            )
            tx.receipt_number = receipt.receipt_number

            # 3. Update FeeAssessment & VerificationApplication
            if tx.fee_assessment:
                tx.fee_assessment.payment_status = PaymentStatusEnum.SUCCESS
                tx.fee_assessment.receipt_number = receipt.receipt_number
                tx.fee_assessment.payment_gateway_ref = webhook.gateway_transaction_id
                tx.fee_assessment.paid_at = now_utc

            if tx.application and tx.application.current_status in (
                ApplicationStatusEnum.FEE_PENDING,
                ApplicationStatusEnum.ACCEPTED,
                ApplicationStatusEnum.SUBMITTED,
            ):
                sm_actor = SmUserContext(
                    user_id="system_gateway",
                    tenant_id=tx.tenant_id,
                    role=RoleEnum.SUPERVISOR,
                    jurisdiction_id=tx.application.jurisdiction_id,
                    is_active=True,
                )
                ApplicationStateMachine.reconcile_payment(
                    tx.application, sm_actor, receipt_number=receipt.receipt_number
                )

        else:
            # Payment failed
            PaymentStateMachine.validate_transition(current_state, PaymentLifecycleState.FAILED, tx.payment_id)
            tx.status = PaymentLifecycleEnum.FAILED
            tx.failure_reason = webhook.failure_reason or "Payment declined or cancelled by user"
            if tx.fee_assessment:
                tx.fee_assessment.payment_status = PaymentStatusEnum.FAILED

        db.flush()
        db.commit()
        db.refresh(tx)
        return PaymentTransactionResponse.model_validate(tx)

    @staticmethod
    def mock_complete_payment(
        db: Session,
        req: MockCompletePaymentRequest,
        actor: UserContext,
    ) -> Dict[str, Any]:
        """Simulate a gateway webhook callback in test/demo environment."""
        tx = db.execute(
            select(PaymentTransaction).where(PaymentTransaction.payment_id == req.payment_id)
        ).scalar_one_or_none()

        if not tx:
            raise NotFoundError(f"Payment transaction [{req.payment_id}] not found")

        verify_tenant_access(actor, tx.tenant_id)

        gateway = MockPaymentGateway()
        _, raw_json_str, signature_header = gateway.simulate_webhook_event(
            payment_id=tx.payment_id,
            amount=tx.amount,
            status=req.status,
            failure_reason=req.failure_reason,
        )

        resp = PaymentService.process_webhook(db, raw_json_str, signature_header=signature_header)
        return {
            "success": True,
            "payment_id": resp.payment_id,
            "status": resp.status.value if hasattr(resp.status, "value") else str(resp.status),
            "receipt_number": resp.receipt_number,
            "gateway_transaction_id": resp.gateway_transaction_id,
        }

    @staticmethod
    def get_payment(
        db: Session,
        payment_id: str,
        actor: UserContext,
    ) -> PaymentTransactionResponse:
        """Fetch payment transaction details."""
        tx = db.execute(
            select(PaymentTransaction).where(
                (PaymentTransaction.payment_id == payment_id)
                | (PaymentTransaction.receipt_number == payment_id)
            )
        ).scalar_one_or_none()

        if not tx:
            raise NotFoundError(f"Payment transaction [{payment_id}] not found")

        verify_tenant_access(actor, tx.tenant_id)
        return PaymentTransactionResponse.model_validate(tx)

    @staticmethod
    def get_receipt(
        db: Session,
        receipt_id: str,
        actor: UserContext,
    ) -> StatutoryReceiptResponse:
        """Fetch itemized statutory receipt."""
        tx = db.execute(
            select(PaymentTransaction)
            .options(
                joinedload(PaymentTransaction.fee_assessment),
                joinedload(PaymentTransaction.application),
            )
            .where(
                (PaymentTransaction.receipt_number == receipt_id)
                | (PaymentTransaction.payment_id == receipt_id)
            )
        ).unique().scalar_one_or_none()

        if not tx:
            raise NotFoundError(f"Receipt or payment [{receipt_id}] not found")

        verify_tenant_access(actor, tx.tenant_id)

        if not tx.receipt_number or tx.status != PaymentLifecycleEnum.RECONCILED:
            raise UnprocessableError(f"Payment [{tx.payment_id}] is not settled or receipt has not been issued yet.")

        fee_obj = tx.fee_assessment
        breakdown = []
        if fee_obj:
            breakdown = [
                {"code": "BASE_FEE", "name": "Base Statutory Verification Fee", "amount": str(fee_obj.base_verification_fee)},
                {"code": "USER_CHARGE", "name": "Portal Administrative User Charge", "amount": str(fee_obj.user_charge)},
                {"code": "LATE_FEE", "name": "Late Submission Penalty", "amount": str(fee_obj.late_fee)},
            ]

        receipt = StatutoryReceiptGenerator.create_receipt(
            payment_id=tx.payment_id,
            application_id=tx.application_id,
            tenant_id=tx.tenant_id,
            payer_name=tx.payer_name,
            amount=tx.amount,
            gateway_reference=tx.gateway_transaction_id or "MOCK_TXN",
            payment_method=tx.payment_method,
            application_number=tx.application.application_number if tx.application else None,
            itemized_breakdown=breakdown,
            paid_at=tx.completed_at or tx.created_at or datetime.now(timezone.utc),
            receipt_number=tx.receipt_number,
        )

        return StatutoryReceiptResponse(
            receipt_number=receipt.receipt_number,
            payment_id=receipt.payment_id,
            application_id=receipt.application_id,
            application_number=receipt.application_number,
            tenant_id=receipt.tenant_id,
            payer_name=receipt.payer_name,
            amount=receipt.amount,
            currency=receipt.currency,
            payment_method=receipt.payment_method,
            gateway_reference=receipt.gateway_reference,
            paid_at=receipt.paid_at,
            itemized_breakdown=receipt.itemized_breakdown,
            digital_verification_hash=receipt.digital_verification_hash,
        )
