"""Golden test scenarios for NAWI metrological evaluator and calculation trace engine.

Citations:
- The Legal Metrology Act, 2009
- The Legal Metrology (General) Rules, 2011 (Seventh Schedule, Part II)
- OIML R 76-1:2006 Non-automatic weighing instruments
"""

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
    VerificationOutcomeEnum,
    VerificationTypeEnum,
    ZeroSettingObservation,
)
from verification_procedures.nawi.evaluator import NAWIEvaluator
from verification_procedures.nawi.pack import NAWIProcedurePack


@pytest.fixture
def standard_m1_15kg():
    """Valid unexpired Class M1 standard weight set covering 15kg."""
    return ReferenceStandardItem(
        standard_id="STD-M1-2026-001",
        standard_name="Working Standard Mass Set 1mg-20kg",
        accuracy_class=StandardAccuracyClassEnum.M1,
        nominal_mass=Quantity("20", "kg"),
        calibration_date="2026-01-15",
        expiry_date="2027-01-14",
        is_quarantined=False,
        status="ACTIVE",
        uncertainty_k2=Quantity("0.0005", "kg"),  # 0.5g uncertainty
        certificate_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    )


class TestNAWIEvaluatorGoldenScenarios:
    """Execute authoritative golden test scenarios from specification report."""

    def test_golden_nawi_01_class_iii_initial_pass(self, standard_m1_15kg):
        """GOLDEN-NAWI-01: Standard Class III initial verification (15kg / 5g) -> PASS."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("15", "kg"),
            min_capacity=Quantity("0.100", "kg"),  # 20e = 100g
            verification_scale_interval_e=Quantity("0.005", "kg"),  # 5g
            actual_scale_interval_d=Quantity("0.005", "kg"),
        )

        session_input = SessionEvaluationInput(
            session_id="SESS-GOLDEN-01",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[standard_m1_15kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.0025", "kg"),  # delta_L = 0.5e -> P0 = 0, E0 = 0
            ),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity("0.100", "kg"),
                    indicated_I=Quantity("0.100", "kg"),
                    delta_L=Quantity("0.0025", "kg"),
                ),
                LinearityStepObservation(
                    step_number=2,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity("2.500", "kg"),  # 500e
                    indicated_I=Quantity("2.500", "kg"),
                    delta_L=Quantity("0.0025", "kg"),
                ),
                LinearityStepObservation(
                    step_number=3,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity("10.000", "kg"),  # 2000e
                    indicated_I=Quantity("10.000", "kg"),
                    delta_L=Quantity("0.0025", "kg"),
                ),
                LinearityStepObservation(
                    step_number=4,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity("15.000", "kg"),  # 3000e (Max)
                    indicated_I=Quantity("15.000", "kg"),
                    delta_L=Quantity("0.0025", "kg"),
                ),
            ],
            eccentricity=EccentricityTestObservation(
                test_load=Quantity("5.000", "kg"),  # 1/3 Max
                positions=[
                    EccentricityPositionObservation(
                        position=EccentricityPositionEnum.CENTER,
                        indicated_I=Quantity("5.000", "kg"),
                        delta_L=Quantity("0.0025", "kg"),
                    ),
                    EccentricityPositionObservation(
                        position=EccentricityPositionEnum.FRONT_LEFT,
                        indicated_I=Quantity("5.000", "kg"),
                        delta_L=Quantity("0.0025", "kg"),
                    ),
                    EccentricityPositionObservation(
                        position=EccentricityPositionEnum.FRONT_RIGHT,
                        indicated_I=Quantity("5.000", "kg"),
                        delta_L=Quantity("0.0025", "kg"),
                    ),
                    EccentricityPositionObservation(
                        position=EccentricityPositionEnum.BACK_RIGHT,
                        indicated_I=Quantity("5.000", "kg"),
                        delta_L=Quantity("0.0025", "kg"),
                    ),
                    EccentricityPositionObservation(
                        position=EccentricityPositionEnum.BACK_LEFT,
                        indicated_I=Quantity("5.000", "kg"),
                        delta_L=Quantity("0.0025", "kg"),
                    ),
                ],
            ),
            repeatability=[
                RepeatabilitySeriesObservation(
                    nominal_load=Quantity("7.500", "kg"),  # 50% Max
                    runs=[
                        RepeatabilityRunObservation(run_number=1, indicated_I=Quantity("7.500", "kg"), delta_L=Quantity("0.0025", "kg")),
                        RepeatabilityRunObservation(run_number=2, indicated_I=Quantity("7.500", "kg"), delta_L=Quantity("0.0025", "kg")),
                        RepeatabilityRunObservation(run_number=3, indicated_I=Quantity("7.500", "kg"), delta_L=Quantity("0.0025", "kg")),
                    ],
                ),
                RepeatabilitySeriesObservation(
                    nominal_load=Quantity("15.000", "kg"),  # Max
                    runs=[
                        RepeatabilityRunObservation(run_number=1, indicated_I=Quantity("15.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                        RepeatabilityRunObservation(run_number=2, indicated_I=Quantity("15.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                        RepeatabilityRunObservation(run_number=3, indicated_I=Quantity("15.000", "kg"), delta_L=Quantity("0.0025", "kg")),
                    ],
                ),
            ],
            tare=TareObservation(
                tare_load=Quantity("5.000", "kg"),
                net_load=Quantity("8.000", "kg"),
                indicated_I_net=Quantity("8.000", "kg"),
                delta_L_net=Quantity("0.0025", "kg"),
            ),
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is True
        assert res.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION
        assert len(res.failure_reasons) == 0
        assert "calculation_trace" in res.__dict__ or res.calculation_trace is not None
        assert res.calculation_trace["overall_verdict"]["is_passed"] is True

    def test_golden_nawi_02_class_iii_initial_mpe_failure(self, standard_m1_15kg):
        """GOLDEN-NAWI-02: Error at 500e is +3.0g, exceeding Initial MPE (2.5g) -> FAIL."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("15", "kg"),
            min_capacity=Quantity("0.100", "kg"),
            verification_scale_interval_e=Quantity("0.005", "kg"),
            actual_scale_interval_d=Quantity("0.005", "kg"),
        )

        # At load 2.500 kg: indicated_I = 2.505, delta_L = 0.0045 -> P = 2.505 + 0.0025 - 0.0045 = 2.5030 kg -> Ec = +3.0g
        session_input = SessionEvaluationInput(
            session_id="SESS-GOLDEN-02",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[standard_m1_15kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.0025", "kg"),
            ),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity("2.500", "kg"),  # 500e -> MPE is +/- 2.5g
                    indicated_I=Quantity("2.505", "kg"),
                    delta_L=Quantity("0.0045", "kg"),
                ),
            ],
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is False
        assert res.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_FAILED
        assert any("STEP_1_MPE_EXCEEDED" in reason for reason in res.failure_reasons)

    def test_golden_nawi_03_class_iii_reverification_pass_under_relaxed_mpe(self, standard_m1_15kg):
        """GOLDEN-NAWI-03: Same +3.0g error passes under Re-Verification MPE (5.0g) -> PASS."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("15", "kg"),
            min_capacity=Quantity("0.100", "kg"),
            verification_scale_interval_e=Quantity("0.005", "kg"),
            actual_scale_interval_d=Quantity("0.005", "kg"),
        )

        session_input = SessionEvaluationInput(
            session_id="SESS-GOLDEN-03",
            instrument=instrument,
            verification_type=VerificationTypeEnum.RE_VERIFICATION,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[standard_m1_15kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.0025", "kg"),
            ),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity("2.500", "kg"),  # 500e -> Re-verif MPE is +/- 5.0g
                    indicated_I=Quantity("2.505", "kg"),
                    delta_L=Quantity("0.0045", "kg"),  # Ec = +3.0g <= 5.0g
                ),
            ],
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is True
        assert res.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION

    def test_golden_nawi_04_class_iii_eccentricity_pass(self, standard_m1_15kg):
        """GOLDEN-NAWI-04: Eccentricity corner 4 error +15g at 20kg (MPE=20g) -> PASS."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("60", "kg"),
            min_capacity=Quantity("0.400", "kg"),
            verification_scale_interval_e=Quantity("0.020", "kg"),  # 20g
            actual_scale_interval_d=Quantity("0.020", "kg"),
        )

        # Standard with sufficient mass
        std_60kg = ReferenceStandardItem(
            standard_id="STD-M1-60KG",
            standard_name="60kg Working Mass Set",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("60", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
        )

        # Corner 4: I = 20.020, delta_L = 0.015 -> P = 20.020 + 0.010 - 0.015 = 20.015 kg -> Ec = +15g <= 20g MPE
        session_input = SessionEvaluationInput(
            session_id="SESS-GOLDEN-04",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[std_60kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.010", "kg"),  # 0.5e
            ),
            linearity_steps=[],
            eccentricity=EccentricityTestObservation(
                test_load=Quantity("20.000", "kg"),  # 1/3 Max = 1000e -> MPE is 20g
                positions=[
                    EccentricityPositionObservation(position=EccentricityPositionEnum.CENTER, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                    EccentricityPositionObservation(position=EccentricityPositionEnum.FRONT_LEFT, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                    EccentricityPositionObservation(position=EccentricityPositionEnum.FRONT_RIGHT, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                    EccentricityPositionObservation(position=EccentricityPositionEnum.BACK_RIGHT, indicated_I=Quantity("20.020", "kg"), delta_L=Quantity("0.015", "kg")), # Ec = +15g
                    EccentricityPositionObservation(position=EccentricityPositionEnum.BACK_LEFT, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                ],
            ),
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is True
        assert res.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION

    def test_golden_nawi_05_class_iii_eccentricity_fail(self, standard_m1_15kg):
        """GOLDEN-NAWI-05: Eccentricity corner 2 error +25g exceeds MPE (20g) -> FAIL."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("60", "kg"),
            min_capacity=Quantity("0.400", "kg"),
            verification_scale_interval_e=Quantity("0.020", "kg"),
            actual_scale_interval_d=Quantity("0.020", "kg"),
        )

        std_60kg = ReferenceStandardItem(
            standard_id="STD-M1-60KG",
            standard_name="60kg Working Mass Set",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("60", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
        )

        # Corner 2: I = 20.040, delta_L = 0.025 -> P = 20.040 + 0.010 - 0.025 = 20.025 kg -> Ec = +25g > 20g MPE
        session_input = SessionEvaluationInput(
            session_id="SESS-GOLDEN-05",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[std_60kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.010", "kg"),
            ),
            linearity_steps=[],
            eccentricity=EccentricityTestObservation(
                test_load=Quantity("20.000", "kg"),
                positions=[
                    EccentricityPositionObservation(position=EccentricityPositionEnum.CENTER, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                    EccentricityPositionObservation(position=EccentricityPositionEnum.FRONT_LEFT, indicated_I=Quantity("20.040", "kg"), delta_L=Quantity("0.025", "kg")), # Ec = +25g
                    EccentricityPositionObservation(position=EccentricityPositionEnum.FRONT_RIGHT, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                    EccentricityPositionObservation(position=EccentricityPositionEnum.BACK_RIGHT, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                    EccentricityPositionObservation(position=EccentricityPositionEnum.BACK_LEFT, indicated_I=Quantity("20.000", "kg"), delta_L=Quantity("0.010", "kg")),
                ],
            ),
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is False
        assert res.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_FAILED
        assert any("ECCENTRICITY_ERROR_EXCEEDED" in reason for reason in res.failure_reasons)

    def test_golden_nawi_06_repeatability_spread_failure(self):
        """GOLDEN-NAWI-06: Repeatability spread 200g exceeds MPE (150g) at Max -> FAIL."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("300", "kg"),
            min_capacity=Quantity("2.000", "kg"),
            verification_scale_interval_e=Quantity("0.100", "kg"),  # 100g
            actual_scale_interval_d=Quantity("0.100", "kg"),
        )

        std_300kg = ReferenceStandardItem(
            standard_id="STD-M1-300KG",
            standard_name="300kg Standard Weights",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("300", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
        )

        # Runs at Max: P1 = 300.0, P2 = 300.2, P3 = 300.0 -> spread delta_P = 0.200 kg = 200g > 150g (1.5e MPE)
        session_input = SessionEvaluationInput(
            session_id="SESS-GOLDEN-06",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[std_300kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.050", "kg"),
            ),
            linearity_steps=[],
            repeatability=[
                RepeatabilitySeriesObservation(
                    nominal_load=Quantity("300.000", "kg"),
                    runs=[
                        RepeatabilityRunObservation(run_number=1, indicated_I=Quantity("300.000", "kg"), delta_L=Quantity("0.050", "kg")), # P = 300.0
                        RepeatabilityRunObservation(run_number=2, indicated_I=Quantity("300.200", "kg"), delta_L=Quantity("0.050", "kg")), # P = 300.2
                        RepeatabilityRunObservation(run_number=3, indicated_I=Quantity("300.000", "kg"), delta_L=Quantity("0.050", "kg")), # P = 300.0
                    ],
                )
            ],
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is False
        assert res.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_FAILED
        assert any("REPEATABILITY_SPREAD_EXCEEDED" in reason for reason in res.failure_reasons)

    def test_golden_nawi_07_class_iiii_initial_pass(self):
        """GOLDEN-NAWI-07: Class IIII initial verification (5000kg / 5kg / 1000e) -> PASS."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_IIII,
            max_capacity=Quantity("5000", "kg"),
            min_capacity=Quantity("50", "kg"),  # 10e = 50kg
            verification_scale_interval_e=Quantity("5", "kg"),
            actual_scale_interval_d=Quantity("5", "kg"),
        )

        std_m2 = ReferenceStandardItem(
            standard_id="STD-M2-5000KG",
            standard_name="Class M2 Heavy Weights",
            accuracy_class=StandardAccuracyClassEnum.M2,
            nominal_mass=Quantity("5000", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
        )

        # Step points at 50e (250kg), 200e (1000kg), 1000e (5000kg)
        session_input = SessionEvaluationInput(
            session_id="SESS-GOLDEN-07",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[std_m2],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0", "kg"),
                delta_L0=Quantity("2.5", "kg"),
            ),
            linearity_steps=[
                LinearityStepObservation(step_number=1, direction=TestDirectionEnum.INCREASING, nominal_load=Quantity("250", "kg"), indicated_I=Quantity("250", "kg"), delta_L=Quantity("2.5", "kg")),
                LinearityStepObservation(step_number=2, direction=TestDirectionEnum.INCREASING, nominal_load=Quantity("1000", "kg"), indicated_I=Quantity("1000", "kg"), delta_L=Quantity("2.5", "kg")),
                LinearityStepObservation(step_number=3, direction=TestDirectionEnum.INCREASING, nominal_load=Quantity("5000", "kg"), indicated_I=Quantity("5000", "kg"), delta_L=Quantity("2.5", "kg")),
            ],
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is True
        assert res.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION

    def test_turning_point_true_indication_calculation(self):
        """Test formula P = I + 0.5e - delta_L across exact fractional delta_L values."""
        e = Quantity("5", "g")
        I = Quantity("10.000", "kg")
        # delta_L = 2 g -> 0.5e = 2.5 g -> P = 10.000 kg + 0.0025 kg - 0.0020 kg = 10.0005 kg
        delta_L = Quantity("2", "g")
        p = NAWIEvaluator.calculate_true_indication(I, delta_L, e)
        assert p.value == ExactDecimal("10000.5")
        assert p.unit == "g"

    def test_deterministic_trace_schema_and_reproducibility(self, standard_m1_15kg):
        """Verify deterministic calculation trace has required schema fields and is reproducible."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("15", "kg"),
            min_capacity=Quantity("0.100", "kg"),
            verification_scale_interval_e=Quantity("0.005", "kg"),
            actual_scale_interval_d=Quantity("0.005", "kg"),
        )

        session_input = SessionEvaluationInput(
            session_id="SESS-TRACE-CHECK",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[standard_m1_15kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.0025", "kg"),
            ),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity("2.500", "kg"),
                    indicated_I=Quantity("2.500", "kg"),
                    delta_L=Quantity("0.0025", "kg"),
                )
            ],
        )

        res1 = pack.evaluate_session(session_input)
        res2 = pack.evaluate_session(session_input)

        trace = res1.calculation_trace
        assert trace["$schema"] == "https://legalmetrology.gov.in/schemas/v1/nawi-evaluation-trace.json"
        assert trace["trace_id"] == res2.calculation_trace["trace_id"]
        assert trace["procedure_pack"]["pack_id"] == "IND-LM-NAWI-CLASS-III-IIII-2026.1"
        assert trace["overall_verdict"]["candidate_outcome"] == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION.value

    def test_zero_setting_out_of_tolerance(self, standard_m1_15kg):
        """Zero setting error > 0.25e must fail zero setting evaluation."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("15", "kg"),
            min_capacity=Quantity("0.100", "kg"),
            verification_scale_interval_e=Quantity("0.005", "kg"),  # e = 5g -> 0.25e = 1.25g
            actual_scale_interval_d=Quantity("0.005", "kg"),
        )

        # I0 = 0.000 kg, delta_L0 = 0.000 kg -> P0 = 0 + 0.0025 - 0 = 2.5g > 1.25g (0.25e)
        session_input = SessionEvaluationInput(
            session_id="SESS-ZERO-FAIL",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[standard_m1_15kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.000", "kg"),
            ),
            linearity_steps=[],
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is False
        assert res.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_FAILED
        assert any("ZERO_SETTING_OUT_OF_TOLERANCE" in r for r in res.failure_reasons)

    def test_tare_net_error_exceeded(self, standard_m1_15kg):
        """Tare net weighing error exceeding stepped MPE must fail verification."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("15", "kg"),
            min_capacity=Quantity("0.100", "kg"),
            verification_scale_interval_e=Quantity("0.005", "kg"),
            actual_scale_interval_d=Quantity("0.005", "kg"),
        )

        # Net load = 2.500 kg (500e, MPE = 2.5g). Indicated net = 2.505, delta_L = 0.0040 -> P_net = 2.5035 kg -> E_net = +3.5g > 2.5g
        session_input = SessionEvaluationInput(
            session_id="SESS-TARE-FAIL",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[standard_m1_15kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.0025", "kg"),
            ),
            linearity_steps=[],
            tare=TareObservation(
                tare_load=Quantity("5.000", "kg"),
                net_load=Quantity("2.500", "kg"),
                indicated_I_net=Quantity("2.505", "kg"),
                delta_L_net=Quantity("0.0040", "kg"),
            ),
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is False
        assert res.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_FAILED
        assert any("TARE_NET_ERROR_EXCEEDED" in r for r in res.failure_reasons)

    def test_classification_envelope_n_too_low(self, standard_m1_15kg):
        """Class III scale with n < 100 is outside authorization scope."""
        pack = NAWIProcedurePack()
        # Max = 0.400 kg, e = 0.005 kg -> n = 80 < 100
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("0.400", "kg"),
            min_capacity=Quantity("0.100", "kg"),
            verification_scale_interval_e=Quantity("0.005", "kg"),
            actual_scale_interval_d=Quantity("0.005", "kg"),
        )

        session_input = SessionEvaluationInput(
            session_id="SESS-N-LOW",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[standard_m1_15kg],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.0025", "kg"),
            ),
            linearity_steps=[],
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is False
        assert res.candidate_outcome == VerificationOutcomeEnum.OUTSIDE_AUTHORIZATION_SCOPE
        assert any("CLASS_III_INVALID_N" in r for r in res.failure_reasons)

    def test_missing_reference_standards_fails_closed(self):
        """Session with no reference standards must fail closed as INCOMPLETE_VERIFICATION."""
        pack = NAWIProcedurePack()
        instrument = InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity("15", "kg"),
            min_capacity=Quantity("0.100", "kg"),
            verification_scale_interval_e=Quantity("0.005", "kg"),
            actual_scale_interval_d=Quantity("0.005", "kg"),
        )

        session_input = SessionEvaluationInput(
            session_id="SESS-NO-STD",
            instrument=instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp="2026-08-23T10:00:00Z",
            reference_standards=[],
            zero_setting=ZeroSettingObservation(
                indicated_I0=Quantity("0.000", "kg"),
                delta_L0=Quantity("0.0025", "kg"),
            ),
            linearity_steps=[],
        )

        res = pack.evaluate_session(session_input)
        assert res.is_passed is False
        assert res.candidate_outcome == VerificationOutcomeEnum.INCOMPLETE_VERIFICATION
        assert any("NO_REFERENCE_STANDARDS" in r for r in res.failure_reasons)

