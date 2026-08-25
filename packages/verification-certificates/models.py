"""Deterministic PDF/A Certificate Generator Models.

Data structures for Form 8 / Schedule XI compliant Legal Metrology Certificates.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field


class InstrumentDocData(BaseModel):
    """Metrological and physical attributes of the verified instrument."""
    category: str = Field(default="Non-Automatic Weighing Instrument (NAWI)")
    subtype: str = Field(default="Electronic Counter Scale")
    manufacturer: str = Field(default="N/A")
    model_name: str = Field(default="N/A")
    model_approval_number: str = Field(default="N/A")
    serial_number: str = Field(default="N/A")
    accuracy_class: str = Field(default="CLASS_III")
    max_capacity: str = Field(default="0 kg")
    min_capacity: str = Field(default="0 g")
    verification_scale_interval_e: str = Field(default="0 g")
    division_d: Optional[str] = Field(default=None)
    capacity_unit: str = Field(default="kg")
    installation_location: Optional[str] = Field(default=None)
    owner_name: Optional[str] = Field(default=None)
    owner_trade_name: Optional[str] = Field(default=None)


class VerificationDocData(BaseModel):
    """Metrological testing summary and procedure reference."""
    verification_type: str = Field(default="Initial Verification")
    service_mode: str = Field(default="ON_SITE")
    session_id: str = Field(default="N/A")
    test_date: date = Field(default_factory=date.today)
    metrological_outcome: str = Field(default="PASSED")
    repeatability_result: Optional[str] = Field(default="PASSED (max diff <= 1.0 e)")
    eccentricity_result: Optional[str] = Field(default="PASSED (error <= 1.0 e)")
    linearity_result: Optional[str] = Field(default="PASSED (all load steps <= MPE)")
    tare_result: Optional[str] = Field(default="PASSED (tare effect <= 0.25 e)")


class StandardDocData(BaseModel):
    """Traceable reference standard weight or instrument used during testing."""
    standard_id: str = Field(..., description="Asset tag or serial ID of standard")
    standard_name: str = Field(default="Working Standard Weight", description="Description")
    accuracy_class: str = Field(default="M1", description="OIML Accuracy Class: E1, E2, F1, F2, M1, M2, M3")
    calibration_certificate_number: str = Field(default="NPL/CAL/2026/001")
    calibrating_laboratory: str = Field(default="National Physical Laboratory / RRSL")
    calibration_valid_until: date = Field(default_factory=date.today)


class StampDocData(BaseModel):
    """Physical verification stamp or security seal affixed to the instrument."""
    stamp_type: str = Field(default="LEAD_SEAL", description="STAMP, LEAD_SEAL, POLYCARBONATE, HOLOGRAM")
    seal_serial_number: str = Field(..., description="Physical seal identification number")
    seal_location: str = Field(default="Calibration Port Screw / Housing Junction")
    affixed_date: date = Field(default_factory=date.today)


class SignatureDocData(BaseModel):
    """Digital signature and cryptographic digest metadata."""
    signer_name: str = Field(default="Authorized Legal Metrology Officer")
    signer_role: str = Field(default="Legal Metrology Officer (LMO)")
    authority_id: str = Field(default="LMO-GOV-IN")
    posting_id: Optional[str] = Field(default=None)
    signature_timestamp: datetime = Field(default_factory=datetime.utcnow)
    sha256_digest: str = Field(..., description="SHA-256 hash of canonical certificate data")
    signature_reference: Optional[str] = Field(default=None)
    is_verified: bool = Field(default=True)


class CertificateDocumentData(BaseModel):
    """Top-level document model for Form 8 Legal Metrology Verification Certificate."""
    certificate_number: str = Field(..., description="Unique statutory certificate number")
    public_verification_token: str = Field(..., description="High-entropy opaque QR verification token")
    qr_payload_url: str = Field(..., description="Full URL encoded into QR code")
    tenant_id: str = Field(default="GOV-IN")
    jurisdiction_name: str = Field(default="DEPARTMENT OF LEGAL METROLOGY")
    office_name: Optional[str] = Field(default="Office of the Assistant Controller of Legal Metrology")
    issue_date: date = Field(default_factory=date.today)
    valid_until: date = Field(..., description="Statutory validity expiration date")
    procedure_pack_id: str = Field(default="IN-NAWI-CLASS-III-2026.1")
    procedure_pack_version: Optional[str] = Field(default="2026.1")
    certificate_status: str = Field(default="ISSUED")
    instrument: InstrumentDocData = Field(default_factory=InstrumentDocData)
    verification_details: VerificationDocData = Field(default_factory=VerificationDocData)
    reference_standards: List[StandardDocData] = Field(default_factory=list)
    physical_stamps: List[StampDocData] = Field(default_factory=list)
    signature: SignatureDocData
