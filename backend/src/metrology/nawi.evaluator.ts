import { Decimal, exactDecimal, MetrologyDomainError } from '../core/decimal.js';
import { AccuracyClassEnum, StepTypeEnum } from '../core/types.js';
import { calculateNawiMpe } from './mpe.js';

export interface ObservationInput {
  step_type: StepTypeEnum | string;
  step_sequence: number;
  nominal_load: Decimal | string | number;
  load_unit?: string;
  raw_indication_reading: Decimal | string | number;
  reading_unit?: string;
  delta_L?: Decimal | string | number;
  repetition_index?: number;
  eccentricity_position?: string;
}

export interface StepEvaluationTrace {
  formula: string;
  I: string;
  e: string;
  delta_L: string;
  P: string;
  L: string;
  E: string;
  E_0: string;
  E_c: string;
  MPE: string;
  is_within_mpe: boolean;
  notes?: string;
}

export interface EvaluatedObservation {
  step_type: StepTypeEnum;
  step_sequence: number;
  nominal_load: Decimal;
  load_unit: string;
  raw_indication_reading: Decimal;
  normalized_indication: Decimal;
  reading_unit: string;
  observed_error: Decimal;
  corrected_error: Decimal;
  mpe_allowed: Decimal;
  is_within_mpe: boolean;
  repetition_index: number;
  eccentricity_position?: string;
  calculation_trace: StepEvaluationTrace;
}

export interface NawiEvaluationResult {
  passed: boolean;
  zeroError: Decimal;
  zeroPassed: boolean;
  observations: EvaluatedObservation[];
  eccentricityPassed: boolean;
  eccentricityMaxError?: Decimal;
  repeatabilityPassed: boolean;
  repeatabilityMaxSpread?: Decimal;
  tarePassed: boolean;
  failureReasons: string[];
}

export interface InstrumentSpecs {
  accuracy_class: AccuracyClassEnum | string;
  verification_scale_interval_e: Decimal | string | number;
  min_capacity?: Decimal | string | number;
  max_capacity?: Decimal | string | number;
  unit?: string;
}

/**
 * Calculates true continuous indication P using turning-point method:
 * P = I + 0.5e - ΔL
 */
export function calculateTrueIndication(
  indication: Decimal | string | number,
  scaleIntervalE: Decimal | string | number,
  deltaL?: Decimal | string | number
): Decimal {
  const I = exactDecimal(indication);
  const e = exactDecimal(scaleIntervalE);
  // Default delta_L to 0.5e if omitted
  const dL = deltaL !== undefined ? exactDecimal(deltaL) : e.times('0.5');

  // P = I + 0.5e - delta_L
  return I.plus(e.times('0.5')).minus(dL);
}

/**
 * Calculates Zero Setting Error E_0 and checks if |E_0| <= 0.25e
 */
export function calculateZeroError(
  indication: Decimal | string | number,
  scaleIntervalE: Decimal | string | number,
  deltaL?: Decimal | string | number
): { P0: Decimal; E0: Decimal; isWithinZeroTolerance: boolean; maxAllowedZeroError: Decimal } {
  const e = exactDecimal(scaleIntervalE);
  const P0 = calculateTrueIndication(indication, e, deltaL);
  const E0 = P0; // E_0 = P_0 - 0 = P_0
  const maxAllowedZeroError = e.times('0.25');
  const isWithinZeroTolerance = E0.abs().lessThanOrEqualTo(maxAllowedZeroError);

  return {
    P0,
    E0,
    isWithinZeroTolerance,
    maxAllowedZeroError,
  };
}

/**
 * Evaluates a single NAWI observation step against statutory MPE
 */
export function evaluateStepObservation(
  input: ObservationInput,
  scaleIntervalE: Decimal | string | number,
  accuracyClass: AccuracyClassEnum | string,
  zeroError: Decimal | string | number = '0.0',
  isInitialVerification = true
): EvaluatedObservation {
  const e = exactDecimal(scaleIntervalE);
  const L = exactDecimal(input.nominal_load);
  const I = exactDecimal(input.raw_indication_reading);
  const E0 = exactDecimal(zeroError);
  const deltaL = input.delta_L !== undefined ? exactDecimal(input.delta_L) : e.times('0.5');
  const stepType = input.step_type as StepTypeEnum;

  // 1. True Indication P = I + 0.5e - ΔL
  const P = calculateTrueIndication(I, e, deltaL);

  // 2. Observed Raw Error E = P - L
  const E = P.minus(L);

  // 3. Corrected Error E_c = E - E_0
  const Ec = E.minus(E0);

  // 4. Statutory MPE limit for load L
  const mpeResult = calculateNawiMpe(L, e, accuracyClass, isInitialVerification);
  const mpeAllowed = mpeResult.mpeInMass;

  // 5. Compliance check: |E_c| <= MPE (or for ZERO_TEST: |E_0| <= 0.25e)
  let isWithinMpe: boolean;
  if (stepType === 'ZERO_TEST') {
    const zeroTol = e.times('0.25');
    isWithinMpe = E0.abs().lessThanOrEqualTo(zeroTol);
  } else {
    isWithinMpe = Ec.abs().lessThanOrEqualTo(mpeAllowed);
  }

  const trace: StepEvaluationTrace = {
    formula: 'P = I + 0.5e - ΔL; E = P - L; E_c = E - E_0; |E_c| <= MPE',
    I: I.toString(),
    e: e.toString(),
    delta_L: deltaL.toString(),
    P: P.toString(),
    L: L.toString(),
    E: E.toString(),
    E_0: E0.toString(),
    E_c: Ec.toString(),
    MPE: mpeAllowed.toString(),
    is_within_mpe: isWithinMpe,
  };

  return {
    step_type: stepType,
    step_sequence: input.step_sequence,
    nominal_load: L,
    load_unit: input.load_unit || 'kg',
    raw_indication_reading: I,
    normalized_indication: P,
    reading_unit: input.reading_unit || 'kg',
    observed_error: E,
    corrected_error: Ec,
    mpe_allowed: mpeAllowed,
    is_within_mpe: isWithinMpe,
    repetition_index: input.repetition_index || 1,
    eccentricity_position: input.eccentricity_position,
    calculation_trace: trace,
  };
}

