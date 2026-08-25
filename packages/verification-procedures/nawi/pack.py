"""NAWI Procedure Pack implementation for Class III and Class IIII instruments.

Implements statutory verification workflows under The Legal Metrology Act, 2009 and
The Legal Metrology (General) Rules, 2011 (Seventh Schedule, Part II).
"""

from __future__ import annotations

from typing import List, Optional

from ..base import (
    AccuracyClassEnum,
    BaseProcedurePack,
    EvaluationResult,
    SessionEvaluationInput,
    StepEvaluationResult,
    VerificationOutcomeEnum,
)
from .evaluator import (
    ClassificationValidationResult,
    EccentricityEvaluationResult,
    NAWIEvaluator,
    RepeatabilitySeriesResult,
    TareEvaluationResult,
    ZeroEvaluationResult,
)
from .trace import generate_nawi_calculation_trace
from ..reference_standards.validator import (
    ReferenceStandardValidator,
    StandardValidationResult,
)


class NAWIProcedurePack(BaseProcedurePack):
    """Statutory Procedure Pack for Non-Automatic Weighing Instruments (Class III and Class IIII)."""

    @property
    def pack_id(self) -> str:
        return "IND-LM-NAWI-CLASS-III-IIII-2026.1"

    @property
    def version(self) -> str:
        return "1.0.0"

    @property
    def name(self) -> str:
        return "Non-Automatic Weighing Instruments (NAWI) Procedure Pack (Class III & IIII)"

    @property
    def legal_source_ref(self) -> str:
        return "The Legal Metrology (General) Rules, 2011, Seventh Schedule, Part II"

    @property
    def source_checksum_sha256(self) -> str:
        return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    def evaluate_session(self, session_input: SessionEvaluationInput) -> EvaluationResult:
        """Execute complete, deterministic statutory evaluation of a verification session."""
        failure_reasons: List[str] = []
        fatal_errors: List[str] = []

        # 1. Classification Envelope Validation
        classification_res = NAWIEvaluator.validate_classification(session_input.instrument)
        if not classification_res.is_valid:
            failure_reasons.extend(classification_res.errors)

        # 2. Reference Standards Validation (Fail-Closed)
        standards_res: Optional[StandardValidationResult] = None
        if session_input.reference_standards:
            standards_res = ReferenceStandardValidator.validate_standards(
                standards=session_input.reference_standards,
                instrument=session_input.instrument,
                test_timestamp=session_input.test_timestamp,
                verification_type=session_input.verification_type,
            )
            if not standards_res.is_valid:
                failure_reasons.extend(standards_res.errors)
        else:
            fatal_errors.append("NO_REFERENCE_STANDARDS: Session contains no reference standards.")
            failure_reasons.append("NO_REFERENCE_STANDARDS: Verification requires certified reference standards.")

        # 3. Zero Setting Evaluation
        e = session_input.instrument.verification_scale_interval_e
        zero_res: Optional[ZeroEvaluationResult] = None
        try:
            zero_res = NAWIEvaluator.evaluate_zero_setting(session_input.zero_setting, e)
            if not zero_res.is_passed and zero_res.error_message:
                failure_reasons.append(zero_res.error_message)
        except Exception as exc:
            fatal_errors.append(f"ZERO_EVALUATION_ERROR: {exc}")
            failure_reasons.append(f"ZERO_EVALUATION_ERROR: {exc}")

        e0 = zero_res.zero_error_E0 if zero_res else session_input.zero_setting.indicated_I0

        # 4. Weighing Performance Linearity Steps
        step_results: List[StepEvaluationResult] = []
        for step_obs in session_input.linearity_steps:
            step_res = NAWIEvaluator.evaluate_linearity_step(
                step=step_obs,
                e=e,
                e0=e0,
                accuracy_class=session_input.instrument.accuracy_class,
                verification_type=session_input.verification_type,
            )
            step_results.append(step_res)
            if not step_res.is_within_mpe:
                failure_reasons.append(
                    f"STEP_{step_res.step_number}_MPE_EXCEEDED: At load {step_res.nominal_load.value} {step_res.nominal_load.unit}, "
                    f"error Ec={step_res.corrected_error_Ec.value} {step_res.corrected_error_Ec.unit} exceeds "
                    f"MPE (+/- {step_res.mpe_mass.value} {step_res.mpe_mass.unit})."
                )

        # 5. Eccentricity Test (if conducted)
        eccentricity_res: Optional[EccentricityEvaluationResult] = None
        if session_input.eccentricity:
            eccentricity_res = NAWIEvaluator.evaluate_eccentricity_test(
                ecc_obs=session_input.eccentricity,
                e=e,
                e0=e0,
                accuracy_class=session_input.instrument.accuracy_class,
                verification_type=session_input.verification_type,
            )
            if not eccentricity_res.is_passed:
                failure_reasons.extend(eccentricity_res.failure_reasons)

        # 6. Repeatability Test (if conducted)
        repeatability_res: Optional[List[RepeatabilitySeriesResult]] = None
        if session_input.repeatability:
            repeatability_res = []
            for rep_series in session_input.repeatability:
                rep_res = NAWIEvaluator.evaluate_repeatability_series(
                    series_obs=rep_series,
                    e=e,
                    accuracy_class=session_input.instrument.accuracy_class,
                    verification_type=session_input.verification_type,
                )
                repeatability_res.append(rep_res)
                if not rep_res.is_passed and rep_res.error_message:
                    failure_reasons.append(rep_res.error_message)

        # 7. Tare Test (if conducted)
        tare_res: Optional[TareEvaluationResult] = None
        if session_input.tare:
            tare_res = NAWIEvaluator.evaluate_tare(
                tare_obs=session_input.tare,
                e=e,
                accuracy_class=session_input.instrument.accuracy_class,
                verification_type=session_input.verification_type,
            )
            if not tare_res.is_passed and tare_res.error_message:
                failure_reasons.append(tare_res.error_message)

        # 8. Determine Authoritative Outcome
        if not classification_res.is_valid:
            candidate_outcome = VerificationOutcomeEnum.OUTSIDE_AUTHORIZATION_SCOPE
        elif standards_res and not standards_res.is_valid:
            if any("INCOMPATIBLE_STANDARD_CLASS" in err for err in standards_res.errors):
                candidate_outcome = VerificationOutcomeEnum.OUTSIDE_AUTHORIZATION_SCOPE
            else:
                candidate_outcome = VerificationOutcomeEnum.INCOMPLETE_VERIFICATION
        elif fatal_errors:
            candidate_outcome = VerificationOutcomeEnum.INCOMPLETE_VERIFICATION
        elif failure_reasons:
            candidate_outcome = VerificationOutcomeEnum.VERIFICATION_FAILED
        else:
            candidate_outcome = VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION

        is_passed = candidate_outcome == VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION

        # 9. Generate Deterministic Trace
        trace = generate_nawi_calculation_trace(
            pack=self,
            session_input=session_input,
            classification_res=classification_res,
            standards_res=standards_res,
            zero_res=zero_res,
            step_results=step_results,
            eccentricity_res=eccentricity_res,
            repeatability_res=repeatability_res,
            tare_res=tare_res,
            outcome=candidate_outcome,
            failure_reasons=failure_reasons,
        )

        return EvaluationResult(
            is_passed=is_passed,
            candidate_outcome=candidate_outcome,
            failure_reasons=failure_reasons,
            calculation_trace=trace,
            errors=fatal_errors,
        )
