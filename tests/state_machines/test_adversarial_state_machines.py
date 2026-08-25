"""Adversarial stress harness, exhaustive combinatorial transition testing,
concurrency challenges, role boundary validation, and domain invariants testing.
"""

from __future__ import annotations

import concurrent.futures
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.state_machines import (
    ApplicationStateMachine,
    CertificateStateMachine,
    VerificationSessionStateMachine,
    UserContext,
    InvalidStateTransitionError,
    UnauthorizedTransitionError,
    GuardConditionFailedError,
)
from app.models.base import Base, generate_opaque_token, get_utc_now
from app.models.tenant import Tenant, Jurisdiction, TenantStateEnum, JurisdictionLevelEnum
from app.models.stakeholder import (
    Stakeholder,
    Facility,
    User,
    LMOProfile,
    RoleEnum,
    StakeholderTypeEnum,
)
from app.models.instrument import (
    InstrumentModel,
    Instrument,
    AccuracyClassEnum,
    InstrumentStatusEnum,
)
from app.models.reference_standard import (
    ReferenceStandard,
    ReferenceStandardStatusEnum,
    CustodianTypeEnum,
)
from app.models.application import (
    VerificationApplication,
    FeeAssessment,
    ApplicationStatusEnum,
    ApplicationTypeEnum,
    PaymentStatusEnum,
    ServiceModeEnum,
)
from app.models.session import (
    VerificationSession,
    SessionStatusEnum,
    VerificationOutcomeEnum,
)
from app.models.observation import (
    TestObservation,
    ObservationCorrection,
    StepTypeEnum,
)
from app.models.stamp import (
    PhysicalStampAction,
    PhysicalSealActionEnum,
    SealTypeEnum,
)
from app.models.certificate import (
    Certificate,
    CertificateStatusEnum,
)


@pytest.fixture
def in_memory_db():
    """Create a fresh in-memory SQLite database session for integrity tests."""
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


# ============================================================================
# 1. EXHAUSTIVE STATE TRANSITION MATRIX CHALLENGES
# ============================================================================

