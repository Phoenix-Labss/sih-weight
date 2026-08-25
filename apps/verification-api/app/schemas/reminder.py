"""Pydantic schemas for Expiry Reminder Scan & Records.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from pydantic import ConfigDict, Field

from app.models.reminder import ReminderTypeEnum
from app.schemas.common import BaseSchema


class ReminderRecordResponse(BaseSchema):
    """Schema for reminder notification history item."""
    reminder_id: str
    tenant_id: str
    instrument_id: str
    owner_id: str
    certificate_id: Optional[str] = None
    idempotency_key: str
    due_date: date
    reminder_type: ReminderTypeEnum
    priority: str
    days_remaining: int
    scheduled_for: date
    sent_at: Optional[datetime] = None
    status: str
    channel: str
    title: str
    message_body: str
    action_required: Optional[str] = None
    action_url: Optional[str] = None
    created_at: Optional[datetime] = None


class ReminderScanRequest(BaseSchema):
    """Request payload for triggering an automated expiry scan."""
    model_config = ConfigDict(extra="forbid")
    as_of_date: Optional[date] = Field(None, description="Simulated evaluation date (defaults to today)")
    tenant_id: Optional[str] = Field(None, description="Optional tenant filter")
    auto_expire: bool = Field(True, description="Automatically transition overdue certificates to EXPIRED status")


class ReminderScanResponse(BaseSchema):
    """Execution summary of expiry reminder batch scan."""
    as_of_date: date
    scanned_certificates_count: int
    reminders_generated_count: int
    reminders_skipped_duplicate_count: int
    certificates_expired_count: int
    reminders: List[ReminderRecordResponse] = Field(default_factory=list)
    expired_certificate_ids: List[str] = Field(default_factory=list)
