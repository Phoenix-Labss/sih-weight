import { describe, it, expect } from 'vitest';
import { validateReferenceStandards, ReferenceStandardInput } from '../src/metrology/standards.validator.js';

describe('Reference Standards Fail-Closed Validator', () => {
  const testDate = new Date('2026-08-25T10:00:00Z');

  const validF2Standard: ReferenceStandardInput = {
    standard_id: 'STD-MASS-CLASS-F2-001',
    accuracy_class: 'F2',
    denomination_mass: '5.0',
    calibrated_at: '2025-05-15T00:00:00Z',
    valid_until: '2027-05-15T00:00:00Z',
    expanded_uncertainty: '0.00001',
    calibration_status: 'ACTIVE',
  };

  const validM1Standard: ReferenceStandardInput = {
    standard_id: 'STD-MASS-CLASS-M1-002',
    accuracy_class: 'M1',
    denomination_mass: '20.0',
    calibrated_at: '2025-08-30T00:00:00Z',
    valid_until: '2027-08-30T00:00:00Z',
    expanded_uncertainty: '0.0001',
    calibration_status: 'ACTIVE',
  };

  it('should validate suitable standards for Class III instrument', () => {
    const res = validateReferenceStandards([validF2Standard, validM1Standard], 'CLASS_III', '0.005', testDate);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.candidateOutcome).toBe('VERIFICATION_PASSED_PENDING_AUTHORIZATION');
  });

  it('should fail closed when reference standard calibration is expired', () => {
    const expiredStd: ReferenceStandardInput = {
      ...validF2Standard,
      standard_id: 'STD-EXPIRED-01',
      valid_until: '2026-08-01T00:00:00Z', // Expired 24 days before testDate
    };

    const res = validateReferenceStandards([expiredStd], 'CLASS_III', '0.005', testDate);
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('calibration expired');
    expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
  });

  it('should fail closed when reference standard is quarantined', () => {
    const quarantinedStd: ReferenceStandardInput = {
      ...validF2Standard,
      standard_id: 'STD-QUARANTINED-01',
      calibration_status: 'QUARANTINED',
    };

    const res = validateReferenceStandards([quarantinedStd], 'CLASS_III', '0.005', testDate);
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('QUARANTINED');
    expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
  });

  it('should fail closed when accuracy class is prohibited (e.g. M3 standard for Class III scale)', () => {
    const prohibitedStd: ReferenceStandardInput = {
      standard_id: 'STD-MASS-CLASS-M3-001',
      accuracy_class: 'M3', // Prohibited for Class III
      denomination_mass: '10.0',
      calibrated_at: '2025-01-01T00:00:00Z',
      valid_until: '2027-01-01T00:00:00Z',
      calibration_status: 'ACTIVE',
    };

    const res = validateReferenceStandards([prohibitedStd], 'CLASS_III', '0.005', testDate);
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('prohibited for instrument');
    expect(res.candidateOutcome).toBe('OUTSIDE_AUTHORIZATION_SCOPE');
  });

  it('should fail closed when expanded uncertainty exceeds (1/3) * MPE', () => {
    // For e = 0.005kg, denom = 5kg => m = 1000 => MPE = 1.0e = 0.005kg
    // Max allowed U = MPE / 3 = 0.001666...
    // If standard U = 0.003kg > 0.001666kg => FAIL
    const highUncertaintyStd: ReferenceStandardInput = {
      ...validF2Standard,
      standard_id: 'STD-HIGH-UNCERTAINTY',
      expanded_uncertainty: '0.003',
    };

    const res = validateReferenceStandards([highUncertaintyStd], 'CLASS_III', '0.005', testDate);
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('exceeds statutory limit of (1/3)*MPE');
  });
});