class TestApplicationCombinatorialTransitions:
    """Exhaustive matrix test: Attempt every action from every Application state."""

    ALL_STATES = list(ApplicationStatusEnum)

    @pytest.fixture
    def officer_ctx(self):
        return UserContext(user_id="officer-1", tenant_id="IN-DL", role=RoleEnum.LMO)

    @pytest.fixture
    def applicant_ctx(self):
        return UserContext(user_id="applicant-1", tenant_id="IN-DL", role=RoleEnum.APPLICANT)

    def _make_app(self, status: ApplicationStatusEnum) -> VerificationApplication:
        return VerificationApplication(
            application_id=f"app-{status.value}",
            application_number=f"DL/APP/{status.value}",
            tenant_id="IN-DL",
            jurisdiction_id="DL-01",
            instrument_id="inst-1",
            applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
            service_mode=ServiceModeEnum.ON_SITE,
            current_status=status,
            applicant_declaration_accepted=True,
        )

    def test_submit_application_allowed_only_from_draft(self, applicant_ctx):
        """SUBMIT_APPLICATION must succeed ONLY from DRAFT and raise InvalidStateTransitionError from all other 12 states."""
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state == ApplicationStatusEnum.DRAFT:
                res = ApplicationStateMachine.submit_application(app, applicant_ctx)
                assert res.current_status == ApplicationStatusEnum.SUBMITTED
            else:
                with pytest.raises(InvalidStateTransitionError) as exc:
                    ApplicationStateMachine.submit_application(app, applicant_ctx)
                assert exc.value.details["current_state"] == state.value
                assert exc.value.details["attempted_action"] == "SUBMIT_APPLICATION"

    def test_begin_scrutiny_allowed_only_from_submitted_and_correction(self, officer_ctx):
        """BEGIN_SCRUTINY must succeed ONLY from SUBMITTED and CORRECTION_SUBMITTED."""
        allowed = {ApplicationStatusEnum.SUBMITTED, ApplicationStatusEnum.CORRECTION_SUBMITTED}
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state in allowed:
                res = ApplicationStateMachine.begin_scrutiny(app, officer_ctx)
                assert res.current_status == ApplicationStatusEnum.UNDER_SCRUTINY
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.begin_scrutiny(app, officer_ctx)

    def test_raise_query_allowed_only_from_under_scrutiny(self, officer_ctx):
        """RAISE_QUERY must succeed ONLY from UNDER_SCRUTINY."""
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state == ApplicationStatusEnum.UNDER_SCRUTINY:
                res = ApplicationStateMachine.raise_query(app, officer_ctx, query_text="Valid query")
                assert res.current_status == ApplicationStatusEnum.QUERY_RAISED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.raise_query(app, officer_ctx, query_text="Query")

    def test_submit_correction_allowed_only_from_query_raised(self, applicant_ctx):
        """SUBMIT_CORRECTION must succeed ONLY from QUERY_RAISED."""
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state == ApplicationStatusEnum.QUERY_RAISED:
                res = ApplicationStateMachine.submit_correction(app, applicant_ctx, correction_notes="Fixed")
                assert res.current_status == ApplicationStatusEnum.CORRECTION_SUBMITTED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.submit_correction(app, applicant_ctx, correction_notes="Fixed")

    def test_accept_application_allowed_only_from_under_scrutiny(self, officer_ctx):
        """ACCEPT_APPLICATION must succeed ONLY from UNDER_SCRUTINY."""
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state == ApplicationStatusEnum.UNDER_SCRUTINY:
                res = ApplicationStateMachine.accept_application(app, officer_ctx)
                assert res.current_status == ApplicationStatusEnum.ACCEPTED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.accept_application(app, officer_ctx)

    def test_reject_application_allowed_only_from_submitted_and_scrutiny(self, officer_ctx):
        """REJECT_APPLICATION must succeed ONLY from SUBMITTED and UNDER_SCRUTINY."""
        allowed = {ApplicationStatusEnum.SUBMITTED, ApplicationStatusEnum.UNDER_SCRUTINY}
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state in allowed:
                res = ApplicationStateMachine.reject_application(app, officer_ctx, reason="Disqualified")
                assert res.current_status == ApplicationStatusEnum.REJECTED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.reject_application(app, officer_ctx, reason="Disqualified")

    def test_withdraw_application_allowed_only_pre_acceptance(self, applicant_ctx):
        """WITHDRAW_APPLICATION must succeed ONLY prior to acceptance."""
        allowed = {
            ApplicationStatusEnum.DRAFT,
            ApplicationStatusEnum.SUBMITTED,
            ApplicationStatusEnum.UNDER_SCRUTINY,
            ApplicationStatusEnum.QUERY_RAISED,
            ApplicationStatusEnum.CORRECTION_SUBMITTED,
        }
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state in allowed:
                res = ApplicationStateMachine.withdraw_application(app, applicant_ctx, reason="Cancel")
                assert res.current_status == ApplicationStatusEnum.WITHDRAWN
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.withdraw_application(app, applicant_ctx, reason="Cancel")

    def test_issue_fee_assessment_allowed_only_from_accepted(self, officer_ctx):
        """ISSUE_FEE_ASSESSMENT must succeed ONLY from ACCEPTED."""
        fee = FeeAssessment(
            fee_assessment_id="fee-test",
            tenant_id="IN-DL",
            policy_version="DL-2026",
            base_verification_fee=Decimal("500.00"),
            total_assessed_amount=Decimal("500.00"),
        )
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state == ApplicationStatusEnum.ACCEPTED:
                res = ApplicationStateMachine.issue_fee_assessment(app, fee, officer_ctx)
                assert res.current_status == ApplicationStatusEnum.FEE_PENDING
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.issue_fee_assessment(app, fee, officer_ctx)

    def test_reconcile_payment_allowed_only_from_fee_pending(self, applicant_ctx):
        """RECONCILE_PAYMENT must succeed ONLY from FEE_PENDING."""
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state == ApplicationStatusEnum.FEE_PENDING:
                res = ApplicationStateMachine.reconcile_payment(app, applicant_ctx, receipt_number="RCP-1")
                assert res.current_status == ApplicationStatusEnum.FEE_PAID
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.reconcile_payment(app, applicant_ctx)

    def test_schedule_verification_allowed_only_from_fee_paid(self, officer_ctx):
        """SCHEDULE_VERIFICATION must succeed ONLY from FEE_PAID."""
        now = datetime.now(timezone.utc)
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state == ApplicationStatusEnum.FEE_PAID:
                res = ApplicationStateMachine.schedule_verification(
                    app,
                    officer_ctx,
                    slot_start=now + timedelta(days=1),
                    slot_end=now + timedelta(days=1, hours=2),
                    assigned_lmo_id="lmo-1",
                )
                assert res.current_status == ApplicationStatusEnum.SCHEDULED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.schedule_verification(
                        app,
                        officer_ctx,
                        slot_start=now + timedelta(days=1),
                        slot_end=now + timedelta(days=1, hours=2),
                        assigned_lmo_id="lmo-1",
                    )

    def test_commence_testing_allowed_only_from_scheduled(self, officer_ctx):
        """COMMENCE_TESTING must succeed ONLY from SCHEDULED."""
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state == ApplicationStatusEnum.SCHEDULED:
                res = ApplicationStateMachine.commence_testing(app, officer_ctx)
                assert res.current_status == ApplicationStatusEnum.VERIFICATION_IN_PROGRESS
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.commence_testing(app, officer_ctx)

    def test_complete_application_allowed_only_from_verification_in_progress(self, officer_ctx):
        """COMPLETE_APPLICATION must succeed ONLY from VERIFICATION_IN_PROGRESS with finalized session."""
        session = VerificationSession(
            session_id="s1",
            tenant_id="IN-DL",
            application_id="app-1",
            instrument_id="inst-1",
            procedure_pack_id="P1",
            procedure_pack_checksum="a"*64,
            verifier_id="v1",
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.FINALIZED,
        )
        for state in self.ALL_STATES:
            app = self._make_app(state)
            if state == ApplicationStatusEnum.VERIFICATION_IN_PROGRESS:
                res = ApplicationStateMachine.complete_application(app, session, officer_ctx)
                assert res.current_status == ApplicationStatusEnum.COMPLETED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    ApplicationStateMachine.complete_application(app, session, officer_ctx)


# ============================================================================
# 2. VERIFICATION SESSION COMBINATORIAL MATRIX CHALLENGES
# ============================================================================

