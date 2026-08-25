"""Tier 5 Adversarial Property-Based Tests: NAWI Metrological Evaluator & MPE Stepped Functions.

Validates statutory algorithms under The Legal Metrology (General) Rules, 2011
(Seventh Schedule, Part II) and OIML R 76-1:
- Deterministic MPE stepped functions across Accuracy Classes I, II, III, IIII.
- Exact boundary step transitions and monotonicity.
- In-Service Re-Verification 2.0x MPE multiplier invariant across all loads.
- True Indication turning point formula: P = I + 0.5e - delta_L.
- Zero error compensation: Ec = (P - L) - E0.
- 5-Position Eccentricity failure propagation.
- Repeatability spread property: delta_P <= |MPE(L)|.
- Tare balancing and net load evaluation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import random
import pytest

from packages.measurement.decimal_math import ExactDecimal, exact_abs, exact_decimal
from packages.measurement.units import Quantity
from packages.verification_procedures.base import (
    AccuracyClassEnum,
    EccentricityPositionEnum,
    EccentricityPositionObservation,
    EccentricityTestObservation,
    InstrumentParameters,
    LinearityStepObservation,
    RepeatabilityRunObservation,
    RepeatabilitySeriesObservation,
    SessionEvaluationInput,
    TareObservation,
    TestDirectionEnum,
    VerificationOutcomeEnum,
    VerificationTypeEnum,
    ZeroSettingObservation,
)
from packages.verification_procedures.nawi.evaluator import NAWIEvaluator
from packages.verification_procedures.nawi.mpe import (
    calculate_nawi_mpe,
    get_nawi_mpe_factor_in_e,
)
from packages.verification_procedures.nawi.pack import NAWIProcedurePack


class TestMPESteppedFunctionProperties:
    """Property tests for NAWI MPE stepped factors."""

    def test_class_iii_stepped_boundaries_exactness(self):
        """Class III: 0 <= m <= 500 -> 0.5e, 500 < m <= 2000 -> 1.0e, 2000 < m -> 1.5e."""
        e = Quantity(ExactDecimal("5"), "g")

        # Step 1: <= 500e (<= 2500g)
        assert calculate_nawi_mpe(Quantity(ExactDecimal("0"), "g"), e, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL).value == ExactDecimal("2.5")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("2500"), "g"), e, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL).value == ExactDecimal("2.5")

        # Step 2: 500e < m <= 2000e (2500g < m <= 10000g)
        assert calculate_nawi_mpe(Quantity(ExactDecimal("2500.000001"), "g"), e, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL).value == ExactDecimal("5.0")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("10000"), "g"), e, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL).value == ExactDecimal("5.0")

        # Step 3: > 2000e (> 10000g)
        assert calculate_nawi_mpe(Quantity(ExactDecimal("10000.000001"), "g"), e, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL).value == ExactDecimal("7.5")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("15000"), "g"), e, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL).value == ExactDecimal("7.5")

    def test_class_iiii_stepped_boundaries_exactness(self):
        """Class IIII: 0 <= m <= 50 -> 0.5e, 50 < m <= 200 -> 1.0e, 200 < m -> 1.5e."""
        e = Quantity(ExactDecimal("10"), "kg")

        assert calculate_nawi_mpe(Quantity(ExactDecimal("500"), "kg"), e, AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.INITIAL).value == ExactDecimal("5.0")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("500.001"), "kg"), e, AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.INITIAL).value == ExactDecimal("10.0")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("2000"), "kg"), e, AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.INITIAL).value == ExactDecimal("10.0")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("2000.001"), "kg"), e, AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.INITIAL).value == ExactDecimal("15.0")

    def test_class_ii_stepped_boundaries_exactness(self):
        """Class II: 0 <= m <= 5000 -> 0.5e, 5000 < m <= 20000 -> 1.0e, 20000 < m -> 1.5e."""
        e = Quantity(ExactDecimal("0.01"), "g")

        assert calculate_nawi_mpe(Quantity(ExactDecimal("50"), "g"), e, AccuracyClassEnum.CLASS_II, VerificationTypeEnum.INITIAL).value == ExactDecimal("0.005")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("50.0001"), "g"), e, AccuracyClassEnum.CLASS_II, VerificationTypeEnum.INITIAL).value == ExactDecimal("0.010")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("200"), "g"), e, AccuracyClassEnum.CLASS_II, VerificationTypeEnum.INITIAL).value == ExactDecimal("0.010")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("200.0001"), "g"), e, AccuracyClassEnum.CLASS_II, VerificationTypeEnum.INITIAL).value == ExactDecimal("0.015")

    def test_class_i_stepped_boundaries_exactness(self):
        """Class I: 0 <= m <= 50000 -> 0.5e, 50000 < m <= 200000 -> 1.0e, 200000 < m -> 1.5e."""
        e = Quantity(ExactDecimal("1"), "mg")

        assert calculate_nawi_mpe(Quantity(ExactDecimal("50000"), "mg"), e, AccuracyClassEnum.CLASS_I, VerificationTypeEnum.INITIAL).value == ExactDecimal("0.5")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("50000.001"), "mg"), e, AccuracyClassEnum.CLASS_I, VerificationTypeEnum.INITIAL).value == ExactDecimal("1.0")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("200000"), "mg"), e, AccuracyClassEnum.CLASS_I, VerificationTypeEnum.INITIAL).value == ExactDecimal("1.0")
        assert calculate_nawi_mpe(Quantity(ExactDecimal("200000.001"), "mg"), e, AccuracyClassEnum.CLASS_I, VerificationTypeEnum.INITIAL).value == ExactDecimal("1.5")

    def test_reverification_multiplier_invariant(self):
        """Property: In-Service Re-Verification MPE is strictly 2.0x Initial Verification MPE across all loads."""
        rng = random.Random(1337)
        classes = [AccuracyClassEnum.CLASS_I, AccuracyClassEnum.CLASS_II, AccuracyClassEnum.CLASS_III, AccuracyClassEnum.CLASS_IIII]
        e = Quantity(ExactDecimal("5"), "g")

        for cls in classes:
            for _ in range(100):
                load_val = ExactDecimal(rng.randint(1, 500000))
                load_qty = Quantity(load_val, "g")

                mpe_initial = calculate_nawi_mpe(load_qty, e, cls, VerificationTypeEnum.INITIAL)
                mpe_reverif = calculate_nawi_mpe(load_qty, e, cls, VerificationTypeEnum.RE_VERIFICATION)

                assert mpe_reverif.value == ExactDecimal(mpe_initial.value * ExactDecimal("2"))

    def test_mpe_monotonicity_property(self):
        """Property: MPE(L1) <= MPE(L2) for any L1 <= L2 (monotonic non-decreasing)."""
        classes = [AccuracyClassEnum.CLASS_I, AccuracyClassEnum.CLASS_II, AccuracyClassEnum.CLASS_III, AccuracyClassEnum.CLASS_IIII]
        e = Quantity(ExactDecimal("1"), "kg")

        for cls in classes:
            loads = [ExactDecimal(x) for x in range(0, 300000, 1000)]
            prev_mpe = ExactDecimal("0")
            for load in loads:
                mpe = calculate_nawi_mpe(Quantity(load, "kg"), e, cls, VerificationTypeEnum.INITIAL)
                assert mpe.value >= prev_mpe
                prev_mpe = mpe.value


class TestMetrologicalEvaluationAlgorithms:
    """Property tests for NAWIEvaluator algorithms."""

    def test_true_indication_turning_point_property(self):
        """Property: P = I + 0.5e - delta_L."""
        e = Quantity(ExactDecimal("5"), "g")
        # If I = 100g, delta_L = 2.5g (0.5e), P should be 100 + 2.5 - 2.5 = 100g
        p1 = NAWIEvaluator.calculate_true_indication(
            indicated_I=Quantity(ExactDecimal("100"), "g"),
            delta_L=Quantity(ExactDecimal("2.5"), "g"),
            e=e,
        )
        assert p1.value == ExactDecimal("100")

        # If I = 100g, delta_L = 1.0g, P = 100 + 2.5 - 1.0 = 101.5g
        p2 = NAWIEvaluator.calculate_true_indication(
            indicated_I=Quantity(ExactDecimal("100"), "g"),
            delta_L=Quantity(ExactDecimal("1.0"), "g"),
            e=e,
        )
        assert p2.value == ExactDecimal("101.5")

    def test_zero_error_compensation_property(self):
        """Property: Zero drift E0 is deducted from raw error: Ec = (P - L) - E0."""
        e = Quantity(ExactDecimal("5"), "g")
        e0 = Quantity(ExactDecimal("0.5"), "g")  # 0.5g zero error
        step = LinearityStepObservation(
            step_number=1,
            direction=TestDirectionEnum.INCREASING,
            nominal_load=Quantity(ExactDecimal("1000"), "g"),
            indicated_I=Quantity(ExactDecimal("1000"), "g"),
            delta_L=Quantity(ExactDecimal("2.0"), "g"),  # P = 1000 + 2.5 - 2.0 = 1000.5g
        )
        res = NAWIEvaluator.evaluate_linearity_step(
            step=step,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        # Raw error E = 1000.5 - 1000 = +0.5g
        # Corrected error Ec = 0.5 - 0.5 = 0.0g
        assert res.raw_error_E.value == ExactDecimal("0.5")
        assert res.corrected_error_Ec.value == ExactDecimal("0")
        assert res.is_within_mpe is True

    def test_eccentricity_single_position_failure_propagation(self):
        """Adversarial: If 4 positions pass but 1 position exceeds MPE, the test MUST fail."""
        e = Quantity(ExactDecimal("5"), "g")
        e0 = Quantity(ExactDecimal("0"), "g")
        test_load = Quantity(ExactDecimal("5000"), "g")  # MPE at 1000e is 1.0e = 5.0g

        # Positions: Center, Front-Left, Front-Right, Back-Left pass; Back-Right fails
        positions_obs = [
            EccentricityPositionObservation(position=EccentricityPositionEnum.CENTER, indicated_I=Quantity(ExactDecimal("5000"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),
            EccentricityPositionObservation(position=EccentricityPositionEnum.FRONT_LEFT, indicated_I=Quantity(ExactDecimal("5000"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),
            EccentricityPositionObservation(position=EccentricityPositionEnum.FRONT_RIGHT, indicated_I=Quantity(ExactDecimal("5000"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),
            EccentricityPositionObservation(position=EccentricityPositionEnum.BACK_LEFT, indicated_I=Quantity(ExactDecimal("5000"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),
            EccentricityPositionObservation(position=EccentricityPositionEnum.BACK_RIGHT, indicated_I=Quantity(ExactDecimal("5010"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),  # +10g > 5g
        ]
        ecc_obs = EccentricityTestObservation(test_load=test_load, positions=positions_obs)
        res = NAWIEvaluator.evaluate_eccentricity_test(
            ecc_obs=ecc_obs,
            e=e,
            e0=e0,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res.is_passed is False
        assert len(res.failure_reasons) == 1
        assert "BACK_RIGHT" in res.failure_reasons[0]

    def test_repeatability_spread_property(self):
        """Property: Repeatability passes iff spread delta_P <= |MPE(L)|."""
        e = Quantity(ExactDecimal("5"), "g")
        nominal_load = Quantity(ExactDecimal("5000"), "g")  # MPE = 5g

        # 3 runs: 5000g, 5002g, 5004g => spread = 4g <= 5g => Pass
        runs_pass = [
            RepeatabilityRunObservation(run_number=1, indicated_I=Quantity(ExactDecimal("5000"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),
            RepeatabilityRunObservation(run_number=2, indicated_I=Quantity(ExactDecimal("5002"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),
            RepeatabilityRunObservation(run_number=3, indicated_I=Quantity(ExactDecimal("5004"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),
        ]
        series_pass = RepeatabilitySeriesObservation(nominal_load=nominal_load, runs=runs_pass)
        res_pass = NAWIEvaluator.evaluate_repeatability_series(
            series_obs=series_pass,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_pass.is_passed is True
        assert res_pass.spread_delta_P.value == ExactDecimal("4")

        # 3 runs: 5000g, 5003g, 5007g => spread = 7g > 5g => Fail
        runs_fail = [
            RepeatabilityRunObservation(run_number=1, indicated_I=Quantity(ExactDecimal("5000"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),
            RepeatabilityRunObservation(run_number=2, indicated_I=Quantity(ExactDecimal("5003"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),
            RepeatabilityRunObservation(run_number=3, indicated_I=Quantity(ExactDecimal("5007"), "g"), delta_L=Quantity(ExactDecimal("2.5"), "g")),
        ]
        series_fail = RepeatabilitySeriesObservation(nominal_load=nominal_load, runs=runs_fail)
        res_fail = NAWIEvaluator.evaluate_repeatability_series(
            series_obs=series_fail,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_fail.is_passed is False
        assert res_fail.spread_delta_P.value == ExactDecimal("7")
        assert "REPEATABILITY_SPREAD_EXCEEDED" in res_fail.error_message

    def test_tare_net_weighing_accuracy(self):
        """Property: Tare test checks |E_net| <= MPE(L_net)."""
        e = Quantity(ExactDecimal("5"), "g")
        tare_obs_pass = TareObservation(
            tare_load=Quantity(ExactDecimal("2000"), "g"),
            net_load=Quantity(ExactDecimal("3000"), "g"),  # MPE(3000g) = 5g
            indicated_I_net=Quantity(ExactDecimal("3002"), "g"),
            delta_L_net=Quantity(ExactDecimal("2.5"), "g"),
        )
        res_pass = NAWIEvaluator.evaluate_tare(
            tare_obs=tare_obs_pass,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_pass.is_passed is True
        assert res_pass.net_error_E.value == ExactDecimal("2")

        tare_obs_fail = TareObservation(
            tare_load=Quantity(ExactDecimal("2000"), "g"),
            net_load=Quantity(ExactDecimal("3000"), "g"),
            indicated_I_net=Quantity(ExactDecimal("3008"), "g"),  # Error = 8g > 5g
            delta_L_net=Quantity(ExactDecimal("2.5"), "g"),
        )
        res_fail = NAWIEvaluator.evaluate_tare(
            tare_obs=tare_obs_fail,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_fail.is_passed is False
        assert res_fail.net_error_E.value == ExactDecimal("8")
