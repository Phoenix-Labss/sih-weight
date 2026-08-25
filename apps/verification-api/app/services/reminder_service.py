"""Service layer for Statutory Expiry Reminder scanning, notification generation, and re-verification tracking.
"""

from __future__ import annotations

import sys
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional, Set, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

# Ensure packages are importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
PACKAGES_PATH = PROJECT_ROOT / "packages"
REMINDER_PKG_PATH = PACKAGES_PATH / "verification-reminders"
if str(REMINDER_PKG_PATH) not in sys.path:
    sys.path.insert(0, str(REMINDER_PKG_PATH))

try:
    from packages.verification_reminders import (
        ExpiryReminderEngine,
        ReminderNotificationData,
        ReminderScanResult,
        ReminderStageEnum,
        StatutoryValidityCalculator,
        determine_reminder_stage,
        generate_idempotency_key,
    )
except ImportError:
    from engine import (
        ExpiryReminderEngine,
        determine_reminder_stage,
        generate_idempotency_key,
    )
    from models import (
        ReminderNotificationData,
        ReminderScanResult,
        ReminderStageEnum,
    )
    from validity import StatutoryValidityCalculator

from app.core.auth import UserContext
from app.core.errors import ForbiddenError
from app.core.permissions import verify_tenant_access
from app.models.base import get_utc_now
from app.models.certificate import (
    Certificate,
    CertificateStatusEnum,
    CertificateStatusEvent,
)
from app.models.instrument import Instrument, InstrumentStatusEnum
from app.models.reminder import ReminderRecord, ReminderTypeEnum
from app.models.stakeholder import RoleEnum, Stakeholder
from app.schemas.reminder import (
    ReminderRecordResponse,
    ReminderScanRequest,
    ReminderScanResponse,
)


