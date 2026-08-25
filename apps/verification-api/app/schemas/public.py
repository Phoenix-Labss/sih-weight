"""Pydantic v2 schemas for Public Certificate Verification Projection (Privacy-Preserving / Zero PII).
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, Optional
from pydantic import Field

from app.models.certificate import CertificateStatusEnum
from app.schemas.common import BaseSchema


class PublicCertificateVerifyResponse(BaseSchema):
    """Safe, privacy-preserving public verification projection for consumer and trader QR scans."""
    certificate_number: str = Field(..., description="Official statutory certificate identifier")
    status: CertificateStatusEnum = Field(..., description="Current lifecycle status (ISSUED, EXPIRED, SUSPENDED, REVOKED, SUPERSEDED)")
    issuing_authority: str = Field(..., description="Statutory Legal Metrology Department / Office authority description")
    instrument_summary: Dict[str, Any] = Field(
        ...,
        description="Safe non-PII technical summary: category, model, accuracy class, capacity, unit, masked serial",
    )
    verification_date: date = Field(..., description="Date of statutory testing and issuance")
    valid_until: date = Field(..., description="Statutory expiry / re-verification due date")
    cryptographic_validity: str = Field(
        "VALID_SIGNATURE",
        description="Cryptographic signature verification status ('VALID_SIGNATURE', 'INVALID_SIGNATURE', 'UNCHECKED')",
    )
    certificate_hash: str = Field(..., description="Canonical SHA-256 integrity hash")
    superseded_by: Optional[str] = Field(None, description="Public verification token of superseding certificate if superseded")
    revocation_reason: Optional[str] = Field(None, description="Official public statutory revocation reason if revoked")
