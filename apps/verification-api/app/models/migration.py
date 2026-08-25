"""Legacy record migration models, batch manifests, and reconciliation audit.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.base import (
    Base,
    JSONType,
    TenantMixin,
    TimestampMixin,
    generate_uuid,
)


class MigrationBatchStatusEnum(str, Enum):
    """Lifecycle status of a legacy import batch."""
    UPLOADED = "UPLOADED"
    VALIDATING = "VALIDATING"
    VALIDATED = "VALIDATED"
    IMPORTING = "IMPORTING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


class LegacyTrustLevelEnum(str, Enum):
    """Statutory trust level assigned to imported legacy records."""
    VERIFIED_LEGACY = "VERIFIED_LEGACY"            # Original physical register attested by LMO
    DIGITIZED_FROM_SOURCE = "DIGITIZED_FROM_SOURCE"  # Scanned certificate matching physical record
    UNVERIFIED_LEGACY = "UNVERIFIED_LEGACY"        # Self-declared legacy import without primary physical audit
    CONFLICTED = "CONFLICTED"                      # Duplicate serial/owner conflicts requiring adjudication


class MigrationBatch(Base, TimestampMixin, TenantMixin):
    """Batch manifest representing an imported legacy register or file."""

    __tablename__ = "migration_batches"

    batch_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    jurisdiction_id = Column(String(36), ForeignKey("jurisdictions.jurisdiction_id", ondelete="RESTRICT"), nullable=False, index=True)
    uploaded_by_user_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    source_register_name = Column(String(255), nullable=False)
    source_checksum_sha256 = Column(String(64), nullable=False)
    total_records = Column(Integer, default=0, nullable=False)
    imported_records = Column(Integer, default=0, nullable=False)
    skipped_records = Column(Integer, default=0, nullable=False)
    conflicted_records = Column(Integer, default=0, nullable=False)
    status = Column(
        SQLEnum(MigrationBatchStatusEnum, name="migration_batch_status_enum", native_enum=False),
        default=MigrationBatchStatusEnum.UPLOADED,
        nullable=False,
        index=True,
    )
    reconciliation_summary = Column(JSONType, default=dict, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User")
    jurisdiction = relationship("Jurisdiction")
    records = relationship("LegacyMigratedRecord", back_populates="batch", cascade="all, delete-orphan")


class LegacyMigratedRecord(Base, TimestampMixin, TenantMixin):
    """Individual migrated legacy verification record with confidence classification."""

    __tablename__ = "legacy_migrated_records"

    record_id = Column(String(36), primary_key=True, default=generate_uuid)
    batch_id = Column(String(36), ForeignKey("migration_batches.batch_id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    legacy_certificate_number = Column(String(100), nullable=False, index=True)
    legacy_verification_date = Column(DateTime(timezone=True), nullable=False)
    legacy_expiry_date = Column(DateTime(timezone=True), nullable=True)
    trader_name = Column(String(255), nullable=False)
    instrument_category = Column(String(100), nullable=False)
    instrument_serial = Column(String(100), nullable=False, index=True)
    capacity_text = Column(String(100), nullable=False)
    trust_level = Column(
        SQLEnum(LegacyTrustLevelEnum, name="legacy_trust_level_enum", native_enum=False),
        default=LegacyTrustLevelEnum.UNVERIFIED_LEGACY,
        nullable=False,
        index=True,
    )
    linked_instrument_id = Column(String(36), ForeignKey("instruments.instrument_id", ondelete="SET NULL"), nullable=True)
    raw_source_payload = Column(JSONType, default=dict, nullable=False)
    validation_notes = Column(Text, nullable=True)

    # Relationships
    batch = relationship("MigrationBatch", back_populates="records")
    linked_instrument = relationship("Instrument")
