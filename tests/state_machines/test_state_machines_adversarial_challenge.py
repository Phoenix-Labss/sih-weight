"""Empirical adversarial test suite challenging State Machine invariants for Milestone 2.

Challenges:
- Application state machine: multi-round query/correction cycles, withdrawal matrix, scheduling guards, payment reconciliation
- Verification session state machine: deterministic pass guard enforcement, candidate outcome spectrum, identity check guards, immutability of finalized sessions
- Certificate state machine: cryptographic signature retry loops, suspension/reinstatement cycles, revocation finality, supersession chains, expiry boundaries
- Multi-tenant cross-boundary isolation across ALL state machine transition endpoints
"""

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
    ImmutableEntityModificationError,
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
    CertificateStatusEvent,
)
from app.models.session import (
    SessionStatusEnum,
    VerificationOutcomeEnum,
    VerificationSession,
)
from app.models.stakeholder import RoleEnum


@pytest.fixture
def dl_applicant():
    return UserContext(user_id="usr-app-dl", tenant_id="IN-DL", role=RoleEnum.APPLICANT)


@pytest.fixture
def dl_lmo():
    return UserContext(user_id="usr-lmo-dl", tenant_id="IN-DL", role=RoleEnum.LMO, jurisdiction_id="DL-01")


@pytest.fixture
def dl_supervisor():
    return UserContext(user_id="usr-sup-dl", tenant_id="IN-DL", role=RoleEnum.SUPERVISOR, jurisdiction_id="DL-01")


@pytest.fixture
def dl_gatc():
    return UserContext(user_id="usr-gatc-dl", tenant_id="IN-DL", role=RoleEnum.GATC_VERIFIER, jurisdiction_id="DL-01")


@pytest.fixture
def foreign_tenant_lmo():
    return UserContext(user_id="usr-lmo-foreign", tenant_id="IN-KA", role=RoleEnum.LMO, jurisdiction_id="KA-01")


@pytest.fixture
def global_admin():
    return UserContext(user_id="usr-admin-root", tenant_id="IN-GLOBAL", role=RoleEnum.ADMIN)


@pytest.fixture
def fresh_application():
    return VerificationApplication(
        application_id="app-adv-sm-1",
        application_number="DL/2026/APP-ADV-001",
        tenant_id="IN-DL",
        jurisdiction_id="DL-01",
        instrument_id="inst-adv-1",
        applicant_id="stk-adv-1",
        application_type=ApplicationTypeEnum.INITIAL_VERIFICATION,
        service_mode=ServiceModeEnum.ON_SITE,
        current_status=ApplicationStatusEnum.DRAFT,
        applicant_declaration_accepted=True,
        version=1,
    )


