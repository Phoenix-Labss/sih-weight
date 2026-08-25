"""Unit tests for Digital Certificate state machine transitions, signature bindings, and audit events."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest

from app.core.state_machines import (
    CertificateStateMachine,
    UserContext,
    InvalidStateTransitionError,
    UnauthorizedTransitionError,
    GuardConditionFailedError,
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
def lmo_context():
    return UserContext(user_id="usr-lmo-3", tenant_id="IN-KA", role=RoleEnum.LMO, jurisdiction_id="KA-BLR-N")


@pytest.fixture
def supervisor_context():
    return UserContext(user_id="usr-sup-3", tenant_id="IN-KA", role=RoleEnum.SUPERVISOR, jurisdiction_id="KA-BLR-N")


@pytest.fixture
def applicant_context():
    return UserContext(user_id="usr-app-3", tenant_id="IN-KA", role=RoleEnum.APPLICANT)


@pytest.fixture
def other_tenant_context():
    return UserContext(user_id="usr-other-3", tenant_id="IN-TN", role=RoleEnum.LMO)


@pytest.fixture
def finalized_passed_session():
    return VerificationSession(
        session_id="sess-passed-99",
        tenant_id="IN-KA",
        application_id="app-99",
        instrument_id="inst-99",
        procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
        procedure_pack_checksum="f"*64,
        verifier_id="usr-lmo-3",
        verifier_role="LMO",
        scheduled_date=date.today(),
        status=SessionStatusEnum.FINALIZED,
        outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
    )


class TestCertificateStateMachine:
    """Test suite covering the formal Digital Certificate State Machine."""

    def test_full_successful_issuance_flow(self, finalized_passed_session, lmo_context):
        """Test complete flow: draft creation -> PDF snapshot -> DSC binding -> ISSUED."""
        session = finalized_passed_session

        # 1. Create Draft Certificate
        cert = CertificateStateMachine.create_draft(
            session=session,
            certificate_number="LM-CERT/IN-KA/2026/0001",
            issue_date=date(2026, 8, 23),
            valid_until=date(2027, 8, 22),
            qr_payload="https://verify.legalmetrology.gov.in/qr/cert_testtoken123",
            actor=lmo_context,
        )
        assert cert.certificate_status == CertificateStatusEnum.DRAFT
        assert cert.certificate_number == "LM-CERT/IN-KA/2026/0001"
        assert cert.public_verification_token.startswith("cert_")

        # 2. Render and Lock Canonical Payload
        pdf_hash = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"
        CertificateStateMachine.render_and_lock(
            cert=cert,
            pdf_sha256=pdf_hash,
            storage_path="s3://lm-certificates/2026/IN-KA/cert-0001.pdf",
            actor=lmo_context,
        )
        assert cert.certificate_status == CertificateStatusEnum.PENDING_SIGNATURE
        assert cert.certificate_bytes_sha256 == pdf_hash

        # 3. Bind Digital Signature
        CertificateStateMachine.bind_signature(
            cert=cert,
            signature_reference="DSC-TXN-KA-991823",
            signer_id=lmo_context.user_id,
            actor=lmo_context,
        )
        assert cert.certificate_status == CertificateStatusEnum.ISSUED
        assert cert.digital_signature_reference == "DSC-TXN-KA-991823"
        assert cert.signature_timestamp is not None
        assert len(cert.status_events) == 1
        assert cert.status_events[0].new_status == CertificateStatusEnum.ISSUED

    def test_draft_creation_guard_fails_on_unfinalized_session(self, lmo_context):
        """Test draft creation fails if session is not finalized."""
        session = VerificationSession(
            session_id="sess-unfinalized",
            tenant_id="IN-KA",
            application_id="app-1",
            instrument_id="inst-1",
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            procedure_pack_checksum="f"*64,
            verifier_id="usr-lmo-3",
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.IN_PROGRESS,
        )
        with pytest.raises(GuardConditionFailedError) as exc:
            CertificateStateMachine.create_draft(
                session=session,
                certificate_number="LM-CERT/IN-KA/2026/0002",
                issue_date=date(2026, 8, 23),
                valid_until=date(2027, 8, 22),
                qr_payload="https://verify.gov.in/qr/cert_2",
                actor=lmo_context,
            )
        assert "session that is not finalized" in str(exc.value)

    def test_draft_creation_guard_fails_on_failed_outcome(self, lmo_context):
        """Test draft creation fails if session outcome is FAILED."""
        session = VerificationSession(
            session_id="sess-failed",
            tenant_id="IN-KA",
            application_id="app-1",
            instrument_id="inst-1",
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            procedure_pack_checksum="f"*64,
            verifier_id="usr-lmo-3",
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.FINALIZED,
            outcome=VerificationOutcomeEnum.VERIFICATION_FAILED,
        )
        with pytest.raises(GuardConditionFailedError) as exc:
            CertificateStateMachine.create_draft(
                session=session,
                certificate_number="LM-CERT/IN-KA/2026/0003",
                issue_date=date(2026, 8, 23),
                valid_until=date(2027, 8, 22),
                qr_payload="https://verify.gov.in/qr/cert_3",
                actor=lmo_context,
            )
        assert "outcome: 'Verification failed'" in str(exc.value)

    def test_signing_failure_and_retry(self, finalized_passed_session, lmo_context):
        """Test signing error status event and subsequent successful retry."""
        cert = CertificateStateMachine.create_draft(
            session=finalized_passed_session,
            certificate_number="LM-CERT/IN-KA/2026/0004",
            issue_date=date(2026, 8, 23),
            valid_until=date(2027, 8, 22),
            qr_payload="https://verify.gov.in/qr/cert_4",
            actor=lmo_context,
        )
        pdf_hash = "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff"
        CertificateStateMachine.render_and_lock(cert, pdf_hash, "s3://certs/cert-4.pdf", lmo_context)

        # Provider timeout
        CertificateStateMachine.record_signing_failure(cert, "HSM gateway timeout (504)", lmo_context)
        assert cert.certificate_status == CertificateStatusEnum.SIGNING_FAILED
        assert cert.status_events[-1].new_status == CertificateStatusEnum.SIGNING_FAILED

        # Re-lock for retry
        CertificateStateMachine.render_and_lock(cert, pdf_hash, "s3://certs/cert-4.pdf", lmo_context)
        assert cert.certificate_status == CertificateStatusEnum.PENDING_SIGNATURE

        # Successful retry
        CertificateStateMachine.bind_signature(cert, "DSC-RETRY-SUCCESS-991", lmo_context.user_id, lmo_context)
        assert cert.certificate_status == CertificateStatusEnum.ISSUED

    def test_suspension_and_reinstatement_cycle(self, finalized_passed_session, lmo_context, supervisor_context):
        """Test suspending certificate during inquiry and reinstatement upon clearance."""
        cert = CertificateStateMachine.create_draft(
            session=finalized_passed_session,
            certificate_number="LM-CERT/IN-KA/2026/0005",
            issue_date=date(2026, 8, 23),
            valid_until=date(2027, 8, 22),
            qr_payload="https://verify.gov.in/qr/cert_5",
            actor=lmo_context,
        )
        CertificateStateMachine.render_and_lock(cert, "a"*64, "s3://certs/cert-5.pdf", lmo_context)
        CertificateStateMachine.bind_signature(cert, "DSC-OK-01", lmo_context.user_id, lmo_context)

        # Officer suspends certificate
        CertificateStateMachine.suspend_certificate(
            cert,
            reason="Consumer grievance filed regarding suspected meter calibration manipulation.",
            authority_ref="Notice No. KA/LM/ENF-2026/881",
            actor=lmo_context,
        )
        assert cert.certificate_status == CertificateStatusEnum.SUSPENDED
        assert cert.status_events[-1].new_status == CertificateStatusEnum.SUSPENDED

        # Supervisor reinstates certificate after clean inspection
        CertificateStateMachine.reinstate_certificate(
            cert,
            reason="Surprise departmental re-inspection verified seals intact and calibration accurate within MPE.",
            authority_ref="Order No. KA/LM/ENF-2026/881-A",
            actor=supervisor_context,
        )
        assert cert.certificate_status == CertificateStatusEnum.ISSUED
        assert cert.status_events[-1].new_status == CertificateStatusEnum.ISSUED

    def test_revocation_workflow(self, finalized_passed_session, lmo_context, supervisor_context):
        """Test certificate revocation upon confirmed tampering."""
        cert = CertificateStateMachine.create_draft(
            session=finalized_passed_session,
            certificate_number="LM-CERT/IN-KA/2026/0006",
            issue_date=date(2026, 8, 23),
            valid_until=date(2027, 8, 22),
            qr_payload="https://verify.gov.in/qr/cert_6",
            actor=lmo_context,
        )
        CertificateStateMachine.render_and_lock(cert, "b"*64, "s3://certs/cert-6.pdf", lmo_context)
        CertificateStateMachine.bind_signature(cert, "DSC-OK-02", lmo_context.user_id, lmo_context)

        CertificateStateMachine.revoke_certificate(
            cert,
            reason="Confirmed physical seal tampering and load cell bypass under Section 25.",
            authority_ref="Revocation Order No. KA/LM/REV-2026/11",
            actor=supervisor_context,
        )
        assert cert.certificate_status == CertificateStatusEnum.REVOKED
        assert cert.status_events[-1].new_status == CertificateStatusEnum.REVOKED

    def test_supersession_workflow(self, finalized_passed_session, lmo_context):
        """Test superseding old certificate when periodic re-verification certificate is issued."""
        old_cert = CertificateStateMachine.create_draft(
            session=finalized_passed_session,
            certificate_number="LM-CERT/IN-KA/2025/OLD-01",
            issue_date=date(2025, 8, 23),
            valid_until=date(2026, 8, 22),
            qr_payload="https://verify.gov.in/qr/cert_old",
            actor=lmo_context,
        )
        CertificateStateMachine.render_and_lock(old_cert, "c"*64, "s3://certs/old.pdf", lmo_context)
        CertificateStateMachine.bind_signature(old_cert, "DSC-OLD", lmo_context.user_id, lmo_context)

        new_cert_id = "cert-new-2026-99"
        CertificateStateMachine.supersede_certificate(
            old_cert=old_cert,
            new_certificate_id=new_cert_id,
            reason="Annual periodic re-verification completed.",
            actor=lmo_context,
        )
        assert old_cert.certificate_status == CertificateStatusEnum.SUPERSEDED
        assert old_cert.superseding_certificate_id == new_cert_id
        assert old_cert.status_events[-1].new_status == CertificateStatusEnum.SUPERSEDED

    def test_expiry_workflow(self, finalized_passed_session, lmo_context):
        """Test expiring certificate past validity date."""
        cert = CertificateStateMachine.create_draft(
            session=finalized_passed_session,
            certificate_number="LM-CERT/IN-KA/2025/EXP-01",
            issue_date=date(2025, 1, 1),
            valid_until=date(2026, 1, 1),
            qr_payload="https://verify.gov.in/qr/cert_exp",
            actor=lmo_context,
        )
        CertificateStateMachine.render_and_lock(cert, "d"*64, "s3://certs/exp.pdf", lmo_context)
        CertificateStateMachine.bind_signature(cert, "DSC-EXP", lmo_context.user_id, lmo_context)

        # Expiry before valid_until fails guard
        with pytest.raises(GuardConditionFailedError):
            CertificateStateMachine.expire_certificate(cert, actor=lmo_context, as_of_date=date(2025, 6, 1))

        # Expiry after valid_until succeeds
        CertificateStateMachine.expire_certificate(cert, actor=lmo_context, as_of_date=date(2026, 1, 2))
        assert cert.certificate_status == CertificateStatusEnum.EXPIRED
