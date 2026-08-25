"""Statutory Expiry Reminder and Re-verification Tracking Engine Package.

Provides statutory validity calculations under Section 24 of The Legal Metrology Act, 2009,
multi-milestone reminder scanning (DAYS_60, DAYS_30, DAYS_15, OVERDUE),
idempotent deduplication, and automated certificate expiry detection.
"""

from .models import (
    ReminderStageEnum,
    ReminderPriorityEnum,
    ReminderChannelEnum,
    StatutoryValidityRule,
    ReminderNotificationData,
    ReminderScanResult,
)
from .validity import (
    StatutoryValidityCalculator,
    STATUTORY_VALIDITY_MAP,
)
from .engine import (
    ExpiryReminderEngine,
    determine_reminder_stage,
    generate_idempotency_key,
    build_reminder_message,
)

__all__ = [
    "ReminderStageEnum",
    "ReminderPriorityEnum",
    "ReminderChannelEnum",
    "StatutoryValidityRule",
    "ReminderNotificationData",
    "ReminderScanResult",
    "StatutoryValidityCalculator",
    "STATUTORY_VALIDITY_MAP",
    "ExpiryReminderEngine",
    "determine_reminder_stage",
    "generate_idempotency_key",
    "build_reminder_message",
]
