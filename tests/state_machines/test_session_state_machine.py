"""Unit tests for Verification Session state machine transitions, automated evaluation guards, and legal dispositions."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest

from app.core.state_machines import (
    VerificationSessionStateMachine,
    UserContext,
    InvalidStateTransitionError,
    UnauthorizedTransitionError,
    GuardConditionFailedError,
)
from app.models.session import (
    SessionStatusEnum,
    VerificationOutcomeEnum,
    VerificationSession,
)
from app.models.stakeholder import RoleEnum


@pytest.fixture
def lmo_context():
    return UserContext(user_id="usr-lmo-2", tenant_id="IN-MH", role=RoleEnum.LMO, jurisdiction_id="MH-MUM-C")


@pytest.fixture
def gatc_context():
    return UserContext(user_id="usr-gatc-1", tenant_id="IN-MH", role=RoleEnum.GATC_VERIFIER, jurisdiction_id="MH-MUM-C")


@pytest.fixture
def applicant_context():
    return UserContext(user_id="usr-applicant-2", tenant_id="IN-MH", role=RoleEnum.APPLICANT)


@pytest.fixture
def other_tenant_context():
    return UserContext(user_id="usr-other-2", tenant_id="IN-DL", role=RoleEnum.LMO)


@pytest.fixture
def sample_session():
    return VerificationSession(
        session_id="sess-test-100",
        tenant_id="IN-MH",
        application_id="app-test-200",
        instrument_id="inst-test-300",
        procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
        procedure_pack_checksum="e"*64,
        verifier_id="usr-lmo-2",
        verifier_role="LMO",
        scheduled_date=date.today(),
        status=SessionStatusEnum.PLANNED,
    )


class TestVerificationSessionStateMachine:
    """Test suite covering the formal Verification Session State Machine."""

    def test_full_session_flow_passed_disposition(self, sample_session, lmo_context):
        """Test complete session execution with deterministic calculation pass and officer authorization."""
        session = sample_session

        # 1. Confirm physical identity
        VerificationSessionStateMachine.confirm_identity(session, lmo_context, serial_verified=True)
        assert session.status == SessionStatusEnum.IDENTITY_CONFIRMED

        # 2. Start testing
        test_time = datetime.now(timezone.utc)
        VerificationSessionStateMachine.start_testing(
            session,
            lmo_context,
            test_timestamp=test_time,
            temp_celsius=24.5,
            humidity_pct=55.0,
        )
        assert session.status == SessionStatusEnum.IN_PROGRESS
        assert session.actual_test_timestamp == test_time
        assert session.environmental_temp_celsius == 24.5

        # 3. Submit observations with automated calculation pass (True)
        VerificationSessionStateMachine.submit_observations(
            session,
            lmo_context,
            automated_evaluation_passed=True,
        )
        assert session.status == SessionStatusEnum.SUBMITTED
        assert session.automated_evaluation_flag is True

        # 4. Authorized Officer records legal disposition
        VerificationSessionStateMachine.record_disposition(
            session,
            lmo_context,
            outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
            disposition_notes="Instrument meets all statutory MPE and eccentricity requirements.",
        )
        assert session.status == SessionStatusEnum.FINALIZED
        assert session.outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION
        assert session.finalized_at is not None

    def test_disposition_pass_blocked_when_automated_eval_failed(self, sample_session, lmo_context):
        """Statutory Guard: Officer cannot record passed outcome if deterministic calculation failed."""
        session = sample_session
        VerificationSessionStateMachine.confirm_identity(session, lmo_context)
        VerificationSessionStateMachine.start_testing(session, lmo_context)
        VerificationSessionStateMachine.submit_observations(session, lmo_context, automated_evaluation_passed=False)

        with pytest.raises(GuardConditionFailedError) as exc:
            VerificationSessionStateMachine.record_disposition(
                session,
                lmo_context,
                outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
            )
        assert "Cannot record 'Verification passed'" in str(exc.value)

    def test_failed_disposition_when_evaluation_fails(self, sample_session, lmo_context):
        """Test recording statutory verification failed disposition."""
        session = sample_session
        VerificationSessionStateMachine.confirm_identity(session, lmo_context)
        VerificationSessionStateMachine.start_testing(session, lmo_context)
        VerificationSessionStateMachine.submit_observations(session, lmo_context, automated_evaluation_passed=False)

        VerificationSessionStateMachine.record_disposition(
            session,
            lmo_context,
            outcome=VerificationOutcomeEnum.VERIFICATION_FAILED,
            disposition_notes="Eccentricity error exceeds MPE limit by +0.02g at corner 3.",
        )
        assert session.status == SessionStatusEnum.FINALIZED
        assert session.outcome == VerificationOutcomeEnum.VERIFICATION_FAILED

    def test_candidate_outcomes_recording(self, sample_session, lmo_context):
        """Test recording all valid statutory candidate outcomes."""
        outcomes_to_test = [
            VerificationOutcomeEnum.NEEDS_REVIEW,
            VerificationOutcomeEnum.INCOMPLETE_VERIFICATION,
            VerificationOutcomeEnum.OUTSIDE_AUTHORIZATION_SCOPE,
        ]
        for outcome in outcomes_to_test:
            session = VerificationSession(
                session_id=f"sess-{outcome.name}",
                tenant_id="IN-MH",
                application_id="app-1",
                instrument_id="inst-1",
                procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
                procedure_pack_checksum="e"*64,
                verifier_id=lmo_context.user_id,
                verifier_role="LMO",
                scheduled_date=date.today(),
                status=SessionStatusEnum.SUBMITTED,
                automated_evaluation_flag=False,
            )
            VerificationSessionStateMachine.record_disposition(
                session,
                lmo_context,
                outcome=outcome,
                disposition_notes=f"Recorded {outcome.value}",
            )
            assert session.status == SessionStatusEnum.FINALIZED
            assert session.outcome == outcome

    def test_identity_confirmation_guard_fails(self, sample_session, lmo_context):
        """Test identity confirmation fails when serial number is unverified."""
        with pytest.raises(GuardConditionFailedError) as exc:
            VerificationSessionStateMachine.confirm_identity(sample_session, lmo_context, serial_verified=False)
        assert "serial number must match" in str(exc.value)

    def test_unauthorized_verifier_role(self, sample_session, applicant_context):
        """Test applicant attempting to confirm identity or execute test is blocked."""
        with pytest.raises(UnauthorizedTransitionError):
            VerificationSessionStateMachine.confirm_identity(sample_session, applicant_context)

    def test_cross_tenant_verifier_blocked(self, sample_session, other_tenant_context):
        """Test verifier from different state cannot modify session."""
        with pytest.raises(UnauthorizedTransitionError):
            VerificationSessionStateMachine.confirm_identity(sample_session, other_tenant_context)
