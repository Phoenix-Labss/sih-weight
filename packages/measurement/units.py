"""Typed legal SI units vocabulary and exact rational conversion matrix.

Implements statutory units under The Legal Metrology Act, 2009 (First and Second Schedules)
and OIML R 76-1. All conversions use exact rational ratios to prevent rounding errors.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from fractions import Fraction
from typing import Any, Dict, Union

from .decimal_math import ExactDecimal, exact_decimal, NumericType
from .errors import IncompatibleUnitError


class UnitDimension(str, Enum):
    """Physical dimensions for legal metrology verification."""
    MASS = "MASS"
    LENGTH = "LENGTH"
    TEMPERATURE = "TEMPERATURE"
    PRESSURE = "PRESSURE"


class MassUnit(str, Enum):
    """Statutory units of mass under The Legal Metrology Act, 2009."""
    METRIC_TON = "t"
    KILOGRAM = "kg"
    GRAM = "g"
    MILLIGRAM = "mg"
    MICROGRAM = "ug"
    CARAT = "ct"


class LengthUnit(str, Enum):
    """Statutory units of length."""
    METER = "m"
    CENTIMETER = "cm"
    MILLIMETER = "mm"
    MICROMETER = "um"
    KILOMETER = "km"


# Base unit for Mass is KILOGRAM (kg)
# Exact rational conversion factor: 1 Unit = factor * kg
MASS_FACTORS_TO_KG: Dict[str, Fraction] = {
    "t": Fraction(1000, 1),
    "metric_ton": Fraction(1000, 1),
    "tonne": Fraction(1000, 1),
    "kg": Fraction(1, 1),
    "kilogram": Fraction(1, 1),
    "g": Fraction(1, 1000),
    "gram": Fraction(1, 1000),
    "mg": Fraction(1, 1000000),
    "milligram": Fraction(1, 1000000),
    "ug": Fraction(1, 1000000000),
    "microgram": Fraction(1, 1000000000),
    # 1 carat = 200 mg = 0.2 g = 0.0002 kg = 1/5000 kg
    "ct": Fraction(1, 5000),
    "carat": Fraction(1, 5000),
}

# Base unit for Length is METER (m)
LENGTH_FACTORS_TO_METER: Dict[str, Fraction] = {
    "km": Fraction(1000, 1),
    "kilometer": Fraction(1000, 1),
    "m": Fraction(1, 1),
    "meter": Fraction(1, 1),
    "cm": Fraction(1, 100),
    "centimeter": Fraction(1, 100),
    "mm": Fraction(1, 1000),
    "millimeter": Fraction(1, 1000),
    "um": Fraction(1, 1000000),
    "micrometer": Fraction(1, 1000000),
}

UNIT_DIMENSION_MAP: Dict[str, UnitDimension] = {}
for u in MASS_FACTORS_TO_KG:
    UNIT_DIMENSION_MAP[u.lower()] = UnitDimension.MASS
for u in LENGTH_FACTORS_TO_METER:
    UNIT_DIMENSION_MAP[u.lower()] = UnitDimension.LENGTH


def canonical_unit_name(unit: str) -> str:
    """Normalize unit string representation to canonical short form."""
    u = unit.strip().lower()
    mapping = {
        "metric_ton": "t",
        "tonne": "t",
        "t": "t",
        "kilogram": "kg",
        "kg": "kg",
        "gram": "g",
        "g": "g",
        "milligram": "mg",
        "mg": "mg",
        "microgram": "ug",
        "ug": "ug",
        "carat": "ct",
        "ct": "ct",
        "kilometer": "km",
        "km": "km",
        "meter": "m",
        "m": "m",
        "centimeter": "cm",
        "cm": "cm",
        "millimeter": "mm",
        "mm": "mm",
        "micrometer": "um",
        "um": "um",
    }
    if u in mapping:
        return mapping[u]
    return u


class UnitConverter:
    """Exact rational converter between legal metrology units."""

    @staticmethod
    def get_dimension(unit: str) -> UnitDimension:
        u = canonical_unit_name(unit)
        if u not in UNIT_DIMENSION_MAP:
            raise IncompatibleUnitError(f"Unrecognized unit '{unit}'.")
        return UNIT_DIMENSION_MAP[u]

    @classmethod
    def convert(cls, value: NumericType, from_unit: str, to_unit: str) -> ExactDecimal:
        """Convert a numerical value from one unit to another using exact rational arithmetic."""
        u_from = canonical_unit_name(from_unit)
        u_to = canonical_unit_name(to_unit)

        if u_from == u_to:
            return exact_decimal(value)

        dim_from = cls.get_dimension(u_from)
        dim_to = cls.get_dimension(u_to)

        if dim_from != dim_to:
            raise IncompatibleUnitError(
                f"Cannot convert between incompatible dimensions: '{from_unit}' ({dim_from.value}) "
                f"and '{to_unit}' ({dim_to.value})."
            )

        dec_val = exact_decimal(value)
        frac_val = dec_val.to_fraction()

        if dim_from == UnitDimension.MASS:
            factor_from = MASS_FACTORS_TO_KG[u_from]
            factor_to = MASS_FACTORS_TO_KG[u_to]
        elif dim_from == UnitDimension.LENGTH:
            factor_from = LENGTH_FACTORS_TO_METER[u_from]
            factor_to = LENGTH_FACTORS_TO_METER[u_to]
        else:
            raise IncompatibleUnitError(f"Conversions for dimension {dim_from.value} are not implemented.")

        # Result = value * (factor_from / factor_to)
        conversion_ratio = factor_from / factor_to
        converted_fraction = frac_val * conversion_ratio
        return ExactDecimal(converted_fraction)


@dataclass(frozen=True)
class Quantity:
    """A physical quantity with an exact value and statutory unit."""

    value: ExactDecimal
    unit: str

    def __post_init__(self) -> None:
        # Validate unit existence
        norm_unit = canonical_unit_name(self.unit)
        if norm_unit not in UNIT_DIMENSION_MAP:
            raise IncompatibleUnitError(f"Unrecognized unit '{self.unit}'.")
        object.__setattr__(self, "unit", norm_unit)
        if not isinstance(self.value, ExactDecimal):
            object.__setattr__(self, "value", exact_decimal(self.value))

    def to_unit(self, target_unit: str) -> Quantity:
        """Convert this quantity to a target unit."""
        converted = UnitConverter.convert(self.value, self.unit, target_unit)
        return Quantity(converted, target_unit)

    def to_dict(self) -> Dict[str, str]:
        """Convert to a standardized serialized dictionary."""
        return {"value": str(self.value), "unit": self.unit}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Quantity:
        """Construct from serialized dictionary."""
        return cls(value=exact_decimal(data["value"]), unit=str(data["unit"]))

    def __add__(self, other: Any) -> Quantity:
        if isinstance(other, Quantity):
            other_conv = other.to_unit(self.unit)
            return Quantity(self.value + other_conv.value, self.unit)
        raise TypeError(f"Cannot add Quantity and {type(other).__name__}")

    def __sub__(self, other: Any) -> Quantity:
        if isinstance(other, Quantity):
            other_conv = other.to_unit(self.unit)
            return Quantity(self.value - other_conv.value, self.unit)
        raise TypeError(f"Cannot subtract {type(other).__name__} from Quantity")

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, Quantity):
            return False
        try:
            other_conv = other.to_unit(self.unit)
            return self.value == other_conv.value
        except IncompatibleUnitError:
            return False

    def __lt__(self, other: Any) -> bool:
        if not isinstance(other, Quantity):
            return NotImplemented
        other_conv = other.to_unit(self.unit)
        return self.value < other_conv.value

    def __le__(self, other: Any) -> bool:
        if not isinstance(other, Quantity):
            return NotImplemented
        other_conv = other.to_unit(self.unit)
        return self.value <= other_conv.value

    def __gt__(self, other: Any) -> bool:
        if not isinstance(other, Quantity):
            return NotImplemented
        other_conv = other.to_unit(self.unit)
        return self.value > other_conv.value

    def __ge__(self, other: Any) -> bool:
        if not isinstance(other, Quantity):
            return NotImplemented
        other_conv = other.to_unit(self.unit)
        return self.value >= other_conv.value

    def __repr__(self) -> str:
        return f"Quantity('{self.value}', '{self.unit}')"
