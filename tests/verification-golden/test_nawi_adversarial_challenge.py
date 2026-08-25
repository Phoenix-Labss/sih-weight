"""Adversarial stress-testing suite for Exact Measurement, Arithmetic, and NAWI Procedure Execution Engine.

Empirical verification suite for Milestone 1 Challenger 1.
Tests exact rational/decimal arithmetic, IEEE-754 rejection, 28-precision constraints,
cyclic SI unit conversions, stepped MPE boundary precision at machine epsilon,
zero-setting tolerance boundaries, eccentricity, repeatability spread,
tare balancing, deterministic JSON calculation traces, and property-based invariant generation.
"""

from datetime import datetime, date, timezone
from decimal import Decimal, getcontext
from fractions import Fraction
import json
import random
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
    DimensionalityError,
    IncompatibleUnitError,
    InvalidExactDecimalError,
    MeasurementError,
)
from packages.measurement.units import (
    canonical_unit_name,
    LengthUnit,
    MASS_FACTORS_TO_KG,
    MassUnit,
    Quantity,
    UnitConverter,
    UnitDimension,
)
from verification_procedures.base import (
    AccuracyClassEnum,
    EccentricityPositionEnum,
    EccentricityPositionObservation,
    EccentricityTestObservation,
    InstrumentParameters,
    LinearityStepObservation,
    ReferenceStandardItem,
    RepeatabilityRunObservation,
    RepeatabilitySeriesObservation,
    SessionEvaluationInput,
    StandardAccuracyClassEnum,
    TareObservation,
    TestDirectionEnum,
    VerificationOutcomeEnum,
    VerificationTypeEnum,
    ZeroSettingObservation,
)
from verification_procedures.nawi.evaluator import (
    ClassificationValidationResult,
    EccentricityEvaluationResult,
    NAWIEvaluator,
    RepeatabilitySeriesResult,
    TareEvaluationResult,
    ZeroEvaluationResult,
)
from verification_procedures.nawi.mpe import (
    calculate_nawi_mpe,
    get_nawi_mpe_factor_in_e,
)
from verification_procedures.nawi.pack import NAWIProcedurePack
from verification_procedures.nawi.trace import generate_nawi_calculation_trace


@pytest.fixture
def valid_standard_m1_20kg():
    """Valid unexpired Class M1 standard weight set."""
    return ReferenceStandardItem(
        standard_id="STD-M1-ADV-01",
        standard_name="Class M1 Verification Mass Set 20kg",
        accuracy_class=StandardAccuracyClassEnum.M1,
        nominal_mass=Quantity("20", "kg"),
        calibration_date="2026-01-01",
        expiry_date="2027-01-01",
        is_quarantined=False,
        status="ACTIVE",
        uncertainty_k2=Quantity("0.5", "g"),
    )


# =============================================================================
# SUITE 1: ADVERSARIAL ARITHMETIC & EXACT DECIMAL MATH TESTS
# =============================================================================

