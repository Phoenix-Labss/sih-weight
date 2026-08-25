"""Phase 5/6 Test Suite: Length & Capacity Measures Evaluator.
"""

from datetime import date, datetime, timedelta, timezone
import pytest

from packages.measurement.decimal_math import exact_decimal
from verification_procedures.base import (
    ReferenceStandardItem,
    StandardAccuracyClassEnum,
    VerificationOutcomeEnum,
    VerificationTypeEnum,
)
from verification_procedures.measures.evaluator import MeasuresEvaluator
from verification_procedures.measures.models import (
    CapacityStepObservation,
    LengthStepObservation,
    MeasureCategoryEnum,
    MeasureEvaluationInput,
)


class TestMeasuresEvaluator:
    """Statutory tests for Length and Capacity Measures under Schedules II & III (2011 Rules)."""

    def _make_valid_standard(self) -> ReferenceStandardItem:
        now_date = date.today()
        return ReferenceStandardItem(
            standard_id="std_comparator_01",
            standard_name="Traveling Length Comparator Standard",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=None,
            calibration_date=now_date - timedelta(days=50),
            expiry_date=now_date + timedelta(days=315),
            is_quarantined=False,
            status="ACTIVE",
        )

    def test_golden_passing_rigid_meter_length_measure(self):
        """Pass test for 1m rigid steel meter bar with <= 0.5 mm error."""
        payload = MeasureEvaluationInput(
            session_id="sess_len_001",
            category=MeasureCategoryEnum.LENGTH_MEASURE,
            measure_type_str="RIGID_METALLIC_METER_BAR",
            serial_number="MTR-2026-101",
            nominal_size_value=exact_decimal("1.0"),
            nominal_size_unit="m",
            verification_type=VerificationTypeEnum.INITIAL,
            evaluation_timestamp=datetime.now(timezone.utc),
            reference_standards=[self._make_valid_standard()],
            length_observations=[
                LengthStepObservation(nominal_mark_mm=exact_decimal("100.0"), observed_standard_reading_mm=exact_decimal("100.1")), # 0.1 mm <= 0.2 mm
                LengthStepObservation(nominal_mark_mm=exact_decimal("500.0"), observed_standard_reading_mm=exact_decimal("500.2")), # 0.2 mm <= 0.3 mm
                LengthStepObservation(nominal_mark_mm=exact_decimal("1000.0"), observed_standard_reading_mm=exact_decimal("1000.3")), # 0.3 mm <= 0.5 mm
            ],
        )

        result = MeasuresEvaluator.evaluate(payload)
        assert result.is_passed is True
        assert result.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION

    def test_golden_passing_conical_capacity_measure(self):
        """Pass test for 1 Liter conical capacity measure with <= 10 ml error."""
        payload = MeasureEvaluationInput(
            session_id="sess_cap_001",
            category=MeasureCategoryEnum.CAPACITY_MEASURE,
            measure_type_str="CONICAL_METALLIC_MEASURE",
            serial_number="CAP-1L-2026-55",
            nominal_size_value=exact_decimal("1000.0"),
            nominal_size_unit="ml",
            verification_type=VerificationTypeEnum.INITIAL,
            evaluation_timestamp=datetime.now(timezone.utc),
            reference_standards=[self._make_valid_standard()],
            capacity_observations=[
                CapacityStepObservation(
                    nominal_volume_ml=exact_decimal("1000.0"),
                    prover_standard_reading_ml=exact_decimal("996.0"), # Error = +4 ml <= 10 ml
                    meniscus_inspection_satisfactory=True,
                )
            ],
        )

        result = MeasuresEvaluator.evaluate(payload)
        assert result.is_passed is True
        assert result.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION
