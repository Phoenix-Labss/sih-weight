"""Expiry Reminder & Re-verification Tracking Engine.

Implements milestone tracking (DAYS_60, DAYS_30, DAYS_15, OVERDUE),
idempotency deduplication, statutory notification templates, and expiry transitions.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Callable, Dict, List, Optional, Set, Union

try:
    from .models import (
        ReminderChannelEnum,
        ReminderNotificationData,
        ReminderPriorityEnum,
        ReminderScanResult,
        ReminderStageEnum,
    )
except ImportError:
    from models import (
        ReminderChannelEnum,
        ReminderNotificationData,
        ReminderPriorityEnum,
        ReminderScanResult,
        ReminderStageEnum,
    )


def determine_reminder_stage(valid_until: date, as_of_date: Optional[date] = None) -> Optional[ReminderStageEnum]:
    """Evaluate remaining days and determine the statutory reminder stage.
    
    Milestones:
    - DAYS_60: 31 to 60 days before expiry (Advance Advisory)
    - DAYS_30: 16 to 30 days before expiry (Statutory Notice)
    - DAYS_15: 1 to 15 days before expiry (Critical Warning)
    - OVERDUE: <= 0 days (Expired / Statutory Prohibition)
    """
    ref_date = as_of_date or date.today()
    days_remaining = (valid_until - ref_date).days

    if days_remaining > 60:
        return None
    elif 30 < days_remaining <= 60:
        return ReminderStageEnum.DAYS_60
    elif 15 < days_remaining <= 30:
        return ReminderStageEnum.DAYS_30
    elif 0 < days_remaining <= 15:
        return ReminderStageEnum.DAYS_15
    else:
        return ReminderStageEnum.OVERDUE


def generate_idempotency_key(certificate_id: str, stage: ReminderStageEnum) -> str:
    """Construct unique deduplication key for a certificate's reminder milestone."""
    return f"{certificate_id}:{stage.value}"


def build_reminder_message(
    certificate_number: str,
    instrument_serial: str,
    valid_until: date,
    stage: ReminderStageEnum,
    days_remaining: int,
    base_portal_url: str = "http://localhost:5173",
) -> Dict[str, Any]:
    """Generate localized, statutory reminder text and action guidance."""
    date_str = valid_until.strftime("%d %b %Y")
    renewal_url = f"{base_portal_url}/trader/applications/new?reverification_cert={certificate_number}"

    if stage == ReminderStageEnum.DAYS_60:
        title = f"Statutory Advisory: Re-verification Due in {days_remaining} Days (Cert: {certificate_number})"
        message = (
            f"Statutory verification for instrument [Serial: {instrument_serial}] under Certificate [{certificate_number}] "
            f"is valid until {date_str} ({days_remaining} days remaining). "
            f"Please prepare the instrument and review standard servicing requirements."
        )
        priority = ReminderPriorityEnum.LOW
        action_required = "PREPARE_REVERIFICATION"

    elif stage == ReminderStageEnum.DAYS_30:
        title = f"Statutory Notice: Duty to Apply for Re-verification (Cert: {certificate_number})"
        message = (
            f"Pursuant to Section 24 of The Legal Metrology Act, 2009, instrument [Serial: {instrument_serial}] "
            f"is due for periodic re-verification on {date_str} ({days_remaining} days remaining). "
            f"You are required to submit your re-verification application before expiry to prevent commercial disruption."
        )
        priority = ReminderPriorityEnum.MEDIUM
        action_required = "SUBMIT_APPLICATION"

    elif stage == ReminderStageEnum.DAYS_15:
        title = f"URGENT: Legal Metrology Verification Expiring in {days_remaining} Days (Cert: {certificate_number})"
        message = (
            f"CRITICAL REMINDER: Verification for instrument [Serial: {instrument_serial}] expires in {days_remaining} days "
            f"on {date_str}. Failure to re-verify prior to expiration will render commercial use unlawful under Section 30."
        )
        priority = ReminderPriorityEnum.HIGH
        action_required = "URGENT_APPLICATION"

    else:  # OVERDUE
        days_overdue = abs(days_remaining)
        title = f"COMPLIANCE ALERT: Verification Expired {days_overdue} Days Ago (Cert: {certificate_number})"
        message = (
            f"STATUTORY PROHIBITION: The verification certificate [{certificate_number}] for instrument [Serial: {instrument_serial}] "
            f"expired on {date_str} ({days_overdue} days overdue). Continued use for commercial trade without re-verification "
            f"is punishable under Section 30 of The Legal Metrology Act, 2009. Submit an immediate re-verification application."
        )
        priority = ReminderPriorityEnum.CRITICAL
        action_required = "CEASE_USE_AND_APPLY"

    return {
        "title": title,
        "message": message,
        "priority": priority,
        "action_required": action_required,
        "action_url": renewal_url,
    }