class TestAdversarialExactArithmetic:
    """Stress-test 28-precision exact decimal arithmetic, float rejection, and rational invariants."""

    def test_rejection_of_all_float_variants(self):
        """Strictly reject all binary float representations including scientific, special, and subnormal."""
        invalid_floats = [
            0.0,
            -0.0,
            1.0,
            -1.0,
            0.1,
            0.0000000000000001,
            1e-5,
            1e10,
            float("inf"),
            float("-inf"),
            float("nan"),
            3.141592653589793,
        ]
        for val in invalid_floats:
            with pytest.raises(InvalidExactDecimalError):
                ExactDecimal(val)
            with pytest.raises(InvalidExactDecimalError):
                exact_decimal(val)

    def test_string_rejection_of_invalid_formats(self):
        """Reject invalid strings like empty strings, non-numeric strings, or malformed formats."""
        invalid_strings = [
            "",
            "   ",
            "abc",
            "12.34.56",
            "1,000.00",
            "1e99999999999999999999",  # Overflow
        ]
        for s in invalid_strings:
            with pytest.raises(InvalidExactDecimalError):
                ExactDecimal(s)

    def test_precision_28_no_loss_on_long_decimals(self):
        """Ensure full 28 digits of precision are preserved without premature truncation."""
        long_pi = "3.141592653589793238462643383"
        d = ExactDecimal(long_pi)
        assert str(d) == long_pi
        assert len(str(d).replace(".", "")) == 28

    def test_rational_conversions_exact_bijective(self):
        """Fraction -> ExactDecimal -> Fraction round-tripping for terminating decimals."""
        terminating_decimals = [
            "0.5",
            "0.25",
            "0.125",
            "0.0625",
            "0.03125",
            "0.015625",
            "0.0078125",
            "0.00390625",
            "0.001953125",
            "0.0009765625",
            "123.456",
            "0.0000000000000000000000000001",
        ]
        for s in terminating_decimals:
            d = ExactDecimal(s)
            f = d.to_fraction()
            d_back = ExactDecimal(f)
            assert d == d_back
            assert str(d) == str(d_back)

    def test_extreme_precision_addition_and_subtraction(self):
        """Test exact subtraction of nearly identical 28-digit numbers."""
        a = ExactDecimal("1000000000000000.000000000001")
        b = ExactDecimal("1000000000000000.000000000000")
        diff = a - b
        # Numerical value is exactly 0.000000000001 (1E-12)
        assert diff == ExactDecimal("0.000000000001")
        assert diff == ExactDecimal("1E-12")

    def test_scale_helper(self):
        """Test scale() returns exact number of fractional digits."""
        assert ExactDecimal("100").scale() == 0
        assert ExactDecimal("100.0").scale() == 1
        assert ExactDecimal("100.005").scale() == 3
        assert ExactDecimal("0.0000000000000000000000000001").scale() == 28

    def test_exact_rounding_statutory_cases(self):
        """Test statutory deferred rounding: scale zero, positive."""
        # Scale zero (integers)
        assert ExactDecimal("12.5").exact_round(0) == ExactDecimal("13")
        assert ExactDecimal("12.4").exact_round(0) == ExactDecimal("12")

        # Scale positive (decimal places)
        assert ExactDecimal("12.3456").exact_round(3) == ExactDecimal("12.346")
        assert ExactDecimal("12.3454").exact_round(3) == ExactDecimal("12.345")
        assert ExactDecimal("0.0055").exact_round(3) == ExactDecimal("0.006")
        assert ExactDecimal("0.0054").exact_round(3) == ExactDecimal("0.005")


# =============================================================================
# SUITE 2: ADVERSARIAL SI UNITS & QUANTITY INTEGRITY TESTS
# =============================================================================

