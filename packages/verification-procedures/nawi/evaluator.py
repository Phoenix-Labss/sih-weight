"""Metrological evaluation engine for Non-Automatic Weighing Instruments (NAWI).

Implements deterministic evaluation algorithms under The Legal Metrology (General) Rules, 2011
(Seventh Schedule, Part II) and OIML R 76-1:
- True Indication turning point calculation: P = I + 0.5e - delta_L
- Zero error calculation: E0 = P0
- Corrected error: Ec = (P - L) - E0
- Weighing performance linearity
- 5-Position Eccentricity test
- Repeatability spread: delta_P <= |MPE(L)|
- Tare balancing and net weighing error
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from packages.measurement.decimal_math import (
    ExactDecimal,
    exact_abs,
    exact_decimal,
    exact_max,
    exact_min,
)
from packages.measurement.units import Quantity
from ..base import (
    AccuracyClassEnum,
    EccentricityPositionEnum,
    EccentricityTestObservation,
    InstrumentParameters,
    LinearityStepObservation,
    RepeatabilitySeriesObservation,
    StepEvaluationResult,
    TareObservation,
    VerificationTypeEnum,
    ZeroSettingObservation,
)
from .mpe import calculate_nawi_mpe, get_nawi_mpe_factor_in_e


@dataclass(frozen=True)
class ClassificationValidationResult:
    """Validation of instrument capacity envelope and interval count."""
    is_valid: bool
    n_intervals: ExactDecimal
    min_capacity_requirement: Quantity
    errors: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class ZeroEvaluationResult:
    """Outcome of zero-setting and turning point evaluation."""
    nominal_load: Quantity
    indicated_I0: Quantity
    delta_L0: Quantity
    true_indication_P0: Quantity
    zero_error_E0: Quantity
    mpe_zero_setting: Quantity
    is_passed: bool
    error_message: Optional[str] = None


@dataclass(frozen=True)
class EccentricityStepResult:
    """Result for a single eccentricity test position."""
    position: str
    indicated_I: Quantity
    delta_L: Quantity
    true_indication_P: Quantity
    raw_error_E: Quantity
    corrected_error_Ec: Quantity
    mpe_mass: Quantity
    is_within_mpe: bool


@dataclass(frozen=True)
class EccentricityEvaluationResult:
    """Complete eccentricity test evaluation."""
    test_load: Quantity
    mpe_mass: Quantity
    positions: List[EccentricityStepResult]
    is_passed: bool
    failure_reasons: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class RepeatabilitySeriesResult:
    """Result of a repeatability test series at a specific load."""
    nominal_load: Quantity
    runs_true_indication_P: List[Quantity]
    min_P: Quantity
    max_P: Quantity
    spread_delta_P: Quantity
    mpe_mass: Quantity
    is_passed: bool
    error_message: Optional[str] = None


@dataclass(frozen=True)
class TareEvaluationResult:
    """Evaluation of tare balancing and net load accuracy."""
    tare_load: Quantity
    net_load: Quantity
    indicated_I_net: Quantity
    delta_L_net: Quantity
    true_net_P: Quantity
    net_error_E: Quantity
    mpe_mass: Quantity
    is_passed: bool
    error_message: Optional[str] = None


class NAWIEvaluator:
    """Deterministic Metrological Evaluator for NAWI Class I, II, III, and IIII."""

    @classmethod
    def validate_classification(cls, instrument: InstrumentParameters) -> ClassificationValidationResult:
        """Validate whether instrument parameters comply with statutory classification envelope."""
        errors: List[str] = []
        e = instrument.verification_scale_interval_e
        max_cap = instrument.max_capacity.to_unit(e.unit)
        min_cap = instrument.min_capacity.to_unit(e.unit)

        n = ExactDecimal(max_cap.value / e.value)

        if instrument.accuracy_class == AccuracyClassEnum.CLASS_III:
            # Class III: 100 <= n <= 10,000, Min = 20e
            required_min_val = ExactDecimal("20") * e.value
            min_req = Quantity(required_min_val, e.unit)
            if n < ExactDecimal("100") or n > ExactDecimal("10000"):
                errors.append(
                    f"CLASS_III_INVALID_N: Scale interval count n={n} is outside permitted range [100, 10000]."
                )
            if min_cap.value < required_min_val:
                errors.append(
                    f"CLASS_III_INVALID_MIN: Minimum capacity {min_cap.value} {min_cap.unit} is below required Min=20e ({required_min_val} {e.unit})."
                )

        elif instrument.accuracy_class == AccuracyClassEnum.CLASS_IIII:
            # Class IIII: 100 <= n <= 1,000, Min = 10e
            required_min_val = ExactDecimal("10") * e.value
            min_req = Quantity(required_min_val, e.unit)
            if n < ExactDecimal("100") or n > ExactDecimal("1000"):
                errors.append(
                    f"CLASS_IIII_INVALID_N: Scale interval count n={n} is outside permitted range [100, 1000]."
                )
            if min_cap.value < required_min_val:
                errors.append(
                    f"CLASS_IIII_INVALID_MIN: Minimum capacity {min_cap.value} {min_cap.unit} is below required Min=10e ({required_min_val} {e.unit})."
                )

        else:
            required_min_val = ExactDecimal("10") * e.value
            min_req = Quantity(required_min_val, e.unit)

        return ClassificationValidationResult(
            is_valid=len(errors) == 0,
            n_intervals=n,
            min_capacity_requirement=min_req,
            errors=errors,
        )

    @classmethod
    def calculate_true_indication(
        cls,
        indicated_I: Quantity,
        delta_L: Quantity,
        e: Quantity,
    ) -> Quantity:
        """Compute turning point True Indication: P = I + 0.5e - delta_L.

        Args:
            indicated_I: Observed indication before adding delta_L.
            delta_L: Additional small weight added to reach turning point.
            e: Verification scale interval.

        Returns:
            True Indication P as a Quantity in unit of e.
        """
        unit = e.unit
        i_val = indicated_I.to_unit(unit).value
        dl_val = delta_L.to_unit(unit).value
        e_val = e.value

        half_e = ExactDecimal(e_val / ExactDecimal("2"))
        p_val = ExactDecimal(i_val + half_e - dl_val)
        return Quantity(p_val, unit)

    @classmethod
    def evaluate_zero_setting(
        cls,
        zero_obs: ZeroSettingObservation,
        e: Quantity,
    ) -> ZeroEvaluationResult:
        """Evaluate initial zero indication and error E0 = P0."""
        unit = e.unit
        nominal_zero = Quantity(ExactDecimal("0"), unit)
        p0 = cls.calculate_true_indication(zero_obs.indicated_I0, zero_obs.delta_L0, e)
        e0 = p0  # Zero error E0 = P0 - 0 = P0

        # Statutory zero setting tolerance: +/- 0.25e
        mpe_zero_val = ExactDecimal(ExactDecimal("0.25") * e.value)
        mpe_zero = Quantity(mpe_zero_val, unit)

        is_passed = exact_abs(e0.value) <= mpe_zero_val
        error_msg = None
        if not is_passed:
            error_msg = (
                f"ZERO_SETTING_OUT_OF_TOLERANCE: |E0|={exact_abs(e0.value)} {unit} exceeds "
                f"allowable +/- 0.25e ({mpe_zero_val} {unit})."
            )

        return ZeroEvaluationResult(
            nominal_load=nominal_zero,
            indicated_I0=zero_obs.indicated_I0.to_unit(unit),
            delta_L0=zero_obs.delta_L0.to_unit(unit),
            true_indication_P0=p0,
            zero_error_E0=e0,
            mpe_zero_setting=mpe_zero,
            is_passed=is_passed,
            error_message=error_msg,
        )

    @classmethod
    def evaluate_linearity_step(
        cls,
        step: LinearityStepObservation,
        e: Quantity,
        e0: Quantity,
        accuracy_class: AccuracyClassEnum,
        verification_type: VerificationTypeEnum,
    ) -> StepEvaluationResult:
        """Evaluate a single test load step in weighing performance test.

        Formulas:
        P = I + 0.5e - delta_L
        E = P - L
        Ec = E - E0
        Pass: |Ec| <= MPE(L)
        """
        unit = e.unit
        l_in_e_unit = step.nominal_load.to_unit(unit)
        p = cls.calculate_true_indication(step.indicated_I, step.delta_L, e)
        e_raw = Quantity(ExactDecimal(p.value - l_in_e_unit.value), unit)

        e0_in_unit = e0.to_unit(unit)
        ec = Quantity(ExactDecimal(e_raw.value - e0_in_unit.value), unit)

        load_in_e = ExactDecimal(l_in_e_unit.value / e.value)
        mpe_factor = get_nawi_mpe_factor_in_e(load_in_e, accuracy_class, verification_type)
        mpe_mass_val = ExactDecimal(mpe_factor * e.value)
        mpe_mass = Quantity(mpe_mass_val, unit)

        is_within_mpe = exact_abs(ec.value) <= mpe_mass_val

        return StepEvaluationResult(
            step_number=step.step_number,
            direction=step.direction.value,
            nominal_load=l_in_e_unit,
            load_in_e=load_in_e,
            indicated_I=step.indicated_I.to_unit(unit),
            delta_L=step.delta_L.to_unit(unit),
            true_indication_P=p,
            raw_error_E=e_raw,
            corrected_error_Ec=ec,
            mpe_e=mpe_factor,
            mpe_mass=mpe_mass,
            is_within_mpe=is_within_mpe,
        )

    @classmethod
    def evaluate_eccentricity_test(
        cls,
        ecc_obs: EccentricityTestObservation,
        e: Quantity,
        e0: Quantity,
        accuracy_class: AccuracyClassEnum,
        verification_type: VerificationTypeEnum,
    ) -> EccentricityEvaluationResult:
        """Evaluate off-center loading test across 5 positions."""
        unit = e.unit
        test_load = ecc_obs.test_load.to_unit(unit)
        mpe = calculate_nawi_mpe(test_load, e, accuracy_class, verification_type)

        positions_results: List[EccentricityStepResult] = []
        failure_reasons: List[str] = []
        is_all_passed = True

        for pos_obs in ecc_obs.positions:
            p = cls.calculate_true_indication(pos_obs.indicated_I, pos_obs.delta_L, e)
            e_raw = Quantity(ExactDecimal(p.value - test_load.value), unit)
            ec = Quantity(ExactDecimal(e_raw.value - e0.to_unit(unit).value), unit)
            is_within = exact_abs(ec.value) <= mpe.value

            if not is_within:
                is_all_passed = False
                failure_reasons.append(
                    f"ECCENTRICITY_ERROR_EXCEEDED: Position '{pos_obs.position.value}' error "
                    f"Ec={ec.value} {unit} exceeds MPE ({mpe.value} {unit})."
                )

            positions_results.append(
                EccentricityStepResult(
                    position=pos_obs.position.value,
                    indicated_I=pos_obs.indicated_I.to_unit(unit),
                    delta_L=pos_obs.delta_L.to_unit(unit),
                    true_indication_P=p,
                    raw_error_E=e_raw,
                    corrected_error_Ec=ec,
                    mpe_mass=mpe,
                    is_within_mpe=is_within,
                )
            )

        return EccentricityEvaluationResult(
            test_load=test_load,
            mpe_mass=mpe,
            positions=positions_results,
            is_passed=is_all_passed,
            failure_reasons=failure_reasons,
        )

    @classmethod
    def evaluate_repeatability_series(
        cls,
        series_obs: RepeatabilitySeriesObservation,
        e: Quantity,
        accuracy_class: AccuracyClassEnum,
        verification_type: VerificationTypeEnum,
    ) -> RepeatabilitySeriesResult:
        """Evaluate reproducibility across repeated weighings: delta_P <= |MPE(L)|."""
        unit = e.unit
        nominal_load = series_obs.nominal_load.to_unit(unit)
        mpe = calculate_nawi_mpe(nominal_load, e, accuracy_class, verification_type)

        p_list: List[Quantity] = []
        for run in series_obs.runs:
            p = cls.calculate_true_indication(run.indicated_I, run.delta_L, e)
            p_list.append(p)

        if not p_list:
            raise ValueError("Repeatability series has no runs.")

        p_values = [p.value for p in p_list]
        min_p_val = exact_min(*p_values)
        max_p_val = exact_max(*p_values)
        spread_val = ExactDecimal(max_p_val - min_p_val)

        is_passed = spread_val <= mpe.value
        error_msg = None
        if not is_passed:
            error_msg = (
                f"REPEATABILITY_SPREAD_EXCEEDED: Load {nominal_load.value} {unit} spread "
                f"delta_P={spread_val} {unit} exceeds MPE ({mpe.value} {unit})."
            )

        return RepeatabilitySeriesResult(
            nominal_load=nominal_load,
            runs_true_indication_P=p_list,
            min_P=Quantity(min_p_val, unit),
            max_P=Quantity(max_p_val, unit),
            spread_delta_P=Quantity(spread_val, unit),
            mpe_mass=mpe,
            is_passed=is_passed,
            error_message=error_msg,
        )

    @classmethod
    def evaluate_tare(
        cls,
        tare_obs: TareObservation,
        e: Quantity,
        accuracy_class: AccuracyClassEnum,
        verification_type: VerificationTypeEnum,
    ) -> TareEvaluationResult:
        """Evaluate tare balancing and net weighing error."""
        unit = e.unit
        net_load = tare_obs.net_load.to_unit(unit)
        tare_load = tare_obs.tare_load.to_unit(unit)
        mpe = calculate_nawi_mpe(net_load, e, accuracy_class, verification_type)

        p_net = cls.calculate_true_indication(tare_obs.indicated_I_net, tare_obs.delta_L_net, e)
        e_net = Quantity(ExactDecimal(p_net.value - net_load.value), unit)

        is_passed = exact_abs(e_net.value) <= mpe.value
        error_msg = None
        if not is_passed:
            error_msg = (
                f"TARE_NET_ERROR_EXCEEDED: Net load {net_load.value} {unit} error "
                f"E_net={e_net.value} {unit} exceeds MPE ({mpe.value} {unit})."
            )

        return TareEvaluationResult(
            tare_load=tare_load,
            net_load=net_load,
            indicated_I_net=tare_obs.indicated_I_net.to_unit(unit),
            delta_L_net=tare_obs.delta_L_net.to_unit(unit),
            true_net_P=p_net,
            net_error_E=e_net,
            mpe_mass=mpe,
            is_passed=is_passed,
            error_message=error_msg,
        )
