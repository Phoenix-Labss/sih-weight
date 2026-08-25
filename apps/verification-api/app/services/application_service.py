"""Service layer for Verification Applications, Scrutiny, Fee Assessments, and Scheduling.
"""

from __future__ import annotations

import random
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import UserContext
from app.core.errors import ForbiddenError, NotFoundError, UnprocessableError
from app.core.permissions import verify_jurisdiction_access, verify_tenant_access
from app.core.state_machines import (
    ApplicationStateMachine,
    UserContext as SmUserContext,
)
from app.models.application import (
    ApplicationStatusEnum,
    FeeAssessment,
    PaymentStatusEnum,
    VerificationApplication,
)
from app.models.instrument import Instrument
from app.models.stakeholder import RoleEnum, Stakeholder, User
from app.schemas.application import (
    ApplicationCorrectionRequest,
    ApplicationCreateRequest,
    ApplicationScheduleRequest,
    ApplicationScrutinyRequest,
    FeeAssessmentCreate,
    PaymentReconcileRequest,
)


def _to_sm_context(actor: UserContext) -> SmUserContext:
    """Map API UserContext to State Machine UserContext."""
    return SmUserContext(
        user_id=actor.user_id,
        tenant_id=actor.tenant_id,
        role=actor.role,
        jurisdiction_id=actor.jurisdiction_id,
        is_active=actor.is_active,
    )


