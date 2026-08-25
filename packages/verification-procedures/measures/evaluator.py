"""Deterministic Evaluator for Measures of Length & Capacity.

Statutory Tolerances under Schedule II & Schedule III of The Legal Metrology (General) Rules, 2011:
- Length: +/- 0.5 mm on 1 m rigid bar, +/- 1.0 mm on 2 m tape.
- Capacity: +/- 10 ml on 1 L conical measure, +/- 20 ml on 2 L measure, +/- 50 ml on 5 L measure.
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
from verification_procedures.measures.models import (
    CapacityStepObservation,
    LengthStepObservation,
    MeasureCategoryEnum,
    MeasureEvaluationInput,
)


class MeasuresEvaluator:
    """Deterministic statutory evaluator for length and capacity measures."""

    # Length MPE rules (Schedule II)
    LENGTH_MPE_MAP_MM = {
        exact_decimal("100.0"): exact_decimal("0.200"),
        exact_decimal("500.0"): exact_decimal("0.300"),
        exact_decimal("1000.0"): exact_decimal("0.500"),  # 1 meter
        exact_decimal("2000.0"): exact_decimal("1.000"),  # 2 meters
    }

    # Capacity MPE rules (Schedule III: 1% for conical measures or specific limits)
    CAPACITY_MPE_MAP_ML = {
        exact_decimal("100.0"): exact_decimal("2.0"),
        exact_decimal("200.0"): exact_decimal("3.0"),
        exact_decimal("500.0"): exact_decimal("6.0"),
        exact_decimal("1000.0"): exact_decimal("10.0"),  # 1 Liter
        exact_decimal("2000.0"): exact_decimal("20.0"),  # 2 Liters
        exact_decimal("5000.0"): exact_decimal("50.0"),  # 5 Liters
    }

    @classmethod
    def evaluate(cls, payload: MeasureEvaluationInput) -> EvaluationResult:
        """Evaluate length or capacity measure."""
        eval_time = payload.evaluation_timestamp
        if eval_time.tzinfo is None:
            eval_time = eval_time.replace(tzinfo=timezone.utc)

        evaluation_trace: Dict[str, Any] = {
            "procedure_pack": "IN-PROC-MEASURES-LENGTH-CAPACITY-2026.01",
            "category": payload.category.value,
            "session_id": payload.session_id,
            "serial_number": payload.serial_number,
            "evaluated_at": eval_time.isoformat(),
            "steps": [],
        }

        # 1. Reference standard validity
        eval_date = eval_time.date()
        for s in payload.reference_standards:
            exp = s.expiry_date
            if isinstance(exp, str):
                exp = date.fromisoformat(exp.split("T")[0])
            if exp < eval_date or s.is_quarantined:
                return EvaluationResult(
                    is_passed=False,
                    candidate_outcome=VerificationOutcomeEnum.VERIFICATION_FAILED,
                    failure_reasons=[f"Reference standard '{s.standard_id}' is expired or quarantined."],
                    calculation_trace=evaluation_trace,
                )

        all_pass = True
        errors: List[str] = []

        if payload.category == MeasureCategoryEnum.LENGTH_MEASURE:
            for obs in payload.length_observations:
                delta_mm = obs.nominal_mark_mm - obs.observed_standard_reading_mm
                # MPE lookup or default 0.5 mm per meter
                mpe = cls.LENGTH_MPE_MAP_MM.get(obs.nominal_mark_mm, exact_decimal("0.500"))
                step_pass = abs(delta_mm) <= mpe
                if not step_pass:
                    all_pass = False
                    errors.append(f"Length graduation {obs.nominal_mark_mm} mm error {delta_mm:+.3f} mm exceeds MPE +/- {mpe} mm.")
                evaluation_trace["steps"].append({
                    "nominal_mm": str(obs.nominal_mark_mm),
                    "reading_mm": str(obs.observed_standard_reading_mm),
                    "error_mm": str(delta_mm),
                    "mpe_mm": str(mpe),
                    "is_pass": step_pass,
                })
        else:
            for c_obs in payload.capacity_observations:
                delta_ml = c_obs.nominal_volume_ml - c_obs.prover_standard_reading_ml
                mpe_ml = cls.CAPACITY_MPE_MAP_ML.get(c_obs.nominal_volume_ml, c_obs.nominal_volume_ml * exact_decimal("0.010"))
                step_pass = abs(delta_ml) <= mpe_ml and c_obs.meniscus_inspection_satisfactory
                if not step_pass:
                    all_pass = False
                    errors.append(f"Capacity mark {c_obs.nominal_volume_ml} ml error {delta_ml:+.2f} ml exceeds MPE +/- {mpe_ml} ml.")
                evaluation_trace["steps"].append({
                    "nominal_ml": str(c_obs.nominal_volume_ml),
                    "reading_ml": str(c_obs.prover_standard_reading_ml),
                    "error_ml": str(delta_ml),
                    "mpe_ml": str(mpe_ml),
                    "meniscus_ok": c_obs.meniscus_inspection_satisfactory,
                    "is_pass": step_pass,
                })

        outcome = VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION if all_pass else VerificationOutcomeEnum.VERIFICATION_FAILED

        return EvaluationResult(
            is_passed=all_pass,
            candidate_outcome=outcome,
            failure_reasons=errors,
            calculation_trace=evaluation_trace,
        )
