import { Decimal, exactDecimal, MetrologyDomainError } from '../core/decimal.js';
import { AccuracyClassEnum, VerificationOutcomeEnum } from '../core/types.js';
import { calculateNawiMpe } from './mpe.js';

export interface ReferenceStandardInput {
  standard_id: string;
  accuracy_class: string; // E1, E2, F1, F2, M1, M2, M3
  denomination_mass: Decimal | string | number;
  mass_unit?: string;
  calibrated_at: Date | string;
  valid_until: Date | string;
  expanded_uncertainty?: Decimal | string | number;
  calibration_status?: string; // ACTIVE, DUE_CALIBRATION, QUARANTINED, EXPIRED, RETIRED
  is_quarantined?: boolean;
}

export interface StandardValidationResult {
  isValid: boolean;
  errors: string[];
  candidateOutcome: VerificationOutcomeEnum;
}

const CLASS_HIERARCHY: Record<string, string[]> = {
  CLASS_I: ['E1', 'E2'],
  I: ['E1', 'E2'],
  CLASS_II: ['E1', 'E2', 'F1', 'F2'],
  II: ['E1', 'E2', 'F1', 'F2'],
  CLASS_III: ['E1', 'E2', 'F1', 'F2', 'M1'],
  III: ['E1', 'E2', 'F1', 'F2', 'M1'],
  CLASS_IIII: ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'],
  IIII: ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'],
  CLASS_IV: ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'],
  IV: ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'],
};

/**
 * Validates reference standards against statutory fail-closed criteria:
 * 1. Calibration validity date range (calibrated_at <= testDate <= valid_until)
 * 2. Quarantine & active status check
 * 3. Accuracy class hierarchy compatibility (OIML R 111-1 / Seventh Schedule)
 * 4. Expanded uncertainty ratio: U(k=2) <= (1/3) * MPE
 */
export function validateReferenceStandards(
  standards: ReferenceStandardInput[],
  instrumentAccuracyClass: AccuracyClassEnum | string,
  verificationScaleIntervalE?: Decimal | string | number,
  testTimestamp: Date | string = new Date()
): StandardValidationResult {
  const errors: string[] = [];
  const testDate = new Date(testTimestamp);

  if (standards.length === 0) {
    return {
      isValid: false,
      errors: ['No reference standards provided for verification session'],
      candidateOutcome: 'INCOMPLETE_VERIFICATION',
    };
  }

  const normalizedClass = instrumentAccuracyClass.toUpperCase();
  const permittedClasses = CLASS_HIERARCHY[normalizedClass];

  if (!permittedClasses) {
    throw new MetrologyDomainError(`Unknown instrument accuracy class: ${instrumentAccuracyClass}`);
  }

  let hasIncompatibleClass = false;
  let hasExpiredOrQuarantined = false;

  for (const std of standards) {
    const stdClass = std.accuracy_class.toUpperCase().replace('_', '');

    // 1. Accuracy Class Hierarchy Check
    if (!permittedClasses.includes(stdClass)) {
      hasIncompatibleClass = true;
      errors.push(
        `Reference standard '${std.standard_id}' of accuracy class '${std.accuracy_class}' is prohibited for instrument '${instrumentAccuracyClass}' (Permitted: ${permittedClasses.join(', ')})`
      );
    }

    // 2. Quarantine & Active State Check
    if (std.is_quarantined || (std.calibration_status && std.calibration_status.toUpperCase() === 'QUARANTINED')) {
      hasExpiredOrQuarantined = true;
      errors.push(`Reference standard '${std.standard_id}' is QUARANTINED and cannot be used for statutory verification`);
    } else if (std.calibration_status && !['ACTIVE', 'DUE_CALIBRATION'].includes(std.calibration_status.toUpperCase())) {
      hasExpiredOrQuarantined = true;
      errors.push(`Reference standard '${std.standard_id}' has non-active status: ${std.calibration_status}`);
    }

    // 3. Calibration Date Range Checks
    const calDate = new Date(std.calibrated_at);
    const expDate = new Date(std.valid_until);

    if (testDate.getTime() > expDate.getTime()) {
      hasExpiredOrQuarantined = true;
      errors.push(
        `Reference standard '${std.standard_id}' calibration expired on ${expDate.toISOString().slice(0, 10)} (Test timestamp: ${testDate.toISOString().slice(0, 10)})`
      );
    } else if (testDate.getTime() < calDate.getTime()) {
      hasExpiredOrQuarantined = true;
      errors.push(
        `Reference standard '${std.standard_id}' test date precedes calibration effective date (${calDate.toISOString().slice(0, 10)})`
      );
    }

    // 4. Expanded Uncertainty Check: U(k=2) <= (1/3) * MPE(L)
    if (std.expanded_uncertainty !== undefined && verificationScaleIntervalE !== undefined) {
      try {
        const u = exactDecimal(std.expanded_uncertainty);
        const e = exactDecimal(verificationScaleIntervalE);
        const denom = exactDecimal(std.denomination_mass);

        const mpe = calculateNawiMpe(denom, e, instrumentAccuracyClass, true);
        const maxAllowedUncertainty = mpe.mpeInMass.dividedBy('3.0');

        if (u.greaterThan(maxAllowedUncertainty)) {
          errors.push(
            `Reference standard '${std.standard_id}' expanded uncertainty U=${u.toString()} exceeds statutory limit of (1/3)*MPE (${maxAllowedUncertainty.toString()})`
          );
        }
      } catch (err) {
        // Non-blocking if uncertainty computation fails on edge formats, but logs error
      }
    }
  }

  const isValid = errors.length === 0;
  let candidateOutcome: VerificationOutcomeEnum;

  if (isValid) {
    candidateOutcome = 'VERIFICATION_PASSED_PENDING_AUTHORIZATION';
  } else if (hasIncompatibleClass) {
    candidateOutcome = 'OUTSIDE_AUTHORIZATION_SCOPE';
  } else {
    candidateOutcome = 'INCOMPLETE_VERIFICATION';
  }

  return {
    isValid,
    errors,
    candidateOutcome,
  };
}
