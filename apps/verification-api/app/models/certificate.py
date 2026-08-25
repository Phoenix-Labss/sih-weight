"""Digital Certificate, Cryptographic Signature, and Status Event Audit models.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.base import (
    Base,
    TenantMixin,
    TimestampMixin,
    generate_opaque_token,
    generate_uuid,
    get_utc_now,
)


class CertificateStatusEnum(str, Enum):
    """Lifecycle states of a statutory digital verification certificate."""
    DRAFT = "DRAFT"
    PENDING_SIGNATURE = "PENDING_SIGNATURE"
    ISSUED = "ISSUED"
    SIGNING_FAILED = "SIGNING_FAILED"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"
    REVOKED = "REVOKED"
    SUPERSEDED = "SUPERSEDED"


class Certificate(Base, TimestampMixin, TenantMixin):
    """Digitally signed statutory verification certificate with high-entropy public QR token."""

    __tablename__ = "certificates"

    certificate_id = Column(String(36), primary_key=True, default=generate_uuid)
    certificate_number = Column(String(100), unique=True, nullable=False, index=True)
    public_verification_token = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        default=lambda: generate_opaque_token("cert_"),
    )
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    session_id = Column(String(36), ForeignKey("verification_sessions.session_id", ondelete="RESTRICT"), nullable=False, index=True)
    instrument_id = Column(String(36), ForeignKey("instruments.instrument_id", ondelete="RESTRICT"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("stakeholders.stakeholder_id", ondelete="RESTRICT"), nullable=False, index=True)
    procedure_pack_id = Column(String(100), nullable=False)
    verifier_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    signer_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=True, index=True)
    issue_date = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=False, index=True)
    certificate_status = Column(
        SQLEnum(CertificateStatusEnum, name="certificate_status_enum", native_enum=False),
        default=CertificateStatusEnum.DRAFT,
        nullable=False,
        index=True,
    )
    certificate_bytes_sha256 = Column(String(64), nullable=True)  # SHA-256 of immutable canonical PDF/A
    pdf_storage_path = Column(String(255), nullable=True)
    digital_signature_reference = Column(String(255), nullable=True)  # HSM / DSC transaction reference
    signature_timestamp = Column(DateTime(timezone=True), nullable=True)
    qr_code_payload = Column(Text, nullable=False)  # High-entropy opaque verification URL
    superseding_certificate_id = Column(String(36), ForeignKey("certificates.certificate_id", ondelete="RESTRICT"), nullable=True)

    __table_args__ = (
        CheckConstraint("valid_until >= issue_date", name="chk_certificate_validity"),
    )

    # Relationships
    tenant = relationship("Tenant")
    session = relationship("VerificationSession", back_populates="certificates")
    instrument = relationship("Instrument")
    owner = relationship("Stakeholder")
    verifier = relationship("User", foreign_keys=[verifier_id])
    signer = relationship("User", foreign_keys=[signer_id])
    status_events = relationship("CertificateStatusEvent", back_populates="certificate", cascade="all, delete-orphan")
    superseding_certificate = relationship("Certificate", remote_side=[certificate_id], backref="superseded_certificates")


class CertificateStatusEvent(Base):
    """Append-only audit log of certificate lifecycle state transitions."""

    __tablename__ = "certificate_status_events"

    status_event_id = Column(String(36), primary_key=True, default=generate_uuid)
    certificate_id = Column(String(36), ForeignKey("certificates.certificate_id", ondelete="RESTRICT"), nullable=False, index=True)
    previous_status = Column(
        SQLEnum(CertificateStatusEnum, name="cert_event_prev_status_enum", native_enum=False),
        nullable=False,
    )
    new_status = Column(
        SQLEnum(CertificateStatusEnum, name="cert_event_new_status_enum", native_enum=False),
        nullable=False,
    )
    actor_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    statutory_authority_reference = Column(String(100), nullable=True)
    event_timestamp = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    # Relationships
    certificate = relationship("Certificate", back_populates="status_events")
    actor = relationship("User")
