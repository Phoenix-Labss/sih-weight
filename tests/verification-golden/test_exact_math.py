"""Golden tests for exact decimal math, rational representation, and legal metrology units."""

from decimal import Decimal
from fractions import Fraction
import pytest

from packages.measurement.decimal_math import (
    ExactDecimal,
    exact_abs,
    exact_decimal,
    exact_max,
    exact_min,
    exact_round,
    LEGAL_METROLOGY_PRECISION,
)
from packages.measurement.errors import (
    IncompatibleUnitError,
    InvalidExactDecimalError,
)
from packages.measurement.units import (
    LengthUnit,
    MassUnit,
    Quantity,
    UnitConverter,
    UnitDimension,
)


class TestExactDecimalArithmetic:
    """Validate 28-precision exact arithmetic and rejection of binary floating point."""

    def test_rejection_of_binary_floats(self):
        """Binary floats must be strictly rejected to prevent representation drift."""
        with pytest.raises(InvalidExactDecimalError, match="Binary float .* is strictly prohibited"):
            ExactDecimal(0.1)

        with pytest.raises(InvalidExactDecimalError):
            ExactDecimal(15.000)

        with pytest.raises(InvalidExactDecimalError):
            exact_decimal(0.005)

    def test_exact_addition_no_drift(self):
        """0.1 + 0.2 must equal exactly 0.3 without IEEE 754 float drift."""
        a = ExactDecimal("0.1")
        b = ExactDecimal("0.2")
        c = a + b
        assert c == ExactDecimal("0.3")
        assert str(c) == "0.3"

    def test_multiplication_precision(self):
        """0.005 * 3000 must be exactly 15.000 without floating point artifacts."""
        e = ExactDecimal("0.005")
        count = ExactDecimal("3000")
        result = e * count
        assert result == ExactDecimal("15.000")
        assert result == ExactDecimal("15")

    def test_rational_fraction_conversion(self):
        """Exact rational fractions (e.g. 1/3, 2/7) convert to ExactDecimal within 28-digit context."""
        f = Fraction(1, 3)
        d = ExactDecimal(f)
        assert isinstance(d, ExactDecimal)
        assert str(d).startswith("0.3333333333333333333333333333")

        # Convert back to rational fraction
        d2 = ExactDecimal("0.125")
        f2 = d2.to_fraction()
        assert f2 == Fraction(1, 8)

    def test_deferred_statutory_rounding(self):
        """Rounding is performed deferred only at the prescribed statutory boundary."""
        # 0.5000000001 must not prematurely round down to 0.5000
        val = ExactDecimal("0.5000000001")
        rounded = exact_round(val, 3)
        assert rounded == ExactDecimal("0.500")

        # Exact half-up rounding
        assert exact_round(ExactDecimal("2.5005"), 3) == ExactDecimal("2.501")
        assert exact_round(ExactDecimal("2.5004"), 3) == ExactDecimal("2.500")

    def test_min_max_abs_helpers(self):
        """Test exact min, max, and abs helpers."""
        v1 = ExactDecimal("-5.005")
        v2 = ExactDecimal("2.500")
        v3 = ExactDecimal("10.125")

        assert exact_abs(v1) == ExactDecimal("5.005")
        assert exact_min(v1, v2, v3) == v1
        assert exact_max(v1, v2, v3) == v3


class TestLegalUnitsConversion:
    """Validate SI units vocabulary and exact rational conversion matrix."""

    def test_mass_conversions(self):
        """Test mass conversions: t, kg, g, mg, ug, ct."""
        # 1 tonne = 1000 kg
        assert UnitConverter.convert("1", "t", "kg") == ExactDecimal("1000")
        assert UnitConverter.convert("1000", "kg", "t") == ExactDecimal("1")

        # 1 kg = 1000 g
        assert UnitConverter.convert("15", "kg", "g") == ExactDecimal("15000")
        assert UnitConverter.convert("5000", "g", "kg") == ExactDecimal("5")

        # 1 g = 1000 mg
        assert UnitConverter.convert("0.5", "g", "mg") == ExactDecimal("500")
        assert UnitConverter.convert("5", "mg", "g") == ExactDecimal("0.005")

        # 1 carat = 0.2 g = 200 mg
        assert UnitConverter.convert("1", "ct", "g") == ExactDecimal("0.2")
        assert UnitConverter.convert("1", "ct", "mg") == ExactDecimal("200")
        assert UnitConverter.convert("5000", "ct", "kg") == ExactDecimal("1")

    def test_length_conversions(self):
        """Test length conversions: km, m, cm, mm, um."""
        assert UnitConverter.convert("1", "km", "m") == ExactDecimal("1000")
        assert UnitConverter.convert("1", "m", "cm") == ExactDecimal("100")
        assert UnitConverter.convert("1", "m", "mm") == ExactDecimal("1000")
        assert UnitConverter.convert("1", "mm", "um") == ExactDecimal("1000")

    def test_incompatible_dimensions_rejection(self):
        """Attempting to convert mass to length must fail with IncompatibleUnitError."""
        with pytest.raises(IncompatibleUnitError, match="Cannot convert between incompatible dimensions"):
            UnitConverter.convert("10", "kg", "m")

        with pytest.raises(IncompatibleUnitError):
            UnitConverter.convert("5", "mm", "g")

    def test_quantity_operations(self):
        """Test Quantity dataclass arithmetic, comparisons, and unit conversions."""
        q1 = Quantity("1.5", "kg")
        q2 = Quantity("500", "g")

        # Addition: 1.5 kg + 500 g = 2.0 kg
        q_sum = q1 + q2
        assert q_sum.value == ExactDecimal("2.0")
        assert q_sum.unit == "kg"

        # Subtraction: 1.5 kg - 500 g = 1.0 kg
        q_diff = q1 - q2
        assert q_diff.value == ExactDecimal("1.0")
        assert q_diff.unit == "kg"

        # Comparison across units
        assert Quantity("1", "kg") == Quantity("1000", "g")
        assert Quantity("500", "g") < Quantity("1", "kg")
        assert Quantity("2000", "g") > Quantity("1", "kg")

        # Serialization to/from dict
        d = q1.to_dict()
        assert d == {"value": "1.5", "unit": "kg"}
        q_restored = Quantity.from_dict(d)
        assert q_restored == q1
