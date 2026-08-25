"""Pydantic v2 schemas for Digital Certificates, Cryptographic Signatures, and Status Events.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from pydantic import ConfigDict, Field

from app.models.certificate import CertificateStatusEnum
from app.schemas.common import BaseSchema


class CertificateIssueRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(..., min_length=1, max_length=36)
    validity_months: int = Field(12, ge=1, le=60, description="Validity period in months (default 12 for annual verification)")
    signer_notes: Optional[str] = Field(None, max_length=500)


class CertificateStatusUpdateRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    action: str = Field(..., description="'SUSPEND', 'REINSTATE', 'REVOKE', 'SUPERSEDE', or 'EXPIRE'")
    reason: str = Field(..., min_length=3, max_length=1000)
    statutory_authority_reference: Optional[str] = Field(None, max_length=100)
    superseding_certificate_id: Optional[str] = Field(None, max_length=36)


class CertificateStatusEventResponse(BaseSchema):
    status_event_id: str
    certificate_id: str
    previous_status: CertificateStatusEnum
    new_status: CertificateStatusEnum
    actor_id: str
    reason: str
    statutory_authority_reference: Optional[str] = None
    event_timestamp: datetime


class CertificateResponse(BaseSchema):
    certificate_id: str
    certificate_number: str
    public_verification_token: str
    tenant_id: str
    session_id: str
    instrument_id: str
    owner_id: str
    procedure_pack_id: str
    verifier_id: str
    signer_id: Optional[str] = None
    issue_date: date
    valid_until: date
    certificate_status: CertificateStatusEnum
    certificate_bytes_sha256: Optional[str] = None
    pdf_storage_path: Optional[str] = None
    digital_signature_reference: Optional[str] = None
    signature_timestamp: Optional[datetime] = None
    qr_code_payload: str
    superseding_certificate_id: Optional[str] = None
    status_events: List[CertificateStatusEventResponse] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
