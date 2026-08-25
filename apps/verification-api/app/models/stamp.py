"""Physical Stamp and Seal actions ledger (strictly decoupled from digital certificates).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Column,
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
    generate_uuid,
    get_utc_now,
)


class PhysicalSealActionEnum(str, Enum):
    """Action recorded on physical security seals and stamping marks."""
    SEAL_APPLIED = "SEAL_APPLIED"
    SEAL_BROKEN_OLD = "SEAL_BROKEN_OLD"
    SEAL_INTACT_VERIFIED = "SEAL_INTACT_VERIFIED"
    SEAL_DEFECTIVE_REPLACED = "SEAL_DEFECTIVE_REPLACED"
    SEAL_LOST_RECORDED = "SEAL_LOST_RECORDED"


class SealTypeEnum(str, Enum):
    """Physical seal / stamping technology."""
    LEAD_WIRE_SEAL = "LEAD_WIRE_SEAL"
    SECURITY_STICKER_HOLOGRAM = "SECURITY_STICKER_HOLOGRAM"
    METALLIC_PUNCH_MARK = "METALLIC_PUNCH_MARK"
    BARCODED_TAMPER_SEAL = "BARCODED_TAMPER_SEAL"


class PhysicalStampAction(Base, TimestampMixin, TenantMixin):
    """Auditable record of physical stamping/sealing actions performed on the physical instrument.

    Decoupled from the digital certificate lifecycle to ensure statutory compliance
    with physical stamping mandates under Section 24 of The Legal Metrology Act, 2009.
    """

    __tablename__ = "physical_stamp_actions"

    stamp_action_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    session_id = Column(String(36), ForeignKey("verification_sessions.session_id", ondelete="RESTRICT"), nullable=False, index=True)
    instrument_id = Column(String(36), ForeignKey("instruments.instrument_id", ondelete="RESTRICT"), nullable=False, index=True)
    verifier_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    action_type = Column(
        SQLEnum(PhysicalSealActionEnum, name="physical_seal_action_enum", native_enum=False),
        nullable=False,
    )
    seal_type = Column(
        SQLEnum(SealTypeEnum, name="seal_type_enum", native_enum=False),
        nullable=False,
    )
    seal_identification_number = Column(String(100), nullable=False, index=True)
    seal_position = Column(String(100), nullable=False)  # 'CALIBRATION_PORT', 'HOUSING_SCREW_1', etc.
    photo_evidence_hash = Column(String(64), nullable=True)  # SHA-256 of physical evidence image
    photo_storage_path = Column(String(255), nullable=True)
    action_timestamp = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    session = relationship("VerificationSession", back_populates="stamp_actions")
    instrument = relationship("Instrument", back_populates="stamp_actions")
    verifier = relationship("User")