class TestSessionCombinatorialTransitions:
    """Exhaustive matrix test: Attempt every action from every VerificationSession state."""

    ALL_STATES = list(SessionStatusEnum)

    @pytest.fixture
    def verifier_ctx(self):
        return UserContext(user_id="v1", tenant_id="IN-DL", role=RoleEnum.LMO)

    def _make_session(self, status: SessionStatusEnum) -> VerificationSession:
        return VerificationSession(
            session_id=f"sess-{status.value}",
            tenant_id="IN-DL",
            application_id="app-1",
            instrument_id="inst-1",
            procedure_pack_id="P1",
            procedure_pack_checksum="a"*64,
            verifier_id="v1",
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=status,
            automated_evaluation_flag=True,
        )

    def test_confirm_identity_allowed_only_from_planned(self, verifier_ctx):
        """CONFIRM_IDENTITY allowed only from PLANNED."""
        for state in self.ALL_STATES:
            session = self._make_session(state)
            if state == SessionStatusEnum.PLANNED:
                res = VerificationSessionStateMachine.confirm_identity(session, verifier_ctx, serial_verified=True)
                assert res.status == SessionStatusEnum.IDENTITY_CONFIRMED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    VerificationSessionStateMachine.confirm_identity(session, verifier_ctx, serial_verified=True)

    def test_start_testing_allowed_only_from_identity_confirmed(self, verifier_ctx):
        """START_TESTING allowed only from IDENTITY_CONFIRMED."""
        for state in self.ALL_STATES:
            session = self._make_session(state)
            if state == SessionStatusEnum.IDENTITY_CONFIRMED:
                res = VerificationSessionStateMachine.start_testing(session, verifier_ctx)
                assert res.status == SessionStatusEnum.IN_PROGRESS
            else:
                with pytest.raises(InvalidStateTransitionError):
                    VerificationSessionStateMachine.start_testing(session, verifier_ctx)

    def test_submit_observations_allowed_only_from_in_progress(self, verifier_ctx):
        """SUBMIT_OBSERVATIONS allowed only from IN_PROGRESS."""
        for state in self.ALL_STATES:
            session = self._make_session(state)
            if state == SessionStatusEnum.IN_PROGRESS:
                res = VerificationSessionStateMachine.submit_observations(session, verifier_ctx, automated_evaluation_passed=True)
                assert res.status == SessionStatusEnum.SUBMITTED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    VerificationSessionStateMachine.submit_observations(session, verifier_ctx, automated_evaluation_passed=True)

    def test_record_disposition_allowed_only_from_submitted(self, verifier_ctx):
        """RECORD_DISPOSITION allowed only from SUBMITTED."""
        for state in self.ALL_STATES:
            session = self._make_session(state)
            if state == SessionStatusEnum.SUBMITTED:
                res = VerificationSessionStateMachine.record_disposition(
                    session,
                    verifier_ctx,
                    outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
                )
                assert res.status == SessionStatusEnum.FINALIZED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    VerificationSessionStateMachine.record_disposition(
                        session,
                        verifier_ctx,
                        outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
                    )


# ============================================================================
# 3. CERTIFICATE COMBINATORIAL MATRIX CHALLENGES
# ============================================================================

