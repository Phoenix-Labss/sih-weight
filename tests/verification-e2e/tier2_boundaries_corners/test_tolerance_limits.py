"""Tier 2 Boundaries & Corners: Metrological Tolerance Limits, Turning Point & Error Boundaries.
"""

from __future__ import annotations

from decimal import Decimal
import pytest

from packages.measurement.decimal_math import ExactDecimal
from packages.measurement.units import Quantity
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
    VerificationTypeEnum,
    ZeroSettingObservation,
)
from verification_procedures.nawi.evaluator import NAWIEvaluator
from verification_procedures.nawi.pack import NAWIProcedurePack


class TestToleranceLimits:
    """Boundary test suite for exact metrological error formulas and tolerance limits."""

    @pytest.fixture
    def nawi_instrument(self) -> InstrumentParameters:
        return InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity(ExactDecimal("15.000"), "kg"),
            min_capacity=Quantity(ExactDecimal("0.100"), "kg"),
            verification_scale_interval_e=Quantity(ExactDecimal("0.005"), "kg"),
            actual_scale_interval_d=Quantity(ExactDecimal("0.005"), "kg"),
        )

    def test_turning_point_true_indication_calculation(self):
        """Turning point formula: P = I + 0.5e - delta_L."""
        e = Quantity(ExactDecimal("0.005"), "kg")
        i_indicated = Quantity(ExactDecimal("10.000"), "kg")

        # 1. Standard nominal test where delta_L = 0.5e -> P = I
        delta_l_std = Quantity(ExactDecimal("0.0025"), "kg")
        p_std = NAWIEvaluator.calculate_true_indication(i_indicated, delta_l_std, e)
        assert p_std.value == ExactDecimal("10.000")

        # 2. Indication about to switch up (delta_L = 0.1e -> P = 10.002 kg)
        delta_l_small = Quantity(ExactDecimal("0.0005"), "kg")
        p_small = NAWIEvaluator.calculate_true_indication(i_indicated, delta_l_small, e)
        assert p_small.value == ExactDecimal("10.002")

        # 3. Indication about to switch down (delta_L = 0.9e -> P = 9.998 kg)
        delta_l_large = Quantity(ExactDecimal("0.0045"), "kg")
        p_large = NAWIEvaluator.calculate_true_indication(i_indicated, delta_l_large, e)
        assert p_large.value == ExactDecimal("9.998")

    def test_corrected_error_exact_mpe_boundary(self, nawi_instrument):
        """Corrected error Ec = E - E0 compared exactly against MPE (+/- limits)."""
        e = nawi_instrument.verification_scale_interval_e
        e0 = Quantity(ExactDecimal("0.000"), "kg")
        l_load = Quantity(ExactDecimal("10.000"), "kg")

        # Case A: Ec == +0.005 kg (At 10kg = 2000e, MPE is 1.0e = 0.005kg -> PASS)
        step_pass_pos = LinearityStepObservation(
            step_number=1,
            direction=TestDirectionEnum.INCREASING,
            nominal_load=l_load,
            indicated_I=Quantity(ExactDecimal("10.005"), "kg"),
            delta_L=Quantity(ExactDecimal("0.0025"), "kg"),
        )
        res_pass_pos = NAWIEvaluator.evaluate_linearity_step(
            step=step_pass_pos,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_pass_pos.corrected_error_Ec.value == ExactDecimal("0.005")
        assert res_pass_pos.is_within_mpe is True

        # Case B: Ec == +0.005001 kg (0.001g above MPE -> FAIL)
        step_fail_pos = LinearityStepObservation(
            step_number=1,
            direction=TestDirectionEnum.INCREASING,
            nominal_load=l_load,
            indicated_I=Quantity(ExactDecimal("10.005001"), "kg"),
            delta_L=Quantity(ExactDecimal("0.0025"), "kg"),
        )
        res_fail_pos = NAWIEvaluator.evaluate_linearity_step(
            step=step_fail_pos,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_fail_pos.corrected_error_Ec.value == ExactDecimal("0.005001")
        assert res_fail_pos.is_within_mpe is False

        # Case C: Ec == -0.005 kg (Exactly at negative MPE -> PASS)
        step_pass_neg = LinearityStepObservation(
            step_number=1,
            direction=TestDirectionEnum.INCREASING,
            nominal_load=l_load,
            indicated_I=Quantity(ExactDecimal("9.995"), "kg"),
            delta_L=Quantity(ExactDecimal("0.0025"), "kg"),
        )
        res_pass_neg = NAWIEvaluator.evaluate_linearity_step(
            step=step_pass_neg,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_pass_neg.corrected_error_Ec.value == ExactDecimal("-0.005")
        assert res_pass_neg.is_within_mpe is True

        # Case D: Ec == -0.005001 kg (0.001g below negative MPE -> FAIL)
        step_fail_neg = LinearityStepObservation(
            step_number=1,
            direction=TestDirectionEnum.INCREASING,
            nominal_load=l_load,
            indicated_I=Quantity(ExactDecimal("9.994999"), "kg"),
            delta_L=Quantity(ExactDecimal("0.0025"), "kg"),
        )
        res_fail_neg = NAWIEvaluator.evaluate_linearity_step(
            step=step_fail_neg,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_fail_neg.corrected_error_Ec.value == ExactDecimal("-0.005001")
        assert res_fail_neg.is_within_mpe is False

    def test_eccentricity_tolerance_boundary(self, nawi_instrument):
        """Eccentricity: Maximum error at 5 positions evaluated against MPE for eccentricity load."""
        e = nawi_instrument.verification_scale_interval_e
        e0 = Quantity(ExactDecimal("0.000"), "kg")
        ecc_load = Quantity(ExactDecimal("5.000"), "kg")  # 1/3 Max

        # Position observations with max error = 0.005 kg (PASS)
        positions_pass = [
            EccentricityPositionObservation(EccentricityPositionEnum.CENTER, Quantity(ExactDecimal("5.000"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            EccentricityPositionObservation(EccentricityPositionEnum.FRONT_LEFT, Quantity(ExactDecimal("5.005"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            EccentricityPositionObservation(EccentricityPositionEnum.FRONT_RIGHT, Quantity(ExactDecimal("4.995"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            EccentricityPositionObservation(EccentricityPositionEnum.BACK_LEFT, Quantity(ExactDecimal("5.002"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            EccentricityPositionObservation(EccentricityPositionEnum.BACK_RIGHT, Quantity(ExactDecimal("4.998"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
        ]
        ecc_test_pass = EccentricityTestObservation(test_load=ecc_load, positions=positions_pass)
        res_pass = NAWIEvaluator.evaluate_eccentricity_test(
            ecc_obs=ecc_test_pass,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_pass.is_passed is True

        # Position observations with max error = 0.006 kg (> MPE 0.005 kg -> FAIL)
        positions_fail = [
            EccentricityPositionObservation(EccentricityPositionEnum.CENTER, Quantity(ExactDecimal("5.000"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            EccentricityPositionObservation(EccentricityPositionEnum.FRONT_LEFT, Quantity(ExactDecimal("5.006"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            EccentricityPositionObservation(EccentricityPositionEnum.FRONT_RIGHT, Quantity(ExactDecimal("4.995"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
        ]
        ecc_test_fail = EccentricityTestObservation(test_load=ecc_load, positions=positions_fail)
        res_fail = NAWIEvaluator.evaluate_eccentricity_test(
            ecc_obs=ecc_test_fail,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_fail.is_passed is False

    def test_repeatability_spread_boundary(self, nawi_instrument):
        """Repeatability: Maximum spread between runs (I_max - I_min) compared against repeatability MPE."""
        e = nawi_instrument.verification_scale_interval_e

        # Spread = 0.005 kg (At 10kg = 2000e, MPE is 0.005kg -> PASS)
        runs_pass = [
            RepeatabilityRunObservation(1, Quantity(ExactDecimal("10.000"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            RepeatabilityRunObservation(2, Quantity(ExactDecimal("10.005"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            RepeatabilityRunObservation(3, Quantity(ExactDecimal("10.002"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
        ]
        series_pass = RepeatabilitySeriesObservation(nominal_load=Quantity(ExactDecimal("10.000"), "kg"), runs=runs_pass)
        res_pass = NAWIEvaluator.evaluate_repeatability_series(
            series_obs=series_pass,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_pass.is_passed is True
        assert res_pass.spread_delta_P.value == ExactDecimal("0.005")

        # Spread = 0.006 kg (> MPE -> FAIL)
        runs_fail = [
            RepeatabilityRunObservation(1, Quantity(ExactDecimal("9.999"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            RepeatabilityRunObservation(2, Quantity(ExactDecimal("10.005"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            RepeatabilityRunObservation(3, Quantity(ExactDecimal("10.001"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
        ]
        series_fail = RepeatabilitySeriesObservation(nominal_load=Quantity(ExactDecimal("10.000"), "kg"), runs=runs_fail)
        res_fail = NAWIEvaluator.evaluate_repeatability_series(
            series_obs=series_fail,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_fail.is_passed is False
        assert res_fail.spread_delta_P.value == ExactDecimal("0.006")
