"""Instrument Model, Physical Instrument Registry, and Component models.
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import (
    Base,
    JSONType,
    MetrologyDecimal,
    TenantMixin,
    TimestampMixin,
    generate_opaque_token,
    generate_uuid,
)
class AccuracyClassEnum(str, Enum):
    """Accuracy classes for weighing instruments under Legal Metrology Rules."""
    CLASS_I = "CLASS_I"
    CLASS_II = "CLASS_II"
    CLASS_III = "CLASS_III"
    CLASS_IIII = "CLASS_IIII"


class InstrumentStatusEnum(str, Enum):
    """Lifecycle status of a physical measuring instrument."""
    DRAFT = "DRAFT"
    ACTIVE_VERIFIED = "ACTIVE_VERIFIED"
    VERIFICATION_EXPIRED = "VERIFICATION_EXPIRED"
    UNDER_REPAIR = "UNDER_REPAIR"
    DECOMMISSIONED = "DECOMMISSIONED"
    SEIZED = "SEIZED"
    REJECTED = "REJECTED"


class LegacyTrustStatusEnum(str, Enum):
    """Provenance confidence level for pre-existing legacy verification records."""
    VERIFIED_LEGACY = "VERIFIED_LEGACY"
    DIGITIZED_FROM_SOURCE = "DIGITIZED_FROM_SOURCE"
    UNVERIFIED_LEGACY = "UNVERIFIED_LEGACY"
    CONFLICTED = "CONFLICTED"


class InstrumentModel(Base, TimestampMixin):
    """Approved instrument model pattern specifications under Section 22 / General Rules."""

    __tablename__ = "instrument_models"

    model_id = Column(String(36), primary_key=True, default=generate_uuid)
    category = Column(String(100), nullable=False)  # e.g., 'NAWI' (Non-Automatic Weighing Instrument)
    subtype = Column(String(100), nullable=False)   # e.g., 'ELECTRONIC_BENCH_SCALE', 'WEIGHBRIDGE'
    manufacturer_name = Column(String(255), nullable=False)
    model_name = Column(String(150), nullable=False)
    model_approval_number = Column(String(100), unique=True, nullable=False, index=True)
    accuracy_class = Column(
        SQLEnum(AccuracyClassEnum, name="accuracy_class_enum", native_enum=False),
        nullable=False,
    )
    verification_scale_interval_e = Column(MetrologyDecimal, nullable=False)
    scale_interval_unit = Column(String(20), nullable=False)  # 'mg', 'g', 'kg', 't'
    min_capacity = Column(MetrologyDecimal, nullable=False)
    max_capacity = Column(MetrologyDecimal, nullable=False)
    capacity_unit = Column(String(20), nullable=False)
    number_of_intervals_n = Column(Integer, nullable=True)
    specifications = Column(JSONType, default=dict, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    instruments = relationship("Instrument", back_populates="model")


class Instrument(Base, TimestampMixin, TenantMixin):
    """Physical instrument unit deployed at a facility with lifetime verification history."""

    __tablename__ = "instruments"

    instrument_id = Column(String(36), primary_key=True, default=generate_uuid)
    public_instrument_token = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        default=lambda: generate_opaque_token("inst_"),
    )
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    jurisdiction_id = Column(String(36), ForeignKey("jurisdictions.jurisdiction_id", ondelete="RESTRICT"), nullable=False, index=True)
    model_id = Column(String(36), ForeignKey("instrument_models.model_id", ondelete="RESTRICT"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("stakeholders.stakeholder_id", ondelete="RESTRICT"), nullable=False, index=True)
    facility_id = Column(String(36), ForeignKey("facilities.facility_id", ondelete="RESTRICT"), nullable=False, index=True)
    serial_number = Column(String(100), nullable=False)
    year_of_manufacture = Column(Integer, nullable=False)
    intended_use = Column(String(255), nullable=True)
    installation_location_notes = Column(Text, nullable=True)
    current_status = Column(
        SQLEnum(InstrumentStatusEnum, name="instrument_status_enum", native_enum=False),
        default=InstrumentStatusEnum.DRAFT,
        nullable=False,
    )
    latest_certificate_id = Column(String(36), nullable=True)
    verification_due_date = Column(Date, nullable=True, index=True)
    legacy_trust = Column(
        SQLEnum(LegacyTrustStatusEnum, name="legacy_trust_status_enum", native_enum=False),
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint("model_id", "serial_number", name="uq_model_serial"),
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="instruments")
    jurisdiction = relationship("Jurisdiction", back_populates="instruments")
    model = relationship("InstrumentModel", back_populates="instruments")
    owner = relationship("Stakeholder", back_populates="instruments")
    facility = relationship("Facility", back_populates="instruments")
    components = relationship("InstrumentComponent", back_populates="instrument", cascade="all, delete-orphan")
    applications = relationship("VerificationApplication", back_populates="instrument")
    sessions = relationship("VerificationSession", back_populates="instrument")
    stamp_actions = relationship("PhysicalStampAction", back_populates="instrument")


class InstrumentComponent(Base, TimestampMixin):
    """Sub-components and peripheral modules (e.g. Load Cells, Digitizer Indicators)."""

    __tablename__ = "instrument_components"

    component_id = Column(String(36), primary_key=True, default=generate_uuid)
    instrument_id = Column(String(36), ForeignKey("instruments.instrument_id", ondelete="CASCADE"), nullable=False, index=True)
    component_type = Column(String(100), nullable=False)  # 'LOAD_CELL', 'DIGITAL_INDICATOR', 'PRINTER'
    serial_number = Column(String(100), nullable=False)
    model_name = Column(String(100), nullable=True)
    specifications = Column(JSONType, default=dict, nullable=False)

    # Relationships
    instrument = relationship("Instrument", back_populates="components")
