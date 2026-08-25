import { describe, it, expect } from 'vitest';
import { calculateNawiMpe } from '../src/metrology/mpe.js';
import { exactDecimal, MetrologyDomainError } from '../src/core/decimal.js';

describe('Statutory NAWI Stepped MPE Piecewise Calculator', () => {
  describe('Class III (Medium Accuracy) - Initial Verification', () => {
    const e = exactDecimal('0.005'); // e = 5g = 0.005kg

    it('should apply ±0.5e for 0 <= m <= 500 (Loads 0kg to 2.5kg)', () => {
      // At L = 0.1 kg => m = 20 => MPE = 0.5e = 0.0025 kg
      const res1 = calculateNawiMpe('0.1', e, 'CLASS_III', true);
      expect(res1.factorInE.toString()).toBe('0.5');
      expect(res1.mpeInMass.toString()).toBe('0.0025');

      // Exactly at boundary m = 500 (L = 2.5 kg) => MPE = 0.5e = 0.0025 kg
      const res2 = calculateNawiMpe('2.5', e, 'CLASS_III', true);
      expect(res2.factorInE.toString()).toBe('0.5');
      expect(res2.mpeInMass.toString()).toBe('0.0025');
    });

    it('should step to ±1.0e for 500 < m <= 2000 (Loads 2.501kg to 10kg)', () => {
      // Just past boundary: L = 2.505 kg => m = 501 => MPE = 1.0e = 0.005 kg
      const res1 = calculateNawiMpe('2.505', e, 'CLASS_III', true);
      expect(res1.factorInE.toString()).toBe('1');
      expect(res1.mpeInMass.toString()).toBe('0.005');

      // Exactly at boundary m = 2000 (L = 10 kg) => MPE = 1.0e = 0.005 kg
      const res2 = calculateNawiMpe('10.0', e, 'CLASS_III', true);
      expect(res2.factorInE.toString()).toBe('1');
      expect(res2.mpeInMass.toString()).toBe('0.005');
    });

    it('should step to ±1.5e for 2000 < m <= 10000 (Loads 10.005kg to 30kg)', () => {
      // At L = 15.0 kg => m = 3000 => MPE = 1.5e = 0.0075 kg
      const res1 = calculateNawiMpe('15.0', e, 'CLASS_III', true);
      expect(res1.factorInE.toString()).toBe('1.5');
      expect(res1.mpeInMass.toString()).toBe('0.0075');

      // At L = 30.0 kg => m = 6000 => MPE = 1.5e = 0.0075 kg
      const res2 = calculateNawiMpe('30.0', e, 'CLASS_III', true);
      expect(res2.factorInE.toString()).toBe('1.5');
      expect(res2.mpeInMass.toString()).toBe('0.0075');
    });
  });

  describe('Class III (Medium Accuracy) - Periodic Re-Verification (In-Service 2x)', () => {
    const e = exactDecimal('0.005');

    it('should apply 2x Initial MPE (±1.0e, ±2.0e, ±3.0e)', () => {
      // 0 <= m <= 500 => ±1.0e
      const res1 = calculateNawiMpe('2.5', e, 'CLASS_III', false);
      expect(res1.factorInE.toString()).toBe('1');
      expect(res1.mpeInMass.toString()).toBe('0.005');

      // 500 < m <= 2000 => ±2.0e
      const res2 = calculateNawiMpe('10.0', e, 'CLASS_III', false);
      expect(res2.factorInE.toString()).toBe('2');
      expect(res2.mpeInMass.toString()).toBe('0.01');

      // 2000 < m <= 10000 => ±3.0e
      const res3 = calculateNawiMpe('30.0', e, 'CLASS_III', false);
      expect(res3.factorInE.toString()).toBe('3');
      expect(res3.mpeInMass.toString()).toBe('0.015');
    });
  });

  describe('Class IIII (Ordinary Accuracy)', () => {
    const e = exactDecimal('10.0'); // Weighbridge e = 10kg

    it('should apply Class IIII stepped boundaries (0-50e, 50-200e, 200-1000e)', () => {
      // m = 50 (L = 500kg) => ±0.5e = 5kg
      const res1 = calculateNawiMpe('500.0', e, 'CLASS_IIII', true);
      expect(res1.factorInE.toString()).toBe('0.5');
      expect(res1.mpeInMass.toString()).toBe('5');

      // m = 200 (L = 2000kg) => ±1.0e = 10kg
      const res2 = calculateNawiMpe('2000.0', e, 'CLASS_IIII', true);
      expect(res2.factorInE.toString()).toBe('1');
      expect(res2.mpeInMass.toString()).toBe('10');

      // m = 1000 (L = 10000kg) => ±1.5e = 15kg
      const res3 = calculateNawiMpe('10000.0', e, 'CLASS_IIII', true);
      expect(res3.factorInE.toString()).toBe('1.5');
      expect(res3.mpeInMass.toString()).toBe('15');
    });
  });

  describe('Class II and Class I Accuracy', () => {
    it('should apply Class II boundaries (0-5000e, 5000-20000e, 20000-100000e)', () => {
      const e = exactDecimal('0.0001'); // e = 0.1g = 0.0001kg
      // m = 5000 (L = 0.5kg) => ±0.5e
      const res1 = calculateNawiMpe('0.5', e, 'CLASS_II', true);
      expect(res1.factorInE.toString()).toBe('0.5');

      // m = 20000 (L = 2.0kg) => ±1.0e
      const res2 = calculateNawiMpe('2.0', e, 'CLASS_II', true);
      expect(res2.factorInE.toString()).toBe('1');

      // m = 50000 (L = 5.0kg) => ±1.5e
      const res3 = calculateNawiMpe('5.0', e, 'CLASS_II', true);
      expect(res3.factorInE.toString()).toBe('1.5');
    });

    it('should apply Class I boundaries (0-50000e, 50000-200000e, >200000e)', () => {
      const e = exactDecimal('0.000001'); // 1mg
      const res1 = calculateNawiMpe('0.05', e, 'CLASS_I', true); // m = 50000
      expect(res1.factorInE.toString()).toBe('0.5');

      const res2 = calculateNawiMpe('0.2', e, 'CLASS_I', true); // m = 200000
      expect(res2.factorInE.toString()).toBe('1');

      const res3 = calculateNawiMpe('0.5', e, 'CLASS_I', true); // m = 500000
      expect(res3.factorInE.toString()).toBe('1.5');
    });
  });

  describe('Invalid inputs', () => {
    it('should reject negative loads and non-positive scale intervals', () => {
      expect(() => calculateNawiMpe('-1.0', '0.005', 'CLASS_III')).toThrow(MetrologyDomainError);
      expect(() => calculateNawiMpe('10.0', '0.0', 'CLASS_III')).toThrow(MetrologyDomainError);
      expect(() => calculateNawiMpe('10.0', '-0.005', 'CLASS_III')).toThrow(MetrologyDomainError);
    });

    it('should reject unsupported accuracy classes', () => {
      expect(() => calculateNawiMpe('10.0', '0.005', 'CLASS_UNKNOWN')).toThrow(MetrologyDomainError);
    });
  });
});