class ReminderService:
    """Business logic for statutory expiry scans, notification tracking, and certificate expiration."""

    @staticmethod
    def trigger_expiry_scan(
        db: Session,
        tenant_id: Optional[str] = None,
        as_of_date: Optional[date] = None,
        auto_expire: bool = True,
        actor: Optional[UserContext] = None,
    ) -> ReminderScanResponse:
        """Scan active certificates, generate milestone notifications, and transition expired states."""
        if tenant_id and actor:
            verify_tenant_access(actor, tenant_id)

        eval_date = as_of_date or date.today()

        # 1. Fetch certificates eligible for reminder evaluation
        stmt = (
            select(Certificate)
            .options(
                joinedload(Certificate.instrument),
                joinedload(Certificate.owner),
            )
            .where(
                Certificate.certificate_status.in_([
                    CertificateStatusEnum.ISSUED,
                    CertificateStatusEnum.PENDING_SIGNATURE,
                ])
            )
        )

        if tenant_id:
            stmt = stmt.where(Certificate.tenant_id == tenant_id)

        certificates = db.execute(stmt).scalars().all()

        # 2. Fetch existing idempotency keys
        existing_keys_stmt = select(ReminderRecord.idempotency_key)
        if tenant_id:
            existing_keys_stmt = existing_keys_stmt.where(ReminderRecord.tenant_id == tenant_id)
        existing_keys: Set[str] = set(db.execute(existing_keys_stmt).scalars().all())

        # 3. Format records for pure domain engine
        cert_dicts = []
        for cert in certificates:
            inst_serial = cert.instrument.serial_number if cert.instrument else "N/A"
            cert_dicts.append({
                "certificate_id": cert.certificate_id,
                "certificate_number": cert.certificate_number,
                "instrument_id": cert.instrument_id,
                "instrument_serial": inst_serial,
                "owner_id": cert.owner_id,
                "tenant_id": cert.tenant_id,
                "valid_until": cert.valid_until,
                "certificate_status": cert.certificate_status.value,
            })

        # 4. Execute domain engine evaluation
        engine = ExpiryReminderEngine()
        scan_result = engine.scan_certificate_records(
            records=cert_dicts,
            as_of_date=eval_date,
            existing_keys=existing_keys,
            auto_expire=auto_expire,
        )

        # 5. Persist newly generated reminder records
        saved_reminder_schemas: List[ReminderRecordResponse] = []
        for notif in scan_result.reminders:
            reminder_type_val = ReminderTypeEnum(notif.stage.value)
            primary_channel = notif.channels[0].value if notif.channels else "IN_APP"

            record = ReminderRecord(
                tenant_id=notif.tenant_id,
                instrument_id=notif.instrument_id,
                owner_id=notif.owner_id,
                certificate_id=notif.certificate_id,
                idempotency_key=notif.idempotency_key,
                due_date=notif.valid_until,
                reminder_type=reminder_type_val,
                priority=notif.priority.value,
                days_remaining=notif.days_remaining,
                scheduled_for=eval_date,
                sent_at=get_utc_now(),
                status="SENT",
                channel=primary_channel,
                title=notif.title,
                message_body=notif.message,
                action_required=notif.action_required,
                action_url=notif.action_url,
            )
            db.add(record)
            db.flush()
            db.refresh(record)
            saved_reminder_schemas.append(ReminderRecordResponse.model_validate(record))

        # 6. Apply state transitions for expired certificates
        if auto_expire and scan_result.expired_certificate_ids:
            for exp_cert_id in scan_result.expired_certificate_ids:
                exp_cert = db.execute(
                    select(Certificate)
                    .options(joinedload(Certificate.instrument))
                    .where(Certificate.certificate_id == exp_cert_id)
                ).unique().scalar_one_or_none()

                if exp_cert and exp_cert.certificate_status == CertificateStatusEnum.ISSUED:
                    exp_cert.certificate_status = CertificateStatusEnum.EXPIRED
                    if exp_cert.instrument:
                        exp_cert.instrument.current_status = InstrumentStatusEnum.VERIFICATION_EXPIRED

                    # Add audit trail event
                    audit_event = CertificateStatusEvent(
                        certificate_id=exp_cert.certificate_id,
                        previous_status=CertificateStatusEnum.ISSUED,
                        new_status=CertificateStatusEnum.EXPIRED,
                        actor_id=actor.user_id if actor else "SYSTEM_REMINDER_WORKER",
                        reason=f"Statutory verification validity period expired on {exp_cert.valid_until}.",
                        event_timestamp=get_utc_now(),
                    )
                    db.add(audit_event)

        db.flush()

        return ReminderScanResponse(
            as_of_date=eval_date,
            scanned_certificates_count=scan_result.scanned_certificates_count,
            reminders_generated_count=scan_result.reminders_generated_count,
            reminders_skipped_duplicate_count=scan_result.reminders_skipped_duplicate_count,
            certificates_expired_count=scan_result.certificates_expired_count,
            reminders=saved_reminder_schemas,
            expired_certificate_ids=scan_result.expired_certificate_ids,
        )

    @staticmethod
    def list_reminders(
        db: Session,
        tenant_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        reminder_type: Optional[str] = None,
        overdue_only: bool = False,
        instrument_id: Optional[str] = None,
        actor: Optional[UserContext] = None,
    ) -> Tuple[List[ReminderRecord], int]:
        """Query reminder notification audit history."""
        stmt = (
            select(ReminderRecord)
            .options(
                joinedload(ReminderRecord.instrument),
                joinedload(ReminderRecord.certificate),
            )
            .order_by(ReminderRecord.created_at.desc())
        )

        if tenant_id:
            if actor:
                verify_tenant_access(actor, tenant_id)
            stmt = stmt.where(ReminderRecord.tenant_id == tenant_id)

        if actor and actor.has_role(RoleEnum.OWNER) and not actor.has_role(RoleEnum.ADMIN, RoleEnum.LMO, RoleEnum.SUPERVISOR):
            stk_subquery = select(Stakeholder.stakeholder_id).where(
                (Stakeholder.stakeholder_id == actor.user_id)
                | (Stakeholder.email == actor.email)
                | (Stakeholder.tenant_id == tenant_id)
            )
            stmt = stmt.where(
                (ReminderRecord.owner_id == actor.user_id)
                | (ReminderRecord.owner_id.in_(stk_subquery))
            )

        if reminder_type:
            stmt = stmt.where(ReminderRecord.reminder_type == reminder_type.upper())

        if overdue_only:
            stmt = stmt.where(ReminderRecord.reminder_type == ReminderTypeEnum.OVERDUE)

        if instrument_id:
            stmt = stmt.where(ReminderRecord.instrument_id == instrument_id)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        offset = (page - 1) * page_size
        results = db.execute(stmt.offset(offset).limit(page_size)).unique().scalars().all()
        return list(results), total
