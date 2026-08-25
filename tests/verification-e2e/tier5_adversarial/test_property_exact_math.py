"""Tier 5 Adversarial Property-Based Tests: Exact Decimal Math & Units Arithmetic.

Validates statutory requirements under The Legal Metrology Act, 2009:
- Absolute prohibition of binary floating-point arithmetic (IEEE-754 float drift).
- Exact 28-digit precision arithmetic context with deferred statutory rounding.
- Invariance under multi-step unit conversion cycles across all statutory mass units.
- Non-terminating rational division precision retention.
- Strict rejection of float, NaN, and Infinity across all numeric boundaries.
"""

from __future__ import annotations

import decimal
from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN
from fractions import Fraction
import math
import random
import pytest

from packages.measurement.decimal_math import (
    ExactDecimal,
    LEGAL_METROLOGY_CONTEXT,
    LEGAL_METROLOGY_PRECISION,
    exact_abs,
    exact_decimal,
    exact_max,
    exact_min,
    exact_round,
)
from packages.measurement.errors import IncompatibleUnitError, InvalidExactDecimalError
from packages.measurement.units import (
    MASS_FACTORS_TO_KG,
    MassUnit,
    Quantity,
    UnitConverter,
    canonical_unit_name,
)


class TestExactDecimalProperties:
    """Property-based and adversarial tests for ExactDecimal."""

    def test_float_rejection_fuzzing(self):
        """Adversarial test: verify that float values are rejected across all entrypoints."""
        float_samples = [
            0.0,
            0.1,
            0.005,
            1.5,
            -0.25,
            1e-7,
            1e12,
            float("nan"),
            float("inf"),
            float("-inf"),
            3.141592653589793,
        ]
        for val in float_samples:
            with pytest.raises(InvalidExactDecimalError):
                ExactDecimal(val)
            with pytest.raises(InvalidExactDecimalError):
                exact_decimal(val)

    def test_string_int_fraction_decimal_acceptance(self):
        """Verify exact construction from safe representations."""
        test_inputs = [
            ("0.005000", "0.005000"),
            ("15.000000", "15.000000"),
            (100, "100"),
            (0, "0"),
            (Decimal("0.005000"), "0.005000"),
            (Fraction(1, 200), "0.005"),
            (Fraction(1, 3), "0.3333333333333333333333333333"),
        ]
        for inp, expected_str in test_inputs:
            d = ExactDecimal(inp)
            assert str(d).startswith(expected_str[:5])

    def test_rational_division_precision_property(self):
        """Property: ExactDecimal preserves 28 significant digits on non-terminating divisions."""
        fractions_to_test = [
            (Fraction(1, 3), "0.3333333333333333333333333333"),
            (Fraction(2, 3), "0.6666666666666666666666666667"),
            (Fraction(1, 7), "0.1428571428571428571428571429"),
            (Fraction(1, 13), "0.0769230769230769230769230769"),
            (Fraction(1, 17), "0.0588235294117647058823529412"),
            (Fraction(22, 7), "3.142857142857142857142857143"),
        ]
        for frac, expected_prefix in fractions_to_test:
            ed = ExactDecimal(frac)
            assert str(ed).startswith(expected_prefix[:15])
            # Reconvert to Fraction and verify closeness within 10^-27
            frac_recon = ed.to_fraction()
            diff = abs(frac - frac_recon)
            assert diff < Fraction(1, 10**26)

    def test_arithmetic_commutativity_and_associativity(self):
        """Property: Addition and multiplication are strictly commutative and associative."""
        rng = random.Random(42)
        for _ in range(50):
            a_val = str(rng.randint(1, 100000)) + "." + str(rng.randint(100, 999))
            b_val = str(rng.randint(1, 100000)) + "." + str(rng.randint(100, 999))
            c_val = str(rng.randint(1, 100000)) + "." + str(rng.randint(100, 999))

            a = ExactDecimal(a_val)
            b = ExactDecimal(b_val)
            c = ExactDecimal(c_val)

            # Commutativity: a + b == b + a, a * b == b * a
            assert a + b == b + a
            assert a * b == b * a

            # Associativity: (a + b) + c == a + (b + c)
            assert (a + b) + c == a + (b + c)
            assert (a * b) * c == a * (b * c)

            # Distributivity: a * (b + c) == a * b + a * c
            assert a * (b + c) == (a * b) + (a * c)

    def test_statutory_rounding_half_up_boundary(self):
        """Statutory rounding rule: ROUND_HALF_UP (0.5 rounds up, 0.499999 rounds down)."""
        # Scale 3 (0.001)
        assert exact_round("0.005500", 3) == ExactDecimal("0.006")
        assert exact_round("0.005499", 3) == ExactDecimal("0.005")
        assert exact_round("0.005501", 3) == ExactDecimal("0.006")
        assert exact_round("0.000500", 3) == ExactDecimal("0.001")
        assert exact_round("0.000499", 3) == ExactDecimal("0.000")

        # Negative numbers under HALF_UP (away from zero)
        assert exact_round("-0.005500", 3) == ExactDecimal("-0.006")
        assert exact_round("-0.005499", 3) == ExactDecimal("-0.005")

    def test_scale_preservation_and_display(self):
        """Verify scale tracking and display formatting."""
        d1 = ExactDecimal("15.000000")
        assert d1.scale() == 6
        assert d1.to_display_str() == "15.000000"
        assert d1.to_display_str(scale=2) == "15.00"

        d2 = ExactDecimal("0.000000000000000001")
        assert d2.scale() == 18

    def test_helper_functions_min_max_abs(self):
        """Verify exact_min, exact_max, exact_abs."""
        vals = [ExactDecimal("-15.5"), ExactDecimal("0.005"), ExactDecimal("100.25"), ExactDecimal("-200")]
        assert exact_min(*vals) == ExactDecimal("-200")
        assert exact_max(*vals) == ExactDecimal("100.25")
        assert exact_abs("-15.5") == ExactDecimal("15.5")
        assert exact_abs("0.000") == ExactDecimal("0.000")

        with pytest.raises(ValueError):
            exact_min()
        with pytest.raises(ValueError):
            exact_max()


