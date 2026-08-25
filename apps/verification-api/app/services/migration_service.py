"""Legacy Record Migration & Batch Reconciliation Service.

Handles ingestion, validation, duplicate checking, confidence tagging, and
control total reconciliation for historical verification records.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import logging
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PreconditionFailedError,
    UnprocessableError,
)
from app.models.instrument import Instrument
from app.models.migration import (
    LegacyMigratedRecord,
    LegacyTrustLevelEnum,
    MigrationBatch,
    MigrationBatchStatusEnum,
)
from app.schemas.migration import (
    MigrationBatchCreateRequest,
    MigrationBatchResponse,
)

logger = logging.getLogger(__name__)


class LegacyMigrationService:
    """Service managing historical verification register imports."""

    @staticmethod
    def process_migration_batch(
        db: Session,
        tenant_id: str,
        user_id: str,
        payload: MigrationBatchCreateRequest,
    ) -> MigrationBatch:
        """Ingest, validate, confidence-tag, and reconcile a batch of legacy records."""
        now_utc = datetime.now(timezone.utc)

        batch = MigrationBatch(
            tenant_id=tenant_id,
            jurisdiction_id=payload.jurisdiction_id,
            uploaded_by_user_id=user_id,
            source_register_name=payload.source_register_name,
            source_checksum_sha256=payload.source_checksum_sha256,
            total_records=len(payload.records),
            imported_records=0,
            skipped_records=0,
            conflicted_records=0,
            status=MigrationBatchStatusEnum.VALIDATING,
        )
        db.add(batch)
        db.flush()

        imported_count = 0
        conflicted_count = 0
        skipped_count = 0
        seen_serials = set()

        for item in payload.records:
            serial = item.instrument_serial.strip()
            cert_no = item.legacy_certificate_number.strip()

            # Duplicate check within batch
            if serial in seen_serials:
                conflicted_count += 1
                record_trust = LegacyTrustLevelEnum.CONFLICTED
                val_notes = "Duplicate serial number encountered within the same import batch."
            else:
                seen_serials.add(serial)
                record_trust = item.trust_level
                val_notes = "Validated successfully against batch schema."

            # Check if matching instrument already exists in tenant
            matched_inst = (
                db.query(Instrument)
                .filter(
                    Instrument.tenant_id == tenant_id,
                    Instrument.serial_number == serial,
                )
                .first()
            )
            linked_inst_id = matched_inst.instrument_id if matched_inst else None

            migrated_rec = LegacyMigratedRecord(
                batch_id=batch.batch_id,
                tenant_id=tenant_id,
                legacy_certificate_number=cert_no,
                legacy_verification_date=item.legacy_verification_date,
                legacy_expiry_date=item.legacy_expiry_date,
                trader_name=item.trader_name,
                instrument_category=item.instrument_category,
                instrument_serial=serial,
                capacity_text=item.capacity_text,
                trust_level=record_trust,
                linked_instrument_id=linked_inst_id,
                raw_source_payload=item.raw_source_payload,
                validation_notes=val_notes,
            )
            db.add(migrated_rec)

            if record_trust == LegacyTrustLevelEnum.CONFLICTED:
                pass
            else:
                imported_count += 1

        batch.imported_records = imported_count
        batch.conflicted_records = conflicted_count
        batch.skipped_records = skipped_count
        batch.status = MigrationBatchStatusEnum.COMPLETED if conflicted_count == 0 else MigrationBatchStatusEnum.COMPLETED_WITH_ERRORS
        batch.completed_at = now_utc
        batch.reconciliation_summary = {
            "batch_id": batch.batch_id,
            "total_processed": len(payload.records),
            "successfully_imported": imported_count,
            "conflicts_detected": conflicted_count,
            "reconciliation_rate_percent": round((imported_count / len(payload.records)) * 100, 2) if payload.records else 100.0,
            "verified_legacy_count": sum(1 for r in payload.records if r.trust_level == LegacyTrustLevelEnum.VERIFIED_LEGACY),
            "digitized_from_source_count": sum(1 for r in payload.records if r.trust_level == LegacyTrustLevelEnum.DIGITIZED_FROM_SOURCE),
            "unverified_legacy_count": sum(1 for r in payload.records if r.trust_level == LegacyTrustLevelEnum.UNVERIFIED_LEGACY),
        }

        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def get_batch(db: Session, tenant_id: str, batch_id: str) -> MigrationBatch:
        """Fetch migration batch summary."""
        batch = (
            db.query(MigrationBatch)
            .filter(
                MigrationBatch.batch_id == batch_id,
                MigrationBatch.tenant_id == tenant_id,
            )
            .first()
        )
        if not batch:
            raise NotFoundError(f"Migration batch '{batch_id}' not found in tenant.")
        return batch

    @staticmethod
    def list_batches(db: Session, tenant_id: str) -> List[MigrationBatch]:
        """List all migration batches in tenant."""
        return db.query(MigrationBatch).filter(MigrationBatch.tenant_id == tenant_id).order_by(MigrationBatch.created_at.desc()).all()
