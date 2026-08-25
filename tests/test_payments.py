"""Comprehensive Unit & Integration Test Suite for Payment Engine & Statutory Settlement.

Tests:
1. Explicit 6-state payment lifecycle state machine (CREATED -> PENDING -> AUTHORIZED -> RECONCILED / FAILED / REFUNDED).
2. Strict rejection of illegal state machine jumps and terminal mutations.
3. Mock Gateway checkout session creation and signed webhook dispatch.
4. HMAC-SHA256 signature verification, tamper detection, and timestamp anti-replay defense.
5. Idempotency token manager preventing duplicate charges.
6. Statutory receipt generation with SHA-256 digital integrity digest.
7. REST API integration: Initiate -> Mock Complete / Webhook -> Reconciled -> Receipt fetch -> Multi-tenant isolation.
"""

import json
import time
import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from packages.verification_payments import (
    DuplicatePaymentError,
    IdempotencyConflictError,
    IllegalPaymentStateTransitionError,
    InvalidWebhookSignatureError,
    MockPaymentGateway,
    PaymentIntentRequest,
    PaymentLifecycleState,
    PaymentStateMachine,
    StatutoryReceiptGenerator,
    WebhookReplayError,
    WebhookVerifier,
    compute_webhook_signature,
    default_idempotency_manager,
)
from app.models.application import (
    ApplicationStatusEnum,
    ApplicationTypeEnum,
    FeeAssessment,
    PaymentStatusEnum,
    ServiceModeEnum,
    VerificationApplication,
)
from app.models.payment import PaymentLifecycleEnum, PaymentTransaction
from app.models.stakeholder import RoleEnum