class ExpiryReminderEngine:
    """Core domain evaluator for scanning certificates, generating notifications, and detecting expiry."""

    def __init__(self, base_portal_url: str = "http://localhost:5173"):
        self.base_portal_url = base_portal_url

    def evaluate_certificate(
        self,
        certificate_id: str,
        certificate_number: str,
        instrument_id: str,
        instrument_serial: str,
        owner_id: str,
        tenant_id: str,
        valid_until: date,
        as_of_date: Optional[date] = None,
        existing_keys: Optional[Set[str]] = None,
    ) -> Optional[ReminderNotificationData]:
        """Evaluate a single certificate and generate a reminder notification if due and not duplicate."""
        ref_date = as_of_date or date.today()
        stage = determine_reminder_stage(valid_until, ref_date)

        if not stage:
            return None

        idempotency_key = generate_idempotency_key(certificate_id, stage)
        if existing_keys and idempotency_key in existing_keys:
            return None

        days_remaining = (valid_until - ref_date).days
        msg_info = build_reminder_message(
            certificate_number=certificate_number,
            instrument_serial=instrument_serial,
            valid_until=valid_until,
            stage=stage,
            days_remaining=days_remaining,
            base_portal_url=self.base_portal_url,
        )

        channels = [ReminderChannelEnum.IN_APP, ReminderChannelEnum.EMAIL]
        if stage in (ReminderStageEnum.DAYS_15, ReminderStageEnum.OVERDUE):
            channels.append(ReminderChannelEnum.SMS)

        return ReminderNotificationData(
            idempotency_key=idempotency_key,
            certificate_id=certificate_id,
            certificate_number=certificate_number,
            instrument_id=instrument_id,
            instrument_serial=instrument_serial,
            owner_id=owner_id,
            tenant_id=tenant_id,
            stage=stage,
            priority=msg_info["priority"],
            days_remaining=days_remaining,
            valid_until=valid_until,
            as_of_date=ref_date,
            title=msg_info["title"],
            message=msg_info["message"],
            action_required=msg_info["action_required"],
            action_url=msg_info["action_url"],
            channels=channels,
        )

    def scan_certificate_records(
        self,
        records: List[Dict[str, Any]],
        as_of_date: Optional[date] = None,
        existing_keys: Optional[Set[str]] = None,
        auto_expire: bool = True,
    ) -> ReminderScanResult:
        """Scan a batch of certificate dictionaries and compute notifications and expirations."""
        ref_date = as_of_date or date.today()
        known_keys = set(existing_keys) if existing_keys else set()
        
        result = ReminderScanResult(as_of_date=ref_date)
        result.scanned_certificates_count = len(records)

        for rec in records:
            cert_id = rec.get("certificate_id") or rec.get("id")
            cert_num = rec.get("certificate_number") or f"CERT-{cert_id}"
            inst_id = rec.get("instrument_id") or "INST-UNKNOWN"
            inst_serial = rec.get("instrument_serial") or rec.get("serial_number") or "N/A"
            owner_id = rec.get("owner_id") or "OWNER-UNKNOWN"
            tenant_id = rec.get("tenant_id") or "TENANT-UNKNOWN"
            valid_until = rec.get("valid_until")
            cert_status = rec.get("certificate_status") or rec.get("status") or "ISSUED"

            if isinstance(valid_until, str):
                valid_until = date.fromisoformat(valid_until)

            if not valid_until:
                continue

            # Check if expired
            if auto_expire and valid_until < ref_date and str(cert_status).upper() == "ISSUED":
                result.certificates_expired_count += 1
                result.expired_certificate_ids.append(cert_id)

            # Evaluate reminder
            reminder = self.evaluate_certificate(
                certificate_id=cert_id,
                certificate_number=cert_num,
                instrument_id=inst_id,
                instrument_serial=inst_serial,
                owner_id=owner_id,
                tenant_id=tenant_id,
                valid_until=valid_until,
                as_of_date=ref_date,
                existing_keys=known_keys,
            )

            if reminder:
                result.reminders_generated_count += 1
                result.reminders.append(reminder)
                known_keys.add(reminder.idempotency_key)
            else:
                stage = determine_reminder_stage(valid_until, ref_date)
                if stage and generate_idempotency_key(cert_id, stage) in known_keys:
                    result.reminders_skipped_duplicate_count += 1

        return result
