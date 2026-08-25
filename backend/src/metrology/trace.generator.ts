import crypto from 'node:crypto';
import { NawiEvaluationResult, InstrumentSpecs } from './nawi.evaluator.js';

export interface CanonicalTraceDocument {
  $schema: string;
  trace_id: string;
  procedure_pack_id: string;
  procedure_pack_checksum: string;
  evaluated_at_utc: string;
  instrument_parameters: {
    accuracy_class: string;
    scale_interval_e: string;
    min_capacity?: string;
    max_capacity?: string;
    unit?: string;
  };
  zero_setting: {
    zero_error_applied: string;
    passed: boolean;
  };
  steps: Array<{
    sequence: number;
    step_type: string;
    nominal_load: string;
    load_unit: string;
    raw_indication: string;
    normalized_indication: string;
    observed_error: string;
    corrected_error: string;
    mpe_allowed: string;
    is_within_mpe: boolean;
    eccentricity_position?: string;
    repetition_index?: number;
  }>;
  summary: {
    total_steps: number;
    eccentricity_passed: boolean;
    repeatability_passed: boolean;
    tare_passed: boolean;
    overall_passed: boolean;
    failure_reasons: string[];
  };
}

/**
 * Generates a deterministic canonical calculation trace JSON conforming to
 * statutory schema 'https://legalmetrology.gov.in/schemas/v1/nawi-evaluation-trace.json'
 */
export function generateNawiCalculationTrace(
  procedurePackId: string,
  procedurePackChecksum: string,
  specs: InstrumentSpecs,
  evaluationResult: NawiEvaluationResult,
  timestamp: Date | string = new Date()
): CanonicalTraceDocument {
  const dateStr = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();

  const stepsData = evaluationResult.observations.map((obs) => ({
    sequence: obs.step_sequence,
    step_type: obs.step_type,
    nominal_load: obs.nominal_load.toString(),
    load_unit: obs.load_unit,
    raw_indication: obs.raw_indication_reading.toString(),
    normalized_indication: obs.normalized_indication.toString(),
    observed_error: obs.observed_error.toString(),
    corrected_error: obs.corrected_error.toString(),
    mpe_allowed: obs.mpe_allowed.toString(),
    is_within_mpe: obs.is_within_mpe,
    eccentricity_position: obs.eccentricity_position,
    repetition_index: obs.repetition_index,
  }));

  // Deterministic seed for trace_id
  const seedString = `${procedurePackId}:${procedurePackChecksum}:${specs.accuracy_class}:${specs.verification_scale_interval_e}:${stepsData.length}:${evaluationResult.passed}`;
  const traceId = crypto.createHash('sha256').update(seedString).digest('hex').slice(0, 32);

  return {
    $schema: 'https://legalmetrology.gov.in/schemas/v1/nawi-evaluation-trace.json',
    trace_id: `trace-${traceId}`,
    procedure_pack_id: procedurePackId,
    procedure_pack_checksum: procedurePackChecksum,
    evaluated_at_utc: dateStr,
    instrument_parameters: {
      accuracy_class: String(specs.accuracy_class),
      scale_interval_e: String(specs.verification_scale_interval_e),
      min_capacity: specs.min_capacity !== undefined ? String(specs.min_capacity) : undefined,
      max_capacity: specs.max_capacity !== undefined ? String(specs.max_capacity) : undefined,
      unit: specs.unit || 'kg',
    },
    zero_setting: {
      zero_error_applied: evaluationResult.zeroError.toString(),
      passed: evaluationResult.zeroPassed,
    },
    steps: stepsData,
    summary: {
      total_steps: stepsData.length,
      eccentricity_passed: evaluationResult.eccentricityPassed,
      repeatability_passed: evaluationResult.repeatabilityPassed,
      tare_passed: evaluationResult.tarePassed,
      overall_passed: evaluationResult.passed,
      failure_reasons: evaluationResult.failureReasons,
    },
  };
}