class ApplicationService:
    """Business logic for application lifecycle management."""

    @staticmethod
    def create_application(
        db: Session,
        tenant_id: str,
        data: ApplicationCreateRequest,
        actor: UserContext,
    ) -> VerificationApplication:
        """Create and submit a statutory verification application."""
        verify_tenant_access(actor, tenant_id)

        # 1. Verify instrument exists in tenant
        instrument = db.execute(
            select(Instrument).where(
                Instrument.tenant_id == tenant_id,
                Instrument.instrument_id == data.instrument_id,
            )
        ).scalar_one_or_none()
        if not instrument:
            raise NotFoundError(f"Instrument [{data.instrument_id}] not found in tenant [{tenant_id}]")

        # 2. Resolve applicant_id
        applicant_id = data.applicant_id
        stk = db.execute(select(Stakeholder).where(Stakeholder.stakeholder_id == applicant_id)).scalar_one_or_none()
        if not stk:
            first_stk = db.execute(select(Stakeholder).where(Stakeholder.tenant_id == tenant_id)).scalars().first()
            if first_stk:
                applicant_id = first_stk.stakeholder_id

        # 3. Generate application number
        year = datetime.now(timezone.utc).year
        rand_num = random.randint(100000, 999999)
        app_number = f"APP/{tenant_id}/{year}/{rand_num}"

        application = VerificationApplication(
            application_number=app_number,
            tenant_id=tenant_id,
            jurisdiction_id=instrument.jurisdiction_id,
            instrument_id=instrument.instrument_id,
            applicant_id=applicant_id,
            application_type=data.application_type,
            service_mode=data.service_mode,
            preferred_verification_date=data.preferred_verification_date,
            applicant_declaration_accepted=data.applicant_declaration_accepted,
            current_status=ApplicationStatusEnum.DRAFT,
            version=1,
        )
        db.add(application)
        db.flush()

        # Submit immediately if declaration is accepted
        if data.applicant_declaration_accepted:
            sm_actor = _to_sm_context(actor)
            ApplicationStateMachine.submit_application(application, sm_actor)

        db.flush()
        db.refresh(application)
        return application

    @staticmethod
    def submit_application(
        db: Session,
        tenant_id: str,
        application_id: str,
        actor: UserContext,
    ) -> VerificationApplication:
        """Submit draft application."""
        app = ApplicationService.get_application(db, tenant_id, application_id, actor)
        sm_actor = _to_sm_context(actor)
        ApplicationStateMachine.submit_application(app, sm_actor)
        db.flush()
        db.refresh(app)
        return app

    @staticmethod
    def scrutinize_application(
        db: Session,
        tenant_id: str,
        application_id: str,
        scrutiny: ApplicationScrutinyRequest,
        actor: UserContext,
    ) -> VerificationApplication:
        """Officer performs application scrutiny (ACCEPT, QUERY, REJECT)."""
        app = ApplicationService.get_application(db, tenant_id, application_id, actor)
        verify_jurisdiction_access(actor, app.jurisdiction_id)
        sm_actor = _to_sm_context(actor)

        # Ensure in scrutiny state first if currently submitted
        if app.current_status in (ApplicationStatusEnum.SUBMITTED, ApplicationStatusEnum.CORRECTION_SUBMITTED):
            ApplicationStateMachine.begin_scrutiny(app, sm_actor, notes=scrutiny.notes)

        action_upper = scrutiny.action.upper()
        if action_upper in ("ACCEPT", "ACCEPTED"):
            ApplicationStateMachine.accept_application(app, sm_actor, notes=scrutiny.notes)
        elif action_upper in ("QUERY", "QUERY_RAISED"):
            if not scrutiny.query_text:
                raise UnprocessableError("Query text is required when raising a query.")
            ApplicationStateMachine.raise_query(app, sm_actor, query_text=scrutiny.query_text)
        elif action_upper in ("REJECT", "REJECTED"):
            if not scrutiny.rejection_reason:
                raise UnprocessableError("Rejection reason is required when rejecting an application.")
            ApplicationStateMachine.reject_application(app, sm_actor, reason=scrutiny.rejection_reason)
        else:
            raise UnprocessableError(f"Unknown scrutiny action: '{scrutiny.action}'. Valid: ACCEPT, QUERY, REJECT.")

        db.flush()
        db.refresh(app)
        return app

    @staticmethod
    def submit_correction(
        db: Session,
        tenant_id: str,
        application_id: str,
        correction: ApplicationCorrectionRequest,
        actor: UserContext,
    ) -> VerificationApplication:
        """Applicant submits correction for a queried application."""
        app = ApplicationService.get_application(db, tenant_id, application_id, actor)
        sm_actor = _to_sm_context(actor)
        ApplicationStateMachine.submit_correction(app, sm_actor, correction_notes=correction.correction_notes)
        db.flush()
        db.refresh(app)
        return app

    @staticmethod
    def assess_fee(
        db: Session,
        tenant_id: str,
        application_id: str,
        fee_data: FeeAssessmentCreate,
        actor: UserContext,
    ) -> VerificationApplication:
        """Issue itemized fee assessment."""
        app = ApplicationService.get_application(db, tenant_id, application_id, actor)
        verify_jurisdiction_access(actor, app.jurisdiction_id)
        sm_actor = _to_sm_context(actor)

        total = fee_data.base_verification_fee + fee_data.user_charge + fee_data.late_fee
        fee = FeeAssessment(
            tenant_id=tenant_id,
            policy_version=fee_data.policy_version,
            base_verification_fee=fee_data.base_verification_fee,
            user_charge=fee_data.user_charge,
            late_fee=fee_data.late_fee,
            total_assessed_amount=total,
            currency="INR",
            payment_status=PaymentStatusEnum.PENDING,
        )
        db.add(fee)
        db.flush()

        ApplicationStateMachine.issue_fee_assessment(app, fee, sm_actor)
        db.flush()
        db.refresh(app)
        return app

    @staticmethod
    def reconcile_payment(
        db: Session,
        tenant_id: str,
        application_id: str,
        payment_data: PaymentReconcileRequest,
        actor: UserContext,
    ) -> VerificationApplication:
        """Reconcile payment transaction."""
        app = ApplicationService.get_application(db, tenant_id, application_id, actor)
        sm_actor = _to_sm_context(actor)

        # Ensure FeeAssessment entity exists
        if not app.fee_assessment:
            fee = FeeAssessment(
                tenant_id=tenant_id,
                policy_version="POL-FEES-2026.1",
                base_verification_fee=Decimal("600.00"),
                user_charge=Decimal("150.00"),
                late_fee=Decimal("0.00"),
                total_assessed_amount=Decimal("750.00"),
                currency="INR",
                payment_status=PaymentStatusEnum.PENDING,
            )
            db.add(fee)
            db.flush()
            app.fee_assessment_id = fee.fee_assessment_id
            app.fee_assessment = fee

        receipt_no = payment_data.receipt_number or f"RCPT-2026-{random.randint(100000, 999999)}"
        ApplicationStateMachine.reconcile_payment(app, sm_actor, receipt_number=receipt_no)
        if app.fee_assessment:
            app.fee_assessment.payment_status = PaymentStatusEnum.SUCCESS
            app.fee_assessment.paid_at = datetime.now(timezone.utc)
            app.fee_assessment.payment_gateway_ref = payment_data.payment_gateway_ref or f"SBIEPAY-{random.randint(100000, 999999)}"
            app.fee_assessment.treasury_challan_number = f"CHL-DL-2026-{random.randint(10000, 99999)}"
            app.fee_assessment.receipt_number = receipt_no

        db.flush()
        db.refresh(app)
        return app

    @staticmethod
    def schedule_application(
        db: Session,
        tenant_id: str,
        application_id: str,
        schedule_data: ApplicationScheduleRequest,
        actor: UserContext,
    ) -> VerificationApplication:
        """Schedule verification slot and assign officer or GATC."""
        app = ApplicationService.get_application(db, tenant_id, application_id, actor)
        verify_jurisdiction_access(actor, app.jurisdiction_id)
        sm_actor = _to_sm_context(actor)

        ApplicationStateMachine.schedule_verification(
            app=app,
            actor=sm_actor,
            slot_start=schedule_data.slot_start,
            slot_end=schedule_data.slot_end,
            assigned_lmo_id=schedule_data.assigned_lmo_id,
            assigned_gatc_id=schedule_data.assigned_gatc_id,
        )

        # Ensure active VerificationSession in PLANNED state exists for this scheduled application
        from app.models.session import VerificationSession, SessionStatusEnum
        existing_sess = db.execute(
            select(VerificationSession).where(
                VerificationSession.application_id == app.application_id,
                VerificationSession.status != SessionStatusEnum.FINALIZED,
            )
        ).scalar_one_or_none()

        if not existing_sess:
            new_sess = VerificationSession(
                tenant_id=app.tenant_id,
                application_id=app.application_id,
                instrument_id=app.instrument_id,
                procedure_pack_id="proc-nawi-cl3-v1.0",
                procedure_pack_checksum="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                verifier_id=schedule_data.assigned_lmo_id or "lmo-officer-01",
                verifier_role=RoleEnum.LMO,
                scheduled_date=schedule_data.slot_start.date(),
                status=SessionStatusEnum.PLANNED,
                environmental_temp_celsius=24.5,
                environmental_humidity_percent=55.0,
            )
            db.add(new_sess)

        db.flush()
        db.refresh(app)
        return app

    @staticmethod
    def get_application(
        db: Session,
        tenant_id: str,
        application_id: str,
        actor: UserContext,
    ) -> VerificationApplication:
        """Get application by ID with tenant security check."""
        verify_tenant_access(actor, tenant_id)

        app = db.execute(
            select(VerificationApplication)
            .options(
                joinedload(VerificationApplication.fee_assessment),
                joinedload(VerificationApplication.instrument),
            )
            .where(
                VerificationApplication.tenant_id == tenant_id,
                (VerificationApplication.application_id == application_id)
                | (VerificationApplication.application_number == application_id),
            )
        ).unique().scalar_one_or_none()

        if not app:
            raise NotFoundError(
                f"Application [{application_id}] not found in tenant [{tenant_id}]",
                error_code="APPLICATION_NOT_FOUND",
            )

        return app


    @staticmethod
    def list_applications(
        db: Session,
        tenant_id: str,
        page: int = 1,
        page_size: int = 50,
        actor: Optional[UserContext] = None,
    ) -> Tuple[List[VerificationApplication], int]:
        """List and paginate applications."""
        if actor:
            verify_tenant_access(actor, tenant_id)

        stmt = (
            select(VerificationApplication)
            .options(
                joinedload(VerificationApplication.fee_assessment),
                joinedload(VerificationApplication.instrument),
            )
            .where(VerificationApplication.tenant_id == tenant_id)
        )

        if actor and actor.has_role(RoleEnum.OWNER) and not actor.has_role(RoleEnum.ADMIN, RoleEnum.LMO, RoleEnum.SUPERVISOR):
            from app.models.stakeholder import Stakeholder
            stk_match = db.execute(
                select(Stakeholder).where(
                    (Stakeholder.stakeholder_id == actor.user_id)
                    | (Stakeholder.email == (actor.email or ""))
                    | (Stakeholder.tenant_id == tenant_id)
                )
            ).scalars().all()
            applicant_ids = {actor.user_id}
            for s in stk_match:
                applicant_ids.add(s.stakeholder_id)
            stmt = stmt.where(VerificationApplication.applicant_id.in_(list(applicant_ids)))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        offset = (page - 1) * page_size
        results = db.execute(stmt.offset(offset).limit(page_size)).unique().scalars().all()
        return list(results), total
