"""Offline Mobile & Device Sync Service.

Manages delta synchronization, offline observation caching, clock skew detection,
and conflict resolution for field verification officers.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PreconditionFailedError,
    UnauthorizedError,
    UnprocessableError,
)
from app.models.application import VerificationApplication
from app.models.instrument import Instrument
from app.models.observation import StepTypeEnum, TestObservation
from app.models.reference_standard import ReferenceStandard, ReferenceStandardStatusEnum
from app.models.session import (
    SessionReferenceStandard,
    SessionStatusEnum,
    VerificationOutcomeEnum,
    VerificationSession,
)
from app.models.stamp import PhysicalSealActionEnum, PhysicalStampAction, SealTypeEnum
from app.models.sync import (
    DevicePlatformEnum,
    SyncChangeLog,
    SyncDevice,
    SyncDirectionEnum,
    SyncSession,
    SyncStatusEnum,
)
from app.schemas.sync import (
    DeviceRegisterRequest,
    DeviceResponse,
    OfflineActionItem,
    ProcessedActionSummary,
    SyncPullResponse,
    SyncPushResponse,
    SyncTaskItem,
)

logger = logging.getLogger(__name__)


class SyncService:
    """Core synchronization and offline change tracking engine."""

    MAX_PERMISSIBLE_CLOCK_SKEW_SECONDS = 3600  # 1 hour maximum skew tolerance

    @staticmethod
    def register_device(
        db: Session,
        tenant_id: str,
        user_id: str,
        payload: DeviceRegisterRequest,
    ) -> SyncDevice:
        """Register or update an authorized field inspection device."""
        existing = (
            db.query(SyncDevice)
            .filter(
                SyncDevice.tenant_id == tenant_id,
                SyncDevice.device_fingerprint == payload.device_fingerprint,
            )
            .first()
        )
        if existing:
            existing.user_id = user_id
            existing.device_name = payload.device_name
            existing.app_version = payload.app_version
            existing.is_active = True
            existing.revoked_at = None
            existing.revocation_reason = None
            db.commit()
            db.refresh(existing)
            return existing

        device = SyncDevice(
            tenant_id=tenant_id,
            user_id=user_id,
            device_name=payload.device_name,
            platform=payload.platform,
            app_version=payload.app_version,
            device_fingerprint=payload.device_fingerprint,
            last_known_revision=0,
            is_active=True,
        )
        db.add(device)
        db.commit()
        db.refresh(device)
        return device

    @staticmethod
    def pull_sync_delta(
        db: Session,
        tenant_id: str,
        user_id: str,
        device_id: str,
        last_known_revision: int = 0,
        jurisdiction_id: Optional[str] = None,
    ) -> SyncPullResponse:
        """Fetch assigned tasks, standards, and procedure packs for offline caching."""
        device = (
            db.query(SyncDevice)
            .filter(
                SyncDevice.device_id == device_id,
                SyncDevice.tenant_id == tenant_id,
                SyncDevice.is_active == True,
            )
            .first()
        )
        if not device:
            raise NotFoundError(f"Active sync device '{device_id}' not found or revoked.")

        now_utc = datetime.now(timezone.utc)

        # 1. Fetch assigned verification sessions for this officer
        query = (
            db.query(VerificationSession)
            .filter(
                VerificationSession.tenant_id == tenant_id,
                VerificationSession.verifier_id == user_id,
                VerificationSession.status.in_([SessionStatusEnum.PLANNED, SessionStatusEnum.IN_PROGRESS]),
            )
        )
        assigned_sessions = query.all()

        task_items: List[SyncTaskItem] = []
        for sess in assigned_sessions:
            app = sess.application
            inst = sess.instrument
            facility = inst.facility if inst else None

            # Get assigned reference standards
            standards_data = []
            for srs in sess.reference_standards:
                std = srs.standard
                if std:
                    standards_data.append({
                        "standard_id": std.standard_id,
                        "asset_tag": std.asset_tag,
                        "denomination_mass": str(std.denomination_mass),
                        "mass_unit": std.mass_unit,
                        "accuracy_class": std.accuracy_class,
                        "valid_until": std.valid_until.isoformat() if std.valid_until else None,
                    })

            task_items.append(
                SyncTaskItem(
                    session_id=sess.session_id,
                    application_id=sess.application_id,
                    application_number=app.application_number if app else "APP-UNKNOWN",
                    instrument_id=sess.instrument_id,
                    serial_number=inst.serial_number if inst else "UNKNOWN",
                    instrument_category=inst.category if inst else "NAWI",
                    accuracy_class=inst.accuracy_class.value if inst and hasattr(inst.accuracy_class, "value") else "Class III",
                    max_capacity=str(inst.max_capacity) if inst else "0",
                    verification_scale_interval_e=str(inst.verification_scale_interval_e) if inst else "0",
                    procedure_pack_id=sess.procedure_pack_id,
                    assigned_standards=standards_data,
                    facility_name=facility.facility_name if facility else "On-Site Facility",
                    facility_address=facility.address_line if facility else "",
                    scheduled_date=datetime.combine(sess.scheduled_date, datetime.min.time(), tzinfo=timezone.utc) if sess.scheduled_date else None,
                )
            )

        # 2. Fetch active reference standards in tenant
        standards = (
            db.query(ReferenceStandard)
            .filter(
                ReferenceStandard.tenant_id == tenant_id,
                ReferenceStandard.calibration_status == ReferenceStandardStatusEnum.ACTIVE,
                ReferenceStandard.valid_until > now_utc,
            )
            .all()
        )
        standards_payload = [
            {
                "standard_id": s.standard_id,
                "asset_tag": s.asset_tag,
                "denomination_mass": str(s.denomination_mass),
                "mass_unit": s.mass_unit,
                "accuracy_class": s.accuracy_class,
                "valid_until": s.valid_until.isoformat(),
            }
            for s in standards
        ]

        # 3. Available statutory procedure packs
        packs_payload = [
            {
                "pack_id": "IN-PROC-NAWI-CL3-2026.01",
                "instrument_type": "NAWI",
                "accuracy_classes": ["Class III", "Class IIII"],
                "version": "2026.01",
            }
        ]

        # Update device sync timestamp
        device.last_synced_at = now_utc
        db.commit()

        return SyncPullResponse(
            current_server_revision=int(now_utc.timestamp()),
            server_timestamp=now_utc,
            assigned_tasks=task_items,
            reference_standards=standards_payload,
            procedure_packs=packs_payload,
        )

    @staticmethod
    def push_sync_actions(
        db: Session,
        tenant_id: str,
        user_id: str,
        payload: Any,
    ) -> SyncPushResponse:
        """Process and commit offline inspection observations and actions."""
        device = (
            db.query(SyncDevice)
            .filter(
                SyncDevice.device_id == payload.device_id,
                SyncDevice.tenant_id == tenant_id,
                SyncDevice.is_active == True,
            )
            .first()
        )
        if not device:
            raise NotFoundError(f"Active sync device '{payload.device_id}' not found or revoked.")

        now_utc = datetime.now(timezone.utc)
        client_ts = payload.client_timestamp
        if client_ts.tzinfo is None:
            client_ts = client_ts.replace(tzinfo=timezone.utc)

        clock_skew = int((now_utc - client_ts).total_seconds())
        if abs(clock_skew) > SyncService.MAX_PERMISSIBLE_CLOCK_SKEW_SECONDS:
            logger.warning(f"Device {device.device_id} detected excessive clock skew: {clock_skew}s")

        results: List[ProcessedActionSummary] = []
        conflicts_count = 0
        items_processed = 0

        for action in payload.actions:
            session_id = action.session_id
            action_type = action.action_type
            idempotency_key = action.idempotency_key
            action_data = action.payload

            # Validate session exists and is assigned to this user
            session = (
                db.query(VerificationSession)
                .filter(
                    VerificationSession.session_id == session_id,
                    VerificationSession.tenant_id == tenant_id,
                )
                .first()
            )
            if not session:
                conflicts_count += 1
                results.append(
                    ProcessedActionSummary(
                        session_id=session_id,
                        action_type=action_type,
                        idempotency_key=idempotency_key,
                        status="ERROR",
                        message=f"Verification session '{session_id}' not found on server.",
                        server_timestamp=now_utc,
                    )
                )
                continue

            if session.status == SessionStatusEnum.FINALIZED:
                conflicts_count += 1
                results.append(
                    ProcessedActionSummary(
                        session_id=session_id,
                        action_type=action_type,
                        idempotency_key=idempotency_key,
                        status="CONFLICT",
                        message="Session is already FINALIZED; offline modifications rejected.",
                        server_timestamp=now_utc,
                    )
                )
                continue

            try:
                if action_type == "RECORD_OBSERVATION":
                    step_type_str = action_data.get("step_type", "INCREASING_LOAD")
                    try:
                        step_type = StepTypeEnum(step_type_str)
                    except ValueError:
                        step_type = StepTypeEnum.INCREASING_LOAD

                    obs = TestObservation(
                        session_id=session_id,
                        step_type=step_type,
                        step_sequence=action_data.get("step_sequence", action_data.get("step_number", 1)),
                        nominal_load=Decimal(str(action_data.get("nominal_load", "0"))),
                        load_unit=action_data.get("unit", "kg"),
                        raw_indication_reading=Decimal(str(action_data.get("observed_indication", "0"))),
                        normalized_indication=Decimal(str(action_data.get("observed_indication", "0"))),
                        reading_unit=action_data.get("unit", "kg"),
                        observed_error=Decimal(str(action_data.get("calculated_error", "0"))),
                        mpe_allowed=Decimal(str(action_data.get("maximum_permissible_error", "1"))),
                        is_within_mpe=action_data.get("is_pass", True),
                        repetition_index=1,
                        calculation_trace={"offline_batch": True},
                    )
                    db.add(obs)
                    session.status = SessionStatusEnum.IN_PROGRESS
                    items_processed += 1
                    results.append(
                        ProcessedActionSummary(
                            session_id=session_id,
                            action_type=action_type,
                            idempotency_key=idempotency_key,
                            status="PROCESSED",
                            message="Observation recorded successfully from offline batch.",
                            server_timestamp=now_utc,
                        )
                    )

                elif action_type == "AFFIX_STAMP":
                    seal_type_str = action_data.get("seal_type", "SECURITY_STICKER_HOLOGRAM")
                    try:
                        seal_type = SealTypeEnum(seal_type_str)
                    except ValueError:
                        seal_type = SealTypeEnum.SECURITY_STICKER_HOLOGRAM

                    stamp = PhysicalStampAction(
                        tenant_id=tenant_id,
                        instrument_id=session.instrument_id,
                        session_id=session_id,
                        verifier_id=user_id,
                        action_type=PhysicalSealActionEnum.SEAL_APPLIED,
                        seal_type=seal_type,
                        seal_identification_number=action_data.get("seal_identifier", action_data.get("seal_identification_number", f"SEAL-{uuid.uuid4().hex[:8].upper()}")),
                        seal_position=action_data.get("position_description", action_data.get("seal_position", "CALIBRATION_PORT")),
                        action_timestamp=action.client_timestamp,
                        notes=action_data.get("notes", "Offline stamp recorded"),
                    )
                    db.add(stamp)
                    items_processed += 1
                    results.append(
                        ProcessedActionSummary(
                            session_id=session_id,
                            action_type=action_type,
                            idempotency_key=idempotency_key,
                            status="PROCESSED",
                            message="Physical stamp recorded from offline batch.",
                            server_timestamp=now_utc,
                        )
                    )

                elif action_type == "RECORD_DISPOSITION":
                    outcome_str = action_data.get("outcome", "Verification passed — pending authorization")
                    try:
                        outcome = VerificationOutcomeEnum(outcome_str)
                    except ValueError:
                        outcome = VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION

                    session.outcome = outcome
                    session.officer_disposition_notes = action_data.get("remarks", "Offline verification completed.")
                    session.status = SessionStatusEnum.FINALIZED
                    session.finalized_at = now_utc

                    if session.application:
                        session.application.current_status = "COMPLETED"

                    items_processed += 1
                    results.append(
                        ProcessedActionSummary(
                            session_id=session_id,
                            action_type=action_type,
                            idempotency_key=idempotency_key,
                            status="PROCESSED",
                            message=f"Disposition '{outcome.value}' finalized from offline batch.",
                            server_timestamp=now_utc,
                        )
                    )
                else:
                    conflicts_count += 1
                    results.append(
                        ProcessedActionSummary(
                            session_id=session_id,
                            action_type=action_type,
                            idempotency_key=idempotency_key,
                            status="ERROR",
                            message=f"Unknown offline action type: '{action_type}'.",
                            server_timestamp=now_utc,
                        )
                    )
            except Exception as exc:
                logger.exception(f"Error executing offline action {action_type} for session {session_id}: {exc}")
                conflicts_count += 1
                results.append(
                    ProcessedActionSummary(
                        session_id=session_id,
                        action_type=action_type,
                        idempotency_key=idempotency_key,
                        status="ERROR",
                        message=str(exc),
                        server_timestamp=now_utc,
                    )
                )

        # Log SyncSession batch record
        sync_batch = SyncSession(
            tenant_id=tenant_id,
            device_id=device.device_id,
            user_id=user_id,
            direction=SyncDirectionEnum.PUSH,
            items_received=len(payload.actions),
            items_processed=items_processed,
            conflicts_detected=conflicts_count,
            client_clock_skew_seconds=clock_skew,
            status=SyncStatusEnum.SUCCESS if conflicts_count == 0 else SyncStatusEnum.PARTIAL_SUCCESS,
            error_details=[r.model_dump(mode="json") for r in results if r.status in ("ERROR", "CONFLICT")],
            completed_at=now_utc,
        )
        db.add(sync_batch)
        db.commit()
        db.refresh(sync_batch)

        return SyncPushResponse(
            sync_session_id=sync_batch.sync_session_id,
            status=sync_batch.status,
            items_received=len(payload.actions),
            items_processed=items_processed,
            conflicts_detected=conflicts_count,
            clock_skew_seconds=clock_skew,
            results=results,
        )