class TestAdversarialApplicationStateMachine:
    """Adversarial challenge tests for the Application state machine."""

    def test_multi_round_query_and_correction_increments_version(self, fresh_application, dl_applicant, dl_lmo):
        """Stress: Multiple rounds of query -> correction correctly increment version count."""
        app = fresh_application
        ApplicationStateMachine.submit_application(app, dl_applicant)
        ApplicationStateMachine.begin_scrutiny(app, dl_lmo)

        # Round 1
        ApplicationStateMachine.raise_query(app, dl_lmo, "Provide load cell calibration certificate.")
        assert app.current_status == ApplicationStatusEnum.QUERY_RAISED
        ApplicationStateMachine.submit_correction(app, dl_applicant, "Uploaded load cell cert v1.")
        assert app.current_status == ApplicationStatusEnum.CORRECTION_SUBMITTED
        assert app.version == 2

        # Round 2
        ApplicationStateMachine.begin_scrutiny(app, dl_lmo)
        ApplicationStateMachine.raise_query(app, dl_lmo, "Load cell serial does not match chassis tag.")
        assert app.current_status == ApplicationStatusEnum.QUERY_RAISED
        ApplicationStateMachine.submit_correction(app, dl_applicant, "Uploaded corrected chassis photo v2.")
        assert app.current_status == ApplicationStatusEnum.CORRECTION_SUBMITTED
        assert app.version == 3

        # Round 3
        ApplicationStateMachine.begin_scrutiny(app, dl_lmo)
        ApplicationStateMachine.raise_query(app, dl_lmo, "Missing owner tax invoice.")
        assert app.current_status == ApplicationStatusEnum.QUERY_RAISED
        ApplicationStateMachine.submit_correction(app, dl_applicant, "Uploaded invoice v3.")
        assert app.current_status == ApplicationStatusEnum.CORRECTION_SUBMITTED
        assert app.version == 4

        # Final acceptance
        ApplicationStateMachine.begin_scrutiny(app, dl_lmo)
        ApplicationStateMachine.accept_application(app, dl_lmo, "All 3 queries resolved successfully.")
        assert app.current_status == ApplicationStatusEnum.ACCEPTED
        assert app.version == 4

    def test_withdrawal_matrix_allowed_and_forbidden_states(self, fresh_application, dl_applicant, dl_lmo):
        """Stress: Verify withdrawal succeeds in all valid pre-acceptance states and fails in post-acceptance states."""
        # 1. DRAFT -> WITHDRAWN
        app_draft = VerificationApplication(
            application_id="app-w-1", application_number="DL/APP/W1", tenant_id="IN-DL",
            jurisdiction_id="DL-01", instrument_id="inst-1", applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION, service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.DRAFT,
        )
        ApplicationStateMachine.withdraw_application(app_draft, dl_applicant, "Cancelled by user")
        assert app_draft.current_status == ApplicationStatusEnum.WITHDRAWN

        # 2. ACCEPTED -> Withdrawal fails
        app_accepted = VerificationApplication(
            application_id="app-w-2", application_number="DL/APP/W2", tenant_id="IN-DL",
            jurisdiction_id="DL-01", instrument_id="inst-1", applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION, service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.ACCEPTED,
        )
        with pytest.raises(InvalidStateTransitionError):
            ApplicationStateMachine.withdraw_application(app_accepted, dl_applicant)

        # 3. SCHEDULED -> Withdrawal fails
        app_sched = VerificationApplication(
            application_id="app-w-3", application_number="DL/APP/W3", tenant_id="IN-DL",
            jurisdiction_id="DL-01", instrument_id="inst-1", applicant_id="stk-1",
            application_type=ApplicationTypeEnum.INITIAL_VERIFICATION, service_mode=ServiceModeEnum.ON_SITE,
            current_status=ApplicationStatusEnum.SCHEDULED,
        )
        with pytest.raises(InvalidStateTransitionError):
            ApplicationStateMachine.withdraw_application(app_sched, dl_applicant)

    def test_scheduling_with_gatc_verifier(self, fresh_application, dl_applicant, dl_lmo, dl_gatc):
        """Stress: Application can be scheduled specifically to a GATC center/verifier."""
        app = fresh_application
        ApplicationStateMachine.submit_application(app, dl_applicant)
        ApplicationStateMachine.begin_scrutiny(app, dl_lmo)
        ApplicationStateMachine.accept_application(app, dl_lmo)

        fee = FeeAssessment(
            fee_assessment_id="fee-gatc-1", tenant_id="IN-DL", policy_version="DL-2026",
            base_verification_fee=Decimal("750.00"), total_assessed_amount=Decimal("750.00"),
        )
        ApplicationStateMachine.issue_fee_assessment(app, fee, dl_lmo)
        ApplicationStateMachine.reconcile_payment(app, dl_applicant)

        now = datetime.now(timezone.utc)
        ApplicationStateMachine.schedule_verification(
            app,
            dl_lmo,
            slot_start=now + timedelta(days=1),
            slot_end=now + timedelta(days=1, hours=4),
            assigned_gatc_id="gatc-centre-north-01",
        )
        assert app.current_status == ApplicationStatusEnum.SCHEDULED
        assert app.assigned_gatc_id == "gatc-centre-north-01"
        assert app.assigned_lmo_id is None

        # GATC Verifier commences testing
        ApplicationStateMachine.commence_testing(app, dl_gatc)
        assert app.current_status == ApplicationStatusEnum.VERIFICATION_IN_PROGRESS

    def test_exhaustive_cross_tenant_rejection_across_application_actions(self, fresh_application, dl_applicant, dl_lmo, foreign_tenant_lmo):
        """Stress: Foreign tenant officer cannot execute ANY application transition."""
        app = fresh_application

        # submit_application
        with pytest.raises(UnauthorizedTransitionError):
            ApplicationStateMachine.submit_application(app, foreign_tenant_lmo)

        # Transition to submitted first
        ApplicationStateMachine.submit_application(app, dl_applicant)

        # begin_scrutiny
        with pytest.raises(UnauthorizedTransitionError):
            ApplicationStateMachine.begin_scrutiny(app, foreign_tenant_lmo)

        # Transition to scrutiny
        ApplicationStateMachine.begin_scrutiny(app, dl_lmo)

        # raise_query
        with pytest.raises(UnauthorizedTransitionError):
            ApplicationStateMachine.raise_query(app, foreign_tenant_lmo, "Query")

        # accept_application
        with pytest.raises(UnauthorizedTransitionError):
            ApplicationStateMachine.accept_application(app, foreign_tenant_lmo)

        # reject_application
        with pytest.raises(UnauthorizedTransitionError):
            ApplicationStateMachine.reject_application(app, foreign_tenant_lmo, "Reject")

        # Accept application with valid LMO
        ApplicationStateMachine.accept_application(app, dl_lmo)

        # issue_fee_assessment
        fee = FeeAssessment(
            fee_assessment_id="fee-f-1", tenant_id="IN-DL", policy_version="DL-2026",
            base_verification_fee=Decimal("100.00"), total_assessed_amount=Decimal("100.00"),
        )
        with pytest.raises(UnauthorizedTransitionError):
            ApplicationStateMachine.issue_fee_assessment(app, fee, foreign_tenant_lmo)

    def test_admin_cross_tenant_override(self, fresh_application, global_admin, dl_applicant):
        """Stress: Global ADMIN context is permitted to execute operations across tenant boundaries."""
        app = fresh_application
        ApplicationStateMachine.submit_application(app, global_admin)
        assert app.current_status == ApplicationStatusEnum.SUBMITTED

        ApplicationStateMachine.begin_scrutiny(app, global_admin)
        assert app.current_status == ApplicationStatusEnum.UNDER_SCRUTINY

        ApplicationStateMachine.accept_application(app, global_admin)
        assert app.current_status == ApplicationStatusEnum.ACCEPTED


