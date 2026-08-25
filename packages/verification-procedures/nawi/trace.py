"""Deterministic calculation trace generator for NAWI procedures.

Produces schema-compliant, bit-reproducible JSON calculation traces capturing all raw inputs,
intermediate variables, applied formulas, tolerance comparisons, and verdicts.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import uuid

from ..base import (
    BaseProcedurePack,
    SessionEvaluationInput,
    VerificationOutcomeEnum,
)
from .evaluator import (
    ClassificationValidationResult,
    EccentricityEvaluationResult,
    RepeatabilitySeriesResult,
    TareEvaluationResult,
    ZeroEvaluationResult,
)
from ..reference_standards.validator import StandardValidationResult


def generate_nawi_calculation_trace(
    pack: BaseProcedurePack,
    session_input: SessionEvaluationInput,
    classification_res: ClassificationValidationResult,
    standards_res: Optional[StandardValidationResult],
    zero_res: Optional[ZeroEvaluationResult],
    step_results: List[Any],
    eccentricity_res: Optional[EccentricityEvaluationResult],
    repeatability_res: Optional[List[RepeatabilitySeriesResult]],
    tare_res: Optional[TareEvaluationResult],
    outcome: VerificationOutcomeEnum,
    failure_reasons: List[str],
) -> Dict[str, Any]:
    """Generate a canonical, fully serializable JSON dictionary capturing the deterministic trace."""
    inst = session_input.instrument
    trace_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{session_input.session_id}:{session_input.test_timestamp}"))

    trace: Dict[str, Any] = {
        "$schema": "https://legalmetrology.gov.in/schemas/v1/nawi-evaluation-trace.json",
        "trace_id": trace_id,
        "engine_version": "1.0.0",
        "evaluated_at": str(session_input.test_timestamp),
        "procedure_pack": {
            "pack_id": pack.pack_id,
            "name": pack.name,
            "version": pack.version,
            "legal_source_ref": pack.legal_source_ref,
            "source_checksum_sha256": pack.source_checksum_sha256,
        },
        "instrument_parameters": {
            "accuracy_class": inst.accuracy_class.value,
            "max_capacity": inst.max_capacity.to_dict(),
            "min_capacity": inst.min_capacity.to_dict(),
            "verification_scale_interval_e": inst.verification_scale_interval_e.to_dict(),
            "actual_scale_interval_d": inst.actual_scale_interval_d.to_dict(),
            "num_scale_intervals_n": int(classification_res.n_intervals),
            "classification_valid": classification_res.is_valid,
            "classification_errors": classification_res.errors,
        },
        "verification_context": {
            "session_id": session_input.session_id,
            "verification_type": session_input.verification_type.value,
            "temperature_celsius": str(session_input.temperature_celsius) if session_input.temperature_celsius else None,
            "relative_humidity_pct": str(session_input.relative_humidity_pct) if session_input.relative_humidity_pct else None,
        },
        "reference_standards_validation": {
            "is_valid": standards_res.is_valid if standards_res else False,
            "errors": standards_res.errors if standards_res else [],
            "details": standards_res.details if standards_res else [],
        },
    }

    # Zero setting
    if zero_res:
        trace["zero_setting_evaluation"] = {
            "nominal_load": zero_res.nominal_load.to_dict(),
            "indicated_I0": zero_res.indicated_I0.to_dict(),
            "delta_L0": zero_res.delta_L0.to_dict(),
            "true_indication_P0": zero_res.true_indication_P0.to_dict(),
            "zero_error_E0": zero_res.zero_error_E0.to_dict(),
            "mpe_zero_setting": zero_res.mpe_zero_setting.to_dict(),
            "passed": zero_res.is_passed,
            "error_message": zero_res.error_message,
        }

    # Weighing performance test steps
    steps_list = []
    for s in step_results:
        steps_list.append({
            "step_number": s.step_number,
            "direction": s.direction,
            "nominal_load": s.nominal_load.to_dict(),
            "load_in_e": str(s.load_in_e),
            "indicated_I": s.indicated_I.to_dict(),
            "delta_L": s.delta_L.to_dict(),
            "true_indication_P": s.true_indication_P.to_dict(),
            "raw_error_E": s.raw_error_E.to_dict(),
            "corrected_error_Ec": s.corrected_error_Ec.to_dict(),
            "mpe_e": str(s.mpe_e),
            "mpe_mass": s.mpe_mass.to_dict(),
            "abs_error_within_mpe": s.is_within_mpe,
        })
    trace["weighing_performance_test"] = {
        "passed": all(s.is_within_mpe for s in step_results) if step_results else False,
        "steps": steps_list,
    }

    # Eccentricity
    if eccentricity_res:
        trace["eccentricity_test"] = {
            "test_load": eccentricity_res.test_load.to_dict(),
            "mpe_mass": eccentricity_res.mpe_mass.to_dict(),
            "passed": eccentricity_res.is_passed,
            "failure_reasons": eccentricity_res.failure_reasons,
            "positions": [
                {
                    "position": p.position,
                    "indicated_I": p.indicated_I.to_dict(),
                    "delta_L": p.delta_L.to_dict(),
                    "true_indication_P": p.true_indication_P.to_dict(),
                    "raw_error_E": p.raw_error_E.to_dict(),
                    "corrected_error_Ec": p.corrected_error_Ec.to_dict(),
                    "mpe_mass": p.mpe_mass.to_dict(),
                    "passed": p.is_within_mpe,
                }
                for p in eccentricity_res.positions
            ],
        }

    # Repeatability
    if repeatability_res:
        rep_data = []
        for r in repeatability_res:
            rep_data.append({
                "nominal_load": r.nominal_load.to_dict(),
                "runs_true_indication": [p.to_dict() for p in r.runs_true_indication_P],
                "min_P": r.min_P.to_dict(),
                "max_P": r.max_P.to_dict(),
                "spread_delta_P": r.spread_delta_P.to_dict(),
                "mpe_mass": r.mpe_mass.to_dict(),
                "passed": r.is_passed,
                "error_message": r.error_message,
            })
        trace["repeatability_test"] = {
            "passed": all(r.is_passed for r in repeatability_res),
            "series": rep_data,
        }

    # Tare
    if tare_res:
        trace["tare_test"] = {
            "tare_load": tare_res.tare_load.to_dict(),
            "net_load": tare_res.net_load.to_dict(),
            "indicated_I_net": tare_res.indicated_I_net.to_dict(),
            "delta_L_net": tare_res.delta_L_net.to_dict(),
            "true_net_P": tare_res.true_net_P.to_dict(),
            "net_error_E": tare_res.net_error_E.to_dict(),
            "mpe_mass": tare_res.mpe_mass.to_dict(),
            "passed": tare_res.is_passed,
            "error_message": tare_res.error_message,
        }

    # Overall verdict
    trace["overall_verdict"] = {
        "candidate_outcome": outcome.value,
        "is_passed": outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
        "failure_reasons": failure_reasons,
    }

    return trace