/**
 * Complete NAWI Session Evaluator:
 * Processes zero setting, linearity steps, 5-position eccentricity, repeatability spread, and tare tests.
 */
export function evaluateNawiSession(
  specs: InstrumentSpecs,
  rawObservations: ObservationInput[],
  isInitialVerification = true
): NawiEvaluationResult {
  const e = exactDecimal(specs.verification_scale_interval_e);
  const failureReasons: string[] = [];

  // 1. Identify Zero Test observation (if any) to establish E_0
  const zeroObs = rawObservations.find((o) => o.step_type === 'ZERO_TEST');
  let zeroError = exactDecimal('0.0');
  let zeroPassed = true;

  if (zeroObs) {
    const zeroRes = calculateZeroError(zeroObs.raw_indication_reading, e, zeroObs.delta_L);
    zeroError = zeroRes.E0;
    zeroPassed = zeroRes.isWithinZeroTolerance;
    if (!zeroPassed) {
      failureReasons.push(
        `Zero-setting error E_0 (${zeroError.toString()}) exceeds statutory limit (0.25e = ${zeroRes.maxAllowedZeroError.toString()})`
      );
    }
  }

  // 2. Evaluate all individual observations
  const evaluatedObservations: EvaluatedObservation[] = rawObservations.map((obs) => {
    return evaluateStepObservation(obs, e, specs.accuracy_class, zeroError, isInitialVerification);
  });

  // Check individual step failures (excluding zero test, handled above)
  for (const evaluated of evaluatedObservations) {
    if (!evaluated.is_within_mpe) {
      failureReasons.push(
        `Step ${evaluated.step_sequence} (${evaluated.step_type}) failed: Corrected error E_c=${evaluated.corrected_error.toString()} exceeds MPE=${evaluated.mpe_allowed.toString()}`
      );
    }
  }

  // 3. Evaluate Eccentricity (Corner Load) Test
  const eccObservations = evaluatedObservations.filter((o) => o.step_type === 'ECCENTRICITY');
  let eccentricityPassed = true;
  let eccentricityMaxError = exactDecimal('0.0');

  if (eccObservations.length > 0) {
    for (const ecc of eccObservations) {
      const errAbs = ecc.corrected_error.abs();
      if (errAbs.greaterThan(eccentricityMaxError)) {
        eccentricityMaxError = errAbs;
      }
      if (!ecc.is_within_mpe) {
        eccentricityPassed = false;
        failureReasons.push(
          `Eccentricity position '${ecc.eccentricity_position || 'UNKNOWN'}' error (${ecc.corrected_error.toString()}) exceeds MPE (${ecc.mpe_allowed.toString()})`
        );
      }
    }
  }

  // 4. Evaluate Repeatability (Spread) Test across series
  const repObservations = evaluatedObservations.filter((o) => o.step_type === 'REPEATABILITY');
  let repeatabilityPassed = true;
  let repeatabilityMaxSpread = exactDecimal('0.0');

  if (repObservations.length >= 2) {
    // Group repeatability tests by nominal load if multiple loads tested
    const loadsMap = new Map<string, EvaluatedObservation[]>();
    for (const rep of repObservations) {
      const key = rep.nominal_load.toString();
      const list = loadsMap.get(key) || [];
      list.push(rep);
      loadsMap.set(key, list);
    }

    for (const [loadStr, list] of loadsMap.entries()) {
      if (list.length >= 2) {
        let pMax = list[0].normalized_indication;
        let pMin = list[0].normalized_indication;
        for (const item of list) {
          if (item.normalized_indication.greaterThan(pMax)) {
            pMax = item.normalized_indication;
          }
          if (item.normalized_indication.lessThan(pMin)) {
            pMin = item.normalized_indication;
          }
        }
        const spread = pMax.minus(pMin);
        if (spread.greaterThan(repeatabilityMaxSpread)) {
          repeatabilityMaxSpread = spread;
        }
        const mpe = list[0].mpe_allowed;
        if (spread.greaterThan(mpe)) {
          repeatabilityPassed = false;
          failureReasons.push(
            `Repeatability spread (ΔP = ${spread.toString()}) at load ${loadStr} exceeds MPE (${mpe.toString()})`
          );
        }
      }
    }
  }

  // 5. Evaluate Tare Tests
  const tareObservations = evaluatedObservations.filter((o) => o.step_type === 'TARE_TEST');
  let tarePassed = true;
  for (const tare of tareObservations) {
    if (!tare.is_within_mpe) {
      tarePassed = false;
      failureReasons.push(
        `Tare net test error (${tare.corrected_error.toString()}) exceeds MPE (${tare.mpe_allowed.toString()})`
      );
    }
  }

  const overallPassed =
    zeroPassed &&
    evaluatedObservations.every((o) => o.is_within_mpe) &&
    eccentricityPassed &&
    repeatabilityPassed &&
    tarePassed;

  return {
    passed: overallPassed,
    zeroError,
    zeroPassed,
    observations: evaluatedObservations,
    eccentricityPassed,
    eccentricityMaxError,
    repeatabilityPassed,
    repeatabilityMaxSpread,
    tarePassed,
    failureReasons,
  };
}