class TestPaymentStateMachineAndCryptoUnit:
    """Pure domain unit tests for Payment State Machine, Webhooks, Idempotency & Receipts."""

    def test_payment_state_machine_valid_lifecycle(self):
        """Test happy path lifecycle transitions: CREATED -> PENDING -> AUTHORIZED -> RECONCILED -> REFUNDED."""
        sm = PaymentStateMachine

        assert sm.can_transition(PaymentLifecycleState.CREATED, PaymentLifecycleState.PENDING)
        assert sm.can_transition(PaymentLifecycleState.PENDING, PaymentLifecycleState.AUTHORIZED)
        assert sm.can_transition(PaymentLifecycleState.AUTHORIZED, PaymentLifecycleState.RECONCILED)
        assert sm.can_transition(PaymentLifecycleState.RECONCILED, PaymentLifecycleState.REFUNDED)

        # Failure branches
        assert sm.can_transition(PaymentLifecycleState.CREATED, PaymentLifecycleState.FAILED)
        assert sm.can_transition(PaymentLifecycleState.PENDING, PaymentLifecycleState.FAILED)
        assert sm.can_transition(PaymentLifecycleState.AUTHORIZED, PaymentLifecycleState.FAILED)

    def test_payment_state_machine_illegal_bypasses(self):
        """Verify illegal state transitions and terminal mutations are strictly rejected."""
        sm = PaymentStateMachine

        # Cannot jump straight from CREATED to RECONCILED
        assert not sm.can_transition(PaymentLifecycleState.CREATED, PaymentLifecycleState.RECONCILED)
        with pytest.raises(IllegalPaymentStateTransitionError):
            sm.validate_transition(PaymentLifecycleState.CREATED, PaymentLifecycleState.RECONCILED)

        # Cannot jump straight from PENDING to RECONCILED without AUTHORIZED callback
        assert not sm.can_transition(PaymentLifecycleState.PENDING, PaymentLifecycleState.RECONCILED)
        with pytest.raises(IllegalPaymentStateTransitionError):
            sm.validate_transition(PaymentLifecycleState.PENDING, PaymentLifecycleState.RECONCILED)

        # Cannot mutate terminal FAILED state
        assert not sm.can_transition(PaymentLifecycleState.FAILED, PaymentLifecycleState.PENDING)
        assert not sm.can_transition(PaymentLifecycleState.FAILED, PaymentLifecycleState.RECONCILED)
        with pytest.raises(IllegalPaymentStateTransitionError):
            sm.validate_transition(PaymentLifecycleState.FAILED, PaymentLifecycleState.RECONCILED)

        # Cannot mutate terminal REFUNDED state
        assert not sm.can_transition(PaymentLifecycleState.REFUNDED, PaymentLifecycleState.RECONCILED)
        with pytest.raises(IllegalPaymentStateTransitionError):
            sm.validate_transition(PaymentLifecycleState.REFUNDED, PaymentLifecycleState.RECONCILED)

    def test_mock_gateway_create_checkout_session(self):
        gateway = MockPaymentGateway()
        intent = PaymentIntentRequest(
            tenant_id="IN-DL",
            application_id="app_12345",
            fee_assessment_id="fee_98765",
            amount=Decimal("450.00"),
            currency="INR",
            payer_id="stk_trader_01",
            payer_name="Kishore Retail",
            payment_method="ONLINE_GATEWAY",
        )

        resp = gateway.create_checkout_session(
            request=intent,
            payment_id="PAY-DL-123456",
            idempotency_key="idemp_key_001",
        )
        assert resp.payment_id == "PAY-DL-123456"
        assert resp.idempotency_key == "idemp_key_001"
        assert resp.amount == Decimal("450.00")
        assert resp.currency == "INR"
        assert resp.status == PaymentLifecycleState.PENDING

    def test_mock_gateway_simulate_webhook_event(self):
        gateway = MockPaymentGateway(secret="test_secret_key_123")
        payload_dict, raw_json, sig_header = gateway.simulate_webhook_event(
            payment_id="pay_abc_01",
            amount=Decimal("450.00"),
            status="SUCCESS",
        )
        assert payload_dict["payment_id"] == "pay_abc_01"
        assert payload_dict["status"] == "SUCCESS"
        assert "v1=" in sig_header

    def test_webhook_signature_verification_and_tamper_defense(self):
        """Verify cryptographic HMAC-SHA256 signature verification rejects forged payloads."""
        secret = "super_secure_webhook_secret_999"
        verifier = WebhookVerifier(secret=secret, tolerance_seconds=300)
        gateway = MockPaymentGateway(secret=secret)

        # Valid payload
        _, raw_json, sig_header = gateway.simulate_webhook_event(
            payment_id="pay_test_99",
            amount=Decimal("500.00"),
            status="SUCCESS",
        )
        verified = verifier.verify(raw_json, signature_header=sig_header)
        assert verified.payment_id == "pay_test_99"
        assert verified.status == "SUCCESS"

        # Tampered body with original signature -> must fail
        tampered_body = raw_json.replace("500.00", "50.00")
        with pytest.raises(InvalidWebhookSignatureError):
            verifier.verify(tampered_body, signature_header=sig_header)

        # Forged signature with fresh timestamp -> must fail
        now_ts = int(time.time())
        with pytest.raises(InvalidWebhookSignatureError):
            verifier.verify(raw_json, signature_header=f"t={now_ts},v1=deadbeef0000111122223333444455556666777788889999aaaabbbbccccdddd")

    def test_webhook_anti_replay_timestamp_check(self):
        """Verify webhook callbacks outside tolerance window are rejected."""
        secret = "secret_anti_replay_test"
        verifier = WebhookVerifier(secret=secret, tolerance_seconds=300)
        gateway = MockPaymentGateway(secret=secret)

        now = int(time.time())

        # Payload created 400 seconds ago (> 300s tolerance)
        stale_ts = now - 400
        _, raw_json, sig_header = gateway.simulate_webhook_event(
            payment_id="pay_stale_01",
            amount=Decimal("200.00"),
            status="SUCCESS",
            custom_timestamp=stale_ts,
        )

        with pytest.raises(WebhookReplayError) as exc_info:
            verifier.verify(raw_json, signature_header=sig_header, current_time=now)
        assert "anti-replay" in str(exc_info.value).lower()

    def test_idempotency_manager(self):
        """Verify thread-safe idempotency manager."""
        mgr = default_idempotency_manager
        key = f"test_key_{uuid.uuid4().hex}"
        tenant = "IN-DL"

        # First attempt: acquire lock
        is_new, cached = mgr.acquire(key, tenant)
        assert is_new is True
        assert cached is None

        # While processing, concurrent acquisition raises conflict
        with pytest.raises(IdempotencyConflictError):
            mgr.acquire(key, tenant)

        # Record completion
        mgr.record_success(key, tenant, {"payment_id": "pay_done_01", "status": "PENDING"})

        # Subsequent attempt: returns cached result
        is_new2, cached2 = mgr.acquire(key, tenant)
        assert is_new2 is False
        assert cached2 == {"payment_id": "pay_done_01", "status": "PENDING"}

    def test_statutory_receipt_generator(self):
        """Verify itemized statutory receipt generation and cryptographic hash digest."""
        receipt = StatutoryReceiptGenerator.create_receipt(
            payment_id="pay_12345",
            application_id="app_12345",
            tenant_id="IN-DL",
            payer_name="Kishore Trader",
            amount=Decimal("450.00"),
            gateway_reference="TXN-MOCK-999",
            application_number="APP/IN-DL/2026/102938",
            itemized_breakdown=[
                {"code": "BASE_FEE", "amount": "200.00"},
                {"code": "LOCATION_SURCHARGE", "amount": "200.00"},
                {"code": "PORTAL_USER_CHARGE", "amount": "50.00"},
            ],
        )

        assert receipt.receipt_number.startswith("REC-DL-")
        assert receipt.amount == Decimal("450.00")
        assert len(receipt.digital_verification_hash) == 64  # SHA-256 hex string
        assert receipt.currency == "INR"