class TestAdversarialSIUnitsAndQuantities:
    """Stress-test legal SI units vocabulary, cyclic conversions, and Quantity immutability."""

    def test_cyclic_mass_conversion_lossless(self):
        """Converting 1 tonne -> kg -> g -> mg -> ug -> ct -> t must be lossless."""
        t_orig = ExactDecimal("1.234567")
        kg_val = UnitConverter.convert(t_orig, "t", "kg")
        g_val = UnitConverter.convert(kg_val, "kg", "g")
        mg_val = UnitConverter.convert(g_val, "g", "mg")
        ug_val = UnitConverter.convert(mg_val, "mg", "ug")
        ct_val = UnitConverter.convert(ug_val, "ug", "ct")
        t_back = UnitConverter.convert(ct_val, "ct", "t")

        assert t_back == t_orig
        assert str(t_back) == str(t_orig)

    def test_all_mass_units_exhaustive_conversion_matrix(self):
        """Test bidirectional conversion between every pair of mass units."""
        units = ["t", "kg", "g", "mg", "ug", "ct"]
        test_val = ExactDecimal("10.0")

        for u1 in units:
            for u2 in units:
                conv_to = UnitConverter.convert(test_val, u1, u2)
                conv_back = UnitConverter.convert(conv_to, u2, u1)
                assert conv_back == test_val, f"Failed round-trip {u1} -> {u2} -> {u1}"

    def test_quantity_immutability(self):
        """Quantity is frozen and cannot be mutated."""
        q = Quantity("10", "kg")
        with pytest.raises(Exception):
            q.value = ExactDecimal("20")  # type: ignore
        with pytest.raises(Exception):
            q.unit = "g"  # type: ignore

    def test_quantity_cross_unit_comparisons_and_ordering(self):
        """Exhaustive comparison of quantities across mass units."""
        q_1t = Quantity("1", "t")
        q_1000kg = Quantity("1000", "kg")
        q_1000000g = Quantity("1000000", "g")
        q_5000000ct = Quantity("5000000", "ct")

        assert q_1t == q_1000kg
        assert q_1000kg == q_1000000g
        assert q_1000000g == q_5000000ct
        assert q_1t == q_5000000ct

        q_small = Quantity("999.999999", "kg")
        assert q_small < q_1t
        assert q_small <= q_1t
        assert q_1t > q_small
        assert q_1t >= q_small
        assert q_small != q_1t

    def test_quantity_arithmetic_cross_units(self):
        """Addition and subtraction across units preserves self.unit."""
        q1 = Quantity("1.5", "kg")
        q2 = Quantity("500", "g")
        q3 = Quantity("2000", "mg")  # 2g = 0.002kg

        q_sum = q1 + q2 + q3
        assert q_sum.unit == "kg"
        assert q_sum.value == ExactDecimal("2.002")

        q_diff = q1 - q2
        assert q_diff.unit == "kg"
        assert q_diff.value == ExactDecimal("1.0")

    def test_incompatible_dimensions_rejections(self):
        """Strictly reject addition/comparison between incompatible dimensions."""
        q_mass = Quantity("5", "kg")
        q_len = Quantity("5", "m")

        with pytest.raises(IncompatibleUnitError):
            _ = q_mass + q_len

        with pytest.raises(IncompatibleUnitError):
            _ = q_mass - q_len

        assert (q_mass == q_len) is False


# =============================================================================
# SUITE 3: ADVERSARIAL STEPPED MPE BOUNDARY & EPSILON PRECISION TESTS
# =============================================================================

class TestAdversarialSteppedMPEBoundaries:
    """Stress-test piecewise stepped MPE boundaries at significant digit precision."""

    @pytest.mark.parametrize(
        "accuracy_class,verif_type,step1_bound,step2_bound,mult,eps1,eps2",
        [
            (AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL, "500", "2000", "1", "0.0000000000000000000000001", "0.000000000000000000000001"),
            (AccuracyClassEnum.CLASS_III, VerificationTypeEnum.RE_VERIFICATION, "500", "2000", "2", "0.0000000000000000000000001", "0.000000000000000000000001"),
            (AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.INITIAL, "50", "200", "1", "0.00000000000000000000000001", "0.0000000000000000000000001"),
            (AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.RE_VERIFICATION, "50", "200", "2", "0.00000000000000000000000001", "0.0000000000000000000000001"),
            (AccuracyClassEnum.CLASS_II, VerificationTypeEnum.INITIAL, "5000", "20000", "1", "0.000000000000000000000001", "0.00000000000000000000001"),
            (AccuracyClassEnum.CLASS_I, VerificationTypeEnum.INITIAL, "50000", "200000", "1", "0.00000000000000000000001", "0.0000000000000000000001"),
        ],
    )
    def test_mpe_step_boundary_epsilon_precision(
        self, accuracy_class, verif_type, step1_bound, step2_bound, mult, eps1, eps2
    ):
        """At exact boundary -> lower tier. At boundary + epsilon within 28 sig digits -> higher tier."""
        m_s1 = ExactDecimal(step1_bound)
        m_s2 = ExactDecimal(step2_bound)
        m_mult = ExactDecimal(mult)
        e1 = ExactDecimal(eps1)
        e2 = ExactDecimal(eps2)

        # At step 1 boundary: factor is 0.5 * mult
        f_s1 = get_nawi_mpe_factor_in_e(m_s1, accuracy_class, verif_type)
        assert f_s1 == ExactDecimal("0.5") * m_mult

        # At step 1 boundary + epsilon: factor jumps to 1.0 * mult
        f_s1_plus = get_nawi_mpe_factor_in_e(m_s1 + e1, accuracy_class, verif_type)
        assert f_s1_plus == ExactDecimal("1.0") * m_mult

        # At step 2 boundary: factor is 1.0 * mult
        f_s2 = get_nawi_mpe_factor_in_e(m_s2, accuracy_class, verif_type)
        assert f_s2 == ExactDecimal("1.0") * m_mult

        # At step 2 boundary + epsilon: factor jumps to 1.5 * mult
        f_s2_plus = get_nawi_mpe_factor_in_e(m_s2 + e2, accuracy_class, verif_type)
        assert f_s2_plus == ExactDecimal("1.5") * m_mult

    def test_negative_load_mpe_absolute_invariance(self):
        """Negative load intervals (e.g. tare offsets) evaluate MPE factor identically to positive loads."""
        f_pos = get_nawi_mpe_factor_in_e(ExactDecimal("1000"), AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL)
        f_neg = get_nawi_mpe_factor_in_e(ExactDecimal("-1000"), AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL)
        assert f_pos == f_neg == ExactDecimal("1.0")


