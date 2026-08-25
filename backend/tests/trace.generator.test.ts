import { describe, it, expect } from 'vitest';
import { generateNawiCalculationTrace } from '../src/metrology/trace.generator.js';
import { evaluateNawiSession, InstrumentSpecs, ObservationInput } from '../src/metrology/nawi.evaluator.js';

describe('Deterministic Calculation Trace Generator', () => {
  const specs: InstrumentSpecs = {
    accuracy_class: 'CLASS_III',
    verification_scale_interval_e: '0.005',
    max_capacity: '30.0',
    min_capacity: '0.1',
    unit: 'kg',
  };

  const observations: ObservationInput[] = [
    { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: 0, raw_indication_reading: 0, delta_L: 0.0025 },
    { step_type: 'INCREASING_LOAD', step_sequence: 2, nominal_load: 2.5, raw_indication_reading: 2.501, delta_L: 0.0025 },
    { step_type: 'INCREASING_LOAD', step_sequence: 3, nominal_load: 10, raw_indication_reading: 10.002, delta_L: 0.0025 },
  ];

  it('should generate canonical trace matching statutory schema', () => {
    const evalResult = evaluateNawiSession(specs, observations, true);
    const trace = generateNawiCalculationTrace(
      'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      specs,
      evalResult,
      '2026-08-25T12:00:00.000Z'
    );

    expect(trace.$schema).toBe('https://legalmetrology.gov.in/schemas/v1/nawi-evaluation-trace.json');
    expect(trace.trace_id).toMatch(/^trace-[a-f0-9]{32}$/);
    expect(trace.procedure_pack_id).toBe('IND-LM-NAWI-CLASS-III-IIII-2026.1');
    expect(trace.instrument_parameters.accuracy_class).toBe('CLASS_III');
    expect(trace.steps).toHaveLength(3);
    expect(trace.summary.overall_passed).toBe(true);
  });

  it('should produce identical trace ID for identical inputs', () => {
    const evalResult = evaluateNawiSession(specs, observations, true);
    const trace1 = generateNawiCalculationTrace(
      'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      'checksum123',
      specs,
      evalResult,
      '2026-08-25T12:00:00.000Z'
    );
    const trace2 = generateNawiCalculationTrace(
      'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      'checksum123',
      specs,
      evalResult,
      '2026-08-25T12:00:00.000Z'
    );

    expect(trace1.trace_id).toBe(trace2.trace_id);
  });
});
