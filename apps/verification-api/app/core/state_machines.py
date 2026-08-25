"""Explicit state machines for Application, Verification Session, and Certificate lifecycles.

Enforces statutory guard conditions, role/jurisdiction authorization, deterministic
calculation binding, decoupled physical stamping, and append-only audit tracking.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Set

from app.models.application import (
    ApplicationStatusEnum,
    PaymentStatusEnum,
    VerificationApplication,
    FeeAssessment,
)
from app.models.base import get_utc_now
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


# ============================================================================
# 1. STRUCTURED DOMAIN ERRORS
# ============================================================================

class StateMachineError(Exception):
    """Base error for state machine validation failures."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class InvalidStateTransitionError(StateMachineError):
    """Raised when an illegal transition is attempted bypassing the lifecycle graph."""
    def __init__(
        self,
        entity_type: str,
        entity_id: str,
        current_state: str,
        attempted_action: str,
        valid_transitions: List[str],
    ) -> None:
        message = (
            f"Invalid transition for {entity_type} [{entity_id}]: "
            f"cannot perform '{attempted_action}' while in '{current_state}' state. "
            f"Valid actions/target states from '{current_state}' are: {valid_transitions}."
        )
        super().__init__(
            message,
            details={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "current_state": current_state,
                "attempted_action": attempted_action,
                "valid_transitions": valid_transitions,
            },
        )


class UnauthorizedTransitionError(StateMachineError):
    """Raised when actor lacks the required statutory role or jurisdiction scope."""
    def __init__(
        self,
        actor_id: str,
        actor_role: str,
        required_roles: Set[str],
        action: str,
    ) -> None:
        message = (
            f"Actor [{actor_id}] with role '{actor_role}' is not authorized to execute '{action}'. "
            f"Required roles: {sorted(list(required_roles))}."
        )
        super().__init__(
            message,
            details={
                "actor_id": actor_id,
                "actor_role": actor_role,
                "required_roles": list(required_roles),
                "action": action,
            },
        )


class GuardConditionFailedError(StateMachineError):
    """Raised when transition prerequisites or metrological checks fail."""
    def __init__(self, condition_name: str, reason: str, details: Optional[Dict[str, Any]] = None) -> None:
        message = f"Guard condition '{condition_name}' failed: {reason}"
        super().__init__(message, details={"condition_name": condition_name, "reason": reason, **(details or {})})


class ImmutableEntityModificationError(StateMachineError):
    """Raised when attempting to modify a finalized session, submitted observation, or signed certificate."""
    def __init__(self, entity_type: str, entity_id: str, reason: str) -> None:
        message = f"Cannot modify immutable {entity_type} [{entity_id}]: {reason}"
        super().__init__(message, details={"entity_type": entity_type, "entity_id": entity_id, "reason": reason})


# ============================================================================
# 2. ACTOR CONTEXT
# ============================================================================

@dataclass(frozen=True)
class UserContext:
    """Security and authorization context of the actor executing a state transition."""
    user_id: str
    tenant_id: str
    role: RoleEnum | str
    jurisdiction_id: Optional[str] = None
    is_active: bool = True

    def role_str(self) -> str:
        if isinstance(self.role, RoleEnum):
            return self.role.value
        return str(self.role)

    def has_role(self, *allowed_roles: RoleEnum | str) -> bool:
        current = self.role_str()
        allowed_str_set = {r.value if isinstance(r, RoleEnum) else str(r) for r in allowed_roles}
        return current in allowed_str_set


# ============================================================================
# 3. APPLICATION STATE MACHINE
# ============================================================================

