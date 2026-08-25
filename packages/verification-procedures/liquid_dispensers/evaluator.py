"""Deterministic Metrological Evaluator for Liquid Fuel Dispensers (Petrol/Diesel Pumps).

Statutory Evaluation Rules under Schedule IX of The Legal Metrology (General) Rules, 2011:
1. Stepped MPE tolerance of +/- 0.5% (+/- 25 ml on 5L, +/- 50 ml on 10L, +/- 100 ml on 20L).
2. Flow rate verification (Fast flow >= 25 L/min, Slow flow >= 4 L/min).
3. Temperature compensation trace (thermal expansion coefficients beta).
4. Totalizer continuity reconciliation.
5. Anti-tampering electronic and mechanical seal verification.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from verification_procedures.base import (
    EvaluationResult,
    ReferenceStandardItem,
    VerificationOutcomeEnum,
)
from verification_procedures.liquid_dispensers.models import (
    FlowRateModeEnum,
    FuelDeliveryTestObservation,
    FuelDispenserEvaluationInput,
    FuelDispenserParameters,
    FuelTypeEnum,
    SecuritySealAudit,
    TotalizerAuditObservation,
)


class LiquidFuelDispenserEvaluator:
    """Deterministic statutory evaluator for liquid fuel dispensing systems."""

    STATUTORY_MPE_PERCENT = exact_decimal("0.500")  # +/- 0.5% maximum permissible error
    THERMAL_COEFFICIENTS = {
        FuelTypeEnum.PETROL: exact_decimal("0.001200"),
        FuelTypeEnum.PREMIUM_PETROL: exact_decimal("0.001200"),
        FuelTypeEnum.ETHANOL_BLEND_E20: exact_decimal("0.001150"),
        FuelTypeEnum.DIESEL: exact_decimal("0.000850"),
        FuelTypeEnum.CNG: exact_decimal("0.000000"),
        FuelTypeEnum.AUTO_LPG: exact_decimal("0.002000"),
    }

    @classmethod
    def evaluate(cls, payload: FuelDispenserEvaluationInput) -> EvaluationResult:
        """Execute full statutory evaluation on fuel dispenser test observations."""
        eval_time = payload.evaluation_timestamp
        if eval_time.tzinfo is None:
            eval_time = eval_time.replace(tzinfo=timezone.utc)

        evaluation_trace: Dict[str, Any] = {
            "procedure_pack": "IN-PROC-LIQUID-FUEL-DISPENSER-2026.01",
            "evaluator_version": "1.0.0",
            "session_id": payload.session_id,
            "evaluated_at": eval_time.isoformat(),
            "dispenser_serial": payload.dispenser.dispenser_serial_number,
            "nozzle_id": payload.dispenser.nozzle_identifier,
            "fuel_type": payload.dispenser.fuel_type.value,
            "steps": [],
        }

        # 1. Validate Certified Reference Prover Measures
        provers_valid, prover_reason = cls._check_reference_provers(payload.reference_provers, eval_time)
        if not provers_valid:
            evaluation_trace["reference_standards_status"] = "REJECTED"
            evaluation_trace["reference_standards_failure"] = prover_reason
            return EvaluationResult(
                is_passed=False,
                candidate_outcome=VerificationOutcomeEnum.VERIFICATION_FAILED,
                failure_reasons=[f"Reference standard failure: {prover_reason}"],
                calculation_trace=evaluation_trace,
            )

        evaluation_trace["reference_standards_status"] = "PASSED"

        # 2. Evaluate Anti-Tampering Security Seals
        seals_pass, seal_errors = cls._check_security_seals(payload.security_seals)
        if not seals_pass:
            evaluation_trace["security_seals_status"] = "FAILED"
            evaluation_trace["seal_errors"] = seal_errors
            return EvaluationResult(
                is_passed=False,
                candidate_outcome=VerificationOutcomeEnum.VERIFICATION_FAILED,
                failure_reasons=seal_errors,
                calculation_trace=evaluation_trace,
            )

        evaluation_trace["security_seals_status"] = "PASSED"

        # 3. Evaluate Volumetric Delivery Runs (5L, 10L, 20L fast & slow)
        all_runs_pass = True
        run_errors: List[str] = []
        step_traces: List[Dict[str, Any]] = []
        max_observed_error_pct = exact_decimal("0.000")

        beta = cls.THERMAL_COEFFICIENTS.get(payload.dispenser.fuel_type, exact_decimal("0.001200"))

        for run in payload.delivery_tests:
            run_pass, run_trace, run_err = cls._evaluate_single_delivery_run(
                run=run,
                dispenser=payload.dispenser,
                beta=beta,
            )
            step_traces.append(run_trace)
            if not run_pass:
                all_runs_pass = False
                run_errors.append(f"Run {run.run_number} ({run.target_preset_volume_L} L, {run.flow_mode.value}): {run_err}")

            # Track peak error
            err_pct = abs(exact_decimal(run_trace["relative_error_percent"]))
            if err_pct > max_observed_error_pct:
                max_observed_error_pct = err_pct

        evaluation_trace["steps"] = step_traces

        # 4. Totalizer Audit Reconciliation
        tot_pass, tot_trace, tot_err = cls._evaluate_totalizer(payload.totalizer_audit, payload.delivery_tests)
        evaluation_trace["totalizer_reconciliation"] = tot_trace
        if not tot_pass:
            all_runs_pass = False
            run_errors.append(f"Totalizer discrepancy: {tot_err}")

        # Final Outcome Determination
        if all_runs_pass:
            outcome = VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION
        else:
            outcome = VerificationOutcomeEnum.VERIFICATION_FAILED

        return EvaluationResult(
            is_passed=all_runs_pass,
            candidate_outcome=outcome,
            failure_reasons=run_errors,
            calculation_trace=evaluation_trace,
        )

    @classmethod
    def _check_reference_provers(
        cls, provers: List[ReferenceStandardItem], eval_time: datetime
    ) -> Tuple[bool, Optional[str]]:
        """Verify volumetric test measures are active and unexpired."""
        if not provers:
            return False, "No calibrated reference prover measures provided for verification."

        eval_date = eval_time.date()
        for p in provers:
            if p.is_quarantined:
                return False, f"Prover '{p.standard_id}' ({p.standard_name}) is QUARANTINED."
            if p.status != "ACTIVE":
                return False, f"Prover '{p.standard_id}' is not in ACTIVE state (status={p.status})."

            exp = p.expiry_date
            if isinstance(exp, str):
                exp = date.fromisoformat(exp.split("T")[0])
            if exp < eval_date:
                return False, f"Prover '{p.standard_id}' calibration expired on {exp.isoformat()} prior to test date {eval_date.isoformat()}."

        return True, None

    @classmethod
    def _check_security_seals(cls, seals: SecuritySealAudit) -> Tuple[bool, List[str]]:
        """Validate all anti-tamper security seals."""
        errors: List[str] = []
        if not seals.metering_unit_calibration_seal_intact:
            errors.append("Metering unit calibration port seal is BROKEN or TAMPERED.")
        if not seals.electronic_pulser_enclosure_seal_intact:
            errors.append("Electronic pulser optical encoder enclosure seal is MISSING or DAMAGED.")
        if not seals.totalizer_and_motherboard_lock_intact:
            errors.append("Motherboard access / totalizer physical lock is COMPROMISED.")
        if not seals.delivery_hose_anti_kink_and_nozzle_valve_intact:
            errors.append("Delivery hose or automatic shut-off nozzle valve integrity check FAILED.")
        return (len(errors) == 0, errors)

    @classmethod
    def _evaluate_single_delivery_run(
        cls,
        run: FuelDeliveryTestObservation,
        dispenser: FuelDispenserParameters,
        beta: ExactDecimal,
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """Evaluate accuracy and flow rate for a single delivery into prover can."""
        v_ind = run.dispenser_indicated_volume_L
        v_std = run.prover_standard_reading_L

        # Optional thermal volume correction: V_corr = V_std * [1 + beta * (T_fuel - T_prover)]
        if run.fuel_temperature_celsius and run.prover_temperature_celsius:
            delta_t = run.fuel_temperature_celsius - run.prover_temperature_celsius
            thermal_factor = exact_decimal("1.000000") + (beta * delta_t)
            v_ref = v_std * thermal_factor
        else:
            thermal_factor = exact_decimal("1.000000")
            v_ref = v_std

        # Exact Error Calculation
        delta_v = v_ind - v_ref
        rel_error_pct = (delta_v / v_ref) * exact_decimal("100.000")

        # Flow Rate (L/min)
        duration = run.delivery_duration_seconds if run.delivery_duration_seconds > exact_decimal("0") else exact_decimal("15.0")
        flow_rate_L_min = (v_ind / duration) * exact_decimal("60.000")

        # Tolerances
        is_accuracy_pass = abs(rel_error_pct) <= cls.STATUTORY_MPE_PERCENT

        # Flow Rate constraints
        is_flow_pass = True
        flow_err = None
        if run.flow_mode == FlowRateModeEnum.FAST_FLOW and flow_rate_L_min < exact_decimal("25.0"):
            is_flow_pass = False
            flow_err = f"Fast flow rate {flow_rate_L_min:.2f} L/min below minimum statutory 25.0 L/min threshold."
        elif run.flow_mode == FlowRateModeEnum.SLOW_FLOW and flow_rate_L_min < exact_decimal("4.0"):
            is_flow_pass = False
            flow_err = f"Slow flow rate {flow_rate_L_min:.2f} L/min below minimum trickle 4.0 L/min threshold."

        run_pass = is_accuracy_pass and is_flow_pass
        err_msg = None
        if not is_accuracy_pass:
            err_msg = f"Relative error {rel_error_pct:+.3f}% exceeds statutory MPE +/- {cls.STATUTORY_MPE_PERCENT}%."
        elif not is_flow_pass:
            err_msg = flow_err

        trace = {
            "run_number": run.run_number,
            "target_preset_L": str(run.target_preset_volume_L),
            "dispenser_indicated_L": str(v_ind),
            "prover_reading_L": str(v_std),
            "thermal_factor": str(thermal_factor),
            "reference_volume_L": str(v_ref),
            "volume_error_L": str(delta_v),
            "relative_error_percent": f"{rel_error_pct:+.3f}",
            "mpe_percent_allowed": str(cls.STATUTORY_MPE_PERCENT),
            "flow_rate_L_per_min": f"{flow_rate_L_min:.2f}",
            "flow_mode": run.flow_mode.value,
            "is_accuracy_pass": is_accuracy_pass,
            "is_flow_pass": is_flow_pass,
            "is_pass": run_pass,
        }

        return (run_pass, trace, err_msg)

    @classmethod
    def _evaluate_totalizer(
        cls,
        totalizer: TotalizerAuditObservation,
        runs: List[FuelDeliveryTestObservation],
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """Verify electromechanical/electronic totalizer advance matches delivered test volume."""
        delta_totalizer = totalizer.end_totalizer_reading_L - totalizer.start_totalizer_reading_L
        sum_deliveries = sum((r.dispenser_indicated_volume_L for r in runs), exact_decimal("0.000"))

        discrepancy = abs(delta_totalizer - sum_deliveries)
        is_pass = discrepancy <= exact_decimal("0.100")  # Max 0.1 L totalizer resolution delta

        trace = {
            "start_totalizer_L": str(totalizer.start_totalizer_reading_L),
            "end_totalizer_L": str(totalizer.end_totalizer_reading_L),
            "totalizer_delta_L": str(delta_totalizer),
            "sum_delivered_tests_L": str(sum_deliveries),
            "discrepancy_L": str(discrepancy),
            "is_reconciled": is_pass,
        }

        err_msg = None
        if not is_pass:
            err_msg = f"Totalizer advance {delta_totalizer} L does not match sum of test deliveries {sum_deliveries} L (discrepancy={discrepancy} L)."

        return (is_pass, trace, err_msg)
