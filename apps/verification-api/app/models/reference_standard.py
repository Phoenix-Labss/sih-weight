"""Reference Standard assets, calibration records, and traceability management.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from typing import List, Optional

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.base import (
    Base,
    JSONType,
    MetrologyDecimal,
    TenantMixin,
    TimestampMixin,
    generate_uuid,
)


class ReferenceStandardStatusEnum(str, Enum):
    """Operational and calibration validity status of a working/secondary standard."""
    ACTIVE = "ACTIVE"
    DUE_CALIBRATION = "DUE_CALIBRATION"
    UNDER_CALIBRATION = "UNDER_CALIBRATION"
    QUARANTINED = "QUARANTINED"
    EXPIRED = "EXPIRED"
    RETIRED = "RETIRED"


class CustodianTypeEnum(str, Enum):
    """Entity holding physical custody of working/reference standards."""
    DEPARTMENTAL_LAB = "DEPARTMENTAL_LAB"
    LMO_OFFICE = "LMO_OFFICE"
    GATC = "GATC"


class ReferenceStandard(Base, TimestampMixin, TenantMixin):
    """Working or secondary reference standard mass / equipment with calibration certificate."""

    __tablename__ = "reference_standards"

    standard_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    custodian_type = Column(
        SQLEnum(CustodianTypeEnum, name="custodian_type_enum", native_enum=False),
        nullable=False,
    )
    custodian_id = Column(String(36), nullable=False, index=True)  # references jurisdiction_id or gatc_id
    asset_tag = Column(String(100), unique=True, nullable=False, index=True)
    denomination_mass = Column(MetrologyDecimal, nullable=False)
    mass_unit = Column(String(20), nullable=False)  # 'mg', 'g', 'kg', 't'
    accuracy_class = Column(String(20), nullable=False)  # 'E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'
    serial_number = Column(String(100), nullable=False)
    calibration_certificate_number = Column(String(100), nullable=False)
    calibrating_laboratory = Column(String(255), nullable=False)
    calibrated_at = Column(DateTime(timezone=True), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=False, index=True)
    expanded_uncertainty = Column(Numeric(precision=18, scale=8), nullable=True)
    calibration_status = Column(
        SQLEnum(ReferenceStandardStatusEnum, name="reference_standard_status_enum", native_enum=False),
        default=ReferenceStandardStatusEnum.ACTIVE,
        nullable=False,
        index=True,
    )
    quarantine_reason = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("valid_until > calibrated_at", name="chk_calibration_dates"),
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="reference_standards")
    calibration_records = relationship("CalibrationRecord", back_populates="standard", cascade="all, delete-orphan")

    def is_valid_at(self, timestamp: datetime) -> bool:
        """Check if standard was active, non-quarantined, and within calibration period at timestamp."""
        if self.calibration_status in (ReferenceStandardStatusEnum.QUARANTINED, ReferenceStandardStatusEnum.RETIRED):
            return False
        cal_at = self.calibrated_at
        val_until = self.valid_until
        ts = timestamp

        if ts.tzinfo is not None:
            if cal_at.tzinfo is None:
                cal_at = cal_at.replace(tzinfo=timezone.utc)
            if val_until.tzinfo is None:
                val_until = val_until.replace(tzinfo=timezone.utc)
        else:
            if cal_at.tzinfo is not None:
                cal_at = cal_at.replace(tzinfo=None)
            if val_until.tzinfo is not None:
                val_until = val_until.replace(tzinfo=None)

        return cal_at <= ts <= val_until



class CalibrationRecord(Base, TimestampMixin):
    """Historical calibration certificate record for a reference standard asset."""

    __tablename__ = "calibration_records"

    calibration_record_id = Column(String(36), primary_key=True, default=generate_uuid)
    standard_id = Column(String(36), ForeignKey("reference_standards.standard_id", ondelete="CASCADE"), nullable=False, index=True)
    certificate_number = Column(String(100), nullable=False)
    calibrated_at = Column(DateTime(timezone=True), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=False)
    calibrating_lab = Column(String(255), nullable=False)
    expanded_uncertainty = Column(Numeric(precision=18, scale=8), nullable=True)
    calibration_data = Column(JSONType, default=dict, nullable=False)

    # Relationships
    standard = relationship("ReferenceStandard", back_populates="calibration_records")
