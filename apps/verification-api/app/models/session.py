"""Verification Session and Session Reference Standard snapshot models.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import (
    Base,
    JSONType,
    TenantMixin,
    TimestampMixin,
    generate_uuid,
)
class VerificationOutcomeEnum(str, Enum):
    """Authoritative legal outcomes for verification evaluations."""
    VERIFICATION_PASSED_PENDING_AUTHORIZATION = "Verification passed — pending authorization"
    VERIFICATION_FAILED = "Verification failed"
    NEEDS_REVIEW = "Needs review"
    INCOMPLETE_VERIFICATION = "Incomplete verification"
    OUTSIDE_AUTHORIZATION_SCOPE = "Outside authorization scope"


class SessionStatusEnum(str, Enum):
    """Lifecycle states of a statutory verification testing session."""
    PLANNED = "PLANNED"
    IDENTITY_CONFIRMED = "IDENTITY_CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    FINALIZED = "FINALIZED"


class VerificationSession(Base, TimestampMixin, TenantMixin):
    """Execution instance of on-site or laboratory statutory verification testing."""

    __tablename__ = "verification_sessions"

    session_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    application_id = Column(String(36), ForeignKey("verification_applications.application_id", ondelete="RESTRICT"), nullable=False, index=True)
    instrument_id = Column(String(36), ForeignKey("instruments.instrument_id", ondelete="RESTRICT"), nullable=False, index=True)
    procedure_pack_id = Column(String(100), nullable=False)  # e.g., 'IN-NAWI-CLASS-III-2026.1'
    procedure_pack_checksum = Column(String(64), nullable=False)
    verifier_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    verifier_role = Column(String(50), nullable=False)  # 'LMO' or 'GATC_VERIFIER'
    scheduled_date = Column(Date, nullable=False)
    actual_test_timestamp = Column(DateTime(timezone=True), nullable=True)
    test_location_geo = Column(JSONType, nullable=True)
    environmental_temp_celsius = Column(Numeric(precision=5, scale=2), nullable=True)
    environmental_humidity_percent = Column(Numeric(precision=5, scale=2), nullable=True)
    status = Column(
        SQLEnum(SessionStatusEnum, name="session_status_enum", native_enum=False),
        default=SessionStatusEnum.PLANNED,
        nullable=False,
        index=True,
    )
    automated_evaluation_flag = Column(Boolean, nullable=True)  # True = metrological calculation passed
    outcome = Column(
        SQLEnum(VerificationOutcomeEnum, name="verification_outcome_enum", native_enum=False),
        nullable=True,
    )
    officer_disposition_notes = Column(Text, nullable=True)
    finalized_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    application = relationship("VerificationApplication", back_populates="sessions")
    instrument = relationship("Instrument", back_populates="sessions")
    verifier = relationship("User", foreign_keys=[verifier_id])
    reference_standards = relationship("SessionReferenceStandard", back_populates="session", cascade="all, delete-orphan")
    observations = relationship("TestObservation", back_populates="session", cascade="all, delete-orphan")
    corrections = relationship("ObservationCorrection", back_populates="session", cascade="all, delete-orphan")
    stamp_actions = relationship("PhysicalStampAction", back_populates="session", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="session")


class SessionReferenceStandard(Base):
    """Snapshot join entity capturing reference standards used and validity at test time."""

    __tablename__ = "session_reference_standards"

    session_id = Column(String(36), ForeignKey("verification_sessions.session_id", ondelete="RESTRICT"), primary_key=True)
    standard_id = Column(String(36), ForeignKey("reference_standards.standard_id", ondelete="RESTRICT"), primary_key=True)
    snapshot_calibration_certificate = Column(String(100), nullable=False)
    snapshot_valid_until = Column(DateTime(timezone=True), nullable=False)
    verified_suitable = Column(Boolean, default=True, nullable=False)

    # Relationships
    session = relationship("VerificationSession", back_populates="reference_standards")
    standard = relationship("ReferenceStandard")
