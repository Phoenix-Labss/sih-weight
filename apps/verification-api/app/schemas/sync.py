"""Pydantic schemas for offline mobile/device synchronization.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.sync import DevicePlatformEnum, SyncDirectionEnum, SyncStatusEnum
from app.schemas.common import BaseSchema


class DeviceRegisterRequest(BaseSchema):
    """Payload to register a new field device for offline caching."""
    device_name: str = Field(..., max_length=100)
    platform: DevicePlatformEnum = Field(default=DevicePlatformEnum.ANDROID)
    app_version: str = Field(..., max_length=50)
    device_fingerprint: str = Field(..., max_length=255)


class DeviceResponse(BaseSchema):
    """Registered device response."""
    device_id: str
    tenant_id: str
    user_id: str
    device_name: str
    platform: DevicePlatformEnum
    app_version: str
    last_synced_at: Optional[datetime] = None
    last_known_revision: int
    is_active: bool
    created_at: datetime


class SyncPullRequest(BaseSchema):
    """Request to download delta changes and assigned tasks for offline use."""
    device_id: str
    last_known_revision: int = Field(0, ge=0)
    jurisdiction_id: Optional[str] = None


class SyncTaskItem(BaseSchema):
    """Assigned verification task bundle for offline execution."""
    session_id: str
    application_id: str
    application_number: str
    instrument_id: str
    serial_number: str
    instrument_category: str
    accuracy_class: str
    max_capacity: str
    verification_scale_interval_e: str
    procedure_pack_id: str
    assigned_standards: List[Dict[str, Any]] = Field(default_factory=list)
    facility_name: str
    facility_address: str
    scheduled_date: Optional[datetime] = None


class SyncPullResponse(BaseSchema):
    """Delta payload returned to offline field device."""
    current_server_revision: int
    server_timestamp: datetime
    assigned_tasks: List[SyncTaskItem] = Field(default_factory=list)
    reference_standards: List[Dict[str, Any]] = Field(default_factory=list)
    procedure_packs: List[Dict[str, Any]] = Field(default_factory=list)


class OfflineActionItem(BaseSchema):
    """Individual action recorded offline on field device."""
    action_type: str = Field(..., description="RECORD_OBSERVATION, AFFIX_STAMP, RECORD_DISPOSITION")
    session_id: str
    client_timestamp: datetime
    idempotency_key: str
    payload: Dict[str, Any]


class SyncPushRequest(BaseSchema):
    """Batch upload of actions completed while device was offline."""
    device_id: str
    client_timestamp: datetime
    actions: List[OfflineActionItem] = Field(default_factory=list)


class ProcessedActionSummary(BaseSchema):
    """Outcome for a single pushed offline action."""
    session_id: str
    action_type: str
    idempotency_key: str
    status: str  # PROCESSED, SKIPPED_DUPLICATE, CONFLICT, ERROR
    message: Optional[str] = None
    server_timestamp: datetime


class SyncPushResponse(BaseSchema):
    """Result of batch offline push execution."""
    sync_session_id: str
    status: SyncStatusEnum
    items_received: int
    items_processed: int
    conflicts_detected: int
    clock_skew_seconds: int
    results: List[ProcessedActionSummary] = Field(default_factory=list)