class ApplicationStateMachine:
    """Explicit state machine governing verification application scrutiny and scheduling."""

    OFFICER_ROLES = {
        RoleEnum.LMO.value,
        RoleEnum.SUPERVISOR.value,
        RoleEnum.CONTROLLER.value,
        RoleEnum.ADMIN.value,
    }
    APPLICANT_ROLES = {
        RoleEnum.APPLICANT.value,
        RoleEnum.OWNER.value,
        RoleEnum.ADMIN.value,
    }

    @classmethod
    def _check_tenant(cls, app: VerificationApplication, actor: UserContext) -> None:
        if app.tenant_id != actor.tenant_id and not actor.has_role(RoleEnum.ADMIN):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles={RoleEnum.ADMIN.value},
                action="CROSS_TENANT_ACCESS",
            )

    @classmethod
    def submit_application(cls, app: VerificationApplication, actor: UserContext) -> VerificationApplication:
        """Submit a draft application for departmental scrutiny."""
        cls._check_tenant(app, actor)
        if app.current_status != ApplicationStatusEnum.DRAFT:
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="SUBMIT_APPLICATION",
                valid_transitions=[ApplicationStatusEnum.DRAFT.value],
            )
        if not app.applicant_declaration_accepted:
            raise GuardConditionFailedError(
                condition_name="APPLICANT_DECLARATION",
                reason="Statutory applicant declaration must be accepted before submission.",
            )
        app.current_status = ApplicationStatusEnum.SUBMITTED
        return app

    @classmethod
    def begin_scrutiny(
        cls, app: VerificationApplication, actor: UserContext, notes: Optional[str] = None
    ) -> VerificationApplication:
        """Assign to scrutiny and lock from applicant edits."""
        cls._check_tenant(app, actor)
        if not actor.has_role(*cls.OFFICER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.OFFICER_ROLES,
                action="BEGIN_SCRUTINY",
            )
        if app.current_status not in (ApplicationStatusEnum.SUBMITTED, ApplicationStatusEnum.CORRECTION_SUBMITTED):
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="BEGIN_SCRUTINY",
                valid_transitions=[ApplicationStatusEnum.SUBMITTED.value, ApplicationStatusEnum.CORRECTION_SUBMITTED.value],
            )
        app.current_status = ApplicationStatusEnum.UNDER_SCRUTINY
        if notes:
            app.scrutiny_notes = notes
        return app

    @classmethod
    def raise_query(
        cls, app: VerificationApplication, actor: UserContext, query_text: str
    ) -> VerificationApplication:
        """Raise a structured deficiency query to the applicant."""
        cls._check_tenant(app, actor)
        if not actor.has_role(*cls.OFFICER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.OFFICER_ROLES,
                action="RAISE_QUERY",
            )
        if app.current_status != ApplicationStatusEnum.UNDER_SCRUTINY:
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="RAISE_QUERY",
                valid_transitions=[ApplicationStatusEnum.UNDER_SCRUTINY.value],
            )
        if not query_text or not query_text.strip():
            raise GuardConditionFailedError(
                condition_name="QUERY_TEXT_REQUIRED",
                reason="Query deficiency text cannot be empty.",
            )
        app.current_status = ApplicationStatusEnum.QUERY_RAISED
        app.active_query = query_text.strip()
        app.query_raised_at = get_utc_now()
        return app

    @classmethod
    def submit_correction(
        cls, app: VerificationApplication, actor: UserContext, correction_notes: Optional[str] = None
    ) -> VerificationApplication:
        """Applicant submits correction response, creating versioned revision."""
        cls._check_tenant(app, actor)
        if app.current_status != ApplicationStatusEnum.QUERY_RAISED:
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="SUBMIT_CORRECTION",
                valid_transitions=[ApplicationStatusEnum.QUERY_RAISED.value],
            )
        app.current_status = ApplicationStatusEnum.CORRECTION_SUBMITTED
        app.version += 1
        if correction_notes:
            app.scrutiny_notes = f"Applicant correction v{app.version}: {correction_notes}"
        return app

    @classmethod
    def accept_application(
        cls, app: VerificationApplication, actor: UserContext, notes: Optional[str] = None
    ) -> VerificationApplication:
        """Officer accepts scrutinized application."""
        cls._check_tenant(app, actor)
        if not actor.has_role(*cls.OFFICER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.OFFICER_ROLES,
                action="ACCEPT_APPLICATION",
            )
        if app.current_status != ApplicationStatusEnum.UNDER_SCRUTINY:
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="ACCEPT_APPLICATION",
                valid_transitions=[ApplicationStatusEnum.UNDER_SCRUTINY.value],
            )
        app.current_status = ApplicationStatusEnum.ACCEPTED
        if notes:
            app.scrutiny_notes = notes
        return app

    @classmethod
    def reject_application(
        cls, app: VerificationApplication, actor: UserContext, reason: str
    ) -> VerificationApplication:
        """Disqualify and reject an application with reason memo."""
        cls._check_tenant(app, actor)
        if not actor.has_role(*cls.OFFICER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.OFFICER_ROLES,
                action="REJECT_APPLICATION",
            )
        if app.current_status not in (ApplicationStatusEnum.SUBMITTED, ApplicationStatusEnum.UNDER_SCRUTINY):
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="REJECT_APPLICATION",
                valid_transitions=[ApplicationStatusEnum.SUBMITTED.value, ApplicationStatusEnum.UNDER_SCRUTINY.value],
            )
        if not reason or not reason.strip():
            raise GuardConditionFailedError(
                condition_name="REJECTION_REASON_REQUIRED",
                reason="Statutory rejection reason cannot be empty.",
            )
        app.current_status = ApplicationStatusEnum.REJECTED
        app.rejection_reason = reason.strip()
        return app

    @classmethod
    def withdraw_application(
        cls, app: VerificationApplication, actor: UserContext, reason: Optional[str] = None
    ) -> VerificationApplication:
        """Applicant cancels/withdraws application before fee assessment."""
        cls._check_tenant(app, actor)
        allowed_pre_states = {
            ApplicationStatusEnum.DRAFT,
            ApplicationStatusEnum.SUBMITTED,
            ApplicationStatusEnum.UNDER_SCRUTINY,
            ApplicationStatusEnum.QUERY_RAISED,
            ApplicationStatusEnum.CORRECTION_SUBMITTED,
        }
        if app.current_status not in allowed_pre_states:
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="WITHDRAW_APPLICATION",
                valid_transitions=[s.value for s in allowed_pre_states],
            )
        app.current_status = ApplicationStatusEnum.WITHDRAWN
        if reason:
            app.rejection_reason = f"Withdrawn by applicant: {reason}"
        return app

    @classmethod
    def issue_fee_assessment(
        cls, app: VerificationApplication, fee: FeeAssessment, actor: UserContext
    ) -> VerificationApplication:
        """Issue statutory fee assessment notice to applicant."""
        cls._check_tenant(app, actor)
        if not actor.has_role(*cls.OFFICER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.OFFICER_ROLES,
                action="ISSUE_FEE_ASSESSMENT",
            )
        if app.current_status != ApplicationStatusEnum.ACCEPTED:
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="ISSUE_FEE_ASSESSMENT",
                valid_transitions=[ApplicationStatusEnum.ACCEPTED.value],
            )
        app.fee_assessment_id = fee.fee_assessment_id
        app.current_status = ApplicationStatusEnum.FEE_PENDING
        return app

    @classmethod
    def reconcile_payment(
        cls, app: VerificationApplication, actor: UserContext, receipt_number: Optional[str] = None
    ) -> VerificationApplication:
        """Reconcile verified treasury/gateway payment."""
        cls._check_tenant(app, actor)
        valid_states = {
            ApplicationStatusEnum.FEE_PENDING,
            ApplicationStatusEnum.ACCEPTED,
            ApplicationStatusEnum.SUBMITTED,
        }
        if app.current_status not in valid_states:
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="RECONCILE_PAYMENT",
                valid_transitions=[s.value for s in valid_states],
            )
        if app.fee_assessment:
            app.fee_assessment.payment_status = PaymentStatusEnum.SUCCESS
            app.fee_assessment.paid_at = get_utc_now()
            if receipt_number:
                app.fee_assessment.receipt_number = receipt_number
        app.current_status = ApplicationStatusEnum.FEE_PAID
        return app

    @classmethod
    def schedule_verification(
        cls,
        app: VerificationApplication,
        actor: UserContext,
        slot_start: datetime,
        slot_end: datetime,
        assigned_lmo_id: Optional[str] = None,
        assigned_gatc_id: Optional[str] = None,
    ) -> VerificationApplication:
        """Allocate verification calendar slot and assigned officer/GATC."""
        cls._check_tenant(app, actor)
        if not actor.has_role(*cls.OFFICER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.OFFICER_ROLES,
                action="SCHEDULE_VERIFICATION",
            )
        valid_states = {
            ApplicationStatusEnum.FEE_PAID,
            ApplicationStatusEnum.ACCEPTED,
            ApplicationStatusEnum.FEE_PENDING,
            ApplicationStatusEnum.SCHEDULED,
        }
        if app.current_status not in valid_states:
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="SCHEDULE_VERIFICATION",
                valid_transitions=[s.value for s in valid_states],
            )
        if not assigned_lmo_id and not assigned_gatc_id:
            raise GuardConditionFailedError(
                condition_name="ASSIGNMENT_REQUIRED",
                reason="Must assign either an LMO or GATC profile for verification.",
            )
        if slot_end <= slot_start:
            raise GuardConditionFailedError(
                condition_name="VALID_SLOT_TIME",
                reason="Slot end timestamp must be after slot start timestamp.",
            )
        app.scheduled_slot_start = slot_start
        app.scheduled_slot_end = slot_end
        app.assigned_lmo_id = assigned_lmo_id
        app.assigned_gatc_id = assigned_gatc_id
        app.current_status = ApplicationStatusEnum.SCHEDULED
        return app

    @classmethod
    def commence_testing(
        cls, app: VerificationApplication, actor: UserContext
    ) -> VerificationApplication:
        """Verifier opens test session in field."""
        cls._check_tenant(app, actor)
        allowed_roles = {RoleEnum.LMO.value, RoleEnum.GATC_VERIFIER.value, RoleEnum.ADMIN.value}
        if not actor.has_role(*allowed_roles):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=allowed_roles,
                action="COMMENCE_TESTING",
            )
        if app.current_status != ApplicationStatusEnum.SCHEDULED:
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="COMMENCE_TESTING",
                valid_transitions=[ApplicationStatusEnum.SCHEDULED.value],
            )
        app.current_status = ApplicationStatusEnum.VERIFICATION_IN_PROGRESS
        return app

    @classmethod
    def complete_application(
        cls, app: VerificationApplication, session: VerificationSession, actor: UserContext
    ) -> VerificationApplication:
        """Finalize application after linked verification session is finalized."""
        cls._check_tenant(app, actor)
        if app.current_status != ApplicationStatusEnum.VERIFICATION_IN_PROGRESS:
            raise InvalidStateTransitionError(
                entity_type="VerificationApplication",
                entity_id=app.application_id,
                current_state=app.current_status.value,
                attempted_action="COMPLETE_APPLICATION",
                valid_transitions=[ApplicationStatusEnum.VERIFICATION_IN_PROGRESS.value],
            )
        if session.status != SessionStatusEnum.FINALIZED:
            raise GuardConditionFailedError(
                condition_name="SESSION_FINALIZED",
                reason=f"Linked session [{session.session_id}] is not finalized (status: {session.status.value}).",
            )
        app.current_status = ApplicationStatusEnum.COMPLETED
        return app


