"""Tier 2 Boundaries & Corners: Stepped MPE Thresholds (500e, 2000e, 10000e ± epsilon).
"""

from __future__ import annotations

from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from packages.measurement.decimal_math import ExactDecimal
from packages.measurement.units import Quantity
from verification_procedures.base import AccuracyClassEnum, VerificationTypeEnum
from verification_procedures.nawi.mpe import calculate_nawi_mpe, get_nawi_mpe_factor_in_e


class TestMPEStepBoundaries:
    """Boundary Value Analysis (BVA) test suite for stepped MPE functions."""

    def test_class_iii_500e_boundary_transition(self):
        """Class III: MPE factor is 0.5e at m <= 500, transitions to 1.0e immediately at m > 500."""
        e = Quantity(ExactDecimal("0.005"), "kg")
        eps = ExactDecimal("0.0000001")

        # 499.9999999 e -> 0.5e
        f_below = get_nawi_mpe_factor_in_e(
            ExactDecimal("500") - eps, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL
        )
        assert f_below == ExactDecimal("0.5")

        # Exactly 500.0 e -> 0.5e
        f_exact = get_nawi_mpe_factor_in_e(
            ExactDecimal("500"), AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL
        )
        assert f_exact == ExactDecimal("0.5")

        # 500.0000001 e -> 1.0e
        f_above = get_nawi_mpe_factor_in_e(
            ExactDecimal("500") + eps, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL
        )
        assert f_above == ExactDecimal("1.0")

        # Check physical quantity values
        mpe_at_500 = calculate_nawi_mpe(Quantity(ExactDecimal("2.5"), "kg"), e, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL)
        assert mpe_at_500.value == ExactDecimal("0.0025")  # 0.5 * 0.005 kg

        mpe_above_500 = calculate_nawi_mpe(Quantity(ExactDecimal("2.500001"), "kg"), e, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL)
        assert mpe_above_500.value == ExactDecimal("0.005")  # 1.0 * 0.005 kg

    def test_class_iii_2000e_boundary_transition(self):
        """Class III: MPE factor is 1.0e at m <= 2000, transitions to 1.5e at m > 2000."""
        e = Quantity(ExactDecimal("0.005"), "kg")
        eps = ExactDecimal("0.0000001")

        # 1999.9999999 e -> 1.0e
        f_below = get_nawi_mpe_factor_in_e(
            ExactDecimal("2000") - eps, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL
        )
        assert f_below == ExactDecimal("1.0")

        # Exactly 2000.0 e -> 1.0e
        f_exact = get_nawi_mpe_factor_in_e(
            ExactDecimal("2000"), AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL
        )
        assert f_exact == ExactDecimal("1.0")

        # 2000.0000001 e -> 1.5e
        f_above = get_nawi_mpe_factor_in_e(
            ExactDecimal("2000") + eps, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL
        )
        assert f_above == ExactDecimal("1.5")

        # Physical quantity check at 10 kg (2000e)
        mpe_at_2000 = calculate_nawi_mpe(Quantity(ExactDecimal("10.0"), "kg"), e, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL)
        assert mpe_at_2000.value == ExactDecimal("0.005")  # 1.0 * 0.005 kg

        # Physical quantity check at 10.000005 kg (>2000e)
        mpe_above_2000 = calculate_nawi_mpe(Quantity(ExactDecimal("10.000005"), "kg"), e, AccuracyClassEnum.CLASS_III, VerificationTypeEnum.INITIAL)
        assert mpe_above_2000.value == ExactDecimal("0.0075")  # 1.5 * 0.005 kg

    def test_class_iiii_50e_and_200e_boundaries(self):
        """Class IIII: Step transitions at 50e and 200e."""
        e = Quantity(ExactDecimal("0.050"), "kg")
        eps = ExactDecimal("0.000001")

        # At 50e -> 0.5e, Above 50e -> 1.0e
        assert get_nawi_mpe_factor_in_e(ExactDecimal("50"), AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.INITIAL) == ExactDecimal("0.5")
        assert get_nawi_mpe_factor_in_e(ExactDecimal("50") + eps, AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.INITIAL) == ExactDecimal("1.0")

        # At 200e -> 1.0e, Above 200e -> 1.5e
        assert get_nawi_mpe_factor_in_e(ExactDecimal("200"), AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.INITIAL) == ExactDecimal("1.0")
        assert get_nawi_mpe_factor_in_e(ExactDecimal("200") + eps, AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.INITIAL) == ExactDecimal("1.5")

    def test_class_ii_5000e_and_20000e_boundaries(self):
        """Class II: Step transitions at 5000e and 20000e."""
        eps = ExactDecimal("0.000001")
        assert get_nawi_mpe_factor_in_e(ExactDecimal("5000"), AccuracyClassEnum.CLASS_II, VerificationTypeEnum.INITIAL) == ExactDecimal("0.5")
        assert get_nawi_mpe_factor_in_e(ExactDecimal("5000") + eps, AccuracyClassEnum.CLASS_II, VerificationTypeEnum.INITIAL) == ExactDecimal("1.0")
        assert get_nawi_mpe_factor_in_e(ExactDecimal("20000"), AccuracyClassEnum.CLASS_II, VerificationTypeEnum.INITIAL) == ExactDecimal("1.0")
        assert get_nawi_mpe_factor_in_e(ExactDecimal("20000") + eps, AccuracyClassEnum.CLASS_II, VerificationTypeEnum.INITIAL) == ExactDecimal("1.5")

    def test_reverification_mpe_doubling_across_all_steps(self):
        """In-Service Re-verification doubles the statutory MPE for all classes and intervals."""
        # Class III
        assert get_nawi_mpe_factor_in_e(ExactDecimal("400"), AccuracyClassEnum.CLASS_III, VerificationTypeEnum.RE_VERIFICATION) == ExactDecimal("1.0")
        assert get_nawi_mpe_factor_in_e(ExactDecimal("1500"), AccuracyClassEnum.CLASS_III, VerificationTypeEnum.RE_VERIFICATION) == ExactDecimal("2.0")
        assert get_nawi_mpe_factor_in_e(ExactDecimal("2500"), AccuracyClassEnum.CLASS_III, VerificationTypeEnum.RE_VERIFICATION) == ExactDecimal("3.0")

        # Class IIII
        assert get_nawi_mpe_factor_in_e(ExactDecimal("40"), AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.RE_VERIFICATION) == ExactDecimal("1.0")
        assert get_nawi_mpe_factor_in_e(ExactDecimal("150"), AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.RE_VERIFICATION) == ExactDecimal("2.0")
        assert get_nawi_mpe_factor_in_e(ExactDecimal("300"), AccuracyClassEnum.CLASS_IIII, VerificationTypeEnum.RE_VERIFICATION) == ExactDecimal("3.0")