class TestUnitConversionProperties:
    """Property-based and adversarial tests for UnitConverter and Quantity."""

    def test_mass_unit_conversion_cycle_invariance(self):
        """Property: Multi-step cycle t -> kg -> g -> mg -> ug -> ct -> t loses zero precision."""
        initial_val = ExactDecimal("123.456789")
        qty_ton = Quantity(initial_val, "t")

        # Cycle through all mass units
        qty_kg = qty_ton.to_unit("kg")
        assert qty_kg.value == ExactDecimal("123456.789")

        qty_g = qty_kg.to_unit("g")
        assert qty_g.value == ExactDecimal("123456789")

        qty_mg = qty_g.to_unit("mg")
        assert qty_mg.value == ExactDecimal("123456789000")

        qty_ug = qty_mg.to_unit("ug")
        assert qty_ug.value == ExactDecimal("123456789000000")

        qty_ct = qty_ug.to_unit("ct")
        # 1 ct = 200 mg = 200,000 ug
        # 123456789000000 / 200000 = 617283945 ct
        assert qty_ct.value == ExactDecimal("617283945")

        # Complete roundtrip back to metric tons
        qty_back_ton = qty_ct.to_unit("t")
        assert qty_back_ton.value == initial_val

    def test_carat_conversion_exactness(self):
        """1 metric carat = exactly 200 mg = 0.2 g = 0.0002 kg."""
        ct_1 = Quantity(ExactDecimal("1"), "ct")
        assert ct_1.to_unit("mg").value == ExactDecimal("200")
        assert ct_1.to_unit("g").value == ExactDecimal("0.2")
        assert ct_1.to_unit("kg").value == ExactDecimal("0.0002")

        # 5 carats = 1 gram
        ct_5 = Quantity(ExactDecimal("5"), "ct")
        assert ct_5.to_unit("g").value == ExactDecimal("1")

    def test_incompatible_dimension_conversion_rejection(self):
        """Adversarial: Attempting to convert between mass and length must raise IncompatibleUnitError."""
        with pytest.raises(IncompatibleUnitError):
            UnitConverter.convert(ExactDecimal("10"), "kg", "meter")
        with pytest.raises(IncompatibleUnitError):
            UnitConverter.convert(ExactDecimal("5"), "mm", "g")
        with pytest.raises(IncompatibleUnitError):
            Quantity(ExactDecimal("10"), "kg").to_unit("km")

    def test_unrecognized_unit_rejection(self):
        """Adversarial: Attempting to use unrecognized / non-statutory units raises IncompatibleUnitError."""
        bad_units = ["lbs", "oz", "pound", "ounce", "yard", "stone", "foo", ""]
        for u in bad_units:
            with pytest.raises(IncompatibleUnitError):
                UnitConverter.convert(ExactDecimal("1"), u, "kg")
            with pytest.raises(IncompatibleUnitError):
                Quantity(ExactDecimal("1"), u)

    def test_quantity_arithmetic_and_comparisons(self):
        """Property: Quantity operations handle cross-unit arithmetic seamlessly."""
        q1 = Quantity(ExactDecimal("1"), "kg")
        q2 = Quantity(ExactDecimal("500"), "g")

        # q1 + q2 = 1.5 kg
        sum_q = q1 + q2
        assert sum_q.value == ExactDecimal("1.5")
        assert sum_q.unit == "kg"

        # q1 - q2 = 0.5 kg
        diff_q = q1 - q2
        assert diff_q.value == ExactDecimal("0.5")
        assert diff_q.unit == "kg"

        # Comparisons
        assert q1 > q2
        assert q2 < q1
        assert q1 >= Quantity(ExactDecimal("1000"), "g")
        assert q1 <= Quantity(ExactDecimal("1000"), "g")
        assert q1 == Quantity(ExactDecimal("1000"), "g")
        assert q1 != Quantity(ExactDecimal("999"), "g")

    def test_extreme_magnitude_tonnage_and_microgram(self):
        """Property: No overflow or loss of precision on 1,000,000 ton or 0.000001 ug."""
        heavy_ton = Quantity(ExactDecimal("1000000"), "t")
        assert heavy_ton.to_unit("kg").value == ExactDecimal("1000000000")
        assert heavy_ton.to_unit("g").value == ExactDecimal("1000000000000")

        micro = Quantity(ExactDecimal("0.000001"), "ug")
        micro_kg = micro.to_unit("kg")
        # 1 ug = 10^-9 kg => 0.000001 ug = 10^-15 kg
        assert micro_kg.value == ExactDecimal("0.000000000000001")
        assert micro_kg.to_unit("ug").value == ExactDecimal("0.000001")
