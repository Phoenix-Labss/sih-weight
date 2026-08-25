"""Adversarial and negative test suite for illegal state bypasses, unauthorized roles, and cross-tenant access."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest

from app.core.state_machines import (
    ApplicationStateMachine,
    CertificateStateMachine,
    VerificationSessionStateMachine,
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
from app.models.certificate import (
    Certificate,
    CertificateStatusEnum,
)
from app.models.session import (
    SessionStatusEnum,
    VerificationOutcomeEnum,
    VerificationSession,
)
from app.models.stakeholder import RoleEnum


class TestApplicationIllegalBypasses:
    """Test suite ensuring all invalid transitions across the Application state graph are rejected."""

    @pytest.fixture
    def applicant_ctx(self):
        return UserContext(user_id="u1", tenant_id="IN-DL", role=RoleEnum.APPLICANT)

    @pytest.fixture
    def lmo_ctx(self):
        return UserContext(user_id="u2", tenant_id="IN-DL", role=RoleEnum.LMO)

    @pytest.fixture
    def cross_tenant_lmo(self):
        return UserContext(user_id="u3", tenant_id="IN-MH", role=RoleEnum.LMO)

    def test_draft_cannot_skip_to_scheduled(self, applicant_ctx, lmo_ctx):
        """Illegal bypass: DRAFT cannot directly transition to SCHEDULED."""
        app = VerificationApplication(
            application_id="app-b1",
            application_number="DL/APP/B1",
            tenant_id="IN-DL",
            jurisdiction_id="DL-01",
            instrument_id="inst-1",
            applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
            service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.DRAFT,
        )
        now = datetime.now(timezone.utc)
        with pytest.raises(InvalidStateTransitionError) as exc:
            ApplicationStateMachine.schedule_verification(
                app,
                lmo_ctx,
                slot_start=now + timedelta(days=1),
                slot_end=now + timedelta(days=1, hours=2),
                assigned_lmo_id="lmo-1",
            )
        assert exc.value.details["current_state"] == "DRAFT"
        assert exc.value.details["attempted_action"] == "SCHEDULE_VERIFICATION"

    def test_draft_cannot_skip_to_completed(self, applicant_ctx, lmo_ctx):
        """Illegal bypass: DRAFT cannot directly transition to COMPLETED."""
        app = VerificationApplication(
            application_id="app-b2",
            application_number="DL/APP/B2",
            tenant_id="IN-DL",
            jurisdiction_id="DL-01",
            instrument_id="inst-1",
            applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
            service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.DRAFT,
        )
        session = VerificationSession(
            session_id="s1",
            tenant_id="IN-DL",
            application_id=app.application_id,
            instrument_id="inst-1",
            procedure_pack_id="P1",
            procedure_pack_checksum="a"*64,
            verifier_id="v1",
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.FINALIZED,
        )
        with pytest.raises(InvalidStateTransitionError):
            ApplicationStateMachine.complete_application(app, session, lmo_ctx)

    def test_fee_pending_cannot_skip_to_scheduled_without_payment(self, lmo_ctx):
        """Illegal bypass: FEE_PENDING cannot be scheduled until payment is reconciled."""
        app = VerificationApplication(
            application_id="app-b3",
            application_number="DL/APP/B3",
            tenant_id="IN-DL",
            jurisdiction_id="DL-01",
            instrument_id="inst-1",
            applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
            service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.FEE_PENDING,
        )
        now = datetime.now(timezone.utc)
        with pytest.raises(InvalidStateTransitionError):
            ApplicationStateMachine.schedule_verification(
                app,
                lmo_ctx,
                slot_start=now + timedelta(days=1),
                slot_end=now + timedelta(days=1, hours=2),
                assigned_lmo_id="lmo-1",
            )

    def test_cross_tenant_officer_cannot_accept_or_reject(self, cross_tenant_lmo):
        """Cross-tenant isolation: LMO from Tenant B cannot accept/reject Tenant A application."""
        app = VerificationApplication(
            application_id="app-b4",
            application_number="DL/APP/B4",
            tenant_id="IN-DL",
            jurisdiction_id="DL-01",
            instrument_id="inst-1",
            applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
            service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.UNDER_SCRUTINY,
        )
        with pytest.raises(UnauthorizedTransitionError) as exc:
            ApplicationStateMachine.accept_application(app, cross_tenant_lmo)
        assert exc.value.details["action"] == "CROSS_TENANT_ACCESS"


class TestSessionIllegalBypasses:
    """Test suite ensuring illegal bypasses across Verification Session are rejected."""

    @pytest.fixture
    def lmo_ctx(self):
        return UserContext(user_id="lmo-1", tenant_id="IN-KA", role=RoleEnum.LMO)

    @pytest.fixture
    def applicant_ctx(self):
        return UserContext(user_id="app-1", tenant_id="IN-KA", role=RoleEnum.APPLICANT)

    def test_planned_cannot_skip_to_submitted(self, lmo_ctx):
        """Illegal bypass: PLANNED cannot submit observations without confirming identity and testing."""
        session = VerificationSession(
            session_id="sess-b1",
            tenant_id="IN-KA",
            application_id="app-1",
            instrument_id="inst-1",
            procedure_pack_id="P1",
            procedure_pack_checksum="a"*64,
            verifier_id="lmo-1",
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.PLANNED,
        )
        with pytest.raises(InvalidStateTransitionError):
            VerificationSessionStateMachine.submit_observations(session, lmo_ctx, automated_evaluation_passed=True)

    def test_in_progress_cannot_skip_to_finalized(self, lmo_ctx):
        """Illegal bypass: IN_PROGRESS cannot record disposition before submitting observations."""
        session = VerificationSession(
            session_id="sess-b2",
            tenant_id="IN-KA",
            application_id="app-1",
            instrument_id="inst-1",
            procedure_pack_id="P1",
            procedure_pack_checksum="a"*64,
            verifier_id="lmo-1",
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.IN_PROGRESS,
        )
        with pytest.raises(InvalidStateTransitionError):
            VerificationSessionStateMachine.record_disposition(
                session,
                lmo_ctx,
                outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
            )

    def test_applicant_cannot_record_disposition(self, applicant_ctx):
        """Unauthorized actor: Applicant cannot record statutory verification disposition."""
        session = VerificationSession(
            session_id="sess-b3",
            tenant_id="IN-KA",
            application_id="app-1",
            instrument_id="inst-1",
            procedure_pack_id="P1",
            procedure_pack_checksum="a"*64,
            verifier_id="lmo-1",
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.SUBMITTED,
            automated_evaluation_flag=True,
        )
        with pytest.raises(UnauthorizedTransitionError):
            VerificationSessionStateMachine.record_disposition(
                session,
                applicant_ctx,
                outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
            )


class TestCertificateIllegalBypasses:
    """Test suite ensuring illegal bypasses across Certificate state machine are rejected."""

    @pytest.fixture
    def lmo_ctx(self):
        return UserContext(user_id="lmo-1", tenant_id="IN-TS", role=RoleEnum.LMO)

    @pytest.fixture
    def supervisor_ctx(self):
        return UserContext(user_id="sup-1", tenant_id="IN-TS", role=RoleEnum.SUPERVISOR)

    def test_draft_cannot_skip_to_issued_without_signing(self, lmo_ctx):
        """Illegal bypass: DRAFT cannot be directly issued without snapshot rendering and DSC binding."""
        cert = Certificate(
            certificate_id="cert-b1",
            certificate_number="LM/TS/2026/B1",
            tenant_id="IN-TS",
            session_id="s1",
            instrument_id="inst-1",
            owner_id="o1",
            procedure_pack_id="P1",
            verifier_id="v1",
            issue_date=date.today(),
            valid_until=date.today() + timedelta(days=365),
            certificate_status=CertificateStatusEnum.DRAFT,
            qr_code_payload="https://qr.gov.in/b1",
        )
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.bind_signature(cert, "DSC-1", "lmo-1", lmo_ctx)

    def test_cannot_reinstate_revoked_certificate(self, supervisor_ctx):
        """Terminal state guard: A REVOKED certificate cannot be reinstated."""
        cert = Certificate(
            certificate_id="cert-b2",
            certificate_number="LM/TS/2026/B2",
            tenant_id="IN-TS",
            session_id="s1",
            instrument_id="inst-1",
            owner_id="o1",
            procedure_pack_id="P1",
            verifier_id="v1",
            issue_date=date.today(),
            valid_until=date.today() + timedelta(days=365),
            certificate_status=CertificateStatusEnum.REVOKED,
            qr_code_payload="https://qr.gov.in/b2",
        )
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.reinstate_certificate(
                cert,
                reason="Attempting unlawful reinstatement",
                authority_ref="Fake Ref",
                actor=supervisor_ctx,
            )

    def test_lmo_cannot_revoke_certificate(self, lmo_ctx):
        """Role constraint: LMO cannot revoke certificate; only supervisor/controller has authority."""
        cert = Certificate(
            certificate_id="cert-b3",
            certificate_number="LM/TS/2026/B3",
            tenant_id="IN-TS",
            session_id="s1",
            instrument_id="inst-1",
            owner_id="o1",
            procedure_pack_id="P1",
            verifier_id="v1",
            issue_date=date.today(),
            valid_until=date.today() + timedelta(days=365),
            certificate_status=CertificateStatusEnum.ISSUED,
            qr_code_payload="https://qr.gov.in/b3",
        )
        with pytest.raises(UnauthorizedTransitionError):
            CertificateStateMachine.revoke_certificate(
                cert,
                reason="LMO trying to revoke directly",
                authority_ref="Memo 1",
                actor=lmo_ctx,
            )