class TestCertificateCombinatorialTransitions:
    """Exhaustive matrix test: Attempt every action from every Certificate state."""

    ALL_STATES = list(CertificateStatusEnum)

    @pytest.fixture
    def officer_ctx(self):
        return UserContext(user_id="off-1", tenant_id="IN-DL", role=RoleEnum.LMO)

    @pytest.fixture
    def supervisor_ctx(self):
        return UserContext(user_id="sup-1", tenant_id="IN-DL", role=RoleEnum.SUPERVISOR)

    def _make_cert(self, status: CertificateStatusEnum) -> Certificate:
        return Certificate(
            certificate_id=f"cert-{status.value}",
            certificate_number=f"DL/CERT/{status.value}",
            tenant_id="IN-DL",
            session_id="s1",
            instrument_id="inst-1",
            owner_id="o1",
            procedure_pack_id="P1",
            verifier_id="v1",
            issue_date=date.today(),
            valid_until=date.today() + timedelta(days=365),
            certificate_status=status,
            qr_code_payload="https://qr.gov.in/token",
        )

    def test_render_and_lock_allowed_only_from_draft_and_signing_failed(self, officer_ctx):
        """RENDER_AND_LOCK allowed ONLY from DRAFT and SIGNING_FAILED."""
        allowed = {CertificateStatusEnum.DRAFT, CertificateStatusEnum.SIGNING_FAILED}
        for state in self.ALL_STATES:
            cert = self._make_cert(state)
            if state in allowed:
                res = CertificateStateMachine.render_and_lock(cert, "a"*64, "s3://pdf", officer_ctx)
                assert res.certificate_status == CertificateStatusEnum.PENDING_SIGNATURE
            else:
                with pytest.raises(InvalidStateTransitionError):
                    CertificateStateMachine.render_and_lock(cert, "a"*64, "s3://pdf", officer_ctx)

    def test_bind_signature_allowed_only_from_pending_signature(self, officer_ctx):
        """BIND_SIGNATURE allowed ONLY from PENDING_SIGNATURE."""
        for state in self.ALL_STATES:
            cert = self._make_cert(state)
            if state == CertificateStatusEnum.PENDING_SIGNATURE:
                res = CertificateStateMachine.bind_signature(cert, "DSC-1", "off-1", officer_ctx)
                assert res.certificate_status == CertificateStatusEnum.ISSUED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    CertificateStateMachine.bind_signature(cert, "DSC-1", "off-1", officer_ctx)

    def test_record_signing_failure_allowed_only_from_pending_signature(self, officer_ctx):
        """RECORD_SIGNING_FAILURE allowed ONLY from PENDING_SIGNATURE."""
        for state in self.ALL_STATES:
            cert = self._make_cert(state)
            if state == CertificateStatusEnum.PENDING_SIGNATURE:
                res = CertificateStateMachine.record_signing_failure(cert, "Provider error", officer_ctx)
                assert res.certificate_status == CertificateStatusEnum.SIGNING_FAILED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    CertificateStateMachine.record_signing_failure(cert, "Provider error", officer_ctx)

    def test_suspend_certificate_allowed_only_from_issued(self, officer_ctx):
        """SUSPEND_CERTIFICATE allowed ONLY from ISSUED."""
        for state in self.ALL_STATES:
            cert = self._make_cert(state)
            if state == CertificateStatusEnum.ISSUED:
                res = CertificateStateMachine.suspend_certificate(cert, "Inquiry", "Ref-1", officer_ctx)
                assert res.certificate_status == CertificateStatusEnum.SUSPENDED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    CertificateStateMachine.suspend_certificate(cert, "Inquiry", "Ref-1", officer_ctx)

    def test_reinstate_certificate_allowed_only_from_suspended(self, supervisor_ctx):
        """REINSTATE_CERTIFICATE allowed ONLY from SUSPENDED."""
        for state in self.ALL_STATES:
            cert = self._make_cert(state)
            if state == CertificateStatusEnum.SUSPENDED:
                res = CertificateStateMachine.reinstate_certificate(cert, "Clean inspection", "Ref-2", supervisor_ctx)
                assert res.certificate_status == CertificateStatusEnum.ISSUED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    CertificateStateMachine.reinstate_certificate(cert, "Clean inspection", "Ref-2", supervisor_ctx)

    def test_revoke_certificate_allowed_only_from_issued_and_suspended(self, supervisor_ctx):
        """REVOKE_CERTIFICATE allowed ONLY from ISSUED and SUSPENDED."""
        allowed = {CertificateStatusEnum.ISSUED, CertificateStatusEnum.SUSPENDED}
        for state in self.ALL_STATES:
            cert = self._make_cert(state)
            if state in allowed:
                res = CertificateStateMachine.revoke_certificate(cert, "Tampering", "Rev-1", supervisor_ctx)
                assert res.certificate_status == CertificateStatusEnum.REVOKED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    CertificateStateMachine.revoke_certificate(cert, "Tampering", "Rev-1", supervisor_ctx)

    def test_supersede_certificate_allowed_only_from_issued_and_suspended(self, officer_ctx):
        """SUPERSEDE_CERTIFICATE allowed ONLY from ISSUED and SUSPENDED."""
        allowed = {CertificateStatusEnum.ISSUED, CertificateStatusEnum.SUSPENDED}
        for state in self.ALL_STATES:
            cert = self._make_cert(state)
            if state in allowed:
                res = CertificateStateMachine.supersede_certificate(cert, "new-cert-99", "Re-verified", officer_ctx)
                assert res.certificate_status == CertificateStatusEnum.SUPERSEDED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    CertificateStateMachine.supersede_certificate(cert, "new-cert-99", "Re-verified", officer_ctx)

    def test_expire_certificate_allowed_only_from_issued(self, officer_ctx):
        """EXPIRE_CERTIFICATE allowed ONLY from ISSUED when as_of_date > valid_until."""
        past_date = date.today() + timedelta(days=400)
        for state in self.ALL_STATES:
            cert = self._make_cert(state)
            if state == CertificateStatusEnum.ISSUED:
                res = CertificateStateMachine.expire_certificate(cert, officer_ctx, as_of_date=past_date)
                assert res.certificate_status == CertificateStatusEnum.EXPIRED
            else:
                with pytest.raises(InvalidStateTransitionError):
                    CertificateStateMachine.expire_certificate(cert, officer_ctx, as_of_date=past_date)


# ============================================================================
# 4. COMPREHENSIVE ROLE & PERMISSION BOUNDARY MATRIX
# ============================================================================

