import { describe, it, expect } from 'vitest';
import {
  Decimal,
  exactDecimal,
  toExactString,
  compareDecimals,
  roundTo,
  MetrologyDomainError,
  InvalidExactDecimalError,
} from '../src/core/decimal.js';
import { calculateNawiMpe } from '../src/metrology/mpe.js';
import {
  calculateTrueIndication,
  calculateZeroError,
  evaluateStepObservation,
  evaluateNawiSession,
  InstrumentSpecs,
  ObservationInput,
} from '../src/metrology/nawi.evaluator.js';
import { validateReferenceStandards, ReferenceStandardInput } from '../src/metrology/standards.validator.js';
import { generateNawiCalculationTrace } from '../src/metrology/trace.generator.js';
import {
  ApplicationStateMachine,
  SessionStateMachine,
  CertificateStateMachine,
  StandardStateMachine,
  PaymentStateMachine,
} from '../src/core/state-machines/index.js';
import { SecurityContext } from '../src/core/types.js';
import {
  ForbiddenError,
  GuardConditionFailedError,
  InvalidStateTransitionError,
  UnauthorizedTransitionError,
} from '../src/core/errors.js';

describe('CHALLENGER 1: Adversarial Metrology & Statutory Integrity Probes', () => {
  // =========================================================================
  // 1. STEPPED MPE BOUNDARY DISCONTINUITIES & PIECEWISE INTERVAL INTEGRITY
  // =========================================================================
  describe('Probe 1: Stepped MPE Boundary Discontinuities & Stepped Functions', () => {
    it('NAWI Class I: Discontinuity at 50,000e and 200,000e (Initial & Re-verification)', () => {
      const e = exactDecimal('0.001'); // 1 mg

      // [0, 50,000e] -> 0.5e (Initial), 1.0e (Re-verif)
      const mpe0 = calculateNawiMpe(e.times(0), e, 'CLASS_I', true);
      expect(mpe0.factorInE.toString()).toBe('0.5');
      expect(mpe0.mpeInMass.toString()).toBe('0.0005');

      const mpe50k = calculateNawiMpe(e.times(50000), e, 'CLASS_I', true);
      expect(mpe50k.factorInE.toString()).toBe('0.5');
      expect(mpe50k.mpeInMass.toString()).toBe('0.0005');

      // (50,000e, 200,000e] -> 1.0e (Initial)
      const mpe50kPlus = calculateNawiMpe(e.times('50000.000000000000000001'), e, 'CLASS_I', true);
      expect(mpe50kPlus.factorInE.toString()).toBe('1');
      expect(mpe50kPlus.mpeInMass.toString()).toBe('0.001'); // MPE = 1.0 * e = 0.001

      const mpe200k = calculateNawiMpe(e.times(200000), e, 'CLASS_I', true);
      expect(mpe200k.factorInE.toString()).toBe('1');
      expect(mpe200k.mpeInMass.toString()).toBe('0.001');

      // > 200,000e -> 1.5e (Initial)
      const mpe200kPlus = calculateNawiMpe(e.times('200000.000000000000000001'), e, 'CLASS_I', true);
      expect(mpe200kPlus.factorInE.toString()).toBe('1.5');
      expect(mpe200kPlus.mpeInMass.toString()).toBe('0.0015'); // MPE = 1.5 * e = 0.0015

      // Re-verification (2x multiplier)
      const mpe50kReverif = calculateNawiMpe(e.times(50000), e, 'CLASS_I', false);
      expect(mpe50kReverif.factorInE.toString()).toBe('1');
      expect(mpe50kReverif.mpeInMass.toString()).toBe('0.001');

      const mpe200kReverif = calculateNawiMpe(e.times(200000), e, 'CLASS_I', false);
      expect(mpe200kReverif.factorInE.toString()).toBe('2');
      expect(mpe200kReverif.mpeInMass.toString()).toBe('0.002');

      const mpe200kPlusReverif = calculateNawiMpe(e.times('200000.000000000000000001'), e, 'CLASS_I', false);
      expect(mpe200kPlusReverif.factorInE.toString()).toBe('3');
      expect(mpe200kPlusReverif.mpeInMass.toString()).toBe('0.003');
    });

    it('NAWI Class II: Discontinuity at 5,000e and 20,000e', () => {
      const e = exactDecimal('0.01'); // 10 mg

      const mpe5k = calculateNawiMpe(e.times(5000), e, 'CLASS_II', true);
      expect(mpe5k.factorInE.toString()).toBe('0.5');

      const mpe5kPlus = calculateNawiMpe(e.times('5000.000000001'), e, 'CLASS_II', true);
      expect(mpe5kPlus.factorInE.toString()).toBe('1');

      const mpe20k = calculateNawiMpe(e.times(20000), e, 'CLASS_II', true);
      expect(mpe20k.factorInE.toString()).toBe('1');

      const mpe20kPlus = calculateNawiMpe(e.times('20000.000000001'), e, 'CLASS_II', true);
      expect(mpe20kPlus.factorInE.toString()).toBe('1.5');
    });

    it('NAWI Class III: Discontinuity at 500e and 2,000e', () => {
      const e = exactDecimal('1.0'); // 1 g

      const mpe500 = calculateNawiMpe(e.times(500), e, 'CLASS_III', true);
      expect(mpe500.factorInE.toString()).toBe('0.5');

      const mpe500Plus = calculateNawiMpe(e.times('500.000000000000000001'), e, 'CLASS_III', true);
      expect(mpe500Plus.factorInE.toString()).toBe('1');

      const mpe2000 = calculateNawiMpe(e.times(2000), e, 'CLASS_III', true);
      expect(mpe2000.factorInE.toString()).toBe('1');

      const mpe2000Plus = calculateNawiMpe(e.times('2000.000000000000000001'), e, 'CLASS_III', true);
      expect(mpe2000Plus.factorInE.toString()).toBe('1.5');
    });

    it('NAWI Class IIII: Discontinuity at 50e and 200e', () => {
      const e = exactDecimal('10.0'); // 10 g

      const mpe50 = calculateNawiMpe(e.times(50), e, 'CLASS_IIII', true);
      expect(mpe50.factorInE.toString()).toBe('0.5');

      const mpe50Plus = calculateNawiMpe(e.times('50.0000000001'), e, 'CLASS_IIII', true);
      expect(mpe50Plus.factorInE.toString()).toBe('1');

      const mpe200 = calculateNawiMpe(e.times(200), e, 'CLASS_IIII', true);
      expect(mpe200.factorInE.toString()).toBe('1');

      const mpe200Plus = calculateNawiMpe(e.times('200.0000000001'), e, 'CLASS_IIII', true);
      expect(mpe200Plus.factorInE.toString()).toBe('1.5');
    });

    it('Rejects negative load, zero interval e, negative interval e, and invalid class', () => {
      expect(() => calculateNawiMpe('-0.001', '1.0', 'CLASS_III')).toThrow(MetrologyDomainError);
      expect(() => calculateNawiMpe('10.0', '0.0', 'CLASS_III')).toThrow(MetrologyDomainError);
      expect(() => calculateNawiMpe('10.0', '-1.0', 'CLASS_III')).toThrow(MetrologyDomainError);
      expect(() => calculateNawiMpe('10.0', '1.0', 'CLASS_INVALID')).toThrow(MetrologyDomainError);
    });
  });

  // =========================================================================
  // 2. DECIMAL PRECISION & EXTREME CAPACITY RANGES (MICROBALANCE TO WEIGHBRIDGE)
  // =========================================================================
  describe('Probe 2: Fractional Scale Intervals & Extreme Capacity Ranges', () => {
    it('Ultra-microbalance (Class I, e = 1 microgram = 0.000001 g, Max = 1 g)', () => {
      const e = exactDecimal('0.000001'); // 1 ug
      const specs: InstrumentSpecs = {
        accuracy_class: 'CLASS_I',
        verification_scale_interval_e: e,
        min_capacity: '0.0001',
        max_capacity: '1.0',
        unit: 'g',
      };

      // Near zero turning point with fractional delta_L = 0.5 * e = 0.0000005 g
      const obs: ObservationInput[] = [
        {
          step_type: 'ZERO_TEST',
          step_sequence: 1,
          nominal_load: '0.0',
          raw_indication_reading: '0.000000',
          delta_L: '0.0000005',
        },
        {
          step_type: 'INCREASING_LOAD',
          step_sequence: 2,
          nominal_load: '0.050000', // 50,000e (MPE = 0.5e = 0.0000005 g)
          raw_indication_reading: '0.050000',
          delta_L: '0.0000005',
        },
        {
          step_type: 'INCREASING_LOAD',
          step_sequence: 3,
          nominal_load: '0.200000', // 200,000e (MPE = 1.0e = 0.0000010 g)
          raw_indication_reading: '0.200001', // error = +1.0e (exact boundary)
          delta_L: '0.0000005',
        },
        {
          step_type: 'INCREASING_LOAD',
          step_sequence: 4,
          nominal_load: '1.000000', // 1,000,000e (MPE = 1.5e = 0.0000015 g)
          raw_indication_reading: '1.000001',
          delta_L: '0.0000005',
        },
      ];

      const result = evaluateNawiSession(specs, obs, true);
      expect(result.passed).toBe(true);
      expect(result.zeroPassed).toBe(true);
      expect(result.zeroError.toString()).toBe('0');
      expect(result.observations[1].mpe_allowed.toString()).toBe('0.0000005');
      expect(result.observations[2].mpe_allowed.toString()).toBe('0.000001');
      expect(result.observations[3].mpe_allowed.toString()).toBe('0.0000015');
    });

    it('Heavy Industrial Weighbridge (Class III, e = 20 kg, Max = 100 tonnes = 100,000 kg)', () => {
      const e = exactDecimal('20');
      const specs: InstrumentSpecs = {
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: e,
        min_capacity: '400',
        max_capacity: '100000',
        unit: 'kg',
      };

      const obs: ObservationInput[] = [
        {
          step_type: 'ZERO_TEST',
          step_sequence: 1,
          nominal_load: '0',
          raw_indication_reading: '0',
          delta_L: '10', // 0.5e
        },
        {
          step_type: 'INCREASING_LOAD',
          step_sequence: 2,
          nominal_load: '10000', // 500e (MPE = 0.5e = 10 kg)
          raw_indication_reading: '10000',
          delta_L: '10',
        },
        {
          step_type: 'INCREASING_LOAD',
          step_sequence: 3,
          nominal_load: '40000', // 2000e (MPE = 1.0e = 20 kg)
          raw_indication_reading: '40020',
          delta_L: '10',
        },
        {
          step_type: 'INCREASING_LOAD',
          step_sequence: 4,
          nominal_load: '100000', // 5000e (MPE = 1.5e = 30 kg)
          raw_indication_reading: '100030', // error = +30 kg (at exact MPE limit)
          delta_L: '10',
        },
      ];

      const result = evaluateNawiSession(specs, obs, true);
      expect(result.passed).toBe(true);
      expect(result.observations[1].mpe_allowed.toString()).toBe('10');
      expect(result.observations[2].mpe_allowed.toString()).toBe('20');
      expect(result.observations[3].mpe_allowed.toString()).toBe('30');
    });

    it('Statutory 1-2-5 series scale interval verification across 8 orders of magnitude', () => {
      const intervals = [
        '0.000001', // 1 ug
        '0.000002', // 2 ug
        '0.000005', // 5 ug
        '0.001',    // 1 mg
        '0.002',    // 2 mg
        '0.005',    // 5 mg
        '0.01',     // 10 mg
        '0.02',     // 20 mg
        '0.05',     // 50 mg
        '0.1',      // 100 mg
        '0.5',      // 500 mg
        '1.0',      // 1 g
        '2.0',      // 2 g
        '5.0',      // 5 g
        '10.0',     // 10 g
        '20.0',     // 20 g
        '50.0',     // 50 g
      ];

      for (const intervalStr of intervals) {
        const e = exactDecimal(intervalStr);
        // Test exact 500e boundary for Class III
        const load500 = e.times(500);
        const mpe500 = calculateNawiMpe(load500, e, 'CLASS_III', true);
        expect(mpe500.factorInE.toString()).toBe('0.5');
        expect(mpe500.mpeInMass.toString()).toBe(e.times('0.5').toString());

        // Test exact 2000e boundary for Class III
        const load2000 = e.times(2000);
        const mpe2000 = calculateNawiMpe(load2000, e, 'CLASS_III', true);
        expect(mpe2000.factorInE.toString()).toBe('1');
        expect(mpe2000.mpeInMass.toString()).toBe(e.times('1.0').toString());
      }
    });

    it('Guards exactDecimal against invalid strings, null, NaN and Infinity', () => {
      expect(() => exactDecimal('')).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal('   ')).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal('abc')).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal(null as any)).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal(undefined as any)).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal(NaN)).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal(Infinity)).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal(-Infinity)).toThrow(InvalidExactDecimalError);
    });
  });

  // =========================================================================
  // 3. ZERO-SETTING ERROR BOUNDARIES, TURNING POINTS & TARE EVALUATION
  // =========================================================================
  describe('Probe 3: Near-zero loads, Turning points, Zero-setting error & Tare', () => {
    it('Statutory zero-setting error |E_0| <= 0.25e boundary tests', () => {
      const e = exactDecimal('1.0');

      // Exact zero: I=0, dL=0.5e -> P0 = 0 + 0.5 - 0.5 = 0, E0 = 0 <= 0.25e (PASS)
      const z1 = calculateZeroError('0.0', e, '0.5');
      expect(z1.E0.toString()).toBe('0');
      expect(z1.isWithinZeroTolerance).toBe(true);

      // Exact positive boundary: I=0, dL=0.25e -> P0 = 0 + 0.5 - 0.25 = +0.25e, E0 = +0.25e <= 0.25e (PASS)
      const z2 = calculateZeroError('0.0', e, '0.25');
      expect(z2.E0.toString()).toBe('0.25');
      expect(z2.isWithinZeroTolerance).toBe(true);

      // Violating positive boundary: I=0, dL=0.249999999999999999 -> P0 = +0.250000000000000001e > 0.25e (FAIL)
      const z3 = calculateZeroError('0.0', e, '0.249999999999999999');
      expect(z3.E0.toString()).toBe('0.250000000000000001');
      expect(z3.isWithinZeroTolerance).toBe(false);

      // Exact negative boundary: I=0, dL=0.75e -> P0 = 0 + 0.5 - 0.75 = -0.25e, |E0| = 0.25e <= 0.25e (PASS)
      const z4 = calculateZeroError('0.0', e, '0.75');
      expect(z4.E0.toString()).toBe('-0.25');
      expect(z4.isWithinZeroTolerance).toBe(true);

      // Violating negative boundary: I=0, dL=0.750000000000000001 -> P0 = -0.250000000000000001e, |E0| > 0.25e (FAIL)
      const z5 = calculateZeroError('0.0', e, '0.750000000000000001');
      expect(z5.E0.toString()).toBe('-0.250000000000000001');
      expect(z5.isWithinZeroTolerance).toBe(false);
    });

    it('Fails entire session when zero-setting error exceeds 0.25e', () => {
      const specs: InstrumentSpecs = {
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: '1.0',
      };
      const obs: ObservationInput[] = [
        {
          step_type: 'ZERO_TEST',
          step_sequence: 1,
          nominal_load: '0.0',
          raw_indication_reading: '0.0',
          delta_L: '0.1', // E0 = +0.4e > 0.25e -> FAILS
        },
        {
          step_type: 'INCREASING_LOAD',
          step_sequence: 2,
          nominal_load: '100.0',
          raw_indication_reading: '100.0',
          delta_L: '0.5',
        },
      ];

      const result = evaluateNawiSession(specs, obs, true);
      expect(result.passed).toBe(false);
      expect(result.zeroPassed).toBe(false);
      expect(result.failureReasons[0]).toContain('Zero-setting error E_0');
    });

    it('Corrected error properly incorporates non-zero E_0 (E_c = E - E_0)', () => {
      const e = exactDecimal('1.0');
      const zeroError = exactDecimal('0.2'); // Valid E_0 <= 0.25e

      // Load = 100g (MPE = 0.5g). I = 100.4g, dL = 0.5g -> P = 100.4.
      // Observed E = 100.4 - 100 = +0.4.
      // Corrected Ec = 0.4 - 0.2 = +0.2 <= 0.5 (PASS).
      const stepInput: ObservationInput = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 2,
        nominal_load: '100.0',
        raw_indication_reading: '100.4',
        delta_L: '0.5',
      };

      const evaluated = evaluateStepObservation(stepInput, e, 'CLASS_III', zeroError, true);
      expect(evaluated.observed_error.toString()).toBe('0.4');
      expect(evaluated.corrected_error.toString()).toBe('0.2');
      expect(evaluated.is_within_mpe).toBe(true);
    });

    it('Tare Net Test: Evaluates tare net observations against statutory MPE', () => {
      const specs: InstrumentSpecs = {
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: '1.0',
      };

      const obs: ObservationInput[] = [
        {
          step_type: 'ZERO_TEST',
          step_sequence: 1,
          nominal_load: '0.0',
          raw_indication_reading: '0.0',
          delta_L: '0.5',
        },
        {
          step_type: 'TARE_TEST',
          step_sequence: 2,
          nominal_load: '200.0', // Net load 200e (MPE = 0.5e = 0.5g)
          raw_indication_reading: '200.4',
          delta_L: '0.5', // Ec = 0.4 <= 0.5 (PASS)
        },
        {
          step_type: 'TARE_TEST',
          step_sequence: 3,
          nominal_load: '200.0',
          raw_indication_reading: '200.6',
          delta_L: '0.5', // Ec = 0.6 > 0.5 (FAIL)
        },
      ];

      const result = evaluateNawiSession(specs, obs, true);
      expect(result.passed).toBe(false);
      expect(result.tarePassed).toBe(false);
      expect(result.failureReasons.some((r) => r.includes('Tare net test error'))).toBe(true);
    });
  });

  // =========================================================================
  // 4. MULTI-RUN REPEATABILITY SPREADS WITH HIGH VARIANCE
  // =========================================================================
  describe('Probe 4: Multi-run Repeatability Spreads with High Variance', () => {
    it('Repeatability: Delta P <= MPE at load L passes, Delta P > MPE fails', () => {
      const specs: InstrumentSpecs = {
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: '1.0', // 1g
      };

      // Load = 1000g (1000e -> MPE = 1.0g = 1.0e)
      // 10 runs with varying readings
      const passObs: ObservationInput[] = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0', raw_indication_reading: '0', delta_L: '0.5' },
        { step_type: 'REPEATABILITY', step_sequence: 2, nominal_load: '1000', raw_indication_reading: '1000.0', delta_L: '0.5', repetition_index: 1 },
        { step_type: 'REPEATABILITY', step_sequence: 3, nominal_load: '1000', raw_indication_reading: '1000.5', delta_L: '0.5', repetition_index: 2 },
        { step_type: 'REPEATABILITY', step_sequence: 4, nominal_load: '1000', raw_indication_reading: '999.8', delta_L: '0.5', repetition_index: 3 },
        { step_type: 'REPEATABILITY', step_sequence: 5, nominal_load: '1000', raw_indication_reading: '1000.4', delta_L: '0.5', repetition_index: 4 },
        { step_type: 'REPEATABILITY', step_sequence: 6, nominal_load: '1000', raw_indication_reading: '1000.2', delta_L: '0.5', repetition_index: 5 },
        { step_type: 'REPEATABILITY', step_sequence: 7, nominal_load: '1000', raw_indication_reading: '999.7', delta_L: '0.5', repetition_index: 6 },
        { step_type: 'REPEATABILITY', step_sequence: 8, nominal_load: '1000', raw_indication_reading: '1000.6', delta_L: '0.5', repetition_index: 7 }, // P_max = 1000.6
        { step_type: 'REPEATABILITY', step_sequence: 9, nominal_load: '1000', raw_indication_reading: '999.6', delta_L: '0.5', repetition_index: 8 }, // P_min = 999.6
      ];
      // Spread = 1000.6 - 999.6 = 1.0g <= MPE (1.0g) -> PASS

      const passResult = evaluateNawiSession(specs, passObs, true);
      expect(passResult.repeatabilityPassed).toBe(true);
      expect(passResult.repeatabilityMaxSpread?.toString()).toBe('1');
      expect(passResult.passed).toBe(true);

      // Now add 1 run with high variance reading: 1000.8g -> Spread = 1000.8 - 999.6 = 1.2g > MPE (1.0g) -> FAILS
      const failObs = [
        ...passObs,
        {
          step_type: 'REPEATABILITY',
          step_sequence: 10,
          nominal_load: '1000',
          raw_indication_reading: '1000.8',
          delta_L: '0.5',
          repetition_index: 9,
        },
      ];

      const failResult = evaluateNawiSession(specs, failObs, true);
      expect(failResult.repeatabilityPassed).toBe(false);
      expect(failResult.repeatabilityMaxSpread?.toString()).toBe('1.2');
      expect(failResult.passed).toBe(false);
      expect(failResult.failureReasons.some((r) => r.includes('Repeatability spread'))).toBe(true);
    });

    it('Multi-load repeatability test groups runs independently by nominal load', () => {
      const specs: InstrumentSpecs = {
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: '1.0',
      };

      // Load A = 200g (MPE = 0.5g), Load B = 2500g (MPE = 1.5g)
      const obs: ObservationInput[] = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0', raw_indication_reading: '0', delta_L: '0.5' },
        // Load A runs: Spread = 200.3 - 200.0 = 0.3 <= 0.5 (PASS)
        { step_type: 'REPEATABILITY', step_sequence: 2, nominal_load: '200', raw_indication_reading: '200.0', delta_L: '0.5', repetition_index: 1 },
        { step_type: 'REPEATABILITY', step_sequence: 3, nominal_load: '200', raw_indication_reading: '200.3', delta_L: '0.5', repetition_index: 2 },
        // Load B runs: Spread = 2501.2 - 2500.0 = 1.2 <= 1.5 (PASS)
        { step_type: 'REPEATABILITY', step_sequence: 4, nominal_load: '2500', raw_indication_reading: '2500.0', delta_L: '0.5', repetition_index: 1 },
        { step_type: 'REPEATABILITY', step_sequence: 5, nominal_load: '2500', raw_indication_reading: '2501.2', delta_L: '0.5', repetition_index: 2 },
      ];

      const result = evaluateNawiSession(specs, obs, true);
      expect(result.repeatabilityPassed).toBe(true);
      expect(result.passed).toBe(true);
    });
  });

  // =========================================================================
  // 5. ECCENTRICITY AT OFF-CENTER CORNER POSITIONS
  // =========================================================================
  describe('Probe 5: Eccentricity at Off-Center Corners', () => {
    it('Passes 5-position eccentricity test when all corners are within statutory MPE', () => {
      const specs: InstrumentSpecs = {
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: '1.0',
      };
      // Load = 1/3 Max = 1000g (MPE = 1.0g)
      const obs: ObservationInput[] = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0', raw_indication_reading: '0', delta_L: '0.5' },
        { step_type: 'ECCENTRICITY', step_sequence: 2, nominal_load: '1000', raw_indication_reading: '1000.2', delta_L: '0.5', eccentricity_position: 'CENTER' },
        { step_type: 'ECCENTRICITY', step_sequence: 3, nominal_load: '1000', raw_indication_reading: '1000.5', delta_L: '0.5', eccentricity_position: 'FRONT_LEFT' },
        { step_type: 'ECCENTRICITY', step_sequence: 4, nominal_load: '1000', raw_indication_reading: '999.5', delta_L: '0.5', eccentricity_position: 'FRONT_RIGHT' },
        { step_type: 'ECCENTRICITY', step_sequence: 5, nominal_load: '1000', raw_indication_reading: '1000.9', delta_L: '0.5', eccentricity_position: 'REAR_LEFT' },
        { step_type: 'ECCENTRICITY', step_sequence: 6, nominal_load: '1000', raw_indication_reading: '999.2', delta_L: '0.5', eccentricity_position: 'REAR_RIGHT' },
      ];

      const result = evaluateNawiSession(specs, obs, true);
      expect(result.eccentricityPassed).toBe(true);
      expect(result.eccentricityMaxError?.toString()).toBe('0.9');
      expect(result.passed).toBe(true);
    });

    it('Fails session when a single off-center corner exceeds MPE', () => {
      const specs: InstrumentSpecs = {
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: '1.0',
      };
      // Load = 1000g (MPE = 1.0g)
      const obs: ObservationInput[] = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0', raw_indication_reading: '0', delta_L: '0.5' },
        { step_type: 'ECCENTRICITY', step_sequence: 2, nominal_load: '1000', raw_indication_reading: '1000.0', delta_L: '0.5', eccentricity_position: 'CENTER' },
        { step_type: 'ECCENTRICITY', step_sequence: 3, nominal_load: '1000', raw_indication_reading: '1000.0', delta_L: '0.5', eccentricity_position: 'FRONT_LEFT' },
        { step_type: 'ECCENTRICITY', step_sequence: 4, nominal_load: '1000', raw_indication_reading: '1000.0', delta_L: '0.5', eccentricity_position: 'FRONT_RIGHT' },
        { step_type: 'ECCENTRICITY', step_sequence: 5, nominal_load: '1000', raw_indication_reading: '1000.0', delta_L: '0.5', eccentricity_position: 'REAR_LEFT' },
        { step_type: 'ECCENTRICITY', step_sequence: 6, nominal_load: '1000', raw_indication_reading: '1001.1', delta_L: '0.5', eccentricity_position: 'REAR_RIGHT' }, // Error = +1.1g > 1.0g
      ];

      const result = evaluateNawiSession(specs, obs, true);
      expect(result.eccentricityPassed).toBe(false);
      expect(result.passed).toBe(false);
      expect(result.failureReasons.some((r) => r.includes("Eccentricity position 'REAR_RIGHT'"))).toBe(true);
    });
  });

  // =========================================================================
  // 6. FAIL-CLOSED REFERENCE STANDARDS VALIDATOR UNDER BOUNDARY CONDITIONS
  // =========================================================================
  describe('Probe 6: Reference Standards Fail-Closed Boundary Conditions', () => {
    const testTimestamp = new Date('2026-08-25T10:00:00.000Z');

    it('Exact expiration millisecond boundary test', () => {
      // Exactly at expiration millisecond: testDate === valid_until -> VALID
      const validStd: ReferenceStandardInput[] = [
        {
          standard_id: 'STD-EXACT-01',
          accuracy_class: 'F1',
          denomination_mass: '5.0',
          calibrated_at: '2025-08-25T10:00:00.000Z',
          valid_until: '2026-08-25T10:00:00.000Z',
          calibration_status: 'ACTIVE',
        },
      ];
      const res1 = validateReferenceStandards(validStd, 'CLASS_III', '0.001', testTimestamp);
      expect(res1.isValid).toBe(true);
      expect(res1.candidateOutcome).toBe('VERIFICATION_PASSED_PENDING_AUTHORIZATION');

      // 1 millisecond expired: testDate > valid_until by 1ms -> FAILS CLOSED
      const expiredStd: ReferenceStandardInput[] = [
        {
          standard_id: 'STD-EXACT-02',
          accuracy_class: 'F1',
          denomination_mass: '5.0',
          calibrated_at: '2025-08-25T10:00:00.000Z',
          valid_until: '2026-08-25T09:59:59.999Z',
          calibration_status: 'ACTIVE',
        },
      ];
      const res2 = validateReferenceStandards(expiredStd, 'CLASS_III', '0.001', testTimestamp);
      expect(res2.isValid).toBe(false);
      expect(res2.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
      expect(res2.errors[0]).toContain('calibration expired');
    });

    it('Test date precedes calibration effective date -> FAILS CLOSED', () => {
      const futureStd: ReferenceStandardInput[] = [
        {
          standard_id: 'STD-FUTURE-01',
          accuracy_class: 'F1',
          denomination_mass: '5.0',
          calibrated_at: '2026-08-25T10:00:00.001Z', // 1ms after test timestamp
          valid_until: '2027-08-25T10:00:00.000Z',
          calibration_status: 'ACTIVE',
        },
      ];
      const res = validateReferenceStandards(futureStd, 'CLASS_III', '0.001', testTimestamp);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
      expect(res.errors[0]).toContain('test date precedes calibration');
    });

    it('Uncertainty Threshold Equality U = (1/3)*MPE vs U > (1/3)*MPE', () => {
      // Instrument: Class III, e = 0.001 kg (1g), Denomination = 1.0 kg (1000e)
      // MPE = 1.0e = 0.001 kg. Statutory limit U <= (1/3)*MPE = 0.001 / 3 = 0.0003333333333333333333333333333 kg
      const e = exactDecimal('0.001');
      const maxAllowedU = calculateNawiMpe('1.0', e, 'CLASS_III', true).mpeInMass.dividedBy('3.0');

      // Exact equality: U = maxAllowedU -> PASS
      const stdEqual: ReferenceStandardInput[] = [
        {
          standard_id: 'STD-U-EQUAL',
          accuracy_class: 'F1',
          denomination_mass: '1.0',
          calibrated_at: '2025-08-25T00:00:00.000Z',
          valid_until: '2027-08-25T00:00:00.000Z',
          calibration_status: 'ACTIVE',
          expanded_uncertainty: maxAllowedU,
        },
      ];
      const resEqual = validateReferenceStandards(stdEqual, 'CLASS_III', e, testTimestamp);
      expect(resEqual.isValid).toBe(true);

      // Infinitesimal violation: U = maxAllowedU + 1e-20 -> FAILS CLOSED
      const stdExceed: ReferenceStandardInput[] = [
        {
          standard_id: 'STD-U-EXCEED',
          accuracy_class: 'F1',
          denomination_mass: '1.0',
          calibrated_at: '2025-08-25T00:00:00.000Z',
          valid_until: '2027-08-25T00:00:00.000Z',
          calibration_status: 'ACTIVE',
          expanded_uncertainty: maxAllowedU.plus('0.00000000000000000001'),
        },
      ];
      const resExceed = validateReferenceStandards(stdExceed, 'CLASS_III', e, testTimestamp);
      expect(resExceed.isValid).toBe(false);
      expect(resExceed.errors[0]).toContain('expanded uncertainty U');
    });

    it('Cross-Class Standard Usage (OIML R 111-1 hierarchy matrix enforcement)', () => {
      const baseStd = {
        denomination_mass: '1.0',
        calibrated_at: '2025-08-25T00:00:00.000Z',
        valid_until: '2027-08-25T00:00:00.000Z',
        calibration_status: 'ACTIVE',
      };

      // 1. Class I instrument: Permitted [E1, E2]. F1 must be rejected -> OUTSIDE_AUTHORIZATION_SCOPE
      const resClassI = validateReferenceStandards(
        [{ ...baseStd, standard_id: 'STD-F1', accuracy_class: 'F1' }],
        'CLASS_I',
        '0.0001',
        testTimestamp
      );
      expect(resClassI.isValid).toBe(false);
      expect(resClassI.candidateOutcome).toBe('OUTSIDE_AUTHORIZATION_SCOPE');

      // 2. Class II instrument: Permitted [E1, E2, F1, F2]. M1 must be rejected
      const resClassII = validateReferenceStandards(
        [{ ...baseStd, standard_id: 'STD-M1', accuracy_class: 'M1' }],
        'CLASS_II',
        '0.001',
        testTimestamp
      );
      expect(resClassII.isValid).toBe(false);
      expect(resClassII.candidateOutcome).toBe('OUTSIDE_AUTHORIZATION_SCOPE');

      // 3. Class III instrument: Permitted [E1, E2, F1, F2, M1]. M2 and M3 must be rejected
      const resClassIII = validateReferenceStandards(
        [{ ...baseStd, standard_id: 'STD-M2', accuracy_class: 'M2' }],
        'CLASS_III',
        '1.0',
        testTimestamp
      );
      expect(resClassIII.isValid).toBe(false);
      expect(resClassIII.candidateOutcome).toBe('OUTSIDE_AUTHORIZATION_SCOPE');

      // 4. Class IIII instrument: Permitted [E1, E2, F1, F2, M1, M2, M3]. M3 must pass
      const resClassIIII = validateReferenceStandards(
        [{ ...baseStd, standard_id: 'STD-M3', accuracy_class: 'M3' }],
        'CLASS_IIII',
        '10.0',
        testTimestamp
      );
      expect(resClassIIII.isValid).toBe(true);
      expect(resClassIIII.candidateOutcome).toBe('VERIFICATION_PASSED_PENDING_AUTHORIZATION');
    });

    it('Quarantined or non-active reference standard fails closed', () => {
      const quarantinedStd: ReferenceStandardInput[] = [
        {
          standard_id: 'STD-Q-01',
          accuracy_class: 'M1',
          denomination_mass: '5.0',
          calibrated_at: '2025-08-25T00:00:00.000Z',
          valid_until: '2027-08-25T00:00:00.000Z',
          calibration_status: 'QUARANTINED',
          is_quarantined: true,
        },
      ];
      const res = validateReferenceStandards(quarantinedStd, 'CLASS_III', '0.005', testTimestamp);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
      expect(res.errors[0]).toContain('QUARANTINED');
    });

    it('Empty standards list fails closed with INCOMPLETE_VERIFICATION', () => {
      const res = validateReferenceStandards([], 'CLASS_III', '1.0', testTimestamp);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
      expect(res.errors[0]).toContain('No reference standards provided');
    });
  });

  // =========================================================================
  // 7. STATE MACHINE ILLEGAL TRANSITION ATTEMPTS & ROLE BYPASSES
  // =========================================================================
  describe('Probe 7: State Machine Transition Guards & Role-Based Access Enforcement', () => {
    const ownerSecurity: SecurityContext = { userId: 'usr-trader-01', tenantId: 'tenant-dl-01', role: 'OWNER' };
    const lmoSecurity: SecurityContext = { userId: 'usr-lmo-01', tenantId: 'tenant-dl-01', role: 'LMO' };
    const supervisorSecurity: SecurityContext = { userId: 'usr-sup-01', tenantId: 'tenant-dl-01', role: 'SUPERVISOR' };
    const intruderSecurity: SecurityContext = { userId: 'usr-trader-99', tenantId: 'tenant-other-99', role: 'OWNER' };

    describe('Application State Machine Probes', () => {
      it('Cross-tenant submission attempt is rejected with UnauthorizedTransitionError', () => {
        const appCtx = {
          application_id: 'app-001',
          tenant_id: 'tenant-dl-01',
          jurisdiction_id: 'jur-dl-01',
          current_status: 'DRAFT' as const,
          applicant_declaration_accepted: true,
          version: 1,
        };

        expect(() => ApplicationStateMachine.submit(appCtx, intruderSecurity)).toThrow(UnauthorizedTransitionError);
      });

      it('Submission without applicant declaration is rejected', () => {
        const appCtx = {
          application_id: 'app-001',
          tenant_id: 'tenant-dl-01',
          jurisdiction_id: 'jur-dl-01',
          current_status: 'DRAFT' as const,
          applicant_declaration_accepted: false,
          version: 1,
        };

        expect(() => ApplicationStateMachine.submit(appCtx, ownerSecurity)).toThrow(GuardConditionFailedError);
      });

      it('Officer actions (Scrutiny, Query, Reject, Schedule) attempted by APPLICANT/OWNER are forbidden', () => {
        const appCtx = {
          application_id: 'app-001',
          tenant_id: 'tenant-dl-01',
          jurisdiction_id: 'jur-dl-01',
          current_status: 'SUBMITTED' as const,
          version: 1,
        };

        expect(() => ApplicationStateMachine.beginScrutiny(appCtx, ownerSecurity)).toThrow(ForbiddenError);
        expect(() => ApplicationStateMachine.raiseQuery(appCtx, ownerSecurity, 'query')).toThrow(ForbiddenError);
        expect(() => ApplicationStateMachine.accept(appCtx, ownerSecurity)).toThrow(ForbiddenError);
        expect(() => ApplicationStateMachine.reject(appCtx, ownerSecurity, 'reason')).toThrow(ForbiddenError);
        expect(() =>
          ApplicationStateMachine.schedule(
            appCtx,
            ownerSecurity,
            '2026-08-26T10:00:00Z',
            '2026-08-26T12:00:00Z',
            'lmo-01'
          )
        ).toThrow(ForbiddenError);
      });

      it('Scheduling requires valid time window (end > start) and assigned verifier', () => {
        const appCtx = {
          application_id: 'app-001',
          tenant_id: 'tenant-dl-01',
          jurisdiction_id: 'jur-dl-01',
          current_status: 'ACCEPTED' as const,
          version: 1,
        };

        // Window end before start
        expect(() =>
          ApplicationStateMachine.schedule(
            appCtx,
            lmoSecurity,
            '2026-08-26T12:00:00Z',
            '2026-08-26T10:00:00Z',
            'lmo-01'
          )
        ).toThrow(GuardConditionFailedError);

        // No assigned LMO or GATC
        expect(() =>
          ApplicationStateMachine.schedule(
            appCtx,
            lmoSecurity,
            '2026-08-26T10:00:00Z',
            '2026-08-26T12:00:00Z',
            null,
            null
          )
        ).toThrow(GuardConditionFailedError);
      });

      it('Cannot complete application before verification session is finalized', () => {
        const appCtx = {
          application_id: 'app-001',
          tenant_id: 'tenant-dl-01',
          jurisdiction_id: 'jur-dl-01',
          current_status: 'VERIFICATION_IN_PROGRESS' as const,
          version: 1,
        };

        expect(() => ApplicationStateMachine.complete(appCtx, lmoSecurity, false)).toThrow(GuardConditionFailedError);
      });
    });

    describe('Verification Session State Machine Probes', () => {
      it('Starting session before confirming identity is rejected', () => {
        const sessCtx = {
          session_id: 'sess-001',
          tenant_id: 'tenant-dl-01',
          status: 'PLANNED' as const,
        };

        expect(() => SessionStateMachine.startSession(sessCtx, lmoSecurity)).toThrow(InvalidStateTransitionError);
      });

      it('Confirming physical identity with unverified serial fails closed', () => {
        const sessCtx = {
          session_id: 'sess-001',
          tenant_id: 'tenant-dl-01',
          status: 'PLANNED' as const,
        };

        expect(() => SessionStateMachine.confirmIdentity(sessCtx, lmoSecurity, false)).toThrow(
          GuardConditionFailedError
        );
      });

      it('Statutory anti-corruption guard: Officer cannot grant PASSED if automated calculation failed', () => {
        const sessCtx = {
          session_id: 'sess-001',
          tenant_id: 'tenant-dl-01',
          status: 'SUBMITTED' as const,
          automated_evaluation_flag: false, // Deterministic calculation failed
        };

        expect(() =>
          SessionStateMachine.recordDisposition(
            sessCtx,
            lmoSecurity,
            'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
            'Overriding test failure manually'
          )
        ).toThrow(GuardConditionFailedError);
      });

      it('Trader / Applicant cannot submit observations or record disposition', () => {
        const sessCtx = {
          session_id: 'sess-001',
          tenant_id: 'tenant-dl-01',
          status: 'IN_PROGRESS' as const,
        };

        expect(() => SessionStateMachine.submitObservations(sessCtx, ownerSecurity, 5)).toThrow(ForbiddenError);
        expect(() =>
          SessionStateMachine.recordDisposition(
            { ...sessCtx, status: 'SUBMITTED' },
            ownerSecurity,
            'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
          )
        ).toThrow(ForbiddenError);
      });
    });

    describe('Certificate State Machine Probes', () => {
      it('Issuing certificate requires valid digital signature reference', () => {
        const certCtx = {
          certificate_id: 'cert-001',
          tenant_id: 'tenant-dl-01',
          certificate_status: 'DRAFT' as const,
          session_id: 'sess-001',
        };

        expect(() => CertificateStateMachine.issue(certCtx, lmoSecurity, '')).toThrow(GuardConditionFailedError);
        expect(() => CertificateStateMachine.issue(certCtx, lmoSecurity, '   ')).toThrow(GuardConditionFailedError);
      });

      it('Trader / Applicant cannot issue certificate', () => {
        const certCtx = {
          certificate_id: 'cert-001',
          tenant_id: 'tenant-dl-01',
          certificate_status: 'PENDING_SIGNATURE' as const,
          session_id: 'sess-001',
        };

        expect(() => CertificateStateMachine.issue(certCtx, ownerSecurity, 'sig-123')).toThrow(ForbiddenError);
      });

      it('REVOKED certificate is in a terminal irreversible state (cannot be re-issued, suspended, or revoked again)', () => {
        const certCtx = {
          certificate_id: 'cert-001',
          tenant_id: 'tenant-dl-01',
          certificate_status: 'REVOKED' as const,
          session_id: 'sess-001',
        };

        expect(() => CertificateStateMachine.issue(certCtx, supervisorSecurity, 'sig-retry')).toThrow(
          InvalidStateTransitionError
        );
        expect(() => CertificateStateMachine.suspend(certCtx, supervisorSecurity, 'reason')).toThrow(
          InvalidStateTransitionError
        );
        expect(() => CertificateStateMachine.reinstate(certCtx, supervisorSecurity, 'reason')).toThrow(
          InvalidStateTransitionError
        );
        expect(() => CertificateStateMachine.revoke(certCtx, supervisorSecurity, 'reason')).toThrow(
          InvalidStateTransitionError
        );
      });

      it('Reinstatement of suspended certificate requires SUPERVISOR / CONTROLLER (LMO is forbidden)', () => {
        const certCtx = {
          certificate_id: 'cert-001',
          tenant_id: 'tenant-dl-01',
          certificate_status: 'SUSPENDED' as const,
          session_id: 'sess-001',
        };

        expect(() => CertificateStateMachine.reinstate(certCtx, lmoSecurity, 'Court stay order')).toThrow(
          ForbiddenError
        );

        const nextStatus = CertificateStateMachine.reinstate(certCtx, supervisorSecurity, 'Court stay order lifted');
        expect(nextStatus).toBe('ISSUED');
      });
    });

    describe('Reference Standard State Machine Probes', () => {
      it('Recalibration requires future valid_until date', () => {
        const stdCtx = {
          standard_id: 'std-001',
          tenant_id: 'tenant-dl-01',
          calibration_status: 'UNDER_CALIBRATION' as const,
          valid_until: '2026-08-25T00:00:00Z',
        };

        // Date in the past
        expect(() => StandardStateMachine.recalibrate(stdCtx, lmoSecurity, '2020-01-01T00:00:00Z')).toThrow(
          GuardConditionFailedError
        );
        // Invalid date format
        expect(() => StandardStateMachine.recalibrate(stdCtx, lmoSecurity, 'invalid-date')).toThrow(
          GuardConditionFailedError
        );
      });

      it('Cannot quarantine or retire an already RETIRED standard', () => {
        const stdCtx = {
          standard_id: 'std-001',
          tenant_id: 'tenant-dl-01',
          calibration_status: 'RETIRED' as const,
          valid_until: '2026-08-25T00:00:00Z',
        };

        expect(() => StandardStateMachine.quarantine(stdCtx, lmoSecurity, 'Damaged')).toThrow(
          InvalidStateTransitionError
        );
        expect(() => StandardStateMachine.retire(stdCtx, supervisorSecurity)).toThrow(InvalidStateTransitionError);
      });
    });

    describe('Payment State Machine Probes', () => {
      it('Refunding payment requires SUPERVISOR / CONTROLLER (OWNER/LMO forbidden)', () => {
        const payCtx = {
          fee_assessment_id: 'fee-001',
          tenant_id: 'tenant-dl-01',
          payment_status: 'SUCCESS' as const,
        };

        expect(() => PaymentStateMachine.refund(payCtx, ownerSecurity)).toThrow(ForbiddenError);
        expect(() => PaymentStateMachine.refund(payCtx, lmoSecurity)).toThrow(ForbiddenError);

        const nextStatus = PaymentStateMachine.refund(payCtx, supervisorSecurity);
        expect(nextStatus).toBe('REFUNDED');
      });

      it('Cross-tenant payment initiation or reconciliation is rejected', () => {
        const payCtx = {
          fee_assessment_id: 'fee-001',
          tenant_id: 'tenant-dl-01',
          payment_status: 'PENDING' as const,
        };

        expect(() => PaymentStateMachine.initiate(payCtx, intruderSecurity)).toThrow(UnauthorizedTransitionError);
        expect(() => PaymentStateMachine.reconcile(payCtx, intruderSecurity)).toThrow(UnauthorizedTransitionError);
      });

      it('Cannot refund a pending or failed payment', () => {
        const pendingPayCtx = {
          fee_assessment_id: 'fee-001',
          tenant_id: 'tenant-dl-01',
          payment_status: 'PENDING' as const,
        };

        expect(() => PaymentStateMachine.refund(pendingPayCtx, supervisorSecurity)).toThrow(
          InvalidStateTransitionError
        );

        const failedPayCtx = {
          fee_assessment_id: 'fee-002',
          tenant_id: 'tenant-dl-01',
          payment_status: 'FAILED' as const,
        };

        expect(() => PaymentStateMachine.refund(failedPayCtx, supervisorSecurity)).toThrow(
          InvalidStateTransitionError
        );
      });
    });
  });

  // =========================================================================
  // 8. MULTI-STANDARD COMPOSITION & DECREASING LOAD HYSTERESIS PROBES
  // =========================================================================
  describe('Probe 8: Multi-standard Composition & Decreasing Load Hysteresis', () => {
    const testTimestamp = new Date('2026-08-25T10:00:00.000Z');

    it('Fails closed when mixing valid standards with one expired or quarantined standard', () => {
      const mixedStandards: ReferenceStandardInput[] = [
        {
          standard_id: 'STD-VALID-1',
          accuracy_class: 'F1',
          denomination_mass: '5.0',
          calibrated_at: '2025-08-25T00:00:00.000Z',
          valid_until: '2027-08-25T00:00:00.000Z',
          calibration_status: 'ACTIVE',
        },
        {
          standard_id: 'STD-EXPIRED-2',
          accuracy_class: 'F1',
          denomination_mass: '5.0',
          calibrated_at: '2024-01-01T00:00:00.000Z',
          valid_until: '2025-01-01T00:00:00.000Z', // Expired
          calibration_status: 'EXPIRED',
        },
      ];

      const res = validateReferenceStandards(mixedStandards, 'CLASS_III', '0.001', testTimestamp);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
      expect(res.errors.some((e) => e.includes('STD-EXPIRED-2'))).toBe(true);
    });

    it('Fails closed with OUTSIDE_AUTHORIZATION_SCOPE when one standard is cross-class prohibited', () => {
      const mixedStandards: ReferenceStandardInput[] = [
        {
          standard_id: 'STD-VALID-F1',
          accuracy_class: 'F1',
          denomination_mass: '10.0',
          calibrated_at: '2025-08-25T00:00:00.000Z',
          valid_until: '2027-08-25T00:00:00.000Z',
          calibration_status: 'ACTIVE',
        },
        {
          standard_id: 'STD-INVALID-M2',
          accuracy_class: 'M2', // Prohibited for Class III
          denomination_mass: '10.0',
          calibrated_at: '2025-08-25T00:00:00.000Z',
          valid_until: '2027-08-25T00:00:00.000Z',
          calibration_status: 'ACTIVE',
        },
      ];

      const res = validateReferenceStandards(mixedStandards, 'CLASS_III', '0.005', testTimestamp);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('OUTSIDE_AUTHORIZATION_SCOPE');
    });

    it('Evaluates full hysteresis cycle (Increasing and Decreasing load) against statutory MPE', () => {
      const specs: InstrumentSpecs = {
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: '1.0',
      };

      const obs: ObservationInput[] = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0', raw_indication_reading: '0', delta_L: '0.5' },
        // Increasing load steps
        { step_type: 'INCREASING_LOAD', step_sequence: 2, nominal_load: '500', raw_indication_reading: '500.4', delta_L: '0.5' },
        { step_type: 'INCREASING_LOAD', step_sequence: 3, nominal_load: '2000', raw_indication_reading: '2000.9', delta_L: '0.5' },
        // Decreasing load steps (Hysteresis check)
        { step_type: 'DECREASING_LOAD', step_sequence: 4, nominal_load: '2000', raw_indication_reading: '2000.8', delta_L: '0.5' },
        { step_type: 'DECREASING_LOAD', step_sequence: 5, nominal_load: '500', raw_indication_reading: '500.3', delta_L: '0.5' },
        { step_type: 'DECREASING_LOAD', step_sequence: 6, nominal_load: '0', raw_indication_reading: '0.0', delta_L: '0.5' },
      ];

      const result = evaluateNawiSession(specs, obs, true);
      expect(result.passed).toBe(true);
      expect(result.observations.length).toBe(6);
      expect(result.observations.every((o) => o.is_within_mpe)).toBe(true);
    });
  });

  // =========================================================================
  // 9. DETERMINISTIC CANONICAL TRACE GENERATOR ADVERSARIAL INTEGRITY
  // =========================================================================
  describe('Probe 9: Canonical Calculation Trace Determinism & Integrity', () => {
    it('Generates deterministic SHA-256 trace_id and statutory schema trace document', () => {
      const specs: InstrumentSpecs = {
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: '1.0',
        min_capacity: '20.0',
        max_capacity: '15000.0',
        unit: 'kg',
      };

      const obs: ObservationInput[] = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0', raw_indication_reading: '0', delta_L: '0.5' },
        { step_type: 'INCREASING_LOAD', step_sequence: 2, nominal_load: '500', raw_indication_reading: '500.2', delta_L: '0.5' },
        { step_type: 'INCREASING_LOAD', step_sequence: 3, nominal_load: '2000', raw_indication_reading: '2000.8', delta_L: '0.5' },
      ];

      const evalResult = evaluateNawiSession(specs, obs, true);
      const trace1 = generateNawiCalculationTrace('pack-nawi-v1', 'chk-sha256-abc123', specs, evalResult, '2026-08-25T10:00:00.000Z');
      const trace2 = generateNawiCalculationTrace('pack-nawi-v1', 'chk-sha256-abc123', specs, evalResult, '2026-08-25T10:00:00.000Z');

      expect(trace1.$schema).toBe('https://legalmetrology.gov.in/schemas/v1/nawi-evaluation-trace.json');
      expect(trace1.trace_id).toBe(trace2.trace_id);
      expect(trace1.trace_id.startsWith('trace-')).toBe(true);
      expect(trace1.steps.length).toBe(3);
      expect(trace1.summary.overall_passed).toBe(true);
    });
  });
});
