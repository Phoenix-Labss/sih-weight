"""Golden tests for reference standards integrity, calibration expiry gating, and hierarchy rules.

Citations:
- The Legal Metrology Act, 2009
- The Legal Metrology (National Standards) Rules, 2011
- The Legal Metrology (General) Rules, 2011 (Seventh Schedule, Heading A)
- OIML R 111-1:2004 & OIML R 76-1:2006 §3.7.1
"""

import pytest

from packages.measurement.decimal_math import ExactDecimal
from packages.measurement.units import Quantity
from verification_procedures.base import (
    AccuracyClassEnum,
    InstrumentParameters,
    LinearityStepObservation,
    ReferenceStandardItem,
    SessionEvaluationInput,
    StandardAccuracyClassEnum,
    TestDirectionEnum,
    VerificationOutcomeEnum,
    VerificationTypeEnum,
    ZeroSettingObservation,
)
from verification_procedures.nawi.pack import NAWIProcedurePack
from verification_procedures.reference_standards.hierarchy import (
    is_standard_class_compatible,
)
from verification_procedures.reference_standards.validator import (
    ReferenceStandardValidator,
)


@pytest.fixture
def class_iii_instrument():
    """Standard Class III retail balance parameters."""
    return InstrumentParameters(
        accuracy_class=AccuracyClassEnum.CLASS_III,
        max_capacity=Quantity("15", "kg"),
        min_capacity=Quantity("0.100", "kg"),
        verification_scale_interval_e=Quantity("0.005", "kg"),
        actual_scale_interval_d=Quantity("0.005", "kg"),
    )


