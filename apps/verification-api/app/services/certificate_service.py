"""Service layer for Digital Certificates, Cryptographic Signing, and Lifecycle Management.
"""

from __future__ import annotations

import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import UserContext
from app.core.crypto import (
    DigitalSignatureAdapter,
    SignerContext,
    calculate_sha256_hex,
    canonical_json_bytes,
    default_signature_adapter,
    generate_high_entropy_token,
)
from app.core.errors import ForbiddenError, NotFoundError, UnprocessableError
from app.core.permissions import verify_tenant_access
from app.core.state_machines import (
    CertificateStateMachine,
    ApplicationStateMachine,
    UserContext as SmUserContext,
)
from app.models.application import ApplicationStatusEnum
from app.models.certificate import (
    Certificate,
    CertificateStatusEnum,
)
from app.models.instrument import Instrument, InstrumentStatusEnum
from app.models.session import (
    SessionStatusEnum,
    VerificationOutcomeEnum,
    VerificationSession,
)
from app.models.stakeholder import RoleEnum
from app.schemas.certificate import (
    CertificateIssueRequest,
    CertificateStatusUpdateRequest,
)


def _to_sm_context(actor: UserContext) -> SmUserContext:
    return SmUserContext(
        user_id=actor.user_id,
        tenant_id=actor.tenant_id,
        role=actor.role,
        jurisdiction_id=actor.jurisdiction_id,
        is_active=actor.is_active,
    )


def generate_certificate_payload_dict(cert: Certificate, session: VerificationSession, actor: UserContext) -> dict:
    """Construct deterministic canonical dictionary for SHA-256 hash generation."""
    model = session.instrument.model if session.instrument else None
    return {
        "certificate_number": cert.certificate_number,
        "tenant_id": cert.tenant_id,
        "instrument": {
            "category": model.category if model else "NAWI",
            "subtype": model.subtype if model else "ELECTRONIC_SCALE",
            "manufacturer": model.manufacturer_name if model else "N/A",
            "model_name": model.model_name if model else "N/A",
            "model_approval_number": model.model_approval_number if model else "N/A",
            "serial_number": session.instrument.serial_number if session.instrument else "N/A",
            "accuracy_class": model.accuracy_class.value if model else "CLASS_III",
            "max_capacity": str(model.max_capacity) if model else "0",
            "min_capacity": str(model.min_capacity) if model else "0",
            "scale_interval_e": str(model.verification_scale_interval_e) if model else "0",
            "unit": model.capacity_unit if model else "kg",
        },
        "session": {
            "session_id": session.session_id,
            "procedure_pack_id": session.procedure_pack_id,
            "procedure_pack_checksum": session.procedure_pack_checksum,
            "outcome": session.outcome.value if session.outcome else "N/A",
        },
        "reference_standards": [
            {
                "standard_id": r.standard_id,
                "certificate": r.snapshot_calibration_certificate,
                "valid_until": r.snapshot_valid_until.isoformat() if hasattr(r.snapshot_valid_until, "isoformat") else str(r.snapshot_valid_until),
            }
            for r in session.reference_standards
        ],
        "verifier": {
            "officer_id": actor.user_id,
            "role": actor.role_str(),
            "jurisdiction_id": actor.jurisdiction_id or "N/A",
        },
        "validity": {
            "issue_date": cert.issue_date.isoformat(),
            "valid_until": cert.valid_until.isoformat(),
        },
    }


class CertificateService:
    """Business logic for certificate generation, signing, and verification."""

    @staticmethod
    def issue_certificate(
        db: Session,
        tenant_id: str,
        data: CertificateIssueRequest,
        actor: UserContext,
        signature_adapter: Optional[DigitalSignatureAdapter] = None,
    ) -> Certificate:
        """Issue digitally signed verification certificate for a passing session."""
        verify_tenant_access(actor, tenant_id)
        adapter = signature_adapter or default_signature_adapter

        # 1. Load session
        session = db.execute(
            select(VerificationSession)
            .options(
                joinedload(VerificationSession.reference_standards),
                joinedload(VerificationSession.instrument).joinedload(Instrument.model),
                joinedload(VerificationSession.observations),
            )
            .where(
                VerificationSession.tenant_id == tenant_id,
                VerificationSession.session_id == data.session_id,
            )
        ).unique().scalar_one_or_none()

        if not session:
            raise NotFoundError(f"Verification session [{data.session_id}] not found in tenant [{tenant_id}]")

        sm_actor = _to_sm_context(actor)

        # 2. Compute certificate dates and numbers
        issue_date = date.today()
        valid_until = issue_date + relativedelta(months=data.validity_months)
        year = issue_date.year
        rand_seq = random.randint(100000, 999999)
        cert_number = f"{tenant_id}/LM/{year}/CERT-{rand_seq}"
        qr_token = generate_high_entropy_token("cert_tok_")
        qr_payload = f"https://verify.legalmetrology.gov.in/v/{qr_token}"

        # 3. Create Draft Certificate via State Machine
        cert = CertificateStateMachine.create_draft(
            session=session,
            certificate_number=cert_number,
            issue_date=issue_date,
            valid_until=valid_until,
            qr_payload=qr_payload,
            actor=sm_actor,
        )
        cert.public_verification_token = qr_token
        db.add(cert)
        db.flush()

        # 4. Generate deterministic canonical payload & SHA-256 hash
        payload_dict = generate_certificate_payload_dict(cert, session, actor)
        canon_bytes = canonical_json_bytes(payload_dict)
        sha256_hex = calculate_sha256_hex(canon_bytes)

        # 5. Render and Lock (PENDING_SIGNATURE)
        storage_path = f"s3://legal-metrology-certificates/{tenant_id}/{cert.certificate_id}.pdf"
        CertificateStateMachine.render_and_lock(
            cert=cert,
            pdf_sha256=sha256_hex,
            storage_path=storage_path,
            actor=sm_actor,
        )

        # 6. Sign Canonical Hash using Digital Signature Adapter
        signer_ctx = SignerContext(
            signer_id=actor.user_id,
            signer_role=actor.role_str(),
            jurisdiction_id=actor.jurisdiction_id or tenant_id,
            certificate_id=cert.certificate_id,
            signer_name=actor.full_name,
        )
        sig_result = adapter.sign_hash(sha256_hex, signer_ctx)

        # 7. Bind Signature (ISSUED)
        sig_ref_combined = f"{sig_result.signature_bytes_base64}:{sig_result.key_identifier}"
        CertificateStateMachine.bind_signature(
            cert=cert,
            signature_reference=sig_ref_combined,
            signer_id=actor.user_id,
            actor=sm_actor,
        )




        # 8. Check for and supersede any existing active certificate for this instrument
        existing_active_certs = db.execute(
            select(Certificate).where(
                Certificate.tenant_id == tenant_id,
                Certificate.instrument_id == session.instrument_id,
                Certificate.certificate_id != cert.certificate_id,
                Certificate.certificate_status.in_([CertificateStatusEnum.ISSUED, CertificateStatusEnum.SUSPENDED]),
            )
        ).scalars().all()

        for prev_cert in existing_active_certs:
            CertificateStateMachine.supersede_certificate(
                old_cert=prev_cert,
                new_certificate_id=cert.certificate_id,
                reason="Statutory periodic re-verification certificate issued.",
                actor=sm_actor,
            )

        # 9. Update Instrument verification status
        if session.instrument:
            session.instrument.latest_certificate_id = cert.certificate_id
            session.instrument.verification_due_date = cert.valid_until
            session.instrument.current_status = InstrumentStatusEnum.ACTIVE_VERIFIED

        # 10. Complete linked application if present
        if session.application:
            try:
                if session.application.current_status != ApplicationStatusEnum.COMPLETED:
                    ApplicationStateMachine.complete_application(session.application, session, sm_actor)
            except Exception:
                session.application.current_status = ApplicationStatusEnum.COMPLETED

        db.flush()
        db.refresh(cert)
        return cert

    @staticmethod
    def update_certificate_status(
        db: Session,
        tenant_id: str,
        certificate_id: str,
        data: CertificateStatusUpdateRequest,
        actor: UserContext,
    ) -> Certificate:
        """Update certificate status (SUSPEND, REINSTATE, REVOKE, SUPERSEDE, EXPIRE)."""
        cert = CertificateService.get_certificate(db, tenant_id, certificate_id, actor)
        sm_actor = _to_sm_context(actor)

        action_upper = data.action.upper()
        auth_ref = data.statutory_authority_reference or f"ORDER-{tenant_id}-{random.randint(1000, 9999)}"

        if action_upper == "SUSPEND":
            CertificateStateMachine.suspend_certificate(
                cert=cert,
                reason=data.reason,
                authority_ref=auth_ref,
                actor=sm_actor,
            )
        elif action_upper == "REINSTATE":
            CertificateStateMachine.reinstate_certificate(
                cert=cert,
                reason=data.reason,
                authority_ref=auth_ref,
                actor=sm_actor,
            )
        elif action_upper == "REVOKE":
            CertificateStateMachine.revoke_certificate(
                cert=cert,
                reason=data.reason,
                authority_ref=auth_ref,
                actor=sm_actor,
            )
            if cert.instrument:
                cert.instrument.current_status = InstrumentStatusEnum.REJECTED
        elif action_upper == "SUPERSEDE":
            if not data.superseding_certificate_id:
                raise UnprocessableError("Superseding certificate ID required for supersession.")
            CertificateStateMachine.supersede_certificate(
                old_cert=cert,
                new_certificate_id=data.superseding_certificate_id,
                reason=data.reason,
                actor=sm_actor,
            )
        elif action_upper == "EXPIRE":
            CertificateStateMachine.expire_certificate(
                cert=cert,
                actor=sm_actor,
                as_of_date=cert.valid_until + timedelta(days=1),
            )
            if cert.instrument:
                cert.instrument.current_status = InstrumentStatusEnum.VERIFICATION_EXPIRED
        else:
            raise UnprocessableError(f"Unsupported certificate action: '{data.action}'.")

        db.flush()
        db.refresh(cert)
        return cert

    @staticmethod
    def get_certificate(
        db: Session,
        tenant_id: str,
        certificate_id: str,
        actor: UserContext,
    ) -> Certificate:
        """Retrieve certificate details with status events."""
        verify_tenant_access(actor, tenant_id)

        cert = db.execute(
            select(Certificate)
            .options(
                joinedload(Certificate.status_events),
                joinedload(Certificate.instrument).joinedload(Instrument.model),
            )
            .where(
                Certificate.tenant_id == tenant_id,
                (Certificate.certificate_id == certificate_id)
                | (Certificate.certificate_number == certificate_id)
                | (Certificate.public_verification_token == certificate_id)
            )
        ).unique().scalar_one_or_none()


        if not cert:
            raise NotFoundError(f"Certificate [{certificate_id}] not found in tenant [{tenant_id}]")


        if actor.has_role(RoleEnum.OWNER) and not actor.has_role(RoleEnum.ADMIN, RoleEnum.LMO, RoleEnum.SUPERVISOR):

            is_own = (
                cert.owner_id == actor.user_id
                or (cert.owner and cert.owner.email == actor.email)
            )
            if not is_own and actor.email:
                if cert.owner and cert.owner.email != actor.email:
                    raise ForbiddenError("You do not have permission to view this certificate.")

        return cert


    @staticmethod
    def list_certificates(
        db: Session,
        tenant_id: str,
        page: int = 1,
        page_size: int = 50,
        actor: Optional[UserContext] = None,
    ) -> Tuple[List[Certificate], int]:
        """List and paginate certificates."""
        if actor:
            verify_tenant_access(actor, tenant_id)

        stmt = (
            select(Certificate)
            .options(
                joinedload(Certificate.status_events),
                joinedload(Certificate.instrument),
            )
            .where(Certificate.tenant_id == tenant_id)
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
            owner_ids = {actor.user_id}
            for s in stk_match:
                owner_ids.add(s.stakeholder_id)
            stmt = stmt.where(Certificate.owner_id.in_(list(owner_ids)))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        offset = (page - 1) * page_size
        results = db.execute(stmt.offset(offset).limit(page_size)).unique().scalars().all()
        return list(results), total
