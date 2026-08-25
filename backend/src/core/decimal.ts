import { Decimal } from 'decimal.js';

// Configure global statutory legal metrology precision context
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP, // Mode 4
  toExpNeg: -20,
  toExpPos: 30,
});

export class MetrologyDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetrologyDomainError';
  }
}

export class InvalidExactDecimalError extends MetrologyDomainError {
  constructor(value: unknown, reason?: string) {
    super(
      `Invalid exact decimal value: ${String(value)}${reason ? ` (${reason})` : ''}. Statutory calculations prohibit IEEE 754 float drift.`
    );
    this.name = 'InvalidExactDecimalError';
  }
}

/**
 * Creates an exact Decimal instance from string, number, or Decimal.
 * Strictly guards against NaN, Infinity, and unsafe numeric operations.
 */
export function exactDecimal(val: string | number | Decimal | bigint): Decimal {
  if (val === null || val === undefined) {
    throw new InvalidExactDecimalError(val, 'Value cannot be null or undefined');
  }

  if (val instanceof Decimal) {
    if (val.isNaN() || !val.isFinite()) {
      throw new InvalidExactDecimalError(val.toString(), 'Decimal is NaN or infinite');
    }
    return val;
  }

  if (typeof val === 'bigint') {
    return new Decimal(val.toString());
  }

  if (typeof val === 'number') {
    if (Number.isNaN(val) || !Number.isFinite(val)) {
      throw new InvalidExactDecimalError(val, 'Number is NaN or non-finite');
    }
    return new Decimal(val.toString());
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.length === 0) {
      throw new InvalidExactDecimalError(val, 'String is empty');
    }
    try {
      const d = new Decimal(trimmed);
      if (d.isNaN() || !d.isFinite()) {
        throw new InvalidExactDecimalError(val, 'Evaluated to NaN or infinite');
      }
      return d;
    } catch (err: unknown) {
      throw new InvalidExactDecimalError(val, err instanceof Error ? err.message : 'Parse error');
    }
  }

  throw new InvalidExactDecimalError(val, `Unsupported type ${typeof val}`);
}

/**
 * Formats a Decimal into an exact non-scientific string representation.
 */
export function toExactString(d: Decimal | string | number, fixedDecimals?: number): string {
  const dec = exactDecimal(d);
  if (fixedDecimals !== undefined) {
    return dec.toFixed(fixedDecimals, Decimal.ROUND_HALF_UP);
  }
  return dec.toFixed();
}

/**
 * Compare two decimals:
 * returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareDecimals(a: Decimal | string | number, b: Decimal | string | number): number {
  const decA = exactDecimal(a);
  const decB = exactDecimal(b);
  return decA.comparedTo(decB);
}

/**
 * Rounds a Decimal to a specified number of decimal places using ROUND_HALF_UP.
 */
export function roundTo(val: Decimal | string | number, decimalPlaces: number): Decimal {
  const d = exactDecimal(val);
  return d.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
}

export { Decimal };
