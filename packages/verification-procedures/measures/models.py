"""Data models and observation schemas for Measures of Length & Capacity.

Statutory references:
- Legal Metrology (General) Rules, 2011 (Schedule II: Length Measures; Schedule III: Capacity Measures)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from packages.measurement.units import Quantity
from verification_procedures.base import (
    ReferenceStandardItem,
    VerificationOutcomeEnum,
    VerificationTypeEnum,
)


class MeasureCategoryEnum(str, Enum):
    """Statutory measure category."""
    LENGTH_MEASURE = "LENGTH_MEASURE"
    CAPACITY_MEASURE = "CAPACITY_MEASURE"


class LengthMeasureTypeEnum(str, Enum):
    """Types of length measures."""
    RIGID_METALLIC_METER_BAR = "RIGID_METALLIC_METER_BAR"
    FOLDING_SCALE = "FOLDING_SCALE"
    FLEXIBLE_STEEL_TAPE = "FLEXIBLE_STEEL_TAPE"
    DIPSTICK_STORAGE_TANK = "DIPSTICK_STORAGE_TANK"


class CapacityMeasureTypeEnum(str, Enum):
    """Types of capacity measures."""
    CONICAL_METALLIC_MEASURE = "CONICAL_METALLIC_MEASURE"
    CYLINDRICAL_METALLIC_MEASURE = "CYLINDRICAL_METALLIC_MEASURE"
    LIQUOR_DISPENSING_MEASURE = "LIQUOR_DISPENSING_MEASURE"


@dataclass(frozen=True)
class LengthStepObservation:
    """Observation at a specific graduation mark along length measure."""
    nominal_mark_mm: ExactDecimal
    observed_standard_reading_mm: ExactDecimal


@dataclass(frozen=True)
class CapacityStepObservation:
    """Observation for liquid capacity measure filled to defined brim/graduated mark."""
    nominal_volume_ml: ExactDecimal
    prover_standard_reading_ml: ExactDecimal
    meniscus_inspection_satisfactory: bool = True


@dataclass(frozen=True)
class MeasureEvaluationInput:
    """Input payload for Length / Capacity measure verification session."""
    session_id: str
    category: MeasureCategoryEnum
    measure_type_str: str
    serial_number: str
    nominal_size_value: ExactDecimal
    nominal_size_unit: str  # 'm', 'mm', 'L', 'ml'
    verification_type: VerificationTypeEnum
    evaluation_timestamp: datetime
    reference_standards: List[ReferenceStandardItem]
    length_observations: List[LengthStepObservation] = field(default_factory=list)
    capacity_observations: List[CapacityStepObservation] = field(default_factory=list)
    physical_stamp_area_clear: bool = True
