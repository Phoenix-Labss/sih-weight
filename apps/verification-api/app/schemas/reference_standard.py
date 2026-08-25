"""Pydantic schemas for Reference Standards and Calibration tracking.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.reference_standard import CustodianTypeEnum, ReferenceStandardStatusEnum
from app.schemas.common import BaseSchema


class ReferenceStandardCreateRequest(BaseSchema):
    """Payload to register a new reference standard mass or equipment."""
    custodian_type: CustodianTypeEnum
    custodian_id: str
    asset_tag: str
    denomination_mass: Decimal
    mass_unit: str = Field("kg", description="mg, g, kg, t")
    accuracy_class: str = Field("M1", description="E1, E2, F1, F2, M1, M2")
    serial_number: str
    calibration_certificate_number: str
    calibrating_laboratory: str
    calibrated_at: datetime
    valid_until: datetime
    expanded_uncertainty: Optional[Decimal] = None


class ReferenceStandardResponse(BaseSchema):
    """Reference standard asset response."""
    standard_id: str
    tenant_id: str
    custodian_type: CustodianTypeEnum
    custodian_id: str
    asset_tag: str
    denomination_mass: Decimal
    mass_unit: str
    accuracy_class: str
    serial_number: str
    calibration_certificate_number: str
    calibrating_laboratory: str
    calibrated_at: datetime
    valid_until: datetime
    expanded_uncertainty: Optional[Decimal] = None
    calibration_status: ReferenceStandardStatusEnum
    quarantine_reason: Optional[str] = None
    created_at: datetime


class RecalibrationRecordRequest(BaseSchema):
    """Payload to record standard recalibration certificate."""
    certificate_number: str
    calibrated_at: datetime
    valid_until: datetime
    calibrating_lab: str
    expanded_uncertainty: Optional[Decimal] = None
    calibration_data: Dict[str, Any] = Field(default_factory=dict)


class StandardQuarantineRequest(BaseSchema):
    """Payload to quarantine a reference standard out of calibration."""
    reason: str
    initiate_impact_review: bool = True
