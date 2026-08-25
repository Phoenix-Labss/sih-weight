"""Pydantic v2 schemas for Physical Stamp and Seal Actions (Decoupled Ledger).
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import ConfigDict, Field

from app.models.stamp import PhysicalSealActionEnum, SealTypeEnum
from app.schemas.common import BaseSchema


class PhysicalStampRecordRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    instrument_id: Optional[str] = Field(None, description="Target instrument ID if not inferred from session")
    action_type: PhysicalSealActionEnum = Field(default=PhysicalSealActionEnum.SEAL_APPLIED)
    seal_type: SealTypeEnum = Field(default=SealTypeEnum.LEAD_WIRE_SEAL)
    seal_identification_number: str = Field(..., min_length=1, max_length=100)
    seal_position: str = Field(..., min_length=1, max_length=100, description="e.g. CALIBRATION_PORT, HOUSING_SCREW_1")
    photo_evidence_hash: Optional[str] = Field(None, min_length=64, max_length=64, description="SHA-256 hash of physical photo evidence")
    photo_storage_path: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=500)


class PhysicalStampResponse(BaseSchema):
    stamp_action_id: str
    tenant_id: str
    session_id: str
    instrument_id: str
    verifier_id: str
    action_type: PhysicalSealActionEnum
    seal_type: SealTypeEnum
    seal_identification_number: str
    seal_position: str
    photo_evidence_hash: Optional[str] = None
    photo_storage_path: Optional[str] = None
    action_timestamp: datetime
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
