import { describe, it, expect } from 'vitest';
import { exactDecimal, toExactString, compareDecimals, roundTo, MetrologyDomainError, InvalidExactDecimalError, Decimal } from '../../src/core/decimal.js';
import { calculateNawiMpe } from '../../src/metrology/mpe.js';
import {
  calculateTrueIndication,
  calculateZeroError,
  evaluateStepObservation,
  evaluateNawiSession,
} from '../../src/metrology/nawi.evaluator.js';
import { validateReferenceStandards } from '../../src/metrology/standards.validator.js';
import { generateNawiCalculationTrace } from '../../src/metrology/trace.generator.js';

describe('Legal Metrology Domain & Calculation Engine (Unit Tests)', () => {
  describe('1. Exact Decimal Arithmetic & Zero-Drift Math', () => {
    it('should maintain 28-digit precision with zero binary floating-point drift', () => {
      const a = exactDecimal('0.1');
      const b = exactDecimal('0.2');
      const sum = a.plus(b);
      expect(sum.toString()).toBe('0.3');
      expect(sum.equals(exactDecimal('0.3'))).toBe(true);

      // Verify exact 26-decimal digit calculation (27 significant digits, within 28-digit precision context)
      const val1 = exactDecimal('1.00000000000000000000000001');
      const val2 = exactDecimal('2.00000000000000000000000002');
      const total = val1.plus(val2);
      expect(total.toString()).toBe('3.00000000000000000000000003');
    });

    it('should round exactly half up (ROUND_HALF_UP / Mode 4)', () => {
      const val1 = roundTo('2.555', 2);
      expect(val1.toString()).toBe('2.56');

      const val2 = roundTo('2.554', 2);
      expect(val2.toString()).toBe('2.55');

      const val3 = roundTo('2.5550', 2);
      expect(val3.toString()).toBe('2.56');

      const val4 = roundTo('0.0025', 3);
      expect(val4.toString()).toBe('0.003');
    });

    it('should format exact strings and compare decimal values correctly', () => {
      const d = exactDecimal('15.500000');
      expect(toExactString(d)).toBe('15.5');
      expect(toExactString(d, 3)).toBe('15.500');
      expect(toExactString(d, 6)).toBe('15.500000');

      expect(compareDecimals('10.5', '10.50')).toBe(0);
      expect(compareDecimals('10.500001', '10.5')).toBe(1);
      expect(compareDecimals('10.499999', '10.5')).toBe(-1);
    });

    it('should reject NaN, Infinity, null, undefined, empty strings, and non-numeric garbage', () => {
      expect(() => exactDecimal(NaN)).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal(Infinity)).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal(-Infinity)).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal(null as unknown as string)).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal(undefined as unknown as string)).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal('')).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal('  ')).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal('invalid_number')).toThrow(InvalidExactDecimalError);
    });

    it('should handle BigInt and Decimal instance inputs without precision loss', () => {
      const bi = 9007199254740993n;
      const decBi = exactDecimal(bi);
      expect(decBi.toString()).toBe('9007199254740993');

      const orig = new Decimal('123456789.987654321');
      const cloned = exactDecimal(orig);
      expect(cloned.equals(orig)).toBe(true);
    });
  });

  describe('2. NAWI Stepped MPE Piecewise Functions (Class I, II, III, IIII)', () => {
    describe('Class III (Medium Accuracy)', () => {
      it('should calculate initial verification stepped MPE thresholds correctly', () => {
        const e = exactDecimal('0.005'); // 5g = 0.005 kg

        // Step 1: 0 <= m <= 500e -> MPE = +/- 0.5e
        // Load 2.5 kg = 500e -> 0.5 * 0.005 = 0.0025 kg
        const mpeAt500 = calculateNawiMpe('2.5', e, 'CLASS_III', true);
        expect(mpeAt500.factorInE.toString()).toBe('0.5');
        expect(mpeAt500.mpeInMass.toString()).toBe('0.0025');
        expect(mpeAt500.intervalsM.toString()).toBe('500');

        // Step 2: 500 < m <= 2000e -> MPE = +/- 1.0e
        // Load 2.505 kg = 501e -> 1.0 * 0.005 = 0.005 kg
        const mpeAt501 = calculateNawiMpe('2.505', e, 'CLASS_III', true);
        expect(mpeAt501.factorInE.toString()).toBe('1');
        expect(mpeAt501.mpeInMass.toString()).toBe('0.005');

        // Load 10.0 kg = 2000e -> 1.0 * 0.005 = 0.005 kg
        const mpeAt2000 = calculateNawiMpe('10.0', e, 'CLASS_III', true);
        expect(mpeAt2000.factorInE.toString()).toBe('1');
        expect(mpeAt2000.mpeInMass.toString()).toBe('0.005');

        // Step 3: 2000 < m <= 10000e -> MPE = +/- 1.5e
        // Load 30.0 kg = 6000e -> 1.5 * 0.005 = 0.0075 kg
        const mpeAt6000 = calculateNawiMpe('30.0', e, 'CLASS_III', true);
        expect(mpeAt6000.factorInE.toString()).toBe('1.5');
        expect(mpeAt6000.mpeInMass.toString()).toBe('0.0075');
      });

      it('should calculate in-service periodic re-verification MPE (2x Initial MPE)', () => {
        const e = exactDecimal('0.005'); // 5g

        // Re-verification: 0 <= m <= 500e -> MPE = +/- 1.0e (0.005 kg)
        const reverif500 = calculateNawiMpe('2.5', e, 'CLASS_III', false);
        expect(reverif500.factorInE.toString()).toBe('1');
        expect(reverif500.mpeInMass.toString()).toBe('0.005');

        // Re-verification: 500 < m <= 2000e -> MPE = +/- 2.0e (0.010 kg)
        const reverif2000 = calculateNawiMpe('10.0', e, 'CLASS_III', false);
        expect(reverif2000.factorInE.toString()).toBe('2');
        expect(reverif2000.mpeInMass.toString()).toBe('0.01');

        // Re-verification: 2000 < m <= 10000e -> MPE = +/- 3.0e (0.015 kg)
        const reverif6000 = calculateNawiMpe('30.0', e, 'CLASS_III', false);
        expect(reverif6000.factorInE.toString()).toBe('3');
        expect(reverif6000.mpeInMass.toString()).toBe('0.015');
      });
    });

    describe('Class IIII (Ordinary Accuracy - Weighbridges & Crane Scales)', () => {
      it('should calculate Class IIII stepped MPE (0-50e, 50-200e, 200-1000e)', () => {
        const e = exactDecimal('10.0'); // 10 kg verification interval

        // 0 <= m <= 50e (500 kg) -> 0.5e = 5 kg
        const mpe50 = calculateNawiMpe('500', e, 'CLASS_IIII', true);
        expect(mpe50.factorInE.toString()).toBe('0.5');
        expect(mpe50.mpeInMass.toString()).toBe('5');

        // 50 < m <= 200e (2000 kg) -> 1.0e = 10 kg
        const mpe200 = calculateNawiMpe('2000', e, 'CLASS_IIII', true);
        expect(mpe200.factorInE.toString()).toBe('1');
        expect(mpe200.mpeInMass.toString()).toBe('10');

        // 200 < m <= 1000e (10000 kg) -> 1.5e = 15 kg
        const mpe1000 = calculateNawiMpe('10000', e, 'CLASS_IIII', true);
        expect(mpe1000.factorInE.toString()).toBe('1.5');
        expect(mpe1000.mpeInMass.toString()).toBe('15');
      });
    });

    describe('Class II (High Accuracy - Precision Laboratory Balances)', () => {
      it('should calculate Class II stepped MPE (0-5000e, 5000-20000e, 20000-100000e)', () => {
        const e = exactDecimal('0.0001'); // 0.1g = 0.0001 kg

        // 0 <= m <= 5000e (0.5 kg) -> 0.5e = 0.00005 kg
        const mpe5k = calculateNawiMpe('0.5', e, 'CLASS_II', true);
        expect(mpe5k.factorInE.toString()).toBe('0.5');
        expect(mpe5k.mpeInMass.toString()).toBe('0.00005');

        // 5000 < m <= 20000e (2.0 kg) -> 1.0e = 0.0001 kg
        const mpe20k = calculateNawiMpe('2.0', e, 'CLASS_II', true);
        expect(mpe20k.factorInE.toString()).toBe('1');
        expect(mpe20k.mpeInMass.toString()).toBe('0.0001');

        // 20000 < m <= 100000e (5.0 kg) -> 1.5e = 0.00015 kg
        const mpe50k = calculateNawiMpe('5.0', e, 'CLASS_II', true);
        expect(mpe50k.factorInE.toString()).toBe('1.5');
        expect(mpe50k.mpeInMass.toString()).toBe('0.00015');
      });
    });

    describe('Class I (Special Accuracy - Micro Balances)', () => {
      it('should calculate Class I stepped MPE (0-50000e, 50000-200000e, >200000e)', () => {
        const e = exactDecimal('0.00001'); // 0.01g = 0.00001 kg

        const mpe50k = calculateNawiMpe('0.5', e, 'CLASS_I', true);
        expect(mpe50k.factorInE.toString()).toBe('0.5');

        const mpe200k = calculateNawiMpe('2.0', e, 'CLASS_I', true);
        expect(mpe200k.factorInE.toString()).toBe('1');

        const mpe300k = calculateNawiMpe('3.0', e, 'CLASS_I', true);
        expect(mpe300k.factorInE.toString()).toBe('1.5');
      });
    });

    it('should reject negative loads, zero scale interval, and unsupported accuracy classes', () => {
      expect(() => calculateNawiMpe('-1.0', '0.005', 'CLASS_III')).toThrow(MetrologyDomainError);
      expect(() => calculateNawiMpe('10.0', '0', 'CLASS_III')).toThrow(MetrologyDomainError);
      expect(() => calculateNawiMpe('10.0', '-0.005', 'CLASS_III')).toThrow(MetrologyDomainError);
      expect(() => calculateNawiMpe('10.0', '0.005', 'CLASS_UNKNOWN')).toThrow(MetrologyDomainError);
    });
  });

  describe('3. True Indication Turning Point, Zero Error & Corrected Error', () => {
    const e = exactDecimal('0.005'); // 5g

    it('should calculate continuous true indication P = I + 0.5e - ΔL', () => {
      // I = 10.000 kg, e = 0.005 kg, delta_L = 0.0025 kg -> P = 10.000 + 0.0025 - 0.0025 = 10.000 kg
      const P1 = calculateTrueIndication('10.000', e, '0.0025');
      expect(P1.toString()).toBe('10');

      // I = 10.000 kg, delta_L = 0.0010 kg -> P = 10.000 + 0.0025 - 0.0010 = 10.0015 kg
      const P2 = calculateTrueIndication('10.000', e, '0.0010');
      expect(P2.toString()).toBe('10.0015');

      // Default delta_L (omitted) defaults to 0.5e
      const P3 = calculateTrueIndication('10.000', e);
      expect(P3.toString()).toBe('10');
    });

    it('should evaluate Zero-Setting Error E_0 and statutory tolerance (|E_0| <= 0.25e)', () => {
      // Valid Zero Setting: I_0 = 0.000, delta_L = 0.0025 -> P_0 = 0.000, E_0 = 0.000 <= 0.25e (0.00125 kg)
      const zero1 = calculateZeroError('0.000', e, '0.0025');
      expect(zero1.E0.toString()).toBe('0');
      expect(zero1.isWithinZeroTolerance).toBe(true);
      expect(zero1.maxAllowedZeroError.toString()).toBe('0.00125');

      // Borderline Passing: E_0 = +0.00125 kg (exactly 0.25e)
      // I_0 = 0.000, delta_L = 0.00125 -> P_0 = 0.000 + 0.0025 - 0.00125 = 0.00125 kg
      const zero2 = calculateZeroError('0.000', e, '0.00125');
      expect(zero2.E0.toString()).toBe('0.00125');
      expect(zero2.isWithinZeroTolerance).toBe(true);

      // Failing Zero Setting: E_0 = +0.0020 kg (> 0.25e)
      // I_0 = 0.000, delta_L = 0.0005 -> P_0 = 0.000 + 0.0025 - 0.0005 = 0.0020 kg
      const zero3 = calculateZeroError('0.000', e, '0.0005');
      expect(zero3.E0.toString()).toBe('0.002');
      expect(zero3.isWithinZeroTolerance).toBe(false);
    });

    it('should calculate Corrected Error E_c = (P - L) - E_0 and evaluate step MPE', () => {
      const stepInput = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 3,
        nominal_load: '10.0',
        raw_indication_reading: '10.002',
        delta_L: '0.0025',
      };

      // Zero Error E_0 = +0.0005 kg
      // True Indication P = 10.002 + 0.0025 - 0.0025 = 10.002 kg
      // Raw Error E = 10.002 - 10.0 = 0.002 kg
      // Corrected Error E_c = 0.002 - 0.0005 = 0.0015 kg
      // Class III Initial MPE at 10kg (2000e) = 1.0e = 0.005 kg -> 0.0015 <= 0.005 -> PASS
      const result = evaluateStepObservation(stepInput, e, 'CLASS_III', '0.0005', true);
      expect(result.observed_error.toString()).toBe('0.002');
      expect(result.corrected_error.toString()).toBe('0.0015');
      expect(result.mpe_allowed.toString()).toBe('0.005');
      expect(result.is_within_mpe).toBe(true);
      expect(result.calculation_trace.P).toBe('10.002');
      expect(result.calculation_trace.E_c).toBe('0.0015');
    });

    it('should fail step observation when corrected error exceeds MPE', () => {
      const stepInput = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 4,
        nominal_load: '2.5', // 500e -> MPE = 0.5e = 0.0025 kg
        raw_indication_reading: '2.504', // Error = 0.004 kg
        delta_L: '0.0025',
      };

      const result = evaluateStepObservation(stepInput, e, 'CLASS_III', '0.0', true);
      expect(result.observed_error.toString()).toBe('0.004');
      expect(result.corrected_error.toString()).toBe('0.004');
      expect(result.mpe_allowed.toString()).toBe('0.0025');
      expect(result.is_within_mpe).toBe(false);
    });
  });

  describe('4. Complete Session Evaluation: Eccentricity, Repeatability & Tare Tests', () => {
    const specs = {
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: '0.005',
      min_capacity: '0.1',
      max_capacity: '30.0',
      unit: 'kg',
    };

    it('should pass a complete compliant NAWI Class III session', () => {
      const observations = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0.0', raw_indication_reading: '0.000', delta_L: '0.0025' },
        { step_type: 'INCREASING_LOAD', step_sequence: 2, nominal_load: '0.1', raw_indication_reading: '0.100', delta_L: '0.0025' },
        { step_type: 'INCREASING_LOAD', step_sequence: 3, nominal_load: '2.5', raw_indication_reading: '2.501', delta_L: '0.0025' },
        { step_type: 'INCREASING_LOAD', step_sequence: 4, nominal_load: '10.0', raw_indication_reading: '10.002', delta_L: '0.0025' },
        { step_type: 'INCREASING_LOAD', step_sequence: 5, nominal_load: '30.0', raw_indication_reading: '30.003', delta_L: '0.0025' },
        // 5-position eccentricity test at 10kg (1/3 Max)
        { step_type: 'ECCENTRICITY', step_sequence: 6, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'CENTER', delta_L: '0.0025' },
        { step_type: 'ECCENTRICITY', step_sequence: 7, nominal_load: '10.0', raw_indication_reading: '10.002', eccentricity_position: 'FRONT_LEFT', delta_L: '0.0025' },
        { step_type: 'ECCENTRICITY', step_sequence: 8, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'FRONT_RIGHT', delta_L: '0.0025' },
        { step_type: 'ECCENTRICITY', step_sequence: 9, nominal_load: '10.0', raw_indication_reading: '10.002', eccentricity_position: 'BACK_RIGHT', delta_L: '0.0025' },
        { step_type: 'ECCENTRICITY', step_sequence: 10, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'BACK_LEFT', delta_L: '0.0025' },
        // Repeatability test: 3 runs at 15kg (MPE = 1.0e = 0.005 kg)
        { step_type: 'REPEATABILITY', step_sequence: 11, nominal_load: '15.0', raw_indication_reading: '15.001', repetition_index: 1, delta_L: '0.0025' },
        { step_type: 'REPEATABILITY', step_sequence: 12, nominal_load: '15.0', raw_indication_reading: '15.002', repetition_index: 2, delta_L: '0.0025' },
        { step_type: 'REPEATABILITY', step_sequence: 13, nominal_load: '15.0', raw_indication_reading: '15.001', repetition_index: 3, delta_L: '0.0025' },
        // Tare net test at 5kg
        { step_type: 'TARE_TEST', step_sequence: 14, nominal_load: '5.0', raw_indication_reading: '5.001', delta_L: '0.0025' },
      ];

      const result = evaluateNawiSession(specs, observations, true);
      expect(result.passed).toBe(true);
      expect(result.zeroPassed).toBe(true);
      expect(result.eccentricityPassed).toBe(true);
      expect(result.repeatabilityPassed).toBe(true);
      expect(result.tarePassed).toBe(true);
      expect(result.failureReasons.length).toBe(0);
    });

    it('should fail session when eccentricity exceeds MPE at corner 4 (BACK_LEFT)', () => {
      const observations = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0.0', raw_indication_reading: '0.000', delta_L: '0.0025' },
        { step_type: 'ECCENTRICITY', step_sequence: 2, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'CENTER', delta_L: '0.0025' },
        { step_type: 'ECCENTRICITY', step_sequence: 3, nominal_load: '10.0', raw_indication_reading: '10.002', eccentricity_position: 'FRONT_LEFT', delta_L: '0.0025' },
        { step_type: 'ECCENTRICITY', step_sequence: 4, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'FRONT_RIGHT', delta_L: '0.0025' },
        { step_type: 'ECCENTRICITY', step_sequence: 5, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'BACK_RIGHT', delta_L: '0.0025' },
        // Corner 4 exceeds MPE (0.005 kg): error is 0.008 kg
        { step_type: 'ECCENTRICITY', step_sequence: 6, nominal_load: '10.0', raw_indication_reading: '10.008', eccentricity_position: 'BACK_LEFT', delta_L: '0.0025' },
      ];

      const result = evaluateNawiSession(specs, observations, true);
      expect(result.passed).toBe(false);
      expect(result.eccentricityPassed).toBe(false);
      expect(result.failureReasons.some((r) => r.includes('BACK_LEFT'))).toBe(true);
    });

    it('should fail session when repeatability spread ΔP exceeds MPE', () => {
      const observations = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0.0', raw_indication_reading: '0.000', delta_L: '0.0025' },
        // 3 runs with spread ΔP = 15.012 - 15.001 = 0.011 kg > MPE (0.0075 kg at 15kg = 3000e)
        { step_type: 'REPEATABILITY', step_sequence: 2, nominal_load: '15.0', raw_indication_reading: '15.001', repetition_index: 1, delta_L: '0.0025' },
        { step_type: 'REPEATABILITY', step_sequence: 3, nominal_load: '15.0', raw_indication_reading: '15.012', repetition_index: 2, delta_L: '0.0025' },
        { step_type: 'REPEATABILITY', step_sequence: 4, nominal_load: '15.0', raw_indication_reading: '15.002', repetition_index: 3, delta_L: '0.0025' },
      ];

      const result = evaluateNawiSession(specs, observations, true);
      expect(result.passed).toBe(false);
      expect(result.repeatabilityPassed).toBe(false);
      expect(result.repeatabilityMaxSpread?.toString()).toBe('0.011');
      expect(result.failureReasons.some((r) => r.includes('Repeatability spread'))).toBe(true);
    });
  });

  describe('5. Reference Standards Validation & Fail-Closed Hierarchy', () => {
    const testDate = new Date('2026-08-25T10:00:00Z');

    it('should validate valid reference standards within accuracy class hierarchy and validity date', () => {
      const standards = [
        {
          standard_id: 'STD-F2-001',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2025-06-01T00:00:00Z',
          valid_until: '2027-06-01T00:00:00Z',
          calibration_status: 'ACTIVE',
          expanded_uncertainty: '0.0005', // U <= (1/3) * MPE (0.005 / 3 = 0.00166)
        },
        {
          standard_id: 'STD-M1-002',
          accuracy_class: 'M1',
          denomination_mass: '20.0',
          calibrated_at: '2025-06-01T00:00:00Z',
          valid_until: '2027-06-01T00:00:00Z',
          calibration_status: 'ACTIVE',
          expanded_uncertainty: '0.0010',
        },
      ];

      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testDate);
      expect(res.isValid).toBe(true);
      expect(res.candidateOutcome).toBe('VERIFICATION_PASSED_PENDING_AUTHORIZATION');
      expect(res.errors.length).toBe(0);
    });

    it('should fail closed when reference standard calibration is expired', () => {
      const standards = [
        {
          standard_id: 'STD-EXPIRED',
          accuracy_class: 'M1',
          denomination_mass: '10.0',
          calibrated_at: '2024-01-01T00:00:00Z',
          valid_until: '2026-08-01T00:00:00Z', // Expired before 2026-08-25
          calibration_status: 'ACTIVE',
        },
      ];

      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testDate);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
      expect(res.errors.some((e) => e.includes('calibration expired'))).toBe(true);
    });

    it('should fail closed when reference standard is quarantined', () => {
      const standards = [
        {
          standard_id: 'STD-QUARANTINED',
          accuracy_class: 'M1',
          denomination_mass: '10.0',
          calibrated_at: '2025-01-01T00:00:00Z',
          valid_until: '2027-01-01T00:00:00Z',
          calibration_status: 'QUARANTINED',
          is_quarantined: true,
        },
      ];

      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testDate);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
      expect(res.errors.some((e) => e.includes('QUARANTINED'))).toBe(true);
    });

    it('should fail closed when reference standard accuracy class is incompatible (e.g. M3 for Class III)', () => {
      const standards = [
        {
          standard_id: 'STD-M3-INVALID',
          accuracy_class: 'M3', // Prohibited for Class III (only E1, E2, F1, F2, M1 allowed)
          denomination_mass: '10.0',
          calibrated_at: '2025-01-01T00:00:00Z',
          valid_until: '2027-01-01T00:00:00Z',
          calibration_status: 'ACTIVE',
        },
      ];

      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testDate);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('OUTSIDE_AUTHORIZATION_SCOPE');
      expect(res.errors.some((e) => e.includes('prohibited'))).toBe(true);
    });

    it('should fail closed when reference standard expanded uncertainty exceeds (1/3) * MPE', () => {
      const standards = [
        {
          standard_id: 'STD-HIGH-UNCERTAINTY',
          accuracy_class: 'M1',
          denomination_mass: '2.5', // At 2.5kg (500e), MPE = 0.0025 kg -> (1/3)*MPE = 0.000833 kg
          calibrated_at: '2025-01-01T00:00:00Z',
          valid_until: '2027-01-01T00:00:00Z',
          calibration_status: 'ACTIVE',
          expanded_uncertainty: '0.0020', // 0.0020 > 0.000833 -> EXCEEDED
        },
      ];

      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testDate);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('expanded uncertainty'))).toBe(true);
    });
  });

  describe('6. Canonical JSON Calculation Trace Generation', () => {
    it('should generate schema-compliant, bit-reproducible calculation trace document', () => {
      const specs = {
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: '0.005',
        min_capacity: '0.1',
        max_capacity: '30.0',
        unit: 'kg',
      };

      const observations = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0.0', raw_indication_reading: '0.000', delta_L: '0.0025' },
        { step_type: 'INCREASING_LOAD', step_sequence: 2, nominal_load: '10.0', raw_indication_reading: '10.002', delta_L: '0.0025' },
      ];

      const evalResult = evaluateNawiSession(specs, observations, true);
      const trace = generateNawiCalculationTrace(
        'IND-LM-NAWI-CLASS-III-2026.1',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        specs,
        evalResult,
        '2026-08-25T10:00:00.000Z'
      );

      expect(trace.$schema).toBe('https://legalmetrology.gov.in/schemas/v1/nawi-evaluation-trace.json');
      expect(trace.trace_id).toMatch(/^trace-[a-f0-9]{32}$/);
      expect(trace.procedure_pack_id).toBe('IND-LM-NAWI-CLASS-III-2026.1');
      expect(trace.evaluated_at_utc).toBe('2026-08-25T10:00:00.000Z');
      expect(trace.zero_setting.passed).toBe(true);
      expect(trace.steps.length).toBe(2);
      expect(trace.summary.overall_passed).toBe(true);
    });
  });
});
