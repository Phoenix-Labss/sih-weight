"""Tier 2 Boundaries & Corners: Exact Decimal Arithmetic & Extreme Scale Intervals.
"""

from __future__ import annotations

from decimal import Decimal
import pytest

from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from packages.measurement.units import MassUnit, Quantity, UnitConverter, UnitDimension


class TestUnitPrecisionBoundaries:
    """Boundary test suite verifying decimal precision, unit conversions, and extreme scale intervals."""

    def test_exact_decimal_arithmetic_no_floating_point_pollution(self):
        """0.1 + 0.2 must equal exactly 0.3 without binary floating point 0.30000000000000004 artifacts."""
        d1 = exact_decimal("0.1")
        d2 = exact_decimal("0.2")
        d_sum = ExactDecimal(d1 + d2)
        assert d_sum == ExactDecimal("0.3")
        assert str(d_sum) == "0.3"

    def test_extreme_precision_micro_weights(self):
        """High-precision analytical balances with microgram/milligram scale intervals."""
        # e = 0.1 mg = 0.0001 g = 0.0000001 kg
        q_load = Quantity(ExactDecimal("0.000100"), "g")
        q_reading = Quantity(ExactDecimal("0.000100"), "g")
        q_delta_l = Quantity(ExactDecimal("0.000050"), "g")

        # Convert to milligrams
        q_load_mg = q_load.to_unit(MassUnit.MILLIGRAM.value)
        assert q_load_mg.value == ExactDecimal("0.1")
        assert q_load_mg.unit == "mg"

        # True indication P = I + 0.5e - delta_L
        half_e = ExactDecimal("0.000050")
        p = ExactDecimal(q_reading.value + half_e - q_delta_l.value)
        assert p == ExactDecimal("0.000100")
        error = ExactDecimal(p - q_load.value)
        assert error == ExactDecimal("0.000000")

    def test_extreme_tonnage_heavy_weighbridges(self):
        """Heavy industrial weighbridge with Max = 150 tonnes = 150,000 kg."""
        q_load_t = Quantity(ExactDecimal("150.000"), MassUnit.METRIC_TON.value)
        q_load_kg = q_load_t.to_unit(MassUnit.KILOGRAM.value)
        assert q_load_kg.value == ExactDecimal("150000")
        assert q_load_kg.unit == "kg"

        # Large load addition: 150t + 50kg test weight
        q_std = Quantity(ExactDecimal("50.000"), "kg")
        total_load = Quantity(ExactDecimal(q_load_kg.value + q_std.value), "kg")
        assert total_load.value == ExactDecimal("150050.000")

    def test_multistep_unit_conversion_invariance(self):
        """Converting t -> kg -> g -> mg -> g -> kg -> t preserves exact starting value."""
        start_val = ExactDecimal("12.345678")
        q_start = Quantity(start_val, "t")

        q_kg = q_start.to_unit("kg")
        assert q_kg.value == ExactDecimal("12345.678")

        q_g = q_kg.to_unit("g")
        assert q_g.value == ExactDecimal("12345678")

        q_mg = q_g.to_unit("mg")
        assert q_mg.value == ExactDecimal("12345678000")

        q_back_t = q_mg.to_unit("t")
        assert q_back_t.value == start_val

    def test_rational_division_boundary_precision(self):
        """Rational division operations maintain 28-digit precision without truncation errors."""
        d1 = ExactDecimal("1")
        d3 = ExactDecimal("3")
        div_res = ExactDecimal(d1 / d3)
        assert str(div_res).startswith("0.33333333333333333333")
        assert len(str(div_res)) >= 28
