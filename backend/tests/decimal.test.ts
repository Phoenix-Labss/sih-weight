import { describe, it, expect } from 'vitest';
import {
  Decimal,
  exactDecimal,
  toExactString,
  compareDecimals,
  roundTo,
  InvalidExactDecimalError,
  MetrologyDomainError,
} from '../src/core/decimal.js';

describe('Exact Decimal Arithmetic & Precision Guarantees', () => {
  it('should initialize Decimal with 28-digit precision and ROUND_HALF_UP', () => {
    // 1/3 in 28 precision
    const one = exactDecimal('1.0');
    const three = exactDecimal('3.0');
    const div = one.dividedBy(three);
    expect(div.toString()).toBe('0.3333333333333333333333333333');
    expect(div.precision()).toBe(28);
  });

  it('should parse exact string and integer representations safely', () => {
    const d1 = exactDecimal('15.000005');
    const d2 = exactDecimal(42);
    const d3 = exactDecimal(100n);
    expect(d1.toString()).toBe('15.000005');
    expect(d2.toString()).toBe('42');
    expect(d3.toString()).toBe('100');
  });

  it('should reject invalid values (NaN, Infinity, empty string, null, undefined)', () => {
    expect(() => exactDecimal(NaN)).toThrow(InvalidExactDecimalError);
    expect(() => exactDecimal(Infinity)).toThrow(InvalidExactDecimalError);
    expect(() => exactDecimal(-Infinity)).toThrow(InvalidExactDecimalError);
    expect(() => exactDecimal('')).toThrow(InvalidExactDecimalError);
    expect(() => exactDecimal('   ')).toThrow(InvalidExactDecimalError);
    expect(() => exactDecimal('invalid-number')).toThrow(InvalidExactDecimalError);
    expect(() => exactDecimal(null as any)).toThrow(InvalidExactDecimalError);
    expect(() => exactDecimal(undefined as any)).toThrow(InvalidExactDecimalError);
  });

  it('should format exact strings without scientific notation drift', () => {
    const d = exactDecimal('0.000005');
    expect(toExactString(d)).toBe('0.000005');
    expect(toExactString(d, 3)).toBe('0.000');
    expect(toExactString(d, 6)).toBe('0.000005');
    expect(toExactString(exactDecimal('123456789012345.678901'))).toBe('123456789012345.678901');
  });

  it('should perform ROUND_HALF_UP rounding deterministically', () => {
    const val1 = exactDecimal('2.5');
    const val2 = exactDecimal('3.5');
    const val3 = exactDecimal('2.125');

    expect(roundTo(val1, 0).toString()).toBe('3');
    expect(roundTo(val2, 0).toString()).toBe('4');
    expect(roundTo(val3, 2).toString()).toBe('2.13');
  });

  it('should compare decimals reliably', () => {
    expect(compareDecimals('10.005', '10.005')).toBe(0);
    expect(compareDecimals('10.005', '10.006')).toBe(-1);
    expect(compareDecimals('10.006', '10.005')).toBe(1);
  });
});