# ============================================================================
# 4. VERIFICATION SESSION STATE MACHINE
# ============================================================================

class VerificationSessionStateMachine:
    """Explicit state machine governing test session execution and authorized legal disposition."""

    VERIFIER_ROLES = {
        RoleEnum.LMO.value,
        RoleEnum.GATC_VERIFIER.value,
        RoleEnum.ADMIN.value,
    }
    SUPERVISOR_ROLES = {
        RoleEnum.SUPERVISOR.value,
        RoleEnum.CONTROLLER.value,
        RoleEnum.ADMIN.value,
    }

    @classmethod
    def _check_tenant(cls, session: VerificationSession, actor: UserContext) -> None:
        if session.tenant_id != actor.tenant_id and not actor.has_role(RoleEnum.ADMIN):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles={RoleEnum.ADMIN.value},
                action="CROSS_TENANT_ACCESS",
            )

    @classmethod
    def confirm_identity(
        cls, session: VerificationSession, actor: UserContext, serial_verified: bool = True
    ) -> VerificationSession:
        """Verifier confirms physical instrument serial, model, and integrity."""
        cls._check_tenant(session, actor)
        if not actor.has_role(*cls.VERIFIER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.VERIFIER_ROLES,
                action="CONFIRM_IDENTITY",
            )
        if session.status != SessionStatusEnum.PLANNED:
            raise InvalidStateTransitionError(
                entity_type="VerificationSession",
                entity_id=session.session_id,
                current_state=session.status.value,
                attempted_action="CONFIRM_IDENTITY",
                valid_transitions=[SessionStatusEnum.PLANNED.value],
            )
        if not serial_verified:
            raise GuardConditionFailedError(
                condition_name="SERIAL_VERIFICATION",
                reason="Physical instrument serial number must match registry record.",
            )
        session.status = SessionStatusEnum.IDENTITY_CONFIRMED
        return session

    @classmethod
    def start_testing(
        cls,
        session: VerificationSession,
        actor: UserContext,
        test_timestamp: Optional[datetime] = None,
        temp_celsius: Optional[float] = None,
        humidity_pct: Optional[float] = None,
    ) -> VerificationSession:
        """Start executing metrological test steps with pinned reference standards."""
        cls._check_tenant(session, actor)
        if not actor.has_role(*cls.VERIFIER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.VERIFIER_ROLES,
                action="START_TESTING",
            )
        if session.status != SessionStatusEnum.IDENTITY_CONFIRMED:
            raise InvalidStateTransitionError(
                entity_type="VerificationSession",
                entity_id=session.session_id,
                current_state=session.status.value,
                attempted_action="START_TESTING",
                valid_transitions=[SessionStatusEnum.IDENTITY_CONFIRMED.value],
            )
        session.status = SessionStatusEnum.IN_PROGRESS
        session.actual_test_timestamp = test_timestamp or get_utc_now()
        if temp_celsius is not None:
            session.environmental_temp_celsius = temp_celsius
        if humidity_pct is not None:
            session.environmental_humidity_percent = humidity_pct
        return session

    @classmethod
    def submit_observations(
        cls,
        session: VerificationSession,
        actor: UserContext,
        automated_evaluation_passed: bool,
    ) -> VerificationSession:
        """Submit recorded test observations to deterministic calculation review."""
        cls._check_tenant(session, actor)
        if not actor.has_role(*cls.VERIFIER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.VERIFIER_ROLES,
                action="SUBMIT_OBSERVATIONS",
            )
        if session.status != SessionStatusEnum.IN_PROGRESS:
            raise InvalidStateTransitionError(
                entity_type="VerificationSession",
                entity_id=session.session_id,
                current_state=session.status.value,
                attempted_action="SUBMIT_OBSERVATIONS",
                valid_transitions=[SessionStatusEnum.IN_PROGRESS.value],
            )
        session.status = SessionStatusEnum.SUBMITTED
        session.automated_evaluation_flag = automated_evaluation_passed
        return session

    @classmethod
    def record_disposition(
        cls,
        session: VerificationSession,
        actor: UserContext,
        outcome: VerificationOutcomeEnum,
        disposition_notes: Optional[str] = None,
    ) -> VerificationSession:
        """Authorized Legal Metrology Officer records official statutory disposition."""
        cls._check_tenant(session, actor)
        allowed_disposition_roles = cls.VERIFIER_ROLES | cls.SUPERVISOR_ROLES
        if not actor.has_role(*allowed_disposition_roles):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=allowed_disposition_roles,
                action="RECORD_DISPOSITION",
            )
        valid_disposition_states = {
            SessionStatusEnum.SUBMITTED,
            SessionStatusEnum.IN_PROGRESS,
            SessionStatusEnum.IDENTITY_CONFIRMED,
            SessionStatusEnum.PLANNED,
        }
        if session.status not in valid_disposition_states:
            raise InvalidStateTransitionError(
                entity_type="VerificationSession",
                entity_id=session.session_id,
                current_state=session.status.value,
                attempted_action="RECORD_DISPOSITION",
                valid_transitions=[s.value for s in valid_disposition_states],
            )

        # Statutory Guard: Officer cannot grant "PASSED" if deterministic calculation failed
        if outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION:
            if session.automated_evaluation_flag is False:
                raise GuardConditionFailedError(
                    condition_name="DETERMINISTIC_PASS_REQUIRED",
                    reason="Cannot record 'Verification passed' outcome when deterministic metrological evaluation flag is False.",
                )

        session.outcome = outcome
        session.officer_disposition_notes = disposition_notes
        session.finalized_at = get_utc_now()
        session.status = SessionStatusEnum.FINALIZED
        return session


