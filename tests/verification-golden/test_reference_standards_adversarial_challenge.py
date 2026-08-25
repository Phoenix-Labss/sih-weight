"""Adversarial stress-testing suite for reference standard fail-closed rules,
calibration timestamp boundaries, and uncertainty ratios.

Empirical verification suite for Milestone 1 Challenger 2.
Tests strict fail-closed security, timestamp precision, timezone parsing,
step-boundary uncertainty tolerances, cross-unit math, and composite session failures.
"""

from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import pytest

from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from packages.measurement.units import Quantity, IncompatibleUnitError
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
from verification_procedures.nawi.pack import NAWIProcedurePack
from verification_procedures.nawi.mpe import calculate_nawi_mpe, get_nawi_mpe_factor_in_e
from verification_procedures.reference_standards.hierarchy import (
    is_standard_class_compatible,
    PERMITTED_STANDARD_CLASSES,
    STANDARD_CLASS_RANK,
)
from verification_procedures.reference_standards.validator import (
    ReferenceStandardValidator,
    parse_date,
)


@pytest.fixture
def class_iii_bench_scale():
    """Class III bench scale: Max=30kg, Min=100g, e=5g."""
    return InstrumentParameters(
        accuracy_class=AccuracyClassEnum.CLASS_III,
        max_capacity=Quantity("30", "kg"),
        min_capacity=Quantity("0.100", "kg"),
        verification_scale_interval_e=Quantity("0.005", "kg"),
        actual_scale_interval_d=Quantity("0.005", "kg"),
    )


@pytest.fixture
def class_i_precision_microbalance():
    """Class I analytical microbalance: Max=200g, Min=1mg, e=1mg."""
    return InstrumentParameters(
        accuracy_class=AccuracyClassEnum.CLASS_I,
        max_capacity=Quantity("200", "g"),
        min_capacity=Quantity("10", "mg"),
        verification_scale_interval_e=Quantity("1", "mg"),
        actual_scale_interval_d=Quantity("0.1", "mg"),
    )


@pytest.fixture
def class_iiii_crane_scale():
    """Class IIII heavy weighbridge/crane scale: Max=50t, Min=200kg, e=20kg."""
    return InstrumentParameters(
        accuracy_class=AccuracyClassEnum.CLASS_IIII,
        max_capacity=Quantity("50", "t"),
        min_capacity=Quantity("200", "kg"),
        verification_scale_interval_e=Quantity("20", "kg"),
        actual_scale_interval_d=Quantity("20", "kg"),
    )


# =============================================================================
# SUITE 1: ADVERSARIAL CALIBRATION TIMESTAMP BOUNDARY TESTS
# =============================================================================

