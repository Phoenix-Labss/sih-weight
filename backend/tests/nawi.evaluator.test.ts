import { describe, it, expect } from 'vitest';
import {
  calculateTrueIndication,
  calculateZeroError,
  evaluateStepObservation,
  evaluateNawiSession,
  InstrumentSpecs,
  ObservationInput,
} from '../src/metrology/nawi.evaluator.js';
import { exactDecimal } from '../src/core/decimal.js';

describe('NAWI Evaluator (Turning Point, Error, Eccentricity, Repeatability, Tare)', () => {
  const e = exactDecimal('0.005'); // 5g = 0.005kg

  describe('Turning Point & Continuous Indication P = I + 0.5e - ΔL', () => {
    it('should calculate true indication P accurately', () => {
      // If I = 10.000kg, delta_L = 0.0025kg (= 0.5e) => P = 10.000 + 0.0025 - 0.0025 = 10.000kg
      const P1 = calculateTrueIndication('10.000', e, '0.0025');
      expect(P1.toString()).toBe('10');

      // If I = 10.000kg, delta_L = 0.0010kg => P = 10.000 + 0.0025 - 0.0010 = 10.0015kg
      const P2 = calculateTrueIndication('10.000', e, '0.0010');
      expect(P2.toString()).toBe('10.0015');
    });

    it('should calculate zero setting error E_0 and enforce |E_0| <= 0.25e', () => {
      // 0.25e = 0.00125kg
      // If I_0 = 0.000kg, delta_L = 0.0020kg => E_0 = 0 + 0.0025 - 0.0020 = +0.0005kg (<= 0.00125 => PASS)
      const resPass = calculateZeroError('0.000', e, '0.0020');
      expect(resPass.E0.toString()).toBe('0.0005');
      expect(resPass.isWithinZeroTolerance).toBe(true);

      // If I_0 = 0.000kg, delta_L = 0.0005kg => E_0 = +0.0020kg (> 0.00125 => FAIL)
      const resFail = calculateZeroError('0.000', e, '0.0005');
      expect(resFail.E0.toString()).toBe('0.002');
      expect(resFail.isWithinZeroTolerance).toBe(false);
    });
  });

  describe('Corrected Error Linearity Evaluation Ec = (P - L) - E_0', () => {
    it('should evaluate step observation against MPE', () => {
      const step: ObservationInput = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 2,
        nominal_load: '2.5', // m = 500 => MPE = 0.5e = 0.0025kg
        raw_indication_reading: '2.501',
        delta_L: '0.0025',
      };
      // P = 2.501 + 0.0025 - 0.0025 = 2.501
      // E = 2.501 - 2.5 = +0.001kg
      // If E_0 = 0 => Ec = +0.001kg <= 0.0025kg => PASS
      const res = evaluateStepObservation(step, e, 'CLASS_III', '0.0', true);
      expect(res.observed_error.toString()).toBe('0.001');
      expect(res.corrected_error.toString()).toBe('0.001');
      expect(res.is_within_mpe).toBe(true);
      expect(res.mpe_allowed.toString()).toBe('0.0025');
    });

    it('should fail step observation when corrected error exceeds MPE', () => {
      const step: ObservationInput = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 3,
        nominal_load: '2.5',
        raw_indication_reading: '2.504',
        delta_L: '0.0025',
      };
      // P = 2.504, E = +0.004kg > MPE 0.0025kg => FAIL
      const res = evaluateStepObservation(step, e, 'CLASS_III', '0.0', true);
      expect(res.corrected_error.toString()).toBe('0.004');
      expect(res.is_within_mpe).toBe(false);
    });
  });

  describe('5-Position Eccentricity Evaluation', () => {
    const specs: InstrumentSpecs = {
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: '0.005',
      max_capacity: '30.0',
      min_capacity: '0.1',
    };

    it('should pass when all 5 corner positions are within MPE', () => {
      const obs: ObservationInput[] = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: 0, raw_indication_reading: 0, delta_L: 0.0025 },
        { step_type: 'ECCENTRICITY', step_sequence: 2, nominal_load: 10, raw_indication_reading: 10.001, eccentricity_position: 'CENTER', delta_L: 0.0025 },
        { step_type: 'ECCENTRICITY', step_sequence: 3, nominal_load: 10, raw_indication_reading: 10.002, eccentricity_position: 'FRONT_LEFT', delta_L: 0.0025 },
        { step_type: 'ECCENTRICITY', step_sequence: 4, nominal_load: 10, raw_indication_reading: 10.001, eccentricity_position: 'FRONT_RIGHT', delta_L: 0.0025 },
        { step_type: 'ECCENTRICITY', step_sequence: 5, nominal_load: 10, raw_indication_reading: 10.002, eccentricity_position: 'BACK_RIGHT', delta_L: 0.0025 },
        { step_type: 'ECCENTRICITY', step_sequence: 6, nominal_load: 10, raw_indication_reading: 10.001, eccentricity_position: 'BACK_LEFT', delta_L: 0.0025 },
      ];

      const res = evaluateNawiSession(specs, obs, true);
      expect(res.passed).toBe(true);
      expect(res.eccentricityPassed).toBe(true);
    });

    it('should fail when any corner position exceeds MPE', () => {
      const obs: ObservationInput[] = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: 0, raw_indication_reading: 0, delta_L: 0.0025 },
        { step_type: 'ECCENTRICITY', step_sequence: 2, nominal_load: 10, raw_indication_reading: 10.001, eccentricity_position: 'CENTER', delta_L: 0.0025 },
        { step_type: 'ECCENTRICITY', step_sequence: 3, nominal_load: 10, raw_indication_reading: 10.008, eccentricity_position: 'FRONT_LEFT', delta_L: 0.0025 }, // MPE is 0.005kg, error is 0.008kg => FAIL
      ];

      const res = evaluateNawiSession(specs, obs, true);
      expect(res.passed).toBe(false);
      expect(res.eccentricityPassed).toBe(false);
      expect(res.failureReasons.length).toBeGreaterThan(0);
    });
  });

  describe('Repeatability (Spread) Evaluation (ΔP <= MPE)', () => {
    const specs: InstrumentSpecs = {
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: '0.005',
      max_capacity: '30.0',
    };

    it('should pass when spread ΔP <= MPE across >= 3 runs', () => {
      // At L = 15kg, MPE = 0.0075kg
      // Runs: P1 = 15.001, P2 = 15.003, P3 = 15.002 => spread = 0.002kg <= 0.0075kg => PASS
      const obs: ObservationInput[] = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: 0, raw_indication_reading: 0, delta_L: 0.0025 },
        { step_type: 'REPEATABILITY', step_sequence: 2, nominal_load: 15, raw_indication_reading: 15.001, repetition_index: 1, delta_L: 0.0025 },
        { step_type: 'REPEATABILITY', step_sequence: 3, nominal_load: 15, raw_indication_reading: 15.003, repetition_index: 2, delta_L: 0.0025 },
        { step_type: 'REPEATABILITY', step_sequence: 4, nominal_load: 15, raw_indication_reading: 15.002, repetition_index: 3, delta_L: 0.0025 },
      ];

      const res = evaluateNawiSession(specs, obs, true);
      expect(res.passed).toBe(true);
      expect(res.repeatabilityPassed).toBe(true);
    });

    it('should fail when spread ΔP > MPE across repeated runs', () => {
      // Runs: P1 = 15.000, P2 = 15.009, P3 = 15.001 => spread = 0.009kg > 0.0075kg => FAIL
      const obs: ObservationInput[] = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: 0, raw_indication_reading: 0, delta_L: 0.0025 },
        { step_type: 'REPEATABILITY', step_sequence: 2, nominal_load: 15, raw_indication_reading: 15.000, repetition_index: 1, delta_L: 0.0025 },
        { step_type: 'REPEATABILITY', step_sequence: 3, nominal_load: 15, raw_indication_reading: 15.009, repetition_index: 2, delta_L: 0.0025 },
        { step_type: 'REPEATABILITY', step_sequence: 4, nominal_load: 15, raw_indication_reading: 15.001, repetition_index: 3, delta_L: 0.0025 },
      ];

      const res = evaluateNawiSession(specs, obs, true);
      expect(res.passed).toBe(false);
      expect(res.repeatabilityPassed).toBe(false);
    });
  });
});
