"""Tier 2 Boundaries & Corners: Reference Standard Validity & Fail-Closed Integrity Gating.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

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
from verification_procedures.reference_standards.validator import ReferenceStandardValidator


class TestReferenceStandardExpiryBlocking:
    """Boundary test suite verifying fail-closed gating on expired or invalid standards."""

    @pytest.fixture
    def nawi_instrument_params(self) -> InstrumentParameters:
        return InstrumentParameters(
            accuracy_class=AccuracyClassEnum.CLASS_III,
            max_capacity=Quantity(ExactDecimal("15.000"), "kg"),
            min_capacity=Quantity(ExactDecimal("0.100"), "kg"),
            verification_scale_interval_e=Quantity(ExactDecimal("0.005"), "kg"),
            actual_scale_interval_d=Quantity(ExactDecimal("0.005"), "kg"),
        )

    def test_expired_calibration_date_fails_closed(self, nawi_instrument_params):
        """Standard whose valid_until is before the test timestamp must fail closed."""
        now = datetime.now(timezone.utc)
        test_ts = now
        expired_std = ReferenceStandardItem(
            standard_id="std_exp_01",
            standard_name="Expired 10kg",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("10.000"), "kg"),
            calibration_date=(now - timedelta(days=400)).date(),
            expiry_date=(now - timedelta(days=35)).date(),  # Expired 35 days ago
            is_quarantined=False,
            status="ACTIVE",
            uncertainty_k2=Quantity(ExactDecimal("0.00005"), "kg"),
        )

        session_input = SessionEvaluationInput(
            session_id="sess_exp_test",
            instrument=nawi_instrument_params,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp=test_ts,
            zero_setting=ZeroSettingObservation(Quantity(ExactDecimal("0"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity(ExactDecimal("10.000"), "kg"),
                    indicated_I=Quantity(ExactDecimal("10.000"), "kg"),
                    delta_L=Quantity(ExactDecimal("0.0025"), "kg"),
                )
            ],
            reference_standards=[expired_std],
        )
        pack = NAWIProcedurePack()
        result = pack.evaluate_session(session_input)
        assert result.is_passed is False
        assert result.candidate_outcome in (VerificationOutcomeEnum.INCOMPLETE_VERIFICATION, "Incomplete verification")
        assert any("expired" in r.lower() or "expiry" in r.lower() for r in result.failure_reasons)

    def test_quarantined_standard_fails_closed(self, nawi_instrument_params):
        """Standard in QUARANTINED status must fail closed immediately."""
        now = datetime.now(timezone.utc)
        quarantined_std = ReferenceStandardItem(
            standard_id="std_quar_01",
            standard_name="Quarantined 5kg",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("5.000"), "kg"),
            calibration_date=(now - timedelta(days=30)).date(),
            expiry_date=(now + timedelta(days=300)).date(),
            is_quarantined=True,
            status="QUARANTINED",
            uncertainty_k2=Quantity(ExactDecimal("0.00002"), "kg"),
        )
        session_input = SessionEvaluationInput(
            session_id="sess_quar_test",
            instrument=nawi_instrument_params,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp=now,
            zero_setting=ZeroSettingObservation(Quantity(ExactDecimal("0"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity(ExactDecimal("5.000"), "kg"),
                    indicated_I=Quantity(ExactDecimal("5.000"), "kg"),
                    delta_L=Quantity(ExactDecimal("0.0025"), "kg"),
                )
            ],
            reference_standards=[quarantined_std],
        )
        pack = NAWIProcedurePack()
        result = pack.evaluate_session(session_input)
        assert result.is_passed is False
        assert result.candidate_outcome in (VerificationOutcomeEnum.INCOMPLETE_VERIFICATION, "Incomplete verification")

    def test_future_calibration_date_fails_closed(self, nawi_instrument_params):
        """Standard calibrated in future relative to test date must fail closed."""
        now = datetime.now(timezone.utc)
        future_std = ReferenceStandardItem(
            standard_id="std_fut_01",
            standard_name="Future Calibrated 5kg",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("5.000"), "kg"),
            calibration_date=(now + timedelta(days=10)).date(),  # Future calibration!
            expiry_date=(now + timedelta(days=375)).date(),
            is_quarantined=False,
            status="ACTIVE",
            uncertainty_k2=Quantity(ExactDecimal("0.00002"), "kg"),
        )
        session_input = SessionEvaluationInput(
            session_id="sess_fut_test",
            instrument=nawi_instrument_params,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp=now,
            zero_setting=ZeroSettingObservation(Quantity(ExactDecimal("0"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity(ExactDecimal("5.000"), "kg"),
                    indicated_I=Quantity(ExactDecimal("5.000"), "kg"),
                    delta_L=Quantity(ExactDecimal("0.0025"), "kg"),
                )
            ],
            reference_standards=[future_std],
        )
        pack = NAWIProcedurePack()
        result = pack.evaluate_session(session_input)
        assert result.is_passed is False
        assert result.candidate_outcome in (VerificationOutcomeEnum.INCOMPLETE_VERIFICATION, "Incomplete verification")

    def test_incompatible_standard_accuracy_class_fails_closed(self, nawi_instrument_params):
        """Class III instrument requiring Class M1 weights fails closed if Class M2/M3 weights are supplied."""
        now = datetime.now(timezone.utc)
        coarse_std = ReferenceStandardItem(
            standard_id="std_m3_01",
            standard_name="Coarse M3 Weight",
            accuracy_class=StandardAccuracyClassEnum.M3,  # Incompatible with Class III
            nominal_mass=Quantity(ExactDecimal("10.000"), "kg"),
            calibration_date=(now - timedelta(days=30)).date(),
            expiry_date=(now + timedelta(days=300)).date(),
            is_quarantined=False,
            status="ACTIVE",
            uncertainty_k2=Quantity(ExactDecimal("0.0005"), "kg"),
        )
        session_input = SessionEvaluationInput(
            session_id="sess_class_incompat",
            instrument=nawi_instrument_params,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp=now,
            zero_setting=ZeroSettingObservation(Quantity(ExactDecimal("0"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity(ExactDecimal("10.000"), "kg"),
                    indicated_I=Quantity(ExactDecimal("10.000"), "kg"),
                    delta_L=Quantity(ExactDecimal("0.0025"), "kg"),
                )
            ],
            reference_standards=[coarse_std],
        )
        pack = NAWIProcedurePack()
        result = pack.evaluate_session(session_input)
        assert result.is_passed is False
        assert result.candidate_outcome in (VerificationOutcomeEnum.OUTSIDE_AUTHORIZATION_SCOPE, "Outside authorization scope")

    def test_multi_standard_one_bad_apple_fails_closed(self, nawi_instrument_params):
        """If 1 out of 3 standard test weights is expired, the entire session fails closed."""
        now = datetime.now(timezone.utc)
        std_valid_1 = ReferenceStandardItem(
            standard_id="std_v1", standard_name="Valid 5kg A", accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("5.000"), "kg"),
            calibration_date=(now - timedelta(days=20)).date(), expiry_date=(now + timedelta(days=300)).date(),
            is_quarantined=False, status="ACTIVE", uncertainty_k2=Quantity(ExactDecimal("0.00002"), "kg"),
        )
        std_valid_2 = ReferenceStandardItem(
            standard_id="std_v2", standard_name="Valid 5kg B", accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("5.000"), "kg"),
            calibration_date=(now - timedelta(days=20)).date(), expiry_date=(now + timedelta(days=300)).date(),
            is_quarantined=False, status="ACTIVE", uncertainty_k2=Quantity(ExactDecimal("0.00002"), "kg"),
        )
        std_expired = ReferenceStandardItem(
            standard_id="std_exp", standard_name="Expired 5kg C", accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=Quantity(ExactDecimal("5.000"), "kg"),
            calibration_date=(now - timedelta(days=400)).date(), expiry_date=(now - timedelta(days=1)).date(),
            is_quarantined=False, status="ACTIVE", uncertainty_k2=Quantity(ExactDecimal("0.00002"), "kg"),
        )

        session_input = SessionEvaluationInput(
            session_id="sess_multi_std_test",
            instrument=nawi_instrument_params,
            verification_type=VerificationTypeEnum.INITIAL,
            test_timestamp=now,
            zero_setting=ZeroSettingObservation(Quantity(ExactDecimal("0"), "kg"), Quantity(ExactDecimal("0.0025"), "kg")),
            linearity_steps=[
                LinearityStepObservation(
                    step_number=1,
                    direction=TestDirectionEnum.INCREASING,
                    nominal_load=Quantity(ExactDecimal("15.000"), "kg"),
                    indicated_I=Quantity(ExactDecimal("15.000"), "kg"),
                    delta_L=Quantity(ExactDecimal("0.0025"), "kg"),
                )
            ],
            reference_standards=[std_valid_1, std_valid_2, std_expired],
        )
        pack = NAWIProcedurePack()
        result = pack.evaluate_session(session_input)
        assert result.is_passed is False
        assert result.candidate_outcome in (VerificationOutcomeEnum.INCOMPLETE_VERIFICATION, "Incomplete verification")