class TestAdversarialCalibrationTimestampBoundaries:
    """Stress-test timestamp boundaries, leap years, timezone offsets, and string formats."""

    @pytest.mark.parametrize(
        "test_ts,cal_start,cal_expiry,expected_valid,expected_error_substring",
        [
            # Exact boundary: on cal_start date -> PASS
            ("2026-06-01", "2026-06-01", "2027-06-01", True, None),
            # 1 day before cal_start -> FAIL
            ("2026-05-31", "2026-06-01", "2027-06-01", False, "CALIBRATION_NOT_EFFECTIVE"),
            # Exact boundary: on cal_expiry date -> PASS
            ("2027-06-01", "2026-06-01", "2027-06-01", True, None),
            # 1 day after cal_expiry -> FAIL
            ("2027-06-02", "2026-06-01", "2027-06-01", False, "EXPIRED_REFERENCE_STANDARD"),
            # Leap year: Feb 29 start
            ("2024-02-29", "2024-02-29", "2025-02-28", True, None),
            ("2024-02-28", "2024-02-29", "2025-02-28", False, "CALIBRATION_NOT_EFFECTIVE"),
            # Leap year: Feb 28 expiry
            ("2025-02-28", "2024-02-29", "2025-02-28", True, None),
            ("2025-03-01", "2024-02-29", "2025-02-28", False, "EXPIRED_REFERENCE_STANDARD"),
            # Inverted calibration dates (cal_expiry < cal_start)
            ("2026-07-01", "2026-12-31", "2026-01-01", False, "EXPIRED_REFERENCE_STANDARD"),
        ],
    )
    def test_timestamp_exact_boundaries(
        self,
        class_iii_bench_scale,
        test_ts,
        cal_start,
        cal_expiry,
        expected_valid,
        expected_error_substring,
    ):
        std = ReferenceStandardItem(
            standard_id="STD-TS-TEST",
            standard_name="Class M1 Boundary Weight",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("10", "kg"),
            calibration_date=cal_start,
            expiry_date=cal_expiry,
            is_quarantined=False,
            status="ACTIVE",
        )
        res = ReferenceStandardValidator.validate_standards(
            standards=[std],
            instrument=class_iii_bench_scale,
            test_timestamp=test_ts,
        )
        assert res.is_valid == expected_valid
        if not expected_valid:
            assert any(expected_error_substring in err for err in res.errors)

    def test_timestamp_various_formats_and_timezones(self, class_iii_bench_scale):
        """Ensure date parsing handles ISO-8601 with tz, space separator, datetime, date objects."""
        std = ReferenceStandardItem(
            standard_id="STD-TZ-01",
            standard_name="Class M1 Weights",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("10", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2026-12-31",
            is_quarantined=False,
            status="ACTIVE",
        )

        valid_timestamps = [
            "2026-06-15T12:00:00Z",
            "2026-06-15T23:59:59.999999+05:30",
            "2026-06-15 14:30:00",
            "2026-06-15",
            datetime(2026, 6, 15, 10, 30, 0),
            datetime(2026, 6, 15, 10, 30, 0, tzinfo=timezone.utc),
            date(2026, 6, 15),
        ]

        for ts in valid_timestamps:
            res = ReferenceStandardValidator.validate_standards(
                standards=[std],
                instrument=class_iii_bench_scale,
                test_timestamp=ts,
            )
            assert res.is_valid is True, f"Failed for timestamp: {ts!r}"

    def test_invalid_date_format_raises(self):
        """Malformed date strings must raise ValueError."""
        with pytest.raises(ValueError):
            parse_date("not-a-date")
        with pytest.raises(ValueError):
            parse_date("2026/08/23")
        with pytest.raises(ValueError):
            parse_date(12345)  # type: ignore


# =============================================================================
# SUITE 2: ADVERSARIAL UNCERTAINTY RATIO & MPE BOUNDARY TESTS
# =============================================================================

class TestAdversarialUncertaintyRatios:
    """Stress-test U(k=2) <= 1/3 MPE(L) across exact boundaries, stepped regions, and units."""

    def test_exact_uncertainty_threshold_3_to_1(self, class_iii_bench_scale):
        """Test U exactly equal to 1/3 MPE, U = 1/3 MPE + epsilon, and U = 1/3 MPE - epsilon."""
        # For 10kg load on Class III (e=5g):
        # m = 10kg / 0.005kg = 2000e -> MPE = 1.0e = 5g = 0.005kg
        # Max allowable U = MPE / 3 = 0.005 / 3 = 0.001666666666666666666666666667 kg
        e = class_iii_bench_scale.verification_scale_interval_e
        mpe = calculate_nawi_mpe(
            Quantity("10", "kg"),
            e,
            AccuracyClassEnum.CLASS_III,
            VerificationTypeEnum.INITIAL,
        )
        assert mpe == Quantity("0.005", "kg")

        exact_one_third_mpe = ExactDecimal(mpe.value / ExactDecimal("3"))
        tiny_epsilon = ExactDecimal("0.0000000000000000000000000001")

        # 1. Exactly equal -> PASS
        std_exact = ReferenceStandardItem(
            standard_id="STD-EXACT-U",
            standard_name="Class M1 Exact 1/3 MPE",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("10", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            uncertainty_k2=Quantity(exact_one_third_mpe, "kg"),
        )
        res_exact = ReferenceStandardValidator.validate_standards(
            standards=[std_exact],
            instrument=class_iii_bench_scale,
            test_timestamp="2026-08-23",
        )
        assert res_exact.is_valid is True

        # 2. Exact + epsilon -> FAIL
        std_above = ReferenceStandardItem(
            standard_id="STD-ABOVE-U",
            standard_name="Class M1 Above 1/3 MPE",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("10", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            uncertainty_k2=Quantity(ExactDecimal(exact_one_third_mpe + tiny_epsilon), "kg"),
        )
        res_above = ReferenceStandardValidator.validate_standards(
            standards=[std_above],
            instrument=class_iii_bench_scale,
            test_timestamp="2026-08-23",
        )
        assert res_above.is_valid is False
        assert any("STANDARD_UNCERTAINTY_EXCEEDED" in err for err in res_above.errors)

        # 3. Exact - epsilon -> PASS
        std_below = ReferenceStandardItem(
            standard_id="STD-BELOW-U",
            standard_name="Class M1 Below 1/3 MPE",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("10", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            uncertainty_k2=Quantity(ExactDecimal(exact_one_third_mpe - tiny_epsilon), "kg"),
        )
        res_below = ReferenceStandardValidator.validate_standards(
            standards=[std_below],
            instrument=class_iii_bench_scale,
            test_timestamp="2026-08-23",
        )
        assert res_below.is_valid is True

    def test_stepped_mpe_uncertainty_ratios(self, class_iii_bench_scale):
        """Test uncertainty ratios across Class III stepped MPE regions: 500e, 501e, 2000e, 2001e."""
        # e = 5g = 0.005kg
        # Region 1: 500e = 2.5kg -> MPE = 0.5e = 2.5g -> 1/3 MPE = 0.8333... g
        # Region 2: 501e = 2.505kg -> MPE = 1.0e = 5.0g -> 1/3 MPE = 1.6666... g
        # Region 2: 2000e = 10.0kg -> MPE = 1.0e = 5.0g -> 1/3 MPE = 1.6666... g
        # Region 3: 2001e = 10.005kg -> MPE = 1.5e = 7.5g -> 1/3 MPE = 2.5000... g

        cases = [
            # (nominal_load, uncertainty_val, unit, expected_valid)
            ("2.500", "0.833", "g", True),      # 500e, U <= 0.8333g
            ("2.500", "0.834", "g", False),     # 500e, U > 0.8333g
            ("2.505", "1.666", "g", True),      # 501e, U <= 1.6666g
            ("2.505", "1.667", "g", False),     # 501e, U > 1.6666g
            ("10.000", "1.666", "g", True),     # 2000e, U <= 1.6666g
            ("10.000", "1.667", "g", False),    # 2000e, U > 1.6666g
            ("10.005", "2.500", "g", True),     # 2001e, U <= 2.5000g
            ("10.005", "2.501", "g", False),    # 2001e, U > 2.5000g
        ]

        for load_str, u_str, u_unit, exp_valid in cases:
            std = ReferenceStandardItem(
                standard_id=f"STD-STEP-{load_str}-{u_str}",
                standard_name="Class M1 Step Weight",
                accuracy_class=StandardAccuracyClassEnum.M1,
                nominal_mass=Quantity(load_str, "kg"),
                calibration_date="2026-01-01",
                expiry_date="2027-01-01",
                uncertainty_k2=Quantity(u_str, u_unit),
            )
            res = ReferenceStandardValidator.validate_standards(
                standards=[std],
                instrument=class_iii_bench_scale,
                test_timestamp="2026-08-23",
            )
            assert res.is_valid == exp_valid, f"Failed for load={load_str}kg, U={u_str}{u_unit}"

    def test_cross_unit_uncertainty_conversion(self, class_i_precision_microbalance):
        """Analytical microbalance: e=1mg. Test standard in grams with uncertainty in micrograms."""
        # Instrument: Class I, e=1mg, Max=200g
        # At 100g load: m = 100g / 0.001g = 100,000e.
        # Class I stepped MPE: (50000e, 200000e] -> MPE = 1.0e = 1mg = 1000ug.
        # Allowable 1/3 MPE = 333.333... ug.
        # Test U = 300 ug (pass) vs U = 350 ug (fail).
        std_pass = ReferenceStandardItem(
            standard_id="STD-E2-100G-PASS",
            standard_name="Class E2 100g Weight",
            accuracy_class=StandardAccuracyClassEnum.E2,
            nominal_mass=Quantity("100", "g"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            uncertainty_k2=Quantity("300", "ug"),
        )
        res_pass = ReferenceStandardValidator.validate_standards(
            standards=[std_pass],
            instrument=class_i_precision_microbalance,
            test_timestamp="2026-08-23",
        )
        assert res_pass.is_valid is True

        std_fail = ReferenceStandardItem(
            standard_id="STD-E2-100G-FAIL",
            standard_name="Class E2 100g Weight",
            accuracy_class=StandardAccuracyClassEnum.E2,
            nominal_mass=Quantity("100", "g"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            uncertainty_k2=Quantity("350", "ug"),
        )
        res_fail = ReferenceStandardValidator.validate_standards(
            standards=[std_fail],
            instrument=class_i_precision_microbalance,
            test_timestamp="2026-08-23",
        )
        assert res_fail.is_valid is False
        assert any("STANDARD_UNCERTAINTY_EXCEEDED" in err for err in res_fail.errors)

    def test_reverification_doubled_mpe_uncertainty(self, class_iii_bench_scale):
        """In-Service Re-Verification doubles MPE, thus doubling allowable uncertainty."""
        # 10kg load, Class III: Initial MPE = 1.0e = 5g -> 1/3 MPE = 1.666g.
        # Re-verification MPE = 2.0e = 10g -> 1/3 MPE = 3.333g.
        # A standard with U = 2.5g fails for INITIAL, but passes for RE_VERIFICATION.
        std = ReferenceStandardItem(
            standard_id="STD-M1-REVERIF",
            standard_name="Class M1 Weight",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("10", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            uncertainty_k2=Quantity("2.5", "g"),
        )

        res_initial = ReferenceStandardValidator.validate_standards(
            standards=[std],
            instrument=class_iii_bench_scale,
            test_timestamp="2026-08-23",
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_initial.is_valid is False
        assert any("STANDARD_UNCERTAINTY_EXCEEDED" in err for err in res_initial.errors)

        res_reverif = ReferenceStandardValidator.validate_standards(
            standards=[std],
            instrument=class_iii_bench_scale,
            test_timestamp="2026-08-23",
            verification_type=VerificationTypeEnum.RE_VERIFICATION,
        )
        assert res_reverif.is_valid is True


# =============================================================================
# SUITE 3: ADVERSARIAL FAIL-CLOSED COMPOSITE & HIERARCHY TESTS
# =============================================================================

class TestAdversarialFailClosedComposite:
    """Stress-test composite multi-standard sets, quarantine, and hierarchy violations."""

    def test_multi_standard_one_bad_apple_fails_closed(self, class_iii_bench_scale):
        """A set of 5 standards where 4 are valid and 1 is defective must fail the entire set."""
        valid_stds = [
            ReferenceStandardItem(
                standard_id=f"STD-VALID-{i}",
                standard_name=f"Class M1 Valid {i}",
                accuracy_class=StandardAccuracyClassEnum.M1,
                nominal_mass=Quantity("5", "kg"),
                calibration_date="2026-01-01",
                expiry_date="2027-01-01",
                uncertainty_k2=Quantity("0.5", "g"),
                is_quarantined=False,
                status="ACTIVE",
            )
            for i in range(1, 5)
        ]

        defective_cases = [
            # Case 1: Quarantined
            ReferenceStandardItem(
                standard_id="STD-DEF-QUARANTINE",
                standard_name="Quarantined Weight",
                accuracy_class=StandardAccuracyClassEnum.M1,
                nominal_mass=Quantity("5", "kg"),
                calibration_date="2026-01-01",
                expiry_date="2027-01-01",
                is_quarantined=True,
                status="ACTIVE",
            ),
            # Case 2: Status not active
            ReferenceStandardItem(
                standard_id="STD-DEF-STATUS",
                standard_name="Suspended Weight",
                accuracy_class=StandardAccuracyClassEnum.M1,
                nominal_mass=Quantity("5", "kg"),
                calibration_date="2026-01-01",
                expiry_date="2027-01-01",
                is_quarantined=False,
                status="SUSPENDED",
            ),
            # Case 3: Expired
            ReferenceStandardItem(
                standard_id="STD-DEF-EXPIRED",
                standard_name="Expired Weight",
                accuracy_class=StandardAccuracyClassEnum.M1,
                nominal_mass=Quantity("5", "kg"),
                calibration_date="2025-01-01",
                expiry_date="2026-01-01",
                is_quarantined=False,
                status="ACTIVE",
            ),
            # Case 4: Incompatible class M3 for Class III instrument
            ReferenceStandardItem(
                standard_id="STD-DEF-CLASS",
                standard_name="Incompatible M3 Weight",
                accuracy_class=StandardAccuracyClassEnum.M3,
                nominal_mass=Quantity("5", "kg"),
                calibration_date="2026-01-01",
                expiry_date="2027-01-01",
                is_quarantined=False,
                status="ACTIVE",
            ),
            # Case 5: Excessive uncertainty
            ReferenceStandardItem(
                standard_id="STD-DEF-UNCERTAINTY",
                standard_name="Excessive Uncertainty Weight",
                accuracy_class=StandardAccuracyClassEnum.M1,
                nominal_mass=Quantity("5", "kg"),
                calibration_date="2026-01-01",
                expiry_date="2027-01-01",
                uncertainty_k2=Quantity("5.0", "g"),
                is_quarantined=False,
                status="ACTIVE",
            ),
        ]

        for defective_std in defective_cases:
            combined_set = valid_stds + [defective_std]
            res = ReferenceStandardValidator.validate_standards(
                standards=combined_set,
                instrument=class_iii_bench_scale,
                test_timestamp="2026-08-23",
            )
            assert res.is_valid is False, f"Did not fail closed for: {defective_std.standard_id}"
            assert len(res.errors) >= 1

    def test_empty_reference_standards_fails_closed(self, class_iii_bench_scale):
        """Session with empty standards list must fail closed."""
        res = ReferenceStandardValidator.validate_standards(
            standards=[],
            instrument=class_iii_bench_scale,
            test_timestamp="2026-08-23",
        )
        assert res.is_valid is False
        assert any("NO_REFERENCE_STANDARDS_PROVIDED" in err for err in res.errors)

    def test_full_hierarchy_exhaustive_rejections(self):
        """Verify strict adherence to OIML R 111-1 hierarchy rankings."""
        # Class I allows only E1, E2
        for std_cls in [StandardAccuracyClassEnum.F1, StandardAccuracyClassEnum.F2,
                        StandardAccuracyClassEnum.M1, StandardAccuracyClassEnum.M2,
                        StandardAccuracyClassEnum.M3]:
            assert is_standard_class_compatible(AccuracyClassEnum.CLASS_I, std_cls) is False

        # Class II allows E1, E2, F1, F2 (prohibits M1, M2, M3)
        for std_cls in [StandardAccuracyClassEnum.M1, StandardAccuracyClassEnum.M2,
                        StandardAccuracyClassEnum.M3]:
            assert is_standard_class_compatible(AccuracyClassEnum.CLASS_II, std_cls) is False

        # Class III allows E1, E2, F1, F2, M1 (prohibits M2, M3)
        for std_cls in [StandardAccuracyClassEnum.M2, StandardAccuracyClassEnum.M3]:
            assert is_standard_class_compatible(AccuracyClassEnum.CLASS_III, std_cls) is False

        # Class IIII allows E1, E2, F1, F2, M1, M2, M3
        for std_cls in StandardAccuracyClassEnum:
            assert is_standard_class_compatible(AccuracyClassEnum.CLASS_IIII, std_cls) is True


# =============================================================================
# SUITE 4: PROCEDURE PACK INTEGRATION STRESS TESTS
# =============================================================================

class TestProcedurePackIntegrationStress:
    """Stress-test end-to-end NAWI procedure pack outcome mapping under adversarial conditions."""

    def test_incompatible_class_maps_to_outside_authorization_scope(self, class_iii_bench_scale):
        """Incompatible reference standard class must yield OUTSIDE_AUTHORIZATION_SCOPE."""
        m2_std = ReferenceStandardItem(
            standard_id="STD-M2-INCOMPAT",
            standard_name="Class M2 Weights",
            accuracy_class=StandardAccuracyClassEnum.M2,  # Incompatible for Class III
            nominal_mass=Quantity("15", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            is_quarantined=False,
            status="ACTIVE",
        )

        pack = NAWIProcedurePack()
        session_input = SessionEvaluationInput(
            session_id="SESS-INCOMPAT-OUTCOME",
            instrument=class_iii_bench_scale,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23",
            reference_standards=[m2_std],
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
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is False
        assert res.candidate_outcome == VerificationOutcomeEnum.OUTSIDE_AUTHORIZATION_SCOPE

    def test_expired_or_quarantined_maps_to_incomplete_verification(self, class_iii_bench_scale):
        """Expired or quarantined reference standard must yield INCOMPLETE_VERIFICATION."""
        expired_std = ReferenceStandardItem(
            standard_id="STD-M1-EXP",
            standard_name="Class M1 Weights",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("15", "kg"),
            calibration_date="2025-01-01",
            expiry_date="2026-01-01",
            is_quarantined=False,
            status="ACTIVE",
        )

        pack = NAWIProcedurePack()
        session_input = SessionEvaluationInput(
            session_id="SESS-EXP-OUTCOME",
            instrument=class_iii_bench_scale,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23",
            reference_standards=[expired_std],
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
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is False
        assert res.candidate_outcome == VerificationOutcomeEnum.INCOMPLETE_VERIFICATION

    def test_metrological_failure_maps_to_verification_failed(self, class_iii_bench_scale):
        """When standards are valid but scale readings exceed MPE, outcome must be VERIFICATION_FAILED."""
        valid_std = ReferenceStandardItem(
            standard_id="STD-M1-GOOD",
            standard_name="Class M1 Weights",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("15", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            is_quarantined=False,
            status="ACTIVE",
            uncertainty_k2=Quantity("0.5", "g"),
        )

        pack = NAWIProcedurePack()
        # Scale has huge error: indicated 5.050kg at 5.000kg load (error = 50g >> MPE 5g)
        session_input = SessionEvaluationInput(
            session_id="SESS-FAILED-OUTCOME",
            instrument=class_iii_bench_scale,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23",
            reference_standards=[valid_std],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.0025", "kg"),
            ),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity("5.000", "kg"),
                    indicated_I=Quantity("5.050", "kg"),
                    delta_L=Quantity("0.0025", "kg"),
                )
            ],
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is False
        assert res.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_FAILED
        assert any("STEP_1_MPE_EXCEEDED" in r for r in res.failure_reasons)