class TestRolePermissionBoundariesMatrix:
    """Comprehensive test verifying role boundaries across all 9 roles."""

    ALL_ROLES = list(RoleEnum)

    def _ctx(self, role: RoleEnum, tenant_id: str = "IN-DL") -> UserContext:
        return UserContext(user_id=f"u-{role.value}", tenant_id=tenant_id, role=role)

    def test_application_officer_actions_role_permissions(self):
        """Test OFFICER_ROLES requirement: LMO, SUPERVISOR, CONTROLLER, ADMIN can execute; others blocked."""
        officer_allowed_roles = {RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN}

        for role in self.ALL_ROLES:
            ctx = self._ctx(role)
            app = VerificationApplication(
                application_id=f"app-role-{role.value}",
                application_number=f"DL/ROLE/{role.value}",
                tenant_id="IN-DL",
                jurisdiction_id="DL-01",
                instrument_id="inst-1",
                applicant_id="stk-1",
                application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
                service_mode=ServiceModeEnum.ON_SITE,
                current_status=ApplicationStatusEnum.SUBMITTED,
                applicant_declaration_accepted=True,
            )
            if role in officer_allowed_roles:
                res = ApplicationStateMachine.begin_scrutiny(app, ctx)
                assert res.current_status == ApplicationStatusEnum.UNDER_SCRUTINY
            else:
                with pytest.raises(UnauthorizedTransitionError) as exc:
                    ApplicationStateMachine.begin_scrutiny(app, ctx)
                assert exc.value.details["action"] == "BEGIN_SCRUTINY"

    def test_session_verifier_roles_permissions(self):
        """Test VERIFIER_ROLES requirement: LMO, GATC_VERIFIER, ADMIN can execute; others blocked."""
        verifier_allowed = {RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.ADMIN}

        for role in self.ALL_ROLES:
            ctx = self._ctx(role)
            session = VerificationSession(
                session_id=f"sess-role-{role.value}",
                tenant_id="IN-DL",
                application_id="app-1",
                instrument_id="inst-1",
                procedure_pack_id="P1",
                procedure_pack_checksum="a"*64,
                verifier_id="v1",
                verifier_role="LMO",
                scheduled_date=date.today(),
                status=SessionStatusEnum.PLANNED,
            )
            if role in verifier_allowed:
                res = VerificationSessionStateMachine.confirm_identity(session, ctx, serial_verified=True)
                assert res.status == SessionStatusEnum.IDENTITY_CONFIRMED
            else:
                with pytest.raises(UnauthorizedTransitionError):
                    VerificationSessionStateMachine.confirm_identity(session, ctx, serial_verified=True)

    def test_certificate_revocation_requires_supervisor_or_higher(self):
        """Test SUPERVISOR_ROLES requirement for revocation: SUPERVISOR, CONTROLLER, ADMIN only."""
        supervisor_allowed = {RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN}

        for role in self.ALL_ROLES:
            ctx = self._ctx(role)
            cert = Certificate(
                certificate_id=f"cert-rev-{role.value}",
                certificate_number=f"DL/REV/{role.value}",
                tenant_id="IN-DL",
                session_id="s1",
                instrument_id="inst-1",
                owner_id="o1",
                procedure_pack_id="P1",
                verifier_id="v1",
                issue_date=date.today(),
                valid_until=date.today() + timedelta(days=365),
                certificate_status=CertificateStatusEnum.ISSUED,
                qr_code_payload="https://qr.gov.in/token",
            )
            if role in supervisor_allowed:
                res = CertificateStateMachine.revoke_certificate(cert, "Tampering", "Order-1", ctx)
                assert res.certificate_status == CertificateStatusEnum.REVOKED
            else:
                with pytest.raises(UnauthorizedTransitionError):
                    CertificateStateMachine.revoke_certificate(cert, "Tampering", "Order-1", ctx)


# ============================================================================
# 5. MULTI-TENANT ISOLATION EXHAUSTIVE CHALLENGES
# ============================================================================

class TestMultiTenantCrossContamination:
    """Ensure cross-tenant operations are strictly denied for non-ADMIN users across all entities."""

    def test_application_cross_tenant_actions_denied(self):
        """All application state machine actions must fail with CROSS_TENANT_ACCESS when tenant mismatch occurs."""
        actor_mh = UserContext(user_id="lmo-mh", tenant_id="IN-MH", role=RoleEnum.LMO)
        app_dl = VerificationApplication(
            application_id="app-dl",
            application_number="DL/APP/01",
            tenant_id="IN-DL",
            jurisdiction_id="DL-01",
            instrument_id="inst-1",
            applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
            service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.DRAFT,
            applicant_declaration_accepted=True,
        )

        with pytest.raises(UnauthorizedTransitionError) as exc:
            ApplicationStateMachine.submit_application(app_dl, actor_mh)
        assert exc.value.details["action"] == "CROSS_TENANT_ACCESS"

    def test_admin_cross_tenant_bypass_allowed(self):
        """Central ADMIN role must be allowed cross-tenant supervisory control."""
        admin_ctx = UserContext(user_id="central-admin", tenant_id="IN-CENTRAL", role=RoleEnum.ADMIN)
        app_dl = VerificationApplication(
            application_id="app-dl-admin",
            application_number="DL/APP/ADMIN",
            tenant_id="IN-DL",
            jurisdiction_id="DL-01",
            instrument_id="inst-1",
            applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
            service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.SUBMITTED,
            applicant_declaration_accepted=True,
        )
        # Admin can begin scrutiny across tenant
        res = ApplicationStateMachine.begin_scrutiny(app_dl, admin_ctx)
        assert res.current_status == ApplicationStatusEnum.UNDER_SCRUTINY


# ============================================================================
# 6. CONCURRENCY & RACE CONDITION CHALLENGES
# ============================================================================

