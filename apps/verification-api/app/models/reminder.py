"""Statutory Expiry Reminder Record entity and state audit models.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Column,
    Date,
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
    TenantMixin,
    TimestampMixin,
    generate_uuid,
    get_utc_now,
)


class ReminderTypeEnum(str, Enum):
    """Statutory reminder milestones."""
    DAYS_60 = "DAYS_60"
    DAYS_30 = "DAYS_30"
    DAYS_15 = "DAYS_15"
    OVERDUE = "OVERDUE"


class ReminderRecord(Base, TimestampMixin, TenantMixin):
    """Immutable audit record of a statutory verification expiry reminder alert."""

    __tablename__ = "reminder_records"

    reminder_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    instrument_id = Column(String(36), ForeignKey("instruments.instrument_id", ondelete="RESTRICT"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("stakeholders.stakeholder_id", ondelete="RESTRICT"), nullable=False, index=True)
    certificate_id = Column(String(36), ForeignKey("certificates.certificate_id", ondelete="RESTRICT"), nullable=True, index=True)
    idempotency_key = Column(String(120), unique=True, nullable=False, index=True)
    due_date = Column(Date, nullable=False, index=True)
    reminder_type = Column(
        SQLEnum(ReminderTypeEnum, name="reminder_type_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    priority = Column(String(20), default="LOW", nullable=False)
    days_remaining = Column(Integer, default=0, nullable=False)
    scheduled_for = Column(Date, nullable=False, default=date.today)
    sent_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=True)
    status = Column(String(30), default="SCHEDULED", nullable=False)  # 'SCHEDULED', 'SENT', 'DELIVERED', 'FAILED'
    channel = Column(String(30), default="IN_APP", nullable=False)
    title = Column(String(255), nullable=False)
    message_body = Column(Text, nullable=False)
    action_required = Column(String(50), nullable=True)
    action_url = Column(String(255), nullable=True)

    __table_args__ = (
        UniqueConstraint("instrument_id", "reminder_type", "due_date", name="uq_instrument_reminder_cycle"),
    )

    # Relationships
    tenant = relationship("Tenant")
    instrument = relationship("Instrument")
    owner = relationship("Stakeholder")
    certificate = relationship("Certificate")
