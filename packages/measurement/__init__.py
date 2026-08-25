"""Exact Measurement & Legal Metrology Units Engine.

This package provides arbitrary-precision exact decimal and rational arithmetic,
preventing binary floating point drift and strictly enforcing statutory rounding rules.
"""

from .decimal_math import (
    ExactDecimal,
    exact_decimal,
    exact_round,
    exact_abs,
    exact_min,
    exact_max,
    LEGAL_METROLOGY_PRECISION,
    LEGAL_METROLOGY_ROUNDING,
)
from .units import (
    UnitDimension,
    MassUnit,
    LengthUnit,
    UnitConverter,
    Quantity,
    canonical_unit_name,
)
from .errors import (
    MeasurementError,
    InvalidExactDecimalError,
    IncompatibleUnitError,
    PrecisionLossError,
    DimensionalityError,
)

__all__ = [
    "ExactDecimal",
    "exact_decimal",
    "exact_round",
    "exact_abs",
    "exact_min",
    "exact_max",
    "LEGAL_METROLOGY_PRECISION",
    "LEGAL_METROLOGY_ROUNDING",
    "UnitDimension",
    "MassUnit",
    "LengthUnit",
    "UnitConverter",
    "Quantity",
    "canonical_unit_name",
    "MeasurementError",
    "InvalidExactDecimalError",
    "IncompatibleUnitError",
    "PrecisionLossError",
    "DimensionalityError",
]