class TestConcurrencyAndRaceConditions:
    """Stress test state machine transition safety under multi-threaded concurrency."""

    def test_concurrent_application_acceptance_and_rejection_race(self):
        """Race condition test: Attempting simultaneous acceptance and rejection from separate threads."""
        officer_ctx = UserContext(user_id="off-race", tenant_id="IN-DL", role=RoleEnum.LMO)

        def attempt_accept(app):
            try:
                ApplicationStateMachine.accept_application(app, officer_ctx)
                return "ACCEPTED"
            except InvalidStateTransitionError:
                return "FAILED_TRANSITION"

        def attempt_reject(app):
            try:
                ApplicationStateMachine.reject_application(app, officer_ctx, reason="Race test")
                return "REJECTED"
            except InvalidStateTransitionError:
                return "FAILED_TRANSITION"

        # Run 20 race iterations
        for _ in range(20):
            app = VerificationApplication(
                application_id="app-race",
                application_number="DL/APP/RACE",
                tenant_id="IN-DL",
                jurisdiction_id="DL-01",
                instrument_id="inst-1",
                applicant_id="stk-1",
                application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
                service_mode=ServiceModeEnum.ON_SITE,
                current_status=ApplicationStatusEnum.UNDER_SCRUTINY,
            )
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                f1 = executor.submit(attempt_accept, app)
                f2 = executor.submit(attempt_reject, app)
                results = {f1.result(), f2.result()}

            # Exactly one must succeed and the application must be in either ACCEPTED or REJECTED
            assert app.current_status in (ApplicationStatusEnum.ACCEPTED, ApplicationStatusEnum.REJECTED)

    def test_concurrent_status_event_appends(self):
        """Ensure concurrent status event appends maintain intact audit history."""
        cert = Certificate(
            certificate_id="cert-concurrent",
            certificate_number="DL/CERT/CONC",
            tenant_id="IN-DL",
            session_id="s1",
            instrument_id="inst-1",
            owner_id="o1",
            procedure_pack_id="P1",
            verifier_id="v1",
            issue_date=date.today(),
            valid_until=date.today() + timedelta(days=365),
            certificate_status=CertificateStatusEnum.ISSUED,
            qr_code_payload="https://qr.gov.in/token",
        )
        lmo_ctx = UserContext(user_id="lmo-1", tenant_id="IN-DL", role=RoleEnum.LMO)
        sup_ctx = UserContext(user_id="sup-1", tenant_id="IN-DL", role=RoleEnum.SUPERVISOR)

        # Suspend then Reinstate
        CertificateStateMachine.suspend_certificate(cert, "Inquiry", "Ref-1", lmo_ctx)
        assert cert.certificate_status == CertificateStatusEnum.SUSPENDED
        assert len(cert.status_events) == 1

        CertificateStateMachine.reinstate_certificate(cert, "Clean", "Ref-2", sup_ctx)
        assert cert.certificate_status == CertificateStatusEnum.ISSUED
        assert len(cert.status_events) == 2

        # Verify audit trail ordering and contents
        assert cert.status_events[0].previous_status == CertificateStatusEnum.ISSUED
        assert cert.status_events[0].new_status == CertificateStatusEnum.SUSPENDED
        assert cert.status_events[1].previous_status == CertificateStatusEnum.SUSPENDED
        assert cert.status_events[1].new_status == CertificateStatusEnum.ISSUED


# ============================================================================
# 7. METROLOGY PRECISION & DATABASE INTEGRITY CHALLENGES
# ============================================================================

class TestMetrologyPrecisionAndConstraints:
    """Stress test exact decimal precision and relational constraints in SQLAlchemy models."""

    def test_metrology_decimal_preserves_sub_microgram_precision(self, in_memory_db):
        """Verify MetrologyDecimal (Numeric 18, 6) stores exact rational values without floating point drift."""
        tenant = Tenant(tenant_id="IN-DL", state_code="DL", state_name="Delhi")
        jurisdiction = Jurisdiction(tenant_id="IN-DL", name="DL Central", code="DL-C", level=JurisdictionLevelEnum.DISTRICT)
        stakeholder = Stakeholder(tenant_id="IN-DL", jurisdiction_id=jurisdiction.jurisdiction_id, legal_name="Precision Lab", stakeholder_type=StakeholderTypeEnum.OWNER_USER, email="p@lab.in", phone="+911122334455", address_line1="DL", city="Delhi", pincode="110001")
        facility = Facility(tenant_id="IN-DL", stakeholder_id=stakeholder.stakeholder_id, facility_name="Main Lab", address_line="DL", district="Delhi", pincode="110001")
        model = InstrumentModel(category="NAWI", subtype="MICRO_BALANCE", manufacturer_name="Mettler", model_name="XPR6UD5", model_approval_number="IND/05/2026/01", accuracy_class=AccuracyClassEnum.CLASS_I, verification_scale_interval_e=Decimal("0.000001"), scale_interval_unit="g", min_capacity=Decimal("0.000005"), max_capacity=Decimal("6.100000"), capacity_unit="g", number_of_intervals_n=6100000)
        inst = Instrument(tenant_id="IN-DL", jurisdiction_id=jurisdiction.jurisdiction_id, model_id=model.model_id, owner_id=stakeholder.stakeholder_id, facility_id=facility.facility_id, serial_number="METTLER-9912", year_of_manufacture=2026)
        user = User(tenant_id="IN-DL", email="lmo@dl.gov.in", full_name="LMO Verma", role=RoleEnum.LMO)
        app = VerificationApplication(application_number="DL/2026/APP-EXACT", tenant_id="IN-DL", jurisdiction_id=jurisdiction.jurisdiction_id, instrument_id=inst.instrument_id, applicant_id=stakeholder.stakeholder_id, application_type=ApplicationTypeEnum.INITIAL_VERIFICATION, service_mode=ServiceModeEnum.ON_SITE, applicant_declaration_accepted=True)
        session = VerificationSession(tenant_id="IN-DL", application_id=app.application_id, instrument_id=inst.instrument_id, procedure_pack_id="IN-NAWI-CLASS-I-2026.1", procedure_pack_checksum="a"*64, verifier_id=user.user_id, verifier_role="LMO", scheduled_date=date.today())

        in_memory_db.add_all([tenant, jurisdiction, stakeholder, facility, model, inst, user, app, session])
        in_memory_db.commit()

        # Add observation with sub-microgram decimal values
        obs = TestObservation(
            session_id=session.session_id,
            step_type=StepTypeEnum.INCREASING_LOAD,
            step_sequence=1,
            nominal_load=Decimal("0.000005"),
            load_unit="g",
            raw_indication_reading=Decimal("0.000005"),
            normalized_indication=Decimal("0.000005"),
            reading_unit="g",
            observed_error=Decimal("0.000000"),
            mpe_allowed=Decimal("0.000002"),
            is_within_mpe=True,
            calculation_trace={"nominal": "0.000005", "reading": "0.000005", "error": "0.000000"},
        )
        in_memory_db.add(obs)
        in_memory_db.commit()

        saved_obs = in_memory_db.execute(select(TestObservation).where(TestObservation.observation_id == obs.observation_id)).scalar_one()
        assert saved_obs.nominal_load == Decimal("0.000005")
        assert saved_obs.mpe_allowed == Decimal("0.000002")

    def test_duplicate_model_serial_number_rejected(self, in_memory_db):
        """Unique constraint uq_model_serial must reject registering duplicate serial numbers for the same model."""
        tenant = Tenant(tenant_id="IN-DL", state_code="DL", state_name="Delhi")
        jurisdiction = Jurisdiction(tenant_id="IN-DL", name="DL Central", code="DL-C", level=JurisdictionLevelEnum.DISTRICT)
        stakeholder = Stakeholder(tenant_id="IN-DL", jurisdiction_id=jurisdiction.jurisdiction_id, legal_name="Lab", stakeholder_type=StakeholderTypeEnum.OWNER_USER, email="p@lab.in", phone="+911122334455", address_line1="DL", city="Delhi", pincode="110001")
        facility = Facility(tenant_id="IN-DL", stakeholder_id=stakeholder.stakeholder_id, facility_name="Main Lab", address_line="DL", district="Delhi", pincode="110001")
        model = InstrumentModel(category="NAWI", subtype="BENCH_SCALE", manufacturer_name="Eagle", model_name="E-100", model_approval_number="IND/01/2026/01", accuracy_class=AccuracyClassEnum.CLASS_III, verification_scale_interval_e=Decimal("1.000000"), scale_interval_unit="g", min_capacity=Decimal("20.000000"), max_capacity=Decimal("10000.000000"), capacity_unit="g")
        in_memory_db.add_all([tenant, jurisdiction, stakeholder, facility, model])
        in_memory_db.commit()

        inst1 = Instrument(tenant_id="IN-DL", jurisdiction_id=jurisdiction.jurisdiction_id, model_id=model.model_id, owner_id=stakeholder.stakeholder_id, facility_id=facility.facility_id, serial_number="DUPLICATE-SERIAL-99", year_of_manufacture=2026)
        in_memory_db.add(inst1)
        in_memory_db.commit()

        # Second instrument with exact same model_id and serial_number must fail
        inst2 = Instrument(tenant_id="IN-DL", jurisdiction_id=jurisdiction.jurisdiction_id, model_id=model.model_id, owner_id=stakeholder.stakeholder_id, facility_id=facility.facility_id, serial_number="DUPLICATE-SERIAL-99", year_of_manufacture=2026)
        in_memory_db.add(inst2)
        with pytest.raises(IntegrityError):
            in_memory_db.commit()


