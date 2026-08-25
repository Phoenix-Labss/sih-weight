"""Pydantic v2 schemas for Statutory Fee Calculation and Assessment.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import ConfigDict, Field

from app.models.application import ApplicationTypeEnum, ServiceModeEnum
from app.schemas.common import BaseSchema


class FeeItemBreakdownSchema(BaseSchema):
    """Itemized statutory fee line item."""
    code: str
    name: str
    amount: Decimal
    description: str


class FeeCalculateRequest(BaseSchema):
    """Statutory fee estimation request payload."""
    model_config = ConfigDict(extra="forbid")

    category: str = Field(default="NAWI", description="Instrument category")
    accuracy_class: str = Field(default="CLASS_III", description="Accuracy class (CLASS_I, CLASS_II, CLASS_III, CLASS_IIII)")
    max_capacity: Decimal = Field(..., gt=0, description="Max capacity of instrument")
    capacity_unit: str = Field(default="kg", description="Unit of capacity (mg, g, kg, t, q)")
    service_mode: ServiceModeEnum = Field(default=ServiceModeEnum.ON_SITE, description="Service delivery mode")
    verification_type: ApplicationTypeEnum = Field(default=ApplicationTypeEnum.INITIAL_VERIFICATION)
    is_late_submission: bool = Field(default=False)
    days_overdue: int = Field(default=0, ge=0)
    months_overdue: int = Field(default=0, ge=0)
    policy_version: str = Field(default="IN-FEES-2026.1")


class FeeCalculateResponse(BaseSchema):
    """Statutory fee calculation estimate response."""
    base_verification_fee: Decimal
    location_multiplier: Decimal
    location_surcharge: Decimal
    portal_charge: Decimal
    late_fee: Decimal
    total_assessed_amount: Decimal
    currency: str = "INR"
    policy_version: str
    itemized_breakdown: List[FeeItemBreakdownSchema] = Field(default_factory=list)
    calculated_at: Optional[datetime] = None
