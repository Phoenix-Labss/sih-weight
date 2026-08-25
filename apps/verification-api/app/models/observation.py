"""Test Observation and Post-Submission Observation Correction audit models.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
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
    TimestampMixin,
    generate_uuid,
    get_utc_now,
)


class StepTypeEnum(str, Enum):
    """Testing step category under legal metrology testing procedures."""
    ZERO_TEST = "ZERO_TEST"
    INCREASING_LOAD = "INCREASING_LOAD"
    DECREASING_LOAD = "DECREASING_LOAD"
    ECCENTRICITY = "ECCENTRICITY"
    REPEATABILITY = "REPEATABILITY"
    TARE_TEST = "TARE_TEST"


class TestObservation(Base, TimestampMixin):
    """Immutable single measurement observation point during a verification session."""
    __test__ = False

    __tablename__ = "test_observations"

    observation_id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("verification_sessions.session_id", ondelete="RESTRICT"), nullable=False, index=True)
    step_type = Column(
        SQLEnum(StepTypeEnum, name="step_type_enum", native_enum=False),
        nullable=False,
    )
    step_sequence = Column(Integer, nullable=False)
    nominal_load = Column(MetrologyDecimal, nullable=False)
    load_unit = Column(String(20), nullable=False)  # 'mg', 'g', 'kg', 't'
    raw_indication_reading = Column(MetrologyDecimal, nullable=False)
    normalized_indication = Column(MetrologyDecimal, nullable=False)
    reading_unit = Column(String(20), nullable=False)
    observed_error = Column(MetrologyDecimal, nullable=False)
    mpe_allowed = Column(MetrologyDecimal, nullable=False)
    is_within_mpe = Column(Boolean, nullable=False)
    repetition_index = Column(Integer, default=1, nullable=False)
    eccentricity_position = Column(String(50), nullable=True)  # 'CENTER', 'FRONT_LEFT', etc.
    calculation_trace = Column(JSONType, default=dict, nullable=False)
    is_immutable = Column(Boolean, default=True, nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "step_type",
            "step_sequence",
            "repetition_index",
            "eccentricity_position",
            name="uq_session_step_repetition",
        ),
    )

    # Relationships
    session = relationship("VerificationSession", back_populates="observations")


class ObservationCorrection(Base):
    """Tamper-evident audit ledger for corrections applied to submitted observations."""

    __tablename__ = "observation_corrections"

    correction_id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("verification_sessions.session_id", ondelete="RESTRICT"), nullable=False, index=True)
    original_observation_id = Column(String(36), ForeignKey("test_observations.observation_id", ondelete="RESTRICT"), nullable=False, index=True)
    new_observation_id = Column(String(36), ForeignKey("test_observations.observation_id", ondelete="RESTRICT"), nullable=False, index=True)
    actor_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    correction_reason = Column(Text, nullable=False)
    authorized_by_supervisor_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=True, index=True)
    corrected_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    # Relationships
    session = relationship("VerificationSession", back_populates="corrections")
    original_observation = relationship("TestObservation", foreign_keys=[original_observation_id])
    new_observation = relationship("TestObservation", foreign_keys=[new_observation_id])
    actor = relationship("User", foreign_keys=[actor_id])
    supervisor = relationship("User", foreign_keys=[authorized_by_supervisor_id])