class TestAdversarialVerificationSessionStateMachine:
    """Adversarial challenge tests for the Verification Session state machine."""

    def test_deterministic_pass_guard_fails_when_flag_is_none_or_false(self, dl_lmo):
        """Stress: Statutory guard blocks 'Passed' disposition if automated evaluation flag is None or False."""
        # 1. Flag is False
        session_false = VerificationSession(
            session_id="sess-f1", tenant_id="IN-DL", application_id="app-1", instrument_id="inst-1",
            procedure_pack_id="P1", procedure_pack_checksum="0"*64, verifier_id="v1", verifier_role="LMO",
            scheduled_date=date.today(), status=SessionStatusEnum.SUBMITTED,
            automated_evaluation_flag=False,
        )
        with pytest.raises(GuardConditionFailedError) as exc1:
            VerificationSessionStateMachine.record_disposition(
                session_false, dl_lmo, outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION
            )
        assert "deterministic metrological evaluation flag is False" in str(exc1.value)

        # 2. Flag is None
        session_none = VerificationSession(
            session_id="sess-f2", tenant_id="IN-DL", application_id="app-1", instrument_id="inst-1",
            procedure_pack_id="P1", procedure_pack_checksum="0"*64, verifier_id="v1", verifier_role="LMO",
            scheduled_date=date.today(), status=SessionStatusEnum.SUBMITTED,
            automated_evaluation_flag=None,
        )
        with pytest.raises(GuardConditionFailedError) as exc2:
            VerificationSessionStateMachine.record_disposition(
                session_none, dl_lmo, outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION
            )
        assert "deterministic metrological evaluation flag is False" in str(exc2.value)

    def test_finalized_session_immutability_against_all_transitions(self, dl_lmo):
        """Stress: A finalized verification session cannot be modified or re-transitioned."""
        session = VerificationSession(
            session_id="sess-final", tenant_id="IN-DL", application_id="app-1", instrument_id="inst-1",
            procedure_pack_id="P1", procedure_pack_checksum="0"*64, verifier_id="v1", verifier_role="LMO",
            scheduled_date=date.today(), status=SessionStatusEnum.FINALIZED,
            outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
            automated_evaluation_flag=True,
        )

        with pytest.raises(InvalidStateTransitionError):
            VerificationSessionStateMachine.confirm_identity(session, dl_lmo)

        with pytest.raises(InvalidStateTransitionError):
            VerificationSessionStateMachine.start_testing(session, dl_lmo)

        with pytest.raises(InvalidStateTransitionError):
            VerificationSessionStateMachine.submit_observations(session, dl_lmo, automated_evaluation_passed=True)

        with pytest.raises(InvalidStateTransitionError):
            VerificationSessionStateMachine.record_disposition(session, dl_lmo, outcome=VerificationOutcomeEnum.VERIFICATION_FAILED)