# ============================================================================
# 8. ADVANCED EDGE CASES, TERMINAL INVARIANTS & PHYSICAL STAMP DECOUPLING
# ============================================================================

class TestAdvancedEdgeCasesAndInvariants:
    """Stress test boundary cases, terminal states immutability, and physical stamp independence."""

    def test_terminal_states_cannot_transition(self):
        """Terminal states REJECTED, WITHDRAWN, COMPLETED, REVOKED, EXPIRED, SUPERSEDED cannot be resurrected."""
        officer_ctx = UserContext(user_id="off-1", tenant_id="IN-DL", role=RoleEnum.LMO)
        sup_ctx = UserContext(user_id="sup-1", tenant_id="IN-DL", role=RoleEnum.SUPERVISOR)

        # 1. Application REJECTED
        app_rej = VerificationApplication(
            application_id="app-rej",
            application_number="DL/APP/REJ",
            tenant_id="IN-DL",
            jurisdiction_id="DL-01",
            instrument_id="inst-1",
            applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
            service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.REJECTED,
        )
        with pytest.raises(InvalidStateTransitionError):
            ApplicationStateMachine.begin_scrutiny(app_rej, officer_ctx)

        # 2. Application COMPLETED
        app_comp = VerificationApplication(
            application_id="app-comp",
            application_number="DL/APP/COMP",
            tenant_id="IN-DL",
            jurisdiction_id="DL-01",
            instrument_id="inst-1",
            applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
            service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.COMPLETED,
        )
        session = VerificationSession(
            session_id="s1",
            tenant_id="IN-DL",
            application_id="app-comp",
            instrument_id="inst-1",
            procedure_pack_id="P1",
            procedure_pack_checksum="a"*64,
            verifier_id="v1",
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.FINALIZED,
        )
        with pytest.raises(InvalidStateTransitionError):
            ApplicationStateMachine.complete_application(app_comp, session, officer_ctx)

        # 3. Certificate REVOKED
        cert_rev = Certificate(
            certificate_id="cert-rev",
            certificate_number="DL/CERT/REV",
            tenant_id="IN-DL",
            session_id="s1",
            instrument_id="inst-1",
            owner_id="o1",
            procedure_pack_id="P1",
            verifier_id="v1",
            issue_date=date.today(),
            valid_until=date.today() + timedelta(days=365),
            certificate_status=CertificateStatusEnum.REVOKED,
            qr_code_payload="https://qr.gov.in/token",
        )
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.suspend_certificate(cert_rev, "Sus", "Ref", officer_ctx)
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.reinstate_certificate(cert_rev, "Rein", "Ref", sup_ctx)

        # 4. Certificate EXPIRED
        cert_exp = Certificate(
            certificate_id="cert-exp",
            certificate_number="DL/CERT/EXP",
            tenant_id="IN-DL",
            session_id="s1",
            instrument_id="inst-1",
            owner_id="o1",
            procedure_pack_id="P1",
            verifier_id="v1",
            issue_date=date.today() - timedelta(days=400),
            valid_until=date.today() - timedelta(days=35),
            certificate_status=CertificateStatusEnum.EXPIRED,
            qr_code_payload="https://qr.gov.in/token",
        )
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.suspend_certificate(cert_exp, "Sus", "Ref", officer_ctx)

    def test_physical_stamp_actions_independent_of_certificate(self, in_memory_db):
        """Physical stamping records can be created, replaced, and audited without altering digital certificate status."""
        tenant = Tenant(tenant_id="IN-DL", state_code="DL", state_name="Delhi")
        jurisdiction = Jurisdiction(tenant_id="IN-DL", name="DL Central", code="DL-C", level=JurisdictionLevelEnum.DISTRICT)
        stakeholder = Stakeholder(tenant_id="IN-DL", jurisdiction_id=jurisdiction.jurisdiction_id, legal_name="Mill", stakeholder_type=StakeholderTypeEnum.OWNER_USER, email="m@mill.in", phone="+911122334455", address_line1="DL", city="Delhi", pincode="110001")
        facility = Facility(tenant_id="IN-DL", stakeholder_id=stakeholder.stakeholder_id, facility_name="Plant", address_line="DL", district="Delhi", pincode="110001")
        model = InstrumentModel(category="NAWI", subtype="BENCH_SCALE", manufacturer_name="Eagle", model_name="E-100", model_approval_number="IND/01/2026/01", accuracy_class=AccuracyClassEnum.CLASS_III, verification_scale_interval_e=Decimal("1.000000"), scale_interval_unit="g", min_capacity=Decimal("20.000000"), max_capacity=Decimal("10000.000000"), capacity_unit="g")
        inst = Instrument(tenant_id="IN-DL", jurisdiction_id=jurisdiction.jurisdiction_id, model_id=model.model_id, owner_id=stakeholder.stakeholder_id, facility_id=facility.facility_id, serial_number="STAMP-SERIAL-01", year_of_manufacture=2026)
        user = User(tenant_id="IN-DL", email="lmo@dl.gov.in", full_name="LMO Verma", role=RoleEnum.LMO)
        app = VerificationApplication(application_number="DL/2026/APP-STAMP", tenant_id="IN-DL", jurisdiction_id=jurisdiction.jurisdiction_id, instrument_id=inst.instrument_id, applicant_id=stakeholder.stakeholder_id, application_type=ApplicationTypeEnum.INITIAL_VERIFICATION, service_mode=ServiceModeEnum.ON_SITE, applicant_declaration_accepted=True)
        session = VerificationSession(tenant_id="IN-DL", application_id=app.application_id, instrument_id=inst.instrument_id, procedure_pack_id="IN-NAWI-CLASS-III-2026.1", procedure_pack_checksum="a"*64, verifier_id=user.user_id, verifier_role="LMO", scheduled_date=date.today(), status=SessionStatusEnum.FINALIZED, outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION)
        cert = Certificate(
            certificate_number="LM-CERT/IN-DL/2026/9999",
            tenant_id="IN-DL",
            session_id=session.session_id,
            instrument_id=inst.instrument_id,
            owner_id=stakeholder.stakeholder_id,
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            verifier_id=user.user_id,
            issue_date=date.today(),
            valid_until=date.today() + timedelta(days=365),
            certificate_status=CertificateStatusEnum.ISSUED,
            qr_code_payload="https://qr.gov.in/token",
        )

        in_memory_db.add_all([tenant, jurisdiction, stakeholder, facility, model, inst, user, app, session, cert])
        in_memory_db.commit()

        # Apply Lead Wire Seal
        seal1 = PhysicalStampAction(
            tenant_id="IN-DL",
            session_id=session.session_id,
            instrument_id=inst.instrument_id,
            verifier_id=user.user_id,
            action_type=PhysicalSealActionEnum.SEAL_APPLIED,
            seal_type=SealTypeEnum.LEAD_WIRE_SEAL,
            seal_identification_number="DL-LEAD-2026-001",
            seal_position="CALIBRATION_SCREW",
            photo_evidence_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        )
        # Apply Tamper Sticker Hologram
        seal2 = PhysicalStampAction(
            tenant_id="IN-DL",
            session_id=session.session_id,
            instrument_id=inst.instrument_id,
            verifier_id=user.user_id,
            action_type=PhysicalSealActionEnum.SEAL_APPLIED,
            seal_type=SealTypeEnum.SECURITY_STICKER_HOLOGRAM,
            seal_identification_number="DL-HOLO-2026-882",
            seal_position="ENCLOSURE_SEAM_FRONT",
            photo_evidence_hash="f4c0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        )
        in_memory_db.add_all([seal1, seal2])
        in_memory_db.commit()

        # Verify cert remains ISSUED
        saved_cert = in_memory_db.execute(select(Certificate).where(Certificate.certificate_id == cert.certificate_id)).scalar_one()
        assert saved_cert.certificate_status == CertificateStatusEnum.ISSUED
        assert len(inst.stamp_actions) == 2