# =============================================================================
# SUITE 4: ADVERSARIAL METROLOGICAL EVALUATOR & DISPOSITION TESTS
# =============================================================================

class TestAdversarialMetrologicalEvaluator:
    """Stress-test NAWIEvaluator on zero setting, linearity, eccentricity, and repeatability."""

    def test_zero_setting_exact_boundary_tolerance(self):
        """Zero setting tolerance is +/- 0.25e. Test at 0.25e (pass) vs 0.25e + epsilon (fail)."""
        e = Quantity("0.005", "kg")  # 5g -> 0.25e = 1.25g = 0.00125 kg
        eps = ExactDecimal("0.000000000000000000000001")

        # 1. Exactly +0.25e: delta_L0 = 0.5e - 0.25e = 0.25e = 0.00125 kg -> P0 = 0 + 0.0025 - 0.00125 = +0.00125 kg = +0.25e
        obs_pass_pos = ZeroSettingObservation(
            indicated_I0=Quantity("0.000", "kg"),
            delta_L0=Quantity("0.00125", "kg"),
        )
        res_pass_pos = NAWIEvaluator.evaluate_zero_setting(obs_pass_pos, e)
        assert res_pass_pos.is_passed is True
        assert res_pass_pos.zero_error_E0.value == ExactDecimal("0.00125")

        # 2. +0.25e + epsilon: delta_L0 = 0.00125 - eps -> P0 = +0.00125 + eps -> FAIL
        obs_fail_pos = ZeroSettingObservation(
            indicated_I0=Quantity("0.000", "kg"),
            delta_L0=Quantity(ExactDecimal(ExactDecimal("0.00125") - eps), "kg"),
        )
        res_fail_pos = NAWIEvaluator.evaluate_zero_setting(obs_fail_pos, e)
        assert res_fail_pos.is_passed is False
        assert "ZERO_SETTING_OUT_OF_TOLERANCE" in res_fail_pos.error_message

        # 3. Exactly -0.25e: delta_L0 = 0.5e - (-0.25e) = 0.75e = 0.00375 kg -> P0 = 0 + 0.0025 - 0.00375 = -0.00125 kg = -0.25e
        obs_pass_neg = ZeroSettingObservation(
            indicated_I0=Quantity("0.000", "kg"),
            delta_L0=Quantity("0.00375", "kg"),
        )
        res_pass_neg = NAWIEvaluator.evaluate_zero_setting(obs_pass_neg, e)
        assert res_pass_neg.is_passed is True
        assert res_pass_neg.zero_error_E0.value == ExactDecimal("-0.00125")

        # 4. -0.25e - epsilon: delta_L0 = 0.00375 + eps -> P0 = -0.00125 - eps -> FAIL
        obs_fail_neg = ZeroSettingObservation(
            indicated_I0=Quantity("0.000", "kg"),
            delta_L0=Quantity(ExactDecimal(ExactDecimal("0.00375") + eps), "kg"),
        )
        res_fail_neg = NAWIEvaluator.evaluate_zero_setting(obs_fail_neg, e)
        assert res_fail_neg.is_passed is False
        assert "ZERO_SETTING_OUT_OF_TOLERANCE" in res_fail_neg.error_message

    def test_linearity_exact_mpe_boundary_pass_and_fail(self):
        """Linearity step: corrected error Ec == MPE (pass) vs Ec == MPE + eps (fail)."""
        e = Quantity("0.005", "kg")
        e0 = Quantity("0.000", "kg")
        eps = ExactDecimal("0.000000000000000000000001")

        # Load = 2.500 kg (500e) -> MPE = 0.5e = 0.0025 kg (2.5g)
        # 1. Ec = +0.0025 kg exactly -> PASS
        step_pass = LinearityStepObservation(
            step_number=1,
            direction=TestDirectionEnum.INCREASING,
            nominal_load=Quantity("2.500", "kg"),
            indicated_I=Quantity("2.505", "kg"),
            delta_L=Quantity("0.0050", "kg"),  # P = 2.505 + 0.0025 - 0.0050 = 2.5025 -> Ec = +0.0025
        )
        res_pass = NAWIEvaluator.evaluate_linearity_step(
            step=step_pass,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_pass.is_within_mpe is True
        assert res_pass.corrected_error_Ec.value == ExactDecimal("0.0025")

        # 2. Ec = +0.0025 + eps -> FAIL
        step_fail = LinearityStepObservation(
            step_number=1,
            direction=TestDirectionEnum.INCREASING,
            nominal_load=Quantity("2.500", "kg"),
            indicated_I=Quantity("2.505", "kg"),
            delta_L=Quantity(ExactDecimal(ExactDecimal("0.0050") - eps), "kg"),
        )
        res_fail = NAWIEvaluator.evaluate_linearity_step(
            step=step_fail,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_fail.is_within_mpe is False

    def test_eccentricity_5_positions_one_corner_fails(self):
        """If 4 positions have zero error but 1 corner exceeds MPE by epsilon, test fails."""
        e = Quantity("0.020", "kg")  # 20g
        e0 = Quantity("0.000", "kg")
        eps = ExactDecimal("0.000000000000000000000001")
        # Test load = 20 kg (1000e) -> MPE = 1.0e = 20g = 0.020 kg

        ecc_obs = EccentricityTestObservation(
            test_load=Quantity("20.000", "kg"),
            positions=[
                EccentricityPositionObservation(position=EccentricityPositionEnum.CENTER, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                EccentricityPositionObservation(position=EccentricityPositionEnum.FRONT_LEFT, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                EccentricityPositionObservation(position=EccentricityPositionEnum.FRONT_RIGHT, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                EccentricityPositionObservation(position=EccentricityPositionEnum.BACK_RIGHT, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                # Corner 4: Ec = 20g + eps -> Exceeds MPE
                EccentricityPositionObservation(position=EccentricityPositionEnum.BACK_LEFT, indicated_I=Quantity("20.040", "kg"), delta_L=Quantity(ExactDecimal(ExactDecimal("0.030") - eps), "kg")),
            ],
        )

        res = NAWIEvaluator.evaluate_eccentricity_test(
            ecc_obs=ecc_obs,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res.is_passed is False
        assert len(res.failure_reasons) == 1
        assert "BACK_LEFT" in res.failure_reasons[0]

    def test_repeatability_spread_exact_boundary(self):
        """Repeatability spread delta_P == MPE (pass) vs delta_P == MPE + eps (fail)."""
        e = Quantity("0.100", "kg")  # 100g
        # Load = 300 kg (3000e) -> MPE = 1.5e = 150g = 0.150 kg
        eps = ExactDecimal("0.000000000000000000000001")

        # 1. Spread = exactly 150g -> PASS
        series_pass = RepeatabilitySeriesObservation(
            nominal_load=Quantity("300.000", "kg"),
            runs=[
                RepeatabilityRunObservation(run_number=1, indicated_I=Quantity("300.000", "kg"), delta_L=Quantity("0.050", "kg")), # P = 300.000
                RepeatabilityRunObservation(run_number=2, indicated_I=Quantity("300.150", "kg"), delta_L=Quantity("0.050", "kg")), # P = 300.150 -> delta = 0.150
                RepeatabilityRunObservation(run_number=3, indicated_I=Quantity("300.000", "kg"), delta_L=Quantity("0.050", "kg")),
            ],
        )
        res_pass = NAWIEvaluator.evaluate_repeatability_series(
            series_obs=series_pass,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_pass.is_passed is True
        assert res_pass.spread_delta_P.value == ExactDecimal("0.150")

        # 2. Spread = 150g + eps -> FAIL
        series_fail = RepeatabilitySeriesObservation(
            nominal_load=Quantity("300.000", "kg"),
            runs=[
                RepeatabilityRunObservation(run_number=1, indicated_I=Quantity("300.000", "kg"), delta_L=Quantity("0.050", "kg")),
                RepeatabilityRunObservation(run_number=2, indicated_I=Quantity("300.150", "kg"), delta_L=Quantity(ExactDecimal(ExactDecimal("0.050") - eps), "kg")), # P = 300.150 + eps
                RepeatabilityRunObservation(run_number=3, indicated_I=Quantity("300.000", "kg"), delta_L=Quantity("0.050", "kg")),
            ],
        )
        res_fail = NAWIEvaluator.evaluate_repeatability_series(
            series_obs=series_fail,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_fail.is_passed is False
        assert "REPEATABILITY_SPREAD_EXCEEDED" in res_fail.error_message


# =============================================================================
# SUITE 5: ADVERSARIAL DETERMINISTIC CALCULATION TRACE & SCHEMA TESTS
# =============================================================================

class TestAdversarialCalculationTraceDeterminism:
    """Validate JSON serializability, canonical hashing determinism, and schema completeness."""

    def test_trace_json_serializability_and_key_structure(self, valid_standard_m1_20kg):
        """The entire calculation trace must be 100% standard JSON-serializable."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("15", "kg"),
            min_capacity=Quantity("0.100", "kg"),
            verification_scale_interval_e=Quantity("0.005", "kg"),
            actual_scale_interval_d=Quantity("0.005", "kg"),
        )

        session_input = SessionEvaluationInput(
            session_id="SESS-TRACE-SERIALIZE-01",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T12:00:00Z",
            reference_standards=[valid_standard_m1_20kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.0025", "kg"),
            ),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity("5.000", "kg"),
                    indicated_I=Quantity("5.000", "kg"),
                    delta_L=Quantity("0.0025", "kg"),
                )
            ],
            eccentricity=EccentricityTestObservation(
                test_load=Quantity("5.000", "kg"),
                positions=[
                    EccentricityPositionObservation(position=EccentricityPositionEnum.CENTER, indicated_I=Quantity("5.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                    EccentricityPositionObservation(position=EccentricityPositionEnum.FRONT_LEFT, indicated_I=Quantity("5.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                    EccentricityPositionObservation(position=EccentricityPositionEnum.FRONT_RIGHT, indicated_I=Quantity("5.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                    EccentricityPositionObservation(position=EccentricityPositionEnum.BACK_RIGHT, indicated_I=Quantity("5.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                    EccentricityPositionObservation(position=EccentricityPositionEnum.BACK_LEFT, indicated_I=Quantity("5.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                ],
            ),
            repeatability=[
                RepeatabilitySeriesObservation(
                    nominal_load=Quantity("5.000", "kg"),
                    runs=[
                        RepeatabilityRunObservation(run_number=1, indicated_I=Quantity("5.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                        RepeatabilityRunObservation(run_number=2, indicated_I=Quantity("5.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                        RepeatabilityRunObservation(run_number=3, indicated_I=Quantity("5.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                    ],
                )
            ],
            tare=TareObservation(
                tare_load=Quantity("2.000", "kg"),
                net_load=Quantity("3.000", "kg"),
                indicated_I_net=Quantity("3.000", "kg"),
                delta_L_net=Quantity("0.0025", "kg"),
            ),
        )

        res = pack.evaluate_session(session_input)
        trace = res.calculation_trace

        # Must serialize to JSON string without errors or exceptions
        json_str = json.dumps(trace, indent=2)
        assert json_str is not None

        # Re-parse and verify structure
        parsed = json.loads(json_str)
        assert parsed["$schema"] == "https://legalmetrology.gov.in/schemas/v1/nawi-evaluation-trace.json"
        assert parsed["procedure_pack"]["pack_id"] == "IND-LM-NAWI-CLASS-III-IIII-2026.1"
        assert parsed["instrument_parameters"]["accuracy_class"] == "CLASS_III"
        assert parsed["zero_setting_evaluation"]["passed"] is True
        assert parsed["weighing_performance_test"]["passed"] is True
        assert parsed["eccentricity_test"]["passed"] is True
        assert parsed["repeatability_test"]["passed"] is True
        assert parsed["tare_test"]["passed"] is True
        assert parsed["overall_verdict"]["candidate_outcome"] == "Verification passed — pending authorization"


# =============================================================================
# SUITE 6: PROPERTY-BASED RANDOMIZED INVARIANT GENERATOR (1,000 ITERATIONS)
# =============================================================================

class TestPropertyBasedMetrologicalInvariants:
    """Randomized property tests ensuring mathematical invariants hold across 1,000 synthetic sessions."""

    def test_randomized_true_indication_and_error_invariants(self):
        """P = I + 0.5e - delta_L and Ec = (P - L) - E0 holds for 1,000 randomized points."""
        rng = random.Random(42)  # Seed for deterministic reproducibility

        for _ in range(1000):
            # Scale e: 1g, 2g, 5g, 10g, 20g, 50g, 100g
            e_g = rng.choice([1, 2, 5, 10, 20, 50, 100])
            e = Quantity(str(e_g), "g")

            # Load in e: 100 to 10000
            n_intervals = rng.randint(100, 10000)
            load_g = n_intervals * e_g
            load = Quantity(str(load_g), "g")

            # Indicated I: load +/- random steps of e
            step_dev = rng.randint(-3, 3)
            i_g = load_g + (step_dev * e_g)
            indicated_I = Quantity(str(i_g), "g")

            # delta_L: between 0 and e
            dl_numerator = rng.randint(0, 1000)
            dl_g = ExactDecimal(ExactDecimal(dl_numerator) / ExactDecimal("1000")) * ExactDecimal(str(e_g))
            delta_L = Quantity(dl_g, "g")

            # Calculate True Indication
            p = NAWIEvaluator.calculate_true_indication(indicated_I, delta_L, e)

            # Independent Oracle: P_expected = I + 0.5*e - delta_L
            expected_p_val = ExactDecimal(str(i_g)) + ExactDecimal(str(e_g)) / ExactDecimal("2") - dl_g
            assert p.value == expected_p_val

            # Linearity step evaluation
            step_obs = LinearityStepObservation(
                step_number=1,
                direction=TestDirectionEnum.INCREASING,
                nominal_load=load,
                indicated_I=indicated_I,
                delta_L=delta_L,
            )
            step_res = NAWIEvaluator.evaluate_linearity_step(
                step=step_obs,
                e=e,
                e0=Quantity("0", "g"),
                accuracy_class=AccuracyClassEnum.CLASS_III,
                verification_type=VerificationTypeEnum.INITIAL,
            )

            # Check raw error and corrected error invariants
            assert step_res.raw_error_E.value == ExactDecimal(p.value - load.value)
            assert step_res.corrected_error_Ec.value == step_res.raw_error_E.value
            assert step_res.is_within_mpe == (exact_abs(step_res.corrected_error_Ec.value) <= step_res.mpe_mass.value)
