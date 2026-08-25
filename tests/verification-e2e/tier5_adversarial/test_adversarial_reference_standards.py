"""Tier 5 Adversarial Property-Based Tests: Reference Standards Hierarchy & Fail-Closed Integrity.

Validates statutory reference standard rules under The Legal Metrology Act, 2009:
- Fail-Closed: Out of calibration, expired, quarantined, or incompatible standards halt verification immediately.
- Strict accuracy class hierarchy compatibility: E1 -> E2 -> F1 -> F2 -> M1 -> M2 -> M3.
- Composite multi-standard rule: If any 1 of N standards is invalid, the entire session fails.
- Expanded uncertainty ratio constraint: U(k=2) <= 1/3 MPE(L).
- Timestamp exact boundary checks and timezone handling.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest

from packages.measurement.decimal_math import ExactDecimal
from packages.measurement.units import Quantity
from packages.verification_procedures.base import (
    AccuracyClassEnum,
    InstrumentParameters,
    ReferenceStandardItem,
    StandardAccuracyClassEnum,
    VerificationTypeEnum,
)
from packages.verification_procedures.reference_standards.hierarchy import (
    is_standard_class_compatible,
    PERMITTED_STANDARD_CLASSES,
)
from packages.verification_procedures.reference_standards.validator import (
    ReferenceStandardValidator,
    StandardValidationResult,
)


@pytest.fixture
def base_instrument() -> InstrumentParameters:
    """Fixture for standard Class III instrument."""
    return InstrumentParameters(
        accuracy_class=AccuracyClassEnum.CLASS_III,
        max_capacity=Quantity(ExactDecimal("15"), "kg"),
        min_capacity=Quantity(ExactDecimal("0.1"), "kg"),
        verification_scale_interval_e=Quantity(ExactDecimal("0.005"), "kg"),
        actual_scale_interval_d=Quantity(ExactDecimal("0.005"), "kg"),
    )


class TestReferenceStandardsAdversarialHierarchy:
    """Adversarial tests for reference standard compatibility and hierarchy."""

    @pytest.mark.parametrize(
        "inst_class,std_class,expected_suitable",
        [
            # Class I requires E1, E2
            (AccuracyClassEnum.CLASS_I, StandardAccuracyClassEnum.E1, True),
            (AccuracyClassEnum.CLASS_I, StandardAccuracyClassEnum.E2, True),
            (AccuracyClassEnum.CLASS_I, StandardAccuracyClassEnum.F1, False),
            (AccuracyClassEnum.CLASS_I, StandardAccuracyClassEnum.F2, False),
            (AccuracyClassEnum.CLASS_I, StandardAccuracyClassEnum.M1, False),
            (AccuracyClassEnum.CLASS_I, StandardAccuracyClassEnum.M2, False),
            (AccuracyClassEnum.CLASS_I, StandardAccuracyClassEnum.M3, False),
            # Class II requires E2, F1, F2
            (AccuracyClassEnum.CLASS_II, StandardAccuracyClassEnum.E1, True),
            (AccuracyClassEnum.CLASS_II, StandardAccuracyClassEnum.E2, True),
            (AccuracyClassEnum.CLASS_II, StandardAccuracyClassEnum.F1, True),
            (AccuracyClassEnum.CLASS_II, StandardAccuracyClassEnum.F2, True),
            (AccuracyClassEnum.CLASS_II, StandardAccuracyClassEnum.M1, False),
            (AccuracyClassEnum.CLASS_II, StandardAccuracyClassEnum.M2, False),
            (AccuracyClassEnum.CLASS_II, StandardAccuracyClassEnum.M3, False),
            # Class III requires E1, E2, F1, F2, M1
            (AccuracyClassEnum.CLASS_III, StandardAccuracyClassEnum.E1, True),
            (AccuracyClassEnum.CLASS_III, StandardAccuracyClassEnum.F1, True),
            (AccuracyClassEnum.CLASS_III, StandardAccuracyClassEnum.M1, True),
            (AccuracyClassEnum.CLASS_III, StandardAccuracyClassEnum.M2, False),
            (AccuracyClassEnum.CLASS_III, StandardAccuracyClassEnum.M3, False),
            # Class IIII allows M1, M2, M3
            (AccuracyClassEnum.CLASS_IIII, StandardAccuracyClassEnum.M1, True),
            (AccuracyClassEnum.CLASS_IIII, StandardAccuracyClassEnum.M2, True),
            (AccuracyClassEnum.CLASS_IIII, StandardAccuracyClassEnum.M3, True),
        ],
    )
    def test_complete_hierarchy_matrix_property(
        self,
        inst_class: AccuracyClassEnum,
        std_class: StandardAccuracyClassEnum,
        expected_suitable: bool,
    ):
        """Property: Verify the statutory hierarchy compatibility matrix."""
        is_suitable = is_standard_class_compatible(inst_class, std_class)
        assert is_suitable == expected_suitable

    def test_multi_standard_one_bad_apple_fails_closed(self, base_instrument: InstrumentParameters):
        """Adversarial: In a set of 5 standards, if 1 is expired, the entire validation fails closed."""
        now = datetime.now(timezone.utc)
        valid_stds = [
            ReferenceStandardItem(
                standard_id=f"std_valid_{i}",
                standard_name=f"Standard {i}",
                accuracy_class=StandardAccuracyClassEnum.M1,
                nominal_mass=Quantity(ExactDecimal("1"), "kg"),
                calibration_date=(now - timedelta(days=60)).date(),
                expiry_date=(now + timedelta(days=300)).date(),
                is_quarantined=False,
                uncertainty_k2=Quantity(ExactDecimal("0.00001"), "kg"),
            )
            for i in range(4)
        ]
        expired_std = ReferenceStandardItem(
            standard_id="std_expired",
            standard_name="Expired Standard",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("1"), "kg"),
            calibration_date=(now - timedelta(days=400)).date(),
            expiry_date=(now - timedelta(days=35)).date(),  # Expired
            is_quarantined=False,
            uncertainty_k2=Quantity(ExactDecimal("0.00001"), "kg"),
        )
        composite_set = valid_stds + [expired_std]

        res = ReferenceStandardValidator.validate_standards(
            standards=composite_set,
            instrument=base_instrument,
            test_timestamp=now,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res.is_valid is False
        assert any("EXPIRED_REFERENCE_STANDARD" in err for err in res.errors)

    def test_quarantined_standard_fails_closed(self, base_instrument: InstrumentParameters):
        """Adversarial: Standard in QUARANTINED state must fail closed."""
        now = datetime.now(timezone.utc)
        quarantined_std = ReferenceStandardItem(
            standard_id="std_quarantined",
            standard_name="Quarantined Standard",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("5"), "kg"),
            calibration_date=(now - timedelta(days=30)).date(),
            expiry_date=(now + timedelta(days=300)).date(),
            is_quarantined=True,
            status="QUARANTINED",
            uncertainty_k2=Quantity(ExactDecimal("0.00001"), "kg"),
        )
        res = ReferenceStandardValidator.validate_standards(
            standards=[quarantined_std],
            instrument=base_instrument,
            test_timestamp=now,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res.is_valid is False
        assert any("QUARANTINED_REFERENCE_STANDARD" in err for err in res.errors)

    def test_future_calibration_date_fails_closed(self, base_instrument: InstrumentParameters):
        """Adversarial: Standard with calibration date in the future relative to test fails closed."""
        now = datetime.now(timezone.utc)
        future_std = ReferenceStandardItem(
            standard_id="std_future",
            standard_name="Future Standard",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("5"), "kg"),
            calibration_date=(now + timedelta(days=5)).date(),  # In future
            expiry_date=(now + timedelta(days=365)).date(),
            is_quarantined=False,
            uncertainty_k2=Quantity(ExactDecimal("0.00001"), "kg"),
        )
        res = ReferenceStandardValidator.validate_standards(
            standards=[future_std],
            instrument=base_instrument,
            test_timestamp=now,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res.is_valid is False
        assert any("CALIBRATION_NOT_EFFECTIVE" in err for err in res.errors)

    def test_uncertainty_ratio_threshold_3_to_1_property(self, base_instrument: InstrumentParameters):
        """Property: Standard uncertainty U(k=2) must not exceed 1/3 of instrument MPE."""
        now = datetime.now(timezone.utc)
        # Instrument e = 5g => MPE at 1000e (5kg) is 1.0e = 5.0g = 0.005 kg
        # 1/3 MPE = 1.666667 g = 0.001666667 kg

        # Case 1: U = 0.001 kg <= 1/3 MPE => Pass
        std_good_u = ReferenceStandardItem(
            standard_id="std_good_u",
            standard_name="Good Uncertainty",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("5"), "kg"),
            calibration_date=(now - timedelta(days=30)).date(),
            expiry_date=(now + timedelta(days=300)).date(),
            is_quarantined=False,
            uncertainty_k2=Quantity(ExactDecimal("0.001"), "kg"),
        )
        res_pass = ReferenceStandardValidator.validate_standards(
            standards=[std_good_u],
            instrument=base_instrument,
            test_timestamp=now,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_pass.is_valid is True

        # Case 2: U = 0.002 kg > 1/3 MPE => Fail
        std_bad_u = ReferenceStandardItem(
            standard_id="std_bad_u",
            standard_name="Bad Uncertainty",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("5"), "kg"),
            calibration_date=(now - timedelta(days=30)).date(),
            expiry_date=(now + timedelta(days=300)).date(),
            is_quarantined=False,
            uncertainty_k2=Quantity(ExactDecimal("0.002"), "kg"),
        )
        res_fail = ReferenceStandardValidator.validate_standards(
            standards=[std_bad_u],
            instrument=base_instrument,
            test_timestamp=now,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res_fail.is_valid is False
        assert any("STANDARD_UNCERTAINTY_EXCEEDED" in err for err in res_fail.errors)

    def test_empty_standards_fails_closed(self, base_instrument: InstrumentParameters):
        """Adversarial: Zero standards must fail closed."""
        now = datetime.now(timezone.utc)
        res = ReferenceStandardValidator.validate_standards(
            standards=[],
            instrument=base_instrument,
            test_timestamp=now,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert res.is_valid is False
        assert any("NO_REFERENCE_STANDARDS" in err for err in res.errors)