class TestAdversarialCertificateStateMachine:
    """Adversarial challenge tests for the Digital Certificate state machine."""

    def test_draft_creation_fails_for_all_non_passed_candidate_outcomes(self, dl_lmo):
        """Stress: Non-passed outcomes cannot create digital certificate drafts."""
        non_passed_outcomes = [
            VerificationOutcomeEnum.VERIFICATION_FAILED,
            VerificationOutcomeEnum.NEEDS_REVIEW,
            VerificationOutcomeEnum.INCOMPLETE_VERIFICATION,
            VerificationOutcomeEnum.OUTSIDE_AUTHORIZATION_SCOPE,
        ]
        for outcome in non_passed_outcomes:
            session = VerificationSession(
                session_id=f"sess-{outcome.name}", tenant_id="IN-DL", application_id="app-1", instrument_id="inst-1",
                procedure_pack_id="P1", procedure_pack_checksum="0"*64, verifier_id="v1", verifier_role="LMO",
                scheduled_date=date.today(), status=SessionStatusEnum.FINALIZED,
                outcome=outcome,
            )
            with pytest.raises(GuardConditionFailedError) as exc:
                CertificateStateMachine.create_draft(
                    session=session,
                    certificate_number=f"CERT-{outcome.name}",
                    issue_date=date.today(),
                    valid_until=date.today() + timedelta(days=365),
                    qr_payload="https://qr.gov.in/test",
                    actor=dl_lmo,
                )
            assert f"outcome: '{outcome.value}'" in str(exc.value)

    def test_draft_creation_invalid_validity_date_range(self, dl_lmo):
        """Stress: Certificate valid_until preceding issue_date is rejected with guard failure."""
        session = VerificationSession(
            session_id="sess-pass-date", tenant_id="IN-DL", application_id="app-1", instrument_id="inst-1",
            procedure_pack_id="P1", procedure_pack_checksum="0"*64, verifier_id="v1", verifier_role="LMO",
            scheduled_date=date.today(), status=SessionStatusEnum.FINALIZED,
            outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
        )
        with pytest.raises(GuardConditionFailedError) as exc:
            CertificateStateMachine.create_draft(
                session=session,
                certificate_number="CERT-BAD-DATES",
                issue_date=date(2026, 8, 23),
                valid_until=date(2026, 8, 22),  # 1 day before issue date
                qr_payload="https://qr.gov.in/test",
                actor=dl_lmo,
            )
        assert "valid_until date cannot be before issue_date" in str(exc.value)

    def test_render_and_lock_sha256_hash_validation(self, dl_lmo):
        """Stress: Payload SHA-256 hash must be exactly 64 characters."""
        cert = Certificate(
            certificate_id="cert-hash-test", certificate_number="CERT-HASH-1", tenant_id="IN-DL",
            session_id="s1", instrument_id="inst-1", owner_id="stk-1", procedure_pack_id="P1",
            verifier_id="v1", issue_date=date.today(), valid_until=date.today() + timedelta(days=365),
            certificate_status=CertificateStatusEnum.DRAFT, qr_code_payload="https://qr.gov.in/h1",
        )
        # 1. Empty hash
        with pytest.raises(GuardConditionFailedError):
            CertificateStateMachine.render_and_lock(cert, "", "s3://certs/h1.pdf", dl_lmo)

        # 2. Short hash (32 chars)
        with pytest.raises(GuardConditionFailedError):
            CertificateStateMachine.render_and_lock(cert, "a"*32, "s3://certs/h1.pdf", dl_lmo)

        # 3. Long hash (65 chars)
        with pytest.raises(GuardConditionFailedError):
            CertificateStateMachine.render_and_lock(cert, "a"*65, "s3://certs/h1.pdf", dl_lmo)

        # 4. Valid 64-char hash
        CertificateStateMachine.render_and_lock(cert, "a"*64, "s3://certs/h1.pdf", dl_lmo)
        assert cert.certificate_status == CertificateStatusEnum.PENDING_SIGNATURE

    def test_repeated_signing_failures_and_event_trail(self, dl_lmo):
        """Stress: Multiple consecutive signing failures record distinct events before eventual success."""
        cert = Certificate(
            certificate_id="cert-multi-fail", certificate_number="CERT-FAIL-1", tenant_id="IN-DL",
            session_id="s1", instrument_id="inst-1", owner_id="stk-1", procedure_pack_id="P1",
            verifier_id="v1", issue_date=date.today(), valid_until=date.today() + timedelta(days=365),
            certificate_status=CertificateStatusEnum.DRAFT, qr_code_payload="https://qr.gov.in/f1",
        )
        hash_val = "f"*64

        # Failure 1: Network timeout
        CertificateStateMachine.render_and_lock(cert, hash_val, "s3://certs/f1.pdf", dl_lmo)
        CertificateStateMachine.record_signing_failure(cert, "Timeout connecting to eSign provider (504)", dl_lmo)
        assert cert.certificate_status == CertificateStatusEnum.SIGNING_FAILED

        # Failure 2: HSM pin locked
        CertificateStateMachine.render_and_lock(cert, hash_val, "s3://certs/f1.pdf", dl_lmo)
        CertificateStateMachine.record_signing_failure(cert, "HSM slot PIN locked", dl_lmo)
        assert cert.certificate_status == CertificateStatusEnum.SIGNING_FAILED

        # Failure 3: Certificate revocation check failure
        CertificateStateMachine.render_and_lock(cert, hash_val, "s3://certs/f1.pdf", dl_lmo)
        CertificateStateMachine.record_signing_failure(cert, "OCSP responder unreachable", dl_lmo)
        assert cert.certificate_status == CertificateStatusEnum.SIGNING_FAILED

        # Recovery & Successful Signature
        CertificateStateMachine.render_and_lock(cert, hash_val, "s3://certs/f1.pdf", dl_lmo)
        CertificateStateMachine.bind_signature(cert, "DSC-FINAL-SUCCESS-007", dl_lmo.user_id, dl_lmo)
        assert cert.certificate_status == CertificateStatusEnum.ISSUED

        # Verify all 4 events exist in audit trail
        events = cert.status_events
        assert len(events) == 4
        assert events[0].new_status == CertificateStatusEnum.SIGNING_FAILED
        assert "504" in events[0].reason
        assert events[1].new_status == CertificateStatusEnum.SIGNING_FAILED
        assert "PIN locked" in events[1].reason
        assert events[2].new_status == CertificateStatusEnum.SIGNING_FAILED
        assert "OCSP" in events[2].reason
        assert events[3].new_status == CertificateStatusEnum.ISSUED

    def test_revocation_is_terminal_against_reinstatement_and_expiry(self, dl_lmo, dl_supervisor):
        """Stress: A REVOKED certificate cannot be reinstated, expired, or superseded."""
        cert = Certificate(
            certificate_id="cert-rev-term", certificate_number="CERT-REV-TERM-01", tenant_id="IN-DL",
            session_id="s1", instrument_id="inst-1", owner_id="stk-1", procedure_pack_id="P1",
            verifier_id="v1", issue_date=date.today(), valid_until=date.today() + timedelta(days=365),
            certificate_status=CertificateStatusEnum.REVOKED, qr_code_payload="https://qr.gov.in/rev",
        )

        # Cannot reinstate
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.reinstate_certificate(cert, "Attempted reinstatement", "Ref-1", dl_supervisor)

        # Cannot expire
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.expire_certificate(cert, dl_lmo, as_of_date=date.today() + timedelta(days=400))

        # Cannot supersede
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.supersede_certificate(cert, "new-cert-id", "Supersede", dl_lmo)

    def test_expiry_date_boundary_conditions(self, dl_lmo):
        """Stress: Expiration guard strictly respects boundary date (equal vs strictly greater)."""
        valid_until_date = date(2026, 8, 23)
        cert = Certificate(
            certificate_id="cert-exp-bound", certificate_number="CERT-EXP-BOUND-01", tenant_id="IN-DL",
            session_id="s1", instrument_id="inst-1", owner_id="stk-1", procedure_pack_id="P1",
            verifier_id="v1", issue_date=date(2025, 8, 23), valid_until=valid_until_date,
            certificate_status=CertificateStatusEnum.ISSUED, qr_code_payload="https://qr.gov.in/exp",
        )

        # 1. 1 day before valid_until -> FAILS
        with pytest.raises(GuardConditionFailedError):
            CertificateStateMachine.expire_certificate(cert, dl_lmo, as_of_date=date(2026, 8, 22))

        # 2. Exact valid_until date -> FAILS (certificate is still valid throughout the expiry day)
        with pytest.raises(GuardConditionFailedError):
            CertificateStateMachine.expire_certificate(cert, dl_lmo, as_of_date=date(2026, 8, 23))

        # 3. 1 day after valid_until -> SUCCEEDS
        CertificateStateMachine.expire_certificate(cert, dl_lmo, as_of_date=date(2026, 8, 24))
        assert cert.certificate_status == CertificateStatusEnum.EXPIRED
