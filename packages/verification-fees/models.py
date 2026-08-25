"""Data models and schemas for statutory fee assessment.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from .errors import InvalidCapacityError


class FeeAccuracyClass(str, Enum):
    """NAWI Accuracy classes under Legal Metrology Rules."""
    CLASS_I = "CLASS_I"
    CLASS_II = "CLASS_II"
    CLASS_III = "CLASS_III"
    CLASS_IIII = "CLASS_IIII"


class FeeServiceMode(str, Enum):
    """Location / service delivery channel for statutory verification."""
    ON_SITE = "ON_SITE"
    DEPARTMENTAL_LAB = "DEPARTMENTAL_LAB"
    GATC_CENTRE = "GATC_CENTRE"


class FeeVerificationType(str, Enum):
    """Type of legal metrology verification requested."""
    INITIAL_VERIFICATION = "INITIAL_VERIFICATION"
    RE_VERIFICATION = "RE_VERIFICATION"
    AFTER_REPAIR_VERIFICATION = "AFTER_REPAIR_VERIFICATION"
    VOLUNTARY_VERIFICATION = "VOLUNTARY_VERIFICATION"


class FeeItemBreakdown(BaseModel):
    """Individual itemized component of statutory fee assessment."""
    model_config = ConfigDict(frozen=True)

    code: str = Field(..., description="Unique fee component code e.g. BASE_STATUTORY_FEE")
    name: str = Field(..., description="Human-readable fee component name")
    amount: Decimal = Field(..., description="Exact fee component amount in INR")
    description: str = Field(..., description="Statutory rule basis or calculation description")


class FeeAssessmentRequest(BaseModel):
    """Input payload to calculate statutory verification fee."""
    model_config = ConfigDict(extra="forbid")

    category: str = Field(default="NAWI", description="Instrument category (e.g. NAWI, WEIGHTS, MEASURES)")
    accuracy_class: str = Field(default="CLASS_III", description="Accuracy class (CLASS_I, CLASS_II, CLASS_III, CLASS_IIII)")
    max_capacity: Decimal = Field(..., description="Maximum capacity of instrument")
    capacity_unit: str = Field(default="kg", description="Unit of capacity (mg, g, kg, t, tonne, metric_ton)")
    service_mode: FeeServiceMode = Field(default=FeeServiceMode.ON_SITE, description="Service delivery location")
    verification_type: FeeVerificationType = Field(default=FeeVerificationType.INITIAL_VERIFICATION, description="Verification type")
    is_late_submission: bool = Field(default=False, description="Whether application was submitted past statutory due date")
    days_overdue: int = Field(default=0, ge=0, description="Days past expiry date for late fee calculation")
    months_overdue: int = Field(default=0, ge=0, description="Explicit months overdue for late fee calculation")
    policy_version: str = Field(default="IN-FEES-2026.1", description="Statutory fee policy schedule version")

    @field_validator("max_capacity", mode="before")
    @classmethod
    def validate_max_capacity(cls, v: Any) -> Decimal:
        try:
            d = Decimal(str(v))
        except Exception as exc:
            raise InvalidCapacityError(f"Invalid capacity value: {v!r}") from exc
        if d <= Decimal("0"):
            raise InvalidCapacityError(f"Capacity must be greater than zero, got {v}")
        return d

    @field_validator("accuracy_class", mode="before")
    @classmethod
    def normalize_accuracy_class(cls, v: Any) -> str:
        if isinstance(v, Enum):
            v = v.value
        s = str(v).strip().upper()
        if s in ("CLASS_I", "CLASS I", "CLASS-I", "I"):
            return "CLASS_I"
        if s in ("CLASS_II", "CLASS II", "CLASS-II", "II"):
            return "CLASS_II"
        if s in ("CLASS_III", "CLASS III", "CLASS-III", "III"):
            return "CLASS_III"
        if s in ("CLASS_IIII", "CLASS IIII", "CLASS-IIII", "IIII", "CLASS_4", "4"):
            return "CLASS_IIII"
        return s

    @field_validator("service_mode", mode="before")
    @classmethod
    def normalize_service_mode(cls, v: Any) -> FeeServiceMode:
        if isinstance(v, FeeServiceMode):
            return v
        s = str(v).strip().upper()
        if s in ("ON_SITE", "ON-SITE", "USER_PREMISES", "PREMISES", "ON SITE"):
            return FeeServiceMode.ON_SITE
        if s in ("DEPARTMENTAL_LAB", "LAB", "DEPARTMENT_LAB", "OFFICE"):
            return FeeServiceMode.DEPARTMENTAL_LAB
        if s in ("GATC_CENTRE", "GATC"):
            return FeeServiceMode.GATC_CENTRE
        return FeeServiceMode(s)

    @field_validator("verification_type", mode="before")
    @classmethod
    def normalize_verification_type(cls, v: Any) -> FeeVerificationType:
        if isinstance(v, FeeVerificationType):
            return v
        s = str(v).strip().upper()
        if s in ("INITIAL", "INITIAL_VERIFICATION"):
            return FeeVerificationType.INITIAL_VERIFICATION
        if s in ("REVERIFICATION", "RE_VERIFICATION", "PERIODIC"):
            return FeeVerificationType.RE_VERIFICATION
        if s in ("AFTER_REPAIR", "AFTER_REPAIR_VERIFICATION", "REPAIR"):
            return FeeVerificationType.AFTER_REPAIR_VERIFICATION
        if s in ("VOLUNTARY", "VOLUNTARY_VERIFICATION"):
            return FeeVerificationType.VOLUNTARY_VERIFICATION
        return FeeVerificationType(s)


class FeeAssessmentResult(BaseModel):
    """Itemized statutory fee assessment response."""
    model_config = ConfigDict(frozen=True)

    base_fee: Decimal = Field(..., description="Base statutory verification fee under Schedule XII")
    location_multiplier: Decimal = Field(..., description="Location multiplier applied (e.g. 2.0 for on-site, 1.0 for lab)")
    location_surcharge: Decimal = Field(..., description="Additional surcharge for on-site premises verification")
    portal_charge: Decimal = Field(..., description="Portal / state digital processing fee")
    late_fee: Decimal = Field(..., description="Statutory late submission penalty fee")
    total_fee: Decimal = Field(..., description="Total assessed statutory fee payable")
    currency: str = Field(default="INR", description="Currency code")
    policy_version: str = Field(..., description="Statutory fee policy schedule version applied")
    itemized_breakdown: List[FeeItemBreakdown] = Field(default_factory=list, description="Itemized breakdown of fee components")
    calculated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of fee assessment")