class TestPaymentApiIntegration:
    """FastAPI integration tests for Payment Initiation, Webhooks, and Receipts."""

    def _setup_assessed_application(self, client: TestClient, seed_data: dict, auth_headers) -> str:
        """Helper to create an application with an issued fee assessment."""
        # 1. Register instrument
        inst_resp = client.post(
            "/api/v1/tenants/IN-DL/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": f"SCALE-PAY-TEST-{uuid.uuid4().hex[:6].upper()}",
                "year_of_manufacture": 2026,
                "intended_use": "Commercial grocery weighment",
                "installation_location_notes": "Shop 4, Market Complex, Delhi",
            },
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert inst_resp.status_code == 201
        inst_id = inst_resp.json()["instrument_id"]

        # 2. Submit application
        app_resp = client.post(
            "/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert app_resp.status_code == 201
        app_id = app_resp.json()["application_id"]

        # 3. LMO Scrutinizes and Accepts Application
        scrutiny_resp = client.post(
            f"/api/v1/tenants/IN-DL/applications/{app_id}/scrutiny",
            json={
                "action": "ACCEPT",
                "notes": "Application details and identity verified.",
            },
            headers=auth_headers(seed_data["lmo_user_id"], role=RoleEnum.LMO),
        )
        assert scrutiny_resp.status_code == 200

        # 4. Assess fee
        fee_resp = client.post(
            f"/api/v1/tenants/IN-DL/applications/{app_id}/fee",
            json={
                "base_verification_fee": "200.00",
                "user_charge": "50.00",
                "late_fee": "0.00",
                "policy_version": "IN-FEES-2026.1",
            },
            headers=auth_headers(seed_data["lmo_user_id"], role=RoleEnum.LMO),
        )
        assert fee_resp.status_code == 200
        return app_id

    def test_full_payment_lifecycle_checkout_to_receipt(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        """Test complete end-to-end payment flow: Initiate -> Mock-Complete -> Webhook -> Reconciled -> Receipt."""
        app_id = self._setup_assessed_application(client, seed_data, auth_headers)

        # 1. Initiate payment checkout
        initiate_resp = client.post(
            "/api/v1/payments/initiate",
            json={
                "application_id": app_id,
                "payment_method": "UPI",
                "idempotency_key": f"test_idem_{uuid.uuid4().hex}",
            },
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert initiate_resp.status_code == 201
        pay_data = initiate_resp.json()
        payment_id = pay_data["payment_id"]
        assert pay_data["status"] == "PENDING"
        assert "gateway.mock.gov.in" in pay_data["checkout_url"]
        assert Decimal(str(pay_data["amount"])) == Decimal("250.00")

        # 2. Simulate payment completion via mock gateway endpoint
        complete_resp = client.post(
            "/api/v1/payments/mock-complete",
            json={
                "payment_id": payment_id,
                "status": "SUCCESS",
            },
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert complete_resp.status_code == 200
        comp_data = complete_resp.json()
        assert comp_data["success"] is True
        assert comp_data["status"] == "RECONCILED"
        receipt_no = comp_data["receipt_number"]
        assert receipt_no.startswith("REC-")

        # 3. Check payment status
        status_resp = client.get(
            f"/api/v1/payments/{payment_id}",
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert status_resp.status_code == 200
        assert status_resp.json()["status"] == "RECONCILED"
        assert status_resp.json()["receipt_number"] == receipt_no

        # 4. Fetch statutory receipt
        receipt_resp = client.get(
            f"/api/v1/payments/receipt/{receipt_no}",
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert receipt_resp.status_code == 200
        rcpt_data = receipt_resp.json()
        assert rcpt_data["receipt_number"] == receipt_no
        assert Decimal(str(rcpt_data["amount"])) == Decimal("250.00")
        assert len(rcpt_data["digital_verification_hash"]) == 64

        # 5. Check application status transitioned to FEE_PAID
        app_check = client.get(
            f"/api/v1/tenants/IN-DL/applications/{app_id}",
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert app_check.status_code == 200
        assert app_check.json()["current_status"] == "FEE_PAID"

    def test_direct_webhook_hmac_verification_flow(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        """Test POST /api/v1/payments/webhook with real HMAC-SHA256 signature."""
        app_id = self._setup_assessed_application(client, seed_data, auth_headers)

        # 1. Initiate payment
        init_resp = client.post(
            "/api/v1/tenants/IN-DL/payments/initiate",
            json={
                "application_id": app_id,
                "payment_method": "ONLINE_GATEWAY",
            },
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert init_resp.status_code == 201
        payment_id = init_resp.json()["payment_id"]

        # 2. Construct signed webhook callback
        gateway = MockPaymentGateway()
        _, raw_json_str, signature_header = gateway.simulate_webhook_event(
            payment_id=payment_id,
            amount=Decimal("250.00"),
            status="SUCCESS",
        )

        # 3. Post to webhook endpoint
        webhook_resp = client.post(
            "/api/v1/payments/webhook",
            content=raw_json_str,
            headers={
                "Content-Type": "application/json",
                "X-Gateway-Signature": signature_header,
            },
        )
        assert webhook_resp.status_code == 200
        tx_data = webhook_resp.json()
        assert tx_data["status"] == "RECONCILED"
        assert tx_data["receipt_number"] is not None

    def test_webhook_rejection_on_invalid_signature(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        """Verify webhook rejects forged signatures with 422 Unprocessable Content."""
        app_id = self._setup_assessed_application(client, seed_data, auth_headers)

        init_resp = client.post(
            "/api/v1/payments/initiate",
            json={"application_id": app_id},
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        payment_id = init_resp.json()["payment_id"]

        forged_payload = json.dumps({
            "event_id": "EVT-FORGED-01",
            "event_type": "payment.authorized",
            "payment_id": payment_id,
            "gateway_transaction_id": "TXN-FORGED",
            "amount": "250.00",
            "currency": "INR",
            "status": "SUCCESS",
            "timestamp": int(time.time()),
        })

        resp = client.post(
            "/api/v1/payments/webhook",
            content=forged_payload,
            headers={
                "Content-Type": "application/json",
                "X-Gateway-Signature": "t=1724410800,v1=bad_signature_digest_12345",
            },
        )
        assert resp.status_code in (422, 400)

    def test_duplicate_payment_prevention(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        """Verify attempting to initiate payment on already reconciled application is rejected."""
        app_id = self._setup_assessed_application(client, seed_data, auth_headers)

        # 1. First payment
        init_resp = client.post(
            "/api/v1/payments/initiate",
            json={"application_id": app_id},
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        payment_id = init_resp.json()["payment_id"]

        # Complete payment
        client.post(
            "/api/v1/payments/mock-complete",
            json={"payment_id": payment_id, "status": "SUCCESS"},
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )

        # 2. Attempt second payment initiation on the same application
        dup_resp = client.post(
            "/api/v1/payments/initiate",
            json={"application_id": app_id},
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert dup_resp.status_code in (409, 422)

    def test_cross_tenant_payment_access_isolation(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        """Verify user in Maharashtra (IN-MH) cannot access payment details in Delhi (IN-DL)."""
        app_id = self._setup_assessed_application(client, seed_data, auth_headers)

        init_resp = client.post(
            "/api/v1/payments/initiate",
            json={"application_id": app_id},
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        payment_id = init_resp.json()["payment_id"]

        # Cross-tenant access attempt with MH credentials
        cross_resp = client.get(
            f"/api/v1/tenants/IN-MH/payments/{payment_id}",
            headers=auth_headers("user_mh_01", tenant_id="IN-MH", role=RoleEnum.OWNER),
        )
        assert cross_resp.status_code in (403, 404)
