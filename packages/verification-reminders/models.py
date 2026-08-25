"""Data models and enums for Statutory Expiry Reminders and Re-verification Tracking.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ReminderStageEnum(str, Enum):
    """Statutory reminder milestones."""
    DAYS_60 = "DAYS_60"      # 60 days before expiry (30 < T <= 60)
    DAYS_30 = "DAYS_30"      # 30 days before expiry (15 < T <= 30)
    DAYS_15 = "DAYS_15"      # 15 days before expiry (0 < T <= 15)
    OVERDUE = "OVERDUE"      # Expiry lapsed (T <= 0)


class ReminderPriorityEnum(str, Enum):
    """Urgency / priority classification of reminder."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ReminderChannelEnum(str, Enum):
    """Notification delivery channels."""
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"
    SMS = "SMS"
    WHATSAPP = "WHATSAPP"


class StatutoryValidityRule(BaseModel):
    """Rule determining validity period for an instrument class."""
    category: str
    accuracy_class: str
    validity_months: int = 12
    description: str = "Standard 1-year statutory verification cycle"


class ReminderNotificationData(BaseModel):
    """Generated reminder notification record."""
    idempotency_key: str = Field(..., description="Unique deduplication key (cert_id + stage)")
    certificate_id: str
    certificate_number: str
    instrument_id: str
    instrument_serial: str
    owner_id: str
    tenant_id: str
    stage: ReminderStageEnum
    priority: ReminderPriorityEnum
    days_remaining: int
    valid_until: date
    as_of_date: date
    title: str
    message: str
    action_required: str
    action_url: str
    channels: List[ReminderChannelEnum] = Field(default_factory=lambda: [ReminderChannelEnum.IN_APP, ReminderChannelEnum.EMAIL])


class ReminderScanResult(BaseModel):
    """Summary of batch reminder scan."""
    as_of_date: date
    scanned_certificates_count: int = 0
    reminders_generated_count: int = 0
    reminders_skipped_duplicate_count: int = 0
    certificates_expired_count: int = 0
    reminders: List[ReminderNotificationData] = Field(default_factory=list)
    expired_certificate_ids: List[str] = Field(default_factory=list)