# ============================================================================
# 5. CERTIFICATE STATE MACHINE
# ============================================================================

class CertificateStateMachine:
    """Explicit state machine governing cryptographic digital certificate lifecycle."""

    OFFICER_ROLES = {
        RoleEnum.LMO.value,
        RoleEnum.GATC_VERIFIER.value,
        RoleEnum.SUPERVISOR.value,
        RoleEnum.CONTROLLER.value,
        RoleEnum.ADMIN.value,
    }
    SUPERVISOR_ROLES = {
        RoleEnum.SUPERVISOR.value,
        RoleEnum.CONTROLLER.value,
        RoleEnum.ADMIN.value,
    }

    @classmethod
    def _check_tenant(cls, cert: Certificate, actor: UserContext) -> None:
        if cert.tenant_id != actor.tenant_id and not actor.has_role(RoleEnum.ADMIN):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles={RoleEnum.ADMIN.value},
                action="CROSS_TENANT_ACCESS",
            )

    @classmethod
    def create_draft(
        cls,
        session: VerificationSession,
        certificate_number: str,
        issue_date: date,
        valid_until: date,
        qr_payload: str,
        actor: UserContext,
    ) -> Certificate:
        """Create draft certificate for a finalized passing verification session."""
        if session.status != SessionStatusEnum.FINALIZED:
            raise GuardConditionFailedError(
                condition_name="SESSION_FINALIZED_REQUIRED",
                reason="Cannot create certificate for a session that is not finalized.",
            )
        if session.outcome != VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION:
            outcome_val = session.outcome.value if hasattr(session.outcome, "value") else str(session.outcome)
            raise GuardConditionFailedError(
                condition_name="SESSION_PASSED_REQUIRED",
                reason=f"Cannot create certificate for session with outcome: '{outcome_val}'.",
            )
        if not actor.has_role(*cls.OFFICER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.OFFICER_ROLES,
                action="CREATE_CERTIFICATE_DRAFT",
            )
        if valid_until < issue_date:
            raise GuardConditionFailedError(
                condition_name="VALID_DATE_RANGE",
                reason="Certificate valid_until date cannot be before issue_date.",
            )

        cert = Certificate(
            certificate_number=certificate_number,
            tenant_id=session.tenant_id,
            session_id=session.session_id,
            instrument_id=session.instrument_id,
            owner_id=session.instrument.owner_id if session.instrument else session.tenant_id,
            procedure_pack_id=session.procedure_pack_id,
            verifier_id=session.verifier_id,
            issue_date=issue_date,
            valid_until=valid_until,
            certificate_status=CertificateStatusEnum.DRAFT,
            qr_code_payload=qr_payload,
        )
        return cert

    @classmethod
    def render_and_lock(
        cls,
        cert: Certificate,
        pdf_sha256: str,
        storage_path: str,
        actor: UserContext,
    ) -> Certificate:
        """Snapshot canonical immutable PDF/A bytes and advance to PENDING_SIGNATURE."""
        cls._check_tenant(cert, actor)
        if cert.certificate_status not in (CertificateStatusEnum.DRAFT, CertificateStatusEnum.SIGNING_FAILED):
            raise InvalidStateTransitionError(
                entity_type="Certificate",
                entity_id=cert.certificate_id,
                current_state=cert.certificate_status.value,
                attempted_action="RENDER_AND_LOCK",
                valid_transitions=[CertificateStatusEnum.DRAFT.value, CertificateStatusEnum.SIGNING_FAILED.value],
            )
        if not pdf_sha256 or len(pdf_sha256) != 64:
            raise GuardConditionFailedError(
                condition_name="VALID_SHA256_HASH",
                reason="Canonical certificate payload SHA-256 hash must be exactly 64 hex characters.",
            )
        cert.certificate_bytes_sha256 = pdf_sha256
        cert.pdf_storage_path = storage_path
        cert.certificate_status = CertificateStatusEnum.PENDING_SIGNATURE
        return cert

    @classmethod
    def bind_signature(
        cls,
        cert: Certificate,
        signature_reference: str,
        signer_id: str,
        actor: UserContext,
    ) -> Certificate:
        """Bind cryptographic digital signature and transition to ISSUED state."""
        cls._check_tenant(cert, actor)
        if cert.certificate_status != CertificateStatusEnum.PENDING_SIGNATURE:
            raise InvalidStateTransitionError(
                entity_type="Certificate",
                entity_id=cert.certificate_id,
                current_state=cert.certificate_status.value,
                attempted_action="BIND_SIGNATURE",
                valid_transitions=[CertificateStatusEnum.PENDING_SIGNATURE.value],
            )
        if not signature_reference:
            raise GuardConditionFailedError(
                condition_name="SIGNATURE_REF_REQUIRED",
                reason="Digital signature transaction reference cannot be empty.",
            )

        prev_status = cert.certificate_status
        cert.digital_signature_reference = signature_reference
        cert.signer_id = signer_id
        cert.signature_timestamp = get_utc_now()
        cert.certificate_status = CertificateStatusEnum.ISSUED

        # Append status event
        event = CertificateStatusEvent(
            certificate_id=cert.certificate_id,
            previous_status=prev_status,
            new_status=CertificateStatusEnum.ISSUED,
            actor_id=actor.user_id,
            reason="Certificate cryptographically signed and issued.",
        )
        cert.status_events.append(event)
        return cert

    @classmethod
    def record_signing_failure(
        cls,
        cert: Certificate,
        error_reason: str,
        actor: UserContext,
    ) -> Certificate:
        """Record signature provider failure to allow controlled retry."""
        cls._check_tenant(cert, actor)
        if cert.certificate_status != CertificateStatusEnum.PENDING_SIGNATURE:
            raise InvalidStateTransitionError(
                entity_type="Certificate",
                entity_id=cert.certificate_id,
                current_state=cert.certificate_status.value,
                attempted_action="RECORD_SIGNING_FAILURE",
                valid_transitions=[CertificateStatusEnum.PENDING_SIGNATURE.value],
            )
        prev_status = cert.certificate_status
        cert.certificate_status = CertificateStatusEnum.SIGNING_FAILED

        event = CertificateStatusEvent(
            certificate_id=cert.certificate_id,
            previous_status=prev_status,
            new_status=CertificateStatusEnum.SIGNING_FAILED,
            actor_id=actor.user_id,
            reason=f"Signing provider failed: {error_reason}",
        )
        cert.status_events.append(event)
        return cert

    @classmethod
    def suspend_certificate(
        cls,
        cert: Certificate,
        reason: str,
        authority_ref: str,
        actor: UserContext,
    ) -> Certificate:
        """Temporarily suspend certificate during enforcement inquiry."""
        cls._check_tenant(cert, actor)
        if not actor.has_role(*cls.OFFICER_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.OFFICER_ROLES,
                action="SUSPEND_CERTIFICATE",
            )
        if cert.certificate_status != CertificateStatusEnum.ISSUED:
            raise InvalidStateTransitionError(
                entity_type="Certificate",
                entity_id=cert.certificate_id,
                current_state=cert.certificate_status.value,
                attempted_action="SUSPEND_CERTIFICATE",
                valid_transitions=[CertificateStatusEnum.ISSUED.value],
            )
        prev_status = cert.certificate_status
        cert.certificate_status = CertificateStatusEnum.SUSPENDED

        event = CertificateStatusEvent(
            certificate_id=cert.certificate_id,
            previous_status=prev_status,
            new_status=CertificateStatusEnum.SUSPENDED,
            actor_id=actor.user_id,
            reason=reason,
            statutory_authority_reference=authority_ref,
        )
        cert.status_events.append(event)
        return cert

    @classmethod
    def reinstate_certificate(
        cls,
        cert: Certificate,
        reason: str,
        authority_ref: str,
        actor: UserContext,
    ) -> Certificate:
        """Reinstate suspended certificate following clean inquiry."""
        cls._check_tenant(cert, actor)
        if not actor.has_role(*cls.SUPERVISOR_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.SUPERVISOR_ROLES,
                action="REINSTATE_CERTIFICATE",
            )
        if cert.certificate_status != CertificateStatusEnum.SUSPENDED:
            raise InvalidStateTransitionError(
                entity_type="Certificate",
                entity_id=cert.certificate_id,
                current_state=cert.certificate_status.value,
                attempted_action="REINSTATE_CERTIFICATE",
                valid_transitions=[CertificateStatusEnum.SUSPENDED.value],
            )
        prev_status = cert.certificate_status
        cert.certificate_status = CertificateStatusEnum.ISSUED

        event = CertificateStatusEvent(
            certificate_id=cert.certificate_id,
            previous_status=prev_status,
            new_status=CertificateStatusEnum.ISSUED,
            actor_id=actor.user_id,
            reason=reason,
            statutory_authority_reference=authority_ref,
        )
        cert.status_events.append(event)
        return cert

    @classmethod
    def revoke_certificate(
        cls,
        cert: Certificate,
        reason: str,
        authority_ref: str,
        actor: UserContext,
    ) -> Certificate:
        """Formally revoke certificate due to tampering or metrological fraud."""
        cls._check_tenant(cert, actor)
        if not actor.has_role(*cls.SUPERVISOR_ROLES):
            raise UnauthorizedTransitionError(
                actor_id=actor.user_id,
                actor_role=actor.role_str(),
                required_roles=cls.SUPERVISOR_ROLES,
                action="REVOKE_CERTIFICATE",
            )
        if cert.certificate_status not in (CertificateStatusEnum.ISSUED, CertificateStatusEnum.SUSPENDED):
            raise InvalidStateTransitionError(
                entity_type="Certificate",
                entity_id=cert.certificate_id,
                current_state=cert.certificate_status.value,
                attempted_action="REVOKE_CERTIFICATE",
                valid_transitions=[CertificateStatusEnum.ISSUED.value, CertificateStatusEnum.SUSPENDED.value],
            )
        prev_status = cert.certificate_status
        cert.certificate_status = CertificateStatusEnum.REVOKED

        event = CertificateStatusEvent(
            certificate_id=cert.certificate_id,
            previous_status=prev_status,
            new_status=CertificateStatusEnum.REVOKED,
            actor_id=actor.user_id,
            reason=reason,
            statutory_authority_reference=authority_ref,
        )
        cert.status_events.append(event)
        return cert

    @classmethod
    def supersede_certificate(
        cls,
        old_cert: Certificate,
        new_certificate_id: str,
        reason: str,
        actor: UserContext,
    ) -> Certificate:
        """Mark certificate as superseded when periodic re-verification certificate is issued."""
        cls._check_tenant(old_cert, actor)
        if old_cert.certificate_status not in (CertificateStatusEnum.ISSUED, CertificateStatusEnum.SUSPENDED):
            raise InvalidStateTransitionError(
                entity_type="Certificate",
                entity_id=old_cert.certificate_id,
                current_state=old_cert.certificate_status.value,
                attempted_action="SUPERSEDE_CERTIFICATE",
                valid_transitions=[CertificateStatusEnum.ISSUED.value, CertificateStatusEnum.SUSPENDED.value],
            )
        prev_status = old_cert.certificate_status
        old_cert.superseding_certificate_id = new_certificate_id
        old_cert.certificate_status = CertificateStatusEnum.SUPERSEDED

        event = CertificateStatusEvent(
            certificate_id=old_cert.certificate_id,
            previous_status=prev_status,
            new_status=CertificateStatusEnum.SUPERSEDED,
            actor_id=actor.user_id,
            reason=f"Superseded by certificate [{new_certificate_id}]: {reason}",
        )
        old_cert.status_events.append(event)
        return old_cert

    @classmethod
    def expire_certificate(
        cls,
        cert: Certificate,
        actor: UserContext,
        as_of_date: Optional[date] = None,
    ) -> Certificate:
        """Expire certificate past valid_until date."""
        cls._check_tenant(cert, actor)
        check_date = as_of_date or date.today()
        if cert.certificate_status != CertificateStatusEnum.ISSUED:
            raise InvalidStateTransitionError(
                entity_type="Certificate",
                entity_id=cert.certificate_id,
                current_state=cert.certificate_status.value,
                attempted_action="EXPIRE_CERTIFICATE",
                valid_transitions=[CertificateStatusEnum.ISSUED.value],
            )
        if check_date <= cert.valid_until:
            raise GuardConditionFailedError(
                condition_name="EXPIRY_DATE_REACHED",
                reason=f"Certificate valid until {cert.valid_until}, cannot expire as of {check_date}.",
            )
        prev_status = cert.certificate_status
        cert.certificate_status = CertificateStatusEnum.EXPIRED

        event = CertificateStatusEvent(
            certificate_id=cert.certificate_id,
            previous_status=prev_status,
            new_status=CertificateStatusEnum.EXPIRED,
            actor_id=actor.user_id,
            reason=f"Certificate expired as of {check_date}.",
        )
        cert.status_events.append(event)
        return cert
