"""Pydantic schemas for legacy record migration and batch reconciliation.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.migration import LegacyTrustLevelEnum, MigrationBatchStatusEnum
from app.schemas.common import BaseSchema


class LegacyRecordInputItem(BaseSchema):
    """Single legacy certificate/register row for import."""
    legacy_certificate_number: str
    legacy_verification_date: datetime
    legacy_expiry_date: Optional[datetime] = None
    trader_name: str
    instrument_category: str = "NAWI"
    instrument_serial: str
    capacity_text: str
    trust_level: LegacyTrustLevelEnum = LegacyTrustLevelEnum.UNVERIFIED_LEGACY
    raw_source_payload: Dict[str, Any] = Field(default_factory=dict)


class MigrationBatchCreateRequest(BaseSchema):
    """Payload to create and upload a legacy migration batch."""
    jurisdiction_id: str
    source_register_name: str
    source_checksum_sha256: str
    records: List[LegacyRecordInputItem] = Field(default_factory=list)


class MigrationBatchResponse(BaseSchema):
    """Summary response of a migration batch."""
    batch_id: str
    tenant_id: str
    jurisdiction_id: str
    source_register_name: str
    source_checksum_sha256: str
    total_records: int
    imported_records: int
    skipped_records: int
    conflicted_records: int
    status: MigrationBatchStatusEnum
    reconciliation_summary: Dict[str, Any]
    created_at: datetime
    completed_at: Optional[datetime] = None


class LegacyMigratedRecordResponse(BaseSchema):
    """Single migrated record response."""
    record_id: str
    batch_id: str
    legacy_certificate_number: str
    legacy_verification_date: datetime
    legacy_expiry_date: Optional[datetime] = None
    trader_name: str
    instrument_category: str
    instrument_serial: str
    capacity_text: str
    trust_level: LegacyTrustLevelEnum
    linked_instrument_id: Optional[str] = None
    validation_notes: Optional[str] = None
    created_at: datetime
