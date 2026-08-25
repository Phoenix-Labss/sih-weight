"""Pydantic v2 schemas for Instrument Models and Physical Instrument Units.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import ConfigDict, Field

from app.models.instrument import AccuracyClassEnum, InstrumentStatusEnum, LegacyTrustStatusEnum
from app.schemas.common import BaseSchema


class InstrumentModelBase(BaseSchema):
    category: str = Field(..., min_length=2, max_length=100, description="Instrument category, e.g. NAWI")
    subtype: str = Field(..., min_length=2, max_length=100, description="Subtype, e.g. COUNTER_MACHINE_ELECTRONIC")
    manufacturer_name: str = Field(..., min_length=2, max_length=255)
    model_name: str = Field(..., min_length=1, max_length=150)
    model_approval_number: str = Field(..., min_length=2, max_length=100, description="Statutory model approval certificate reference")
    accuracy_class: AccuracyClassEnum = Field(..., description="Statutory accuracy class (CLASS_I, CLASS_II, CLASS_III, CLASS_IIII)")
    verification_scale_interval_e: Decimal = Field(..., gt=0, decimal_places=6, description="Verification scale interval 'e'")
    scale_interval_unit: str = Field("kg", min_length=1, max_length=20)
    min_capacity: Decimal = Field(..., ge=0, decimal_places=6)
    max_capacity: Decimal = Field(..., gt=0, decimal_places=6)
    capacity_unit: str = Field("kg", min_length=1, max_length=20)
    number_of_intervals_n: Optional[int] = Field(None, ge=1)
    specifications: Dict[str, Any] = Field(default_factory=dict)


class InstrumentModelCreate(InstrumentModelBase):
    pass


class InstrumentModelResponse(InstrumentModelBase):
    model_id: str
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class InstrumentRegisterRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    jurisdiction_id: str = Field(..., min_length=1, max_length=36)
    model_id: str = Field(..., min_length=1, max_length=36)
    owner_id: str = Field(..., min_length=1, max_length=36)
    facility_id: str = Field(..., min_length=1, max_length=36)
    serial_number: str = Field(..., min_length=1, max_length=100)
    year_of_manufacture: int = Field(..., ge=1900, le=2050)
    intended_use: Optional[str] = Field(None, max_length=255)
    installation_location_notes: Optional[str] = None


class InstrumentComponentResponse(BaseSchema):
    component_id: str
    component_type: str
    serial_number: str
    model_name: Optional[str] = None
    specifications: Dict[str, Any] = Field(default_factory=dict)


class InstrumentResponse(BaseSchema):
    instrument_id: str
    public_instrument_token: str
    tenant_id: str
    jurisdiction_id: str
    model_id: str
    owner_id: str
    facility_id: str
    serial_number: str
    year_of_manufacture: int
    intended_use: Optional[str] = None
    installation_location_notes: Optional[str] = None
    current_status: InstrumentStatusEnum
    latest_certificate_id: Optional[str] = None
    verification_due_date: Optional[date] = None
    legacy_trust: Optional[LegacyTrustStatusEnum] = None
    model: Optional[InstrumentModelResponse] = None
    components: List[InstrumentComponentResponse] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
