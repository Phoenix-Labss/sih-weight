"""Offline synchronization models, device registration, and change tracking logs.
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
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import (
    Base,
    JSONType,
    TenantMixin,
    TimestampMixin,
    generate_uuid,
)


class DevicePlatformEnum(str, Enum):
    """Supported client device operating system."""
    ANDROID = "ANDROID"
    IOS = "IOS"
    WEB_PWA = "WEB_PWA"
    DESKTOP = "DESKTOP"


class SyncDirectionEnum(str, Enum):
    """Direction of synchronization event."""
    PULL = "PULL"
    PUSH = "PUSH"
    BIDIRECTIONAL = "BIDIRECTIONAL"


class SyncStatusEnum(str, Enum):
    """Status of sync batch execution."""
    SUCCESS = "SUCCESS"
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS"
    CONFLICT = "CONFLICT"
    FAILED = "FAILED"


class SyncDevice(Base, TimestampMixin, TenantMixin):
    """Registered field device authorized for offline inspection caching."""

    __tablename__ = "sync_devices"

    device_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    device_name = Column(String(100), nullable=False)
    platform = Column(
        SQLEnum(DevicePlatformEnum, name="device_platform_enum", native_enum=False),
        nullable=False,
    )
    app_version = Column(String(50), nullable=False)
    device_fingerprint = Column(String(255), nullable=False)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    last_known_revision = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revocation_reason = Column(String(255), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "device_fingerprint", name="uq_tenant_device_fingerprint"),
    )

    # Relationships
    user = relationship("User")
    sync_sessions = relationship("SyncSession", back_populates="device", cascade="all, delete-orphan")


class SyncSession(Base, TimestampMixin, TenantMixin):
    """Audit log of individual device pull/push synchronization batches."""

    __tablename__ = "sync_sessions"

    sync_session_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    device_id = Column(String(36), ForeignKey("sync_devices.device_id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    direction = Column(
        SQLEnum(SyncDirectionEnum, name="sync_direction_enum", native_enum=False),
        nullable=False,
    )
    items_received = Column(Integer, default=0, nullable=False)
    items_processed = Column(Integer, default=0, nullable=False)
    conflicts_detected = Column(Integer, default=0, nullable=False)
    client_clock_skew_seconds = Column(Integer, default=0, nullable=False)
    status = Column(
        SQLEnum(SyncStatusEnum, name="sync_status_enum", native_enum=False),
        default=SyncStatusEnum.SUCCESS,
        nullable=False,
    )
    error_details = Column(JSONType, default=list, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    device = relationship("SyncDevice", back_populates="sync_sessions")
    user = relationship("User")


class SyncChangeLog(Base, TimestampMixin, TenantMixin):
    """Authoritative delta change log for incremental client delta sync."""

    __tablename__ = "sync_change_logs"

    change_id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # SESSION, APPLICATION, STANDARD, PACK
    entity_id = Column(String(36), nullable=False, index=True)
    operation = Column(String(20), nullable=False)  # CREATE, UPDATE, DELETE
    revision = Column(Integer, nullable=False, index=True)
    assigned_user_id = Column(String(36), nullable=True, index=True)
    jurisdiction_id = Column(String(36), nullable=True, index=True)
    payload_snapshot = Column(JSONType, nullable=False, default=dict)