class TestReferenceStandardsGolden:
    """Validate fail-closed security and legal integrity rules for reference standards."""

    def test_golden_nawi_08_expired_reference_standard(self, class_iii_instrument):
        """GOLDEN-NAWI-08: Standard expired before test timestamp -> Fail-Closed."""
        expired_std = ReferenceStandardItem(
            standard_id="STD-EXP-2026",
            standard_name="Class M1 Weights",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("15", "kg"),
            calibration_date="2025-08-20",
            expiry_date="2026-08-20",  # Expired 3 days before test
            is_quarantined=False,
            status="ACTIVE",
        )

        test_timestamp = "2026-08-23T10:00:00Z"

        # Direct validator test
        val_res = ReferenceStandardValidator.validate_standards(
            standards=[expired_std],
            instrument=class_iii_instrument,
            test_timestamp=test_timestamp,
        )
        assert val_res.is_valid is False
        assert any("EXPIRED_REFERENCE_STANDARD" in err for err in val_res.errors)

        # Complete procedure pack execution test
        pack = NAWIProcedurePack()
        session_input = SessionEvaluationInput(
            session_id="SESS-EXP-STD",
            instrument=class_iii_instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp=test_timestamp,
            reference_standards=[expired_std],
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

        eval_res = pack.evaluate_session(session_input)
        assert eval_res.is_passed is False
        assert eval_res.candidate_outcome == VerificationOutcomeEnum.INCOMPLETE_VERIFICATION
        assert any("EXPIRED_REFERENCE_STANDARD" in r for r in eval_res.failure_reasons)

    def test_golden_nawi_09_incompatible_standard_class(self, class_iii_instrument):
        """GOLDEN-NAWI-09: Class M3 standard assigned to Class III NAWI -> Prohibited / Fail-Closed."""
        m3_std = ReferenceStandardItem(
            standard_id="STD-M3-IRON",
            standard_name="Class M3 Commercial Iron Weights",
            accuracy_class=StandardAccuracyClassEnum.M3,  # Prohibited for Class III
            nominal_mass=Quantity("15", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            is_quarantined=False,
            status="ACTIVE",
        )

        test_timestamp = "2026-08-23T10:00:00Z"

        # Hierarchy check
        assert is_standard_class_compatible(AccuracyClassEnum.CLASS_III, StandardAccuracyClassEnum.M3) is False
        assert is_standard_class_compatible(AccuracyClassEnum.CLASS_III, StandardAccuracyClassEnum.M1) is True

        # Direct validator test
        val_res = ReferenceStandardValidator.validate_standards(
            standards=[m3_std],
            instrument=class_iii_instrument,
            test_timestamp=test_timestamp,
        )
        assert val_res.is_valid is False
        assert any("INCOMPATIBLE_STANDARD_CLASS" in err for err in val_res.errors)

        # Full procedure pack execution test
        pack = NAWIProcedurePack()
        session_input = SessionEvaluationInput(
            session_id="SESS-INCOMPAT-STD",
            instrument=class_iii_instrument,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp=test_timestamp,
            reference_standards=[m3_std],
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

        eval_res = pack.evaluate_session(session_input)
        assert eval_res.is_passed is False
        assert eval_res.candidate_outcome == VerificationOutcomeEnum.OUTSIDE_AUTHORIZATION_SCOPE
        assert any("INCOMPATIBLE_STANDARD_CLASS" in r for r in eval_res.failure_reasons)

    def test_quarantined_reference_standard_fails_closed(self, class_iii_instrument):
        """Quarantined reference standard must immediately block verification."""
        quarantined_std = ReferenceStandardItem(
            standard_id="STD-QUARANTINE-01",
            standard_name="Class M1 Weights Under Investigation",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("15", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            is_quarantined=True,
            status="QUARANTINED",
        )

        val_res = ReferenceStandardValidator.validate_standards(
            standards=[quarantined_std],
            instrument=class_iii_instrument,
            test_timestamp="2026-08-23T10:00:00Z",
        )
        assert val_res.is_valid is False
        assert any("QUARANTINED_REFERENCE_STANDARD" in err for err in val_res.errors)

    def test_future_calibration_fails_closed(self, class_iii_instrument):
        """Calibration certificate effective in the future cannot be used today."""
        future_std = ReferenceStandardItem(
            standard_id="STD-FUTURE-01",
            standard_name="Class M1 Newly Ordered",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("15", "kg"),
            calibration_date="2026-09-01",  # In the future
            expiry_date="2027-09-01",
            is_quarantined=False,
            status="ACTIVE",
        )

        val_res = ReferenceStandardValidator.validate_standards(
            standards=[future_std],
            instrument=class_iii_instrument,
            test_timestamp="2026-08-23T10:00:00Z",
        )
        assert val_res.is_valid is False
        assert any("CALIBRATION_NOT_EFFECTIVE" in err for err in val_res.errors)

    def test_uncertainty_ratio_rule(self, class_iii_instrument):
        """Per OIML R 76-1 §3.7.1, U(k=2) must be <= 1/3 MPE(L)."""
        # For 15kg load on Class III (e=5g): MPE = 1.5e = 7.5g -> 1/3 MPE = 2.5g = 0.0025kg
        # 1. Standard with excessive uncertainty U = 3.0g > 2.5g -> FAIL
        std_high_u = ReferenceStandardItem(
            standard_id="STD-HIGH-U",
            standard_name="Class M1 Rough Uncertainty",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("15", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            uncertainty_k2=Quantity("0.0030", "kg"),  # 3.0g > 2.5g
        )

        val_high = ReferenceStandardValidator.validate_standards(
            standards=[std_high_u],
            instrument=class_iii_instrument,
            test_timestamp="2026-08-23T10:00:00Z",
        )
        assert val_high.is_valid is False
        assert any("STANDARD_UNCERTAINTY_EXCEEDED" in err for err in val_high.errors)

        # 2. Standard with compliant uncertainty U = 1.0g <= 2.5g -> PASS
        std_good_u = ReferenceStandardItem(
            standard_id="STD-GOOD-U",
            standard_name="Class M1 Precision Certified",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity("15", "kg"),
            calibration_date="2026-01-01",
            expiry_date="2027-01-01",
            uncertainty_k2=Quantity("0.0010", "kg"),  # 1.0g <= 2.5g
        )

        val_good = ReferenceStandardValidator.validate_standards(
            standards=[std_good_u],
            instrument=class_iii_instrument,
            test_timestamp="2026-08-23T10:00:00Z",
        )
        assert val_good.is_valid is True
        assert len(val_good.errors) == 0

    @pytest.mark.parametrize(
        "inst_class,std_class,expected_compatible",
        [
            (AccuracyClassEnum.CLASS_I, StandardAccuracyClassEnum.E1, True),
            (AccuracyClassEnum.CLASS_I, StandardAccuracyClassEnum.E2, True),
            (AccuracyClassEnum.CLASS_I, StandardAccuracyClassEnum.F1, False),
            (AccuracyClassEnum.CLASS_II, StandardAccuracyClassEnum.F1, True),
            (AccuracyClassEnum.CLASS_II, StandardAccuracyClassEnum.F2, True),
            (AccuracyClassEnum.CLASS_II, StandardAccuracyClassEnum.M1, False),
            (AccuracyClassEnum.CLASS_III, StandardAccuracyClassEnum.M1, True),
            (AccuracyClassEnum.CLASS_III, StandardAccuracyClassEnum.M2, False),
            (AccuracyClassEnum.CLASS_III, StandardAccuracyClassEnum.M3, False),
            (AccuracyClassEnum.CLASS_IIII, StandardAccuracyClassEnum.M2, True),
            (AccuracyClassEnum.CLASS_IIII, StandardAccuracyClassEnum.M3, True),
        ],
    )
    def test_complete_hierarchy_compatibility_matrix(self, inst_class, std_class, expected_compatible):
        """Verify full statutory compatibility matrix between instrument accuracy and standard weights."""
        assert is_standard_class_compatible(inst_class, std_class) == expected_compatible
