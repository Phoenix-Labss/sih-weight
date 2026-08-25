import { Decimal, exactDecimal, MetrologyDomainError } from '../core/decimal.js';
import { AccuracyClassEnum } from '../core/types.js';

export interface NawiMpeResult {
  factorInE: Decimal;
  mpeInMass: Decimal;
  intervalsM: Decimal;
  isInitial: boolean;
}

/**
 * Computes statutory Maximum Permissible Error (MPE) for Non-Automatic Weighing Instruments (NAWI)
 * conforming to OIML R 76-1 and Legal Metrology (General) Rules, 2011 (Seventh Schedule).
 *
 * @param load Applied nominal test load in mass units (e.g. kg or g)
 * @param scaleIntervalE Verification scale interval 'e' in same mass units
 * @param accuracyClass Accuracy Class (CLASS_I, CLASS_II, CLASS_III, CLASS_IIII)
 * @param isInitialVerification True for initial/after-repair verification, false for in-service re-verification
 */
export function calculateNawiMpe(
  load: Decimal | string | number,
  scaleIntervalE: Decimal | string | number,
  accuracyClass: AccuracyClassEnum | string,
  isInitialVerification = true
): NawiMpeResult {
  const L = exactDecimal(load);
  const e = exactDecimal(scaleIntervalE);

  if (L.isNegative()) {
    throw new MetrologyDomainError(`Nominal load cannot be negative: ${L.toString()}`);
  }
  if (e.isZero() || e.isNegative()) {
    throw new MetrologyDomainError(`Verification scale interval 'e' must be strictly positive: ${e.toString()}`);
  }

  // Calculate load in number of scale intervals: m = L / e
  const m = L.dividedBy(e);

  let initialFactor: Decimal;

  const normalizedClass = accuracyClass.toUpperCase();

  switch (normalizedClass) {
    case 'CLASS_I':
    case 'I':
      if (m.lessThanOrEqualTo(50000)) {
        initialFactor = exactDecimal('0.5');
      } else if (m.lessThanOrEqualTo(200000)) {
        initialFactor = exactDecimal('1.0');
      } else {
        initialFactor = exactDecimal('1.5');
      }
      break;

    case 'CLASS_II':
    case 'II':
      if (m.lessThanOrEqualTo(5000)) {
        initialFactor = exactDecimal('0.5');
      } else if (m.lessThanOrEqualTo(20000)) {
        initialFactor = exactDecimal('1.0');
      } else {
        initialFactor = exactDecimal('1.5');
      }
      break;

    case 'CLASS_III':
    case 'III':
      if (m.lessThanOrEqualTo(500)) {
        initialFactor = exactDecimal('0.5');
      } else if (m.lessThanOrEqualTo(2000)) {
        initialFactor = exactDecimal('1.0');
      } else {
        initialFactor = exactDecimal('1.5');
      }
      break;

    case 'CLASS_IIII':
    case 'IIII':
    case 'CLASS_IV':
    case 'IV':
      if (m.lessThanOrEqualTo(50)) {
        initialFactor = exactDecimal('0.5');
      } else if (m.lessThanOrEqualTo(200)) {
        initialFactor = exactDecimal('1.0');
      } else {
        initialFactor = exactDecimal('1.5');
      }
      break;

    default:
      throw new MetrologyDomainError(`Unsupported accuracy class for MPE calculation: ${accuracyClass}`);
  }

  // Periodic re-verification MPE is 2 * Initial MPE (Seventh Schedule / Section 24)
  const multiplier = isInitialVerification ? exactDecimal('1.0') : exactDecimal('2.0');
  const factorInE = initialFactor.times(multiplier);
  const mpeInMass = factorInE.times(e);

  return {
    factorInE,
    mpeInMass,
    intervalsM: m,
    isInitial: isInitialVerification,
  };
}
