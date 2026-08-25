"""Unit tests for Verification Application state machine transitions, guards, and versioning."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest

from app.core.state_machines import (
    ApplicationStateMachine,
    UserContext,
    InvalidStateTransitionError,
    UnauthorizedTransitionError,
    GuardConditionFailedError,
)
from app.models.application import (
    ApplicationStatusEnum,
    ApplicationTypeEnum,
    FeeAssessment,
    PaymentStatusEnum,
    ServiceModeEnum,
    VerificationApplication,
)
from app.models.session import (
    SessionStatusEnum,
    VerificationOutcomeEnum,
    VerificationSession,
)
from app.models.stakeholder import RoleEnum


@pytest.fixture
def applicant_context():
    return UserContext(user_id="usr-applicant-1", tenant_id="IN-DL", role=RoleEnum.APPLICANT)


@pytest.fixture
def lmo_context():
    return UserContext(user_id="usr-lmo-1", tenant_id="IN-DL", role=RoleEnum.LMO, jurisdiction_id="DL-SWD")


@pytest.fixture
def supervisor_context():
    return UserContext(user_id="usr-supervisor-1", tenant_id="IN-DL", role=RoleEnum.SUPERVISOR, jurisdiction_id="DL-SWD")


@pytest.fixture
def other_tenant_context():
    return UserContext(user_id="usr-other-1", tenant_id="IN-MH", role=RoleEnum.LMO)


@pytest.fixture
def sample_application():
    return VerificationApplication(
        application_id="app-12345",
        application_number="DL/2026/APP-00123",
        tenant_id="IN-DL",
        jurisdiction_id="DL-SWD",
        instrument_id="inst-9988",
        applicant_id="stakeholder-44",
        application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
        service_mode=ServiceModeEnum.ON_SITE,
        current_status=ApplicationStatusEnum.DRAFT,
        applicant_declaration_accepted=True,
        version=1,
    )


class TestApplicationStateMachine:
    """Test suite covering the formal Application State Machine."""

    def test_full_successful_lifecycle(self, sample_application, applicant_context, lmo_context):
        """Test complete golden path through application states to completion."""
        app = sample_application

        # 1. Submit Application
        ApplicationStateMachine.submit_application(app, applicant_context)
        assert app.current_status == ApplicationStatusEnum.SUBMITTED

        # 2. Begin Scrutiny
        ApplicationStateMachine.begin_scrutiny(app, lmo_context, notes="Document verification in progress.")
        assert app.current_status == ApplicationStatusEnum.UNDER_SCRUTINY
        assert app.scrutiny_notes == "Document verification in progress."

        # 3. Accept Application
        ApplicationStateMachine.accept_application(app, lmo_context, notes="All model docs verified.")
        assert app.current_status == ApplicationStatusEnum.ACCEPTED

        # 4. Issue Fee Assessment
        fee = FeeAssessment(
            fee_assessment_id="fee-001",
            tenant_id="IN-DL",
            policy_version="DL-FEE-2026.1",
            base_verification_fee=Decimal("500.00"),
            total_assessed_amount=Decimal("500.00"),
            payment_status=PaymentStatusEnum.PENDING,
        )
        ApplicationStateMachine.issue_fee_assessment(app, fee, lmo_context)
        assert app.current_status == ApplicationStatusEnum.FEE_PENDING
        assert app.fee_assessment_id == "fee-001"

        # 5. Reconcile Payment
        ApplicationStateMachine.reconcile_payment(app, applicant_context, receipt_number="RCP-88991")
        assert app.current_status == ApplicationStatusEnum.FEE_PAID

        # 6. Schedule Verification
        now = datetime.now(timezone.utc)
        slot_start = now + timedelta(days=2)
        slot_end = now + timedelta(days=2, hours=2)
        ApplicationStateMachine.schedule_verification(
            app,
            lmo_context,
            slot_start=slot_start,
            slot_end=slot_end,
            assigned_lmo_id=lmo_context.user_id,
        )
        assert app.current_status == ApplicationStatusEnum.SCHEDULED
        assert app.assigned_lmo_id == lmo_context.user_id

        # 7. Commence Testing
        ApplicationStateMachine.commence_testing(app, lmo_context)
        assert app.current_status == ApplicationStatusEnum.VERIFICATION_IN_PROGRESS

        # 8. Complete Application after Session Finalization
        session = VerificationSession(
            session_id="sess-001",
            tenant_id="IN-DL",
            application_id=app.application_id,
            instrument_id=app.instrument_id,
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            procedure_pack_checksum="a"*64,
            verifier_id=lmo_context.user_id,
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.FINALIZED,
            outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
        )
        ApplicationStateMachine.complete_application(app, session, lmo_context)
        assert app.current_status == ApplicationStatusEnum.COMPLETED

    def test_submission_declaration_guard_fails(self, sample_application, applicant_context):
        """Test submission rejection when declaration is unaccepted."""
        sample_application.applicant_declaration_accepted = False
        with pytest.raises(GuardConditionFailedError) as exc:
            ApplicationStateMachine.submit_application(sample_application, applicant_context)
        assert "declaration must be accepted" in str(exc.value)

    def test_scrutiny_query_and_correction_cycle(self, sample_application, applicant_context, lmo_context):
        """Test query raising, applicant correction submission with version bump, and re-scrutiny."""
        app = sample_application
        ApplicationStateMachine.submit_application(app, applicant_context)
        ApplicationStateMachine.begin_scrutiny(app, lmo_context)

        # Officer raises query
        ApplicationStateMachine.raise_query(app, lmo_context, query_text="Model approval certificate page 2 is missing.")
        assert app.current_status == ApplicationStatusEnum.QUERY_RAISED
        assert app.active_query == "Model approval certificate page 2 is missing."
        assert app.query_raised_at is not None

        # Applicant submits correction
        initial_version = app.version
        ApplicationStateMachine.submit_correction(app, applicant_context, correction_notes="Attached complete 4-page PDF.")
        assert app.current_status == ApplicationStatusEnum.CORRECTION_SUBMITTED
        assert app.version == initial_version + 1

        # Officer resumes scrutiny
        ApplicationStateMachine.begin_scrutiny(app, lmo_context)
        assert app.current_status == ApplicationStatusEnum.UNDER_SCRUTINY

    def test_raise_query_empty_text_fails(self, sample_application, applicant_context, lmo_context):
        """Test raising query with empty text is rejected."""
        app = sample_application
        ApplicationStateMachine.submit_application(app, applicant_context)
        ApplicationStateMachine.begin_scrutiny(app, lmo_context)

        with pytest.raises(GuardConditionFailedError) as exc:
            ApplicationStateMachine.raise_query(app, lmo_context, query_text="   ")
        assert "cannot be empty" in str(exc.value)

    def test_rejection_workflow(self, sample_application, applicant_context, lmo_context):
        """Test application rejection with reason memo."""
        app = sample_application
        ApplicationStateMachine.submit_application(app, applicant_context)
        ApplicationStateMachine.begin_scrutiny(app, lmo_context)

        ApplicationStateMachine.reject_application(app, lmo_context, reason="Instrument model is revoked by Central Government.")
        assert app.current_status == ApplicationStatusEnum.REJECTED
        assert "revoked" in app.rejection_reason

    def test_withdrawal_workflow(self, sample_application, applicant_context):
        """Test applicant cancellation prior to acceptance."""
        app = sample_application
        ApplicationStateMachine.submit_application(app, applicant_context)
        ApplicationStateMachine.withdraw_application(app, applicant_context, reason="Purchased replacement instrument.")
        assert app.current_status == ApplicationStatusEnum.WITHDRAWN

    def test_scheduling_guards(self, sample_application, applicant_context, lmo_context):
        """Test schedule verification slot time validation and assignment requirements."""
        app = sample_application
        ApplicationStateMachine.submit_application(app, applicant_context)
        ApplicationStateMachine.begin_scrutiny(app, lmo_context)
        ApplicationStateMachine.accept_application(app, lmo_context)
        fee = FeeAssessment(
            fee_assessment_id="fee-002",
            tenant_id="IN-DL",
            policy_version="DL-FEE-2026.1",
            base_verification_fee=Decimal("500.00"),
            total_assessed_amount=Decimal("500.00"),
        )
        ApplicationStateMachine.issue_fee_assessment(app, fee, lmo_context)
        ApplicationStateMachine.reconcile_payment(app, applicant_context)

        now = datetime.now(timezone.utc)
        # 1. Missing assignment
        with pytest.raises(GuardConditionFailedError) as exc:
            ApplicationStateMachine.schedule_verification(
                app,
                lmo_context,
                slot_start=now + timedelta(days=1),
                slot_end=now + timedelta(days=1, hours=2),
                assigned_lmo_id=None,
                assigned_gatc_id=None,
            )
        assert "Must assign either an LMO or GATC" in str(exc.value)

        # 2. Invalid slot interval (end before start)
        with pytest.raises(GuardConditionFailedError) as exc:
            ApplicationStateMachine.schedule_verification(
                app,
                lmo_context,
                slot_start=now + timedelta(days=1, hours=2),
                slot_end=now + timedelta(days=1),
                assigned_lmo_id=lmo_context.user_id,
            )
        assert "Slot end timestamp must be after" in str(exc.value)

    def test_unauthorized_role_rejected(self, sample_application, applicant_context):
        """Test applicant attempting privileged officer actions is blocked."""
        with pytest.raises(UnauthorizedTransitionError):
            ApplicationStateMachine.begin_scrutiny(sample_application, applicant_context)

    def test_cross_tenant_access_blocked(self, sample_application, other_tenant_context):
        """Test user from different State/UT cannot modify application."""
        with pytest.raises(UnauthorizedTransitionError):
            ApplicationStateMachine.begin_scrutiny(sample_application, other_tenant_context)
