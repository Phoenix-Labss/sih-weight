"""Golden tests for NAWI stepped Maximum Permissible Error (MPE) calculations.

Citations:
- The Legal Metrology (General) Rules, 2011 (Seventh Schedule, Part II, Table 4)
- OIML R 76-1:2006 Table 6
"""

import pytest

from packages.measurement.decimal_math import ExactDecimal
from packages.measurement.units import Quantity
from verification_procedures.base import (
    AccuracyClassEnum,
    VerificationTypeEnum,
)
from verification_procedures.nawi.mpe import (
    calculate_nawi_mpe,
    get_nawi_mpe_factor_in_e,
)


class TestNAWISteppedMPE:
    """Validate stepped MPE piecewise functions across all statutory load boundaries."""

    @pytest.mark.parametrize(
        "m_intervals,expected_factor",
        [
            # Step 1: [0, 500e] -> 0.5e
            (ExactDecimal("0"), ExactDecimal("0.5")),
            (ExactDecimal("50"), ExactDecimal("0.5")),
            (ExactDecimal("250"), ExactDecimal("0.5")),
            (ExactDecimal("500"), ExactDecimal("0.5")),
            # Step 2: (500e, 2000e] -> 1.0e
            (ExactDecimal("500.0000000001"), ExactDecimal("1.0")),
            (ExactDecimal("501"), ExactDecimal("1.0")),
            (ExactDecimal("1000"), ExactDecimal("1.0")),
            (ExactDecimal("2000"), ExactDecimal("1.0")),
            # Step 3: (2000e, 10000e] -> 1.5e
            (ExactDecimal("2000.0000000001"), ExactDecimal("1.5")),
            (ExactDecimal("3000"), ExactDecimal("1.5")),
            (ExactDecimal("5000"), ExactDecimal("1.5")),
            (ExactDecimal("10000"), ExactDecimal("1.5")),
        ],
    )
    def test_class_iii_initial_verification_mpe(self, m_intervals, expected_factor):
        """Class III Initial Verification stepped MPE: 0.5e, 1.0e, 1.5e."""
        factor = get_nawi_mpe_factor_in_e(
            m_intervals=m_intervals,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert factor == expected_factor

    @pytest.mark.parametrize(
        "m_intervals,expected_factor",
        [
            # Step 1: [0, 500e] -> 1.0e
            (ExactDecimal("0"), ExactDecimal("1.0")),
            (ExactDecimal("500"), ExactDecimal("1.0")),
            # Step 2: (500e, 2000e] -> 2.0e
            (ExactDecimal("500.001"), ExactDecimal("2.0")),
            (ExactDecimal("2000"), ExactDecimal("2.0")),
            # Step 3: (2000e, 10000e] -> 3.0e
            (ExactDecimal("2000.001"), ExactDecimal("3.0")),
            (ExactDecimal("5000"), ExactDecimal("3.0")),
        ],
    )
    def test_class_iii_reverification_mpe(self, m_intervals, expected_factor):
        """Class III Periodic Re-Verification stepped MPE: 2x Initial MPE (1.0e, 2.0e, 3.0e)."""
        factor = get_nawi_mpe_factor_in_e(
            m_intervals=m_intervals,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.RE_VERIFICATION,
        )
        assert factor == expected_factor

    @pytest.mark.parametrize(
        "m_intervals,expected_factor",
        [
            # Step 1: [0, 50e] -> 0.5e
            (ExactDecimal("0"), ExactDecimal("0.5")),
            (ExactDecimal("50"), ExactDecimal("0.5")),
            # Step 2: (50e, 200e] -> 1.0e
            (ExactDecimal("50.0001"), ExactDecimal("1.0")),
            (ExactDecimal("200"), ExactDecimal("1.0")),
            # Step 3: (200e, 1000e] -> 1.5e
            (ExactDecimal("200.0001"), ExactDecimal("1.5")),
            (ExactDecimal("1000"), ExactDecimal("1.5")),
        ],
    )
    def test_class_iiii_initial_verification_mpe(self, m_intervals, expected_factor):
        """Class IIII Initial Verification stepped MPE: 0.5e, 1.0e, 1.5e."""
        factor = get_nawi_mpe_factor_in_e(
            m_intervals=m_intervals,
            accuracy_class=AccuracyClassEnum.CLASS_IIII,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert factor == expected_factor

    @pytest.mark.parametrize(
        "m_intervals,expected_factor",
        [
            # Step 1: [0, 50e] -> 1.0e
            (ExactDecimal("0"), ExactDecimal("1.0")),
            (ExactDecimal("50"), ExactDecimal("1.0")),
            # Step 2: (50e, 200e] -> 2.0e
            (ExactDecimal("50.0001"), ExactDecimal("2.0")),
            (ExactDecimal("200"), ExactDecimal("2.0")),
            # Step 3: (200e, 1000e] -> 3.0e
            (ExactDecimal("200.0001"), ExactDecimal("3.0")),
            (ExactDecimal("1000"), ExactDecimal("3.0")),
        ],
    )
    def test_class_iiii_reverification_mpe(self, m_intervals, expected_factor):
        """Class IIII Periodic Re-Verification stepped MPE: 1.0e, 2.0e, 3.0e."""
        factor = get_nawi_mpe_factor_in_e(
            m_intervals=m_intervals,
            accuracy_class=AccuracyClassEnum.CLASS_IIII,
            verification_type=VerificationTypeEnum.RE_VERIFICATION,
        )
        assert factor == expected_factor

    def test_calculate_nawi_mpe_with_quantities(self):
        """Test calculate_nawi_mpe when load and e are in different units."""
        # Scale: e = 5 g (0.005 kg). Load = 2.5 kg = 500e -> MPE = 0.5e = 2.5 g
        e = Quantity("5", "g")
        load = Quantity("2.5", "kg")
        mpe = calculate_nawi_mpe(
            load=load,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert mpe.unit == "g"
        assert mpe.value == ExactDecimal("2.5")

        # Load = 10 kg = 2000e -> MPE = 1.0e = 5 g
        load2 = Quantity("10", "kg")
        mpe2 = calculate_nawi_mpe(
            load=load2,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert mpe2.value == ExactDecimal("5.0")
        assert mpe2.unit == "g"

        # Load = 15 kg = 3000e -> MPE = 1.5e = 7.5 g
        load3 = Quantity("15", "kg")
        mpe3 = calculate_nawi_mpe(
            load=load3,
            e=e,
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_type=VerificationTypeEnum.INITIAL,
        )
        assert mpe3.value == ExactDecimal("7.5")
        assert mpe3.unit == "g"
