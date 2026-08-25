"""Phase 5/6 Test Suite: Liquid Fuel Dispenser (Petrol Pump) Procedure Evaluator.
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
from verification_procedures.liquid_dispensers.evaluator import LiquidFuelDispenserEvaluator
from verification_procedures.liquid_dispensers.models import (
    FlowRateModeEnum,
    FuelDeliveryTestObservation,
    FuelDispenserEvaluationInput,
    FuelDispenserParameters,
    FuelTypeEnum,
    SecuritySealAudit,
    TotalizerAuditObservation,
)


class TestLiquidFuelDispenserEvaluator:
    """Statutory tests for Petrol/Diesel Pump Verification under Schedule IX (2011 Rules)."""

    def _make_valid_prover(self, exp_offset_days: int = 200) -> ReferenceStandardItem:
        now_date = date.today()
        return ReferenceStandardItem(
            standard_id="std_prover_20l_01",
            standard_name="Certified Conical Prover Measure 20 L",
            accuracy_class=StandardAccuracyClassEnum.M1,
            nominal_mass=None,
            calibration_date=now_date - timedelta(days=100),
            expiry_date=now_date + timedelta(days=exp_offset_days),
            is_quarantined=False,
            status="ACTIVE",
        )

    def test_golden_passing_fuel_dispenser_verification(self):
        """Happy path: 5L slow, 10L fast, 20L fast runs with <= 0.5% error and intact seals."""
        dispenser = FuelDispenserParameters(
            dispenser_serial_number="MS-NZ-2026-9901",
            nozzle_identifier="NZ-01-PETROL",
            fuel_type=FuelTypeEnum.PETROL,
        )

        delivery_runs = [
            FuelDeliveryTestObservation(
                run_number=1,
                target_preset_volume_L=exact_decimal("5.000"),
                dispenser_indicated_volume_L=exact_decimal("5.000"),
                prover_standard_reading_L=exact_decimal("4.995"),  # +0.10% error (well within +/- 0.5%)
                flow_mode=FlowRateModeEnum.SLOW_FLOW,
                delivery_duration_seconds=exact_decimal("35.0"),    # 8.57 L/min (>= 5 L/min)
            ),
            FuelDeliveryTestObservation(
                run_number=2,
                target_preset_volume_L=exact_decimal("10.000"),
                dispenser_indicated_volume_L=exact_decimal("10.000"),
                prover_standard_reading_L=exact_decimal("10.010"), # -0.10% error
                flow_mode=FlowRateModeEnum.FAST_FLOW,
                delivery_duration_seconds=exact_decimal("18.0"),   # 33.3 L/min (>= 30 L/min)
            ),
            FuelDeliveryTestObservation(
                run_number=3,
                target_preset_volume_L=exact_decimal("20.000"),
                dispenser_indicated_volume_L=exact_decimal("20.000"),
                prover_standard_reading_L=exact_decimal("19.980"), # +0.10% error
                flow_mode=FlowRateModeEnum.FAST_FLOW,
                delivery_duration_seconds=exact_decimal("32.0"),   # 37.5 L/min
            ),
        ]

        totalizer = TotalizerAuditObservation(
            start_totalizer_reading_L=exact_decimal("100500.000"),
            end_totalizer_reading_L=exact_decimal("100535.000"),  # Advance = 35.0 L (matches 5 + 10 + 20)
            actual_test_liters_delivered=exact_decimal("35.000"),
        )

        payload = FuelDispenserEvaluationInput(
            session_id="sess_fuel_001",
            dispenser=dispenser,
            verification_type=VerificationTypeEnum.INITIAL,
            evaluation_timestamp=datetime.now(timezone.utc),
            reference_provers=[self._make_valid_prover()],
            delivery_tests=delivery_runs,
            totalizer_audit=totalizer,
            security_seals=SecuritySealAudit(),
        )

        result = LiquidFuelDispenserEvaluator.evaluate(payload)
        assert result.is_passed is True
        assert result.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION
        assert len(result.failure_reasons) == 0

    def test_volume_error_exceeding_mpe_fails_verification(self):
        """Relative error > 0.5% (+35 ml on 5L = +0.70%) triggers statutory failure."""
        dispenser = FuelDispenserParameters(
            dispenser_serial_number="HSD-NZ-2026-8802",
            nozzle_identifier="NZ-02-DIESEL",
            fuel_type=FuelTypeEnum.DIESEL,
        )

        delivery_runs = [
            FuelDeliveryTestObservation(
                run_number=1,
                target_preset_volume_L=exact_decimal("5.000"),
                dispenser_indicated_volume_L=exact_decimal("5.000"),
                prover_standard_reading_L=exact_decimal("4.960"),  # Error = +40 ml (+0.806% > 0.5%)
                flow_mode=FlowRateModeEnum.FAST_FLOW,
                delivery_duration_seconds=exact_decimal("8.0"),
            ),
        ]

        payload = FuelDispenserEvaluationInput(
            session_id="sess_fuel_002",
            dispenser=dispenser,
            verification_type=VerificationTypeEnum.RE_VERIFICATION,
            evaluation_timestamp=datetime.now(timezone.utc),
            reference_provers=[self._make_valid_prover()],
            delivery_tests=delivery_runs,
            totalizer_audit=TotalizerAuditObservation(
                start_totalizer_reading_L=exact_decimal("200.0"),
                end_totalizer_reading_L=exact_decimal("205.0"),
                actual_test_liters_delivered=exact_decimal("5.0"),
            ),
            security_seals=SecuritySealAudit(),
        )

        result = LiquidFuelDispenserEvaluator.evaluate(payload)
        assert result.is_passed is False
        assert result.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_FAILED
        assert any("exceeds statutory MPE" in err for err in result.failure_reasons)

    def test_tampered_security_seal_fails_verification(self):
        """Broken pulser encoder seal triggers immediate failure regardless of accuracy."""
        dispenser = FuelDispenserParameters(
            dispenser_serial_number="MS-NZ-2026-9903",
            nozzle_identifier="NZ-03-PETROL",
            fuel_type=FuelTypeEnum.PETROL,
        )

        delivery_runs = [
            FuelDeliveryTestObservation(
                run_number=1,
                target_preset_volume_L=exact_decimal("5.000"),
                dispenser_indicated_volume_L=exact_decimal("5.000"),
                prover_standard_reading_L=exact_decimal("5.000"),
                flow_mode=FlowRateModeEnum.FAST_FLOW,
                delivery_duration_seconds=exact_decimal("8.0"),
            ),
        ]

        payload = FuelDispenserEvaluationInput(
            session_id="sess_fuel_003",
            dispenser=dispenser,
            verification_type=VerificationTypeEnum.INITIAL,
            evaluation_timestamp=datetime.now(timezone.utc),
            reference_provers=[self._make_valid_prover()],
            delivery_tests=delivery_runs,
            totalizer_audit=TotalizerAuditObservation(
                start_totalizer_reading_L=exact_decimal("100.0"),
                end_totalizer_reading_L=exact_decimal("105.0"),
                actual_test_liters_delivered=exact_decimal("5.0"),
            ),
            security_seals=SecuritySealAudit(electronic_pulser_enclosure_seal_intact=False),
        )

        result = LiquidFuelDispenserEvaluator.evaluate(payload)
        assert result.is_passed is False
        assert result.candidate_outcome == VerificationOutcomeEnum.VERIFICATION_FAILED
        assert any("pulser" in err.lower() for err in result.failure_reasons)
