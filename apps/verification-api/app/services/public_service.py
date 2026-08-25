"""Service layer for Public Certificate Verification and Opaque QR Token Resolution.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.crypto import (
    DigitalSignatureAdapter,
    default_signature_adapter,
)
from app.core.errors import NotFoundError
from app.models.certificate import (
    Certificate,
    CertificateStatusEnum,
)
from app.models.instrument import Instrument
from app.models.tenant import Tenant
from app.schemas.public import PublicCertificateVerifyResponse


def mask_serial_number(serial: str) -> str:
    """Mask instrument serial number to prevent enumeration while allowing on-site physical check."""
    if len(serial) <= 4:
        return f"****{serial[-2:]}" if len(serial) >= 2 else "****"
    return f"{serial[:2]}-****-{serial[-4:]}"


class PublicService:
    """Business logic for public verification projection with zero PII leakage."""

    @staticmethod
    def verify_public_certificate(
        db: Session,
        qr_reference: str,
        signature_adapter: Optional[DigitalSignatureAdapter] = None,
    ) -> PublicCertificateVerifyResponse:
        """Resolve opaque QR token to safe, privacy-preserving public certificate projection."""
        adapter = signature_adapter or default_signature_adapter

        # Normalize reference if URL passed
        token_cleaned = qr_reference.strip()
        if "/v/" in token_cleaned:
            token_cleaned = token_cleaned.split("/v/")[-1]

        cert = db.execute(
            select(Certificate)
            .options(
                joinedload(Certificate.instrument).joinedload(Instrument.model),
                joinedload(Certificate.tenant),
                joinedload(Certificate.status_events),
                joinedload(Certificate.superseding_certificate),
            )
            .where(
                (Certificate.public_verification_token == token_cleaned)
                | (Certificate.certificate_number == token_cleaned)
            )
        ).unique().scalar_one_or_none()

        if not cert:
            raise NotFoundError(
                f"Statutory certificate for verification token [{qr_reference}] not found or revoked from public index.",
                error_code="CERTIFICATE_NOT_FOUND",
            )

        # 1. Verify Cryptographic Signature
        crypto_validity = "VALID_SIGNATURE"
        if cert.certificate_bytes_sha256 and cert.digital_signature_reference:
            if ":" in cert.digital_signature_reference:
                sig_b64, key_id = cert.digital_signature_reference.split(":", 1)
            else:
                sig_b64 = cert.digital_signature_reference
                key_id = f"key_{cert.signer_id}_{cert.tenant_id}"

            is_valid = adapter.verify_signature(
                canonical_hash=cert.certificate_bytes_sha256,
                signature_base64=sig_b64,
                key_identifier=key_id,
            )
            if not is_valid:
                crypto_validity = "INVALID_SIGNATURE"
        else:
            crypto_validity = "UNCHECKED"



        # 2. Build Safe Instrument Technical Summary (Non-PII)
        model = cert.instrument.model if cert.instrument else None
        raw_serial = cert.instrument.serial_number if cert.instrument else "UNKNOWN"
        instrument_summary: Dict[str, Any] = {
            "category": model.category if model else "NAWI",
            "subtype": model.subtype if model else "ELECTRONIC_SCALE",
            "manufacturer": model.manufacturer_name if model else "N/A",
            "model_name": model.model_name if model else "N/A",
            "accuracy_class": model.accuracy_class.value if model else "CLASS_III",
            "max_capacity": str(model.max_capacity) if model else "0",
            "min_capacity": str(model.min_capacity) if model else "0",
            "scale_interval_e": str(model.verification_scale_interval_e) if model else "0",
            "unit": model.capacity_unit if model else "kg",
            "serial_number_masked": mask_serial_number(raw_serial),
        }

        # 3. Issuing Authority Text
        state_name = cert.tenant.state_name if cert.tenant else cert.tenant_id
        issuing_authority = f"Department of Legal Metrology, Government of {state_name}"

        # 4. Handle Superseded Reference
        superseded_token = None
        if cert.superseding_certificate:
            superseded_token = cert.superseding_certificate.public_verification_token

        # 5. Handle Revocation Reason
        revocation_reason = None
        if cert.certificate_status == CertificateStatusEnum.REVOKED:
            for ev in reversed(cert.status_events):
                if ev.new_status == CertificateStatusEnum.REVOKED:
                    revocation_reason = ev.reason
                    break
            if not revocation_reason:
                revocation_reason = "Revoked by statutory order of Legal Metrology Authority."

        return PublicCertificateVerifyResponse(
            certificate_number=cert.certificate_number,
            status=cert.certificate_status,
            issuing_authority=issuing_authority,
            instrument_summary=instrument_summary,
            verification_date=cert.issue_date,
            valid_until=cert.valid_until,
            cryptographic_validity=crypto_validity,
            certificate_hash=cert.certificate_bytes_sha256 or "N/A",
            superseded_by=superseded_token,
            revocation_reason=revocation_reason,
        )
