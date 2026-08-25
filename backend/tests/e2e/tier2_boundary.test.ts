import { describe, it, expect } from 'vitest';
import {
  exactDecimal,
  compareDecimals,
  roundTo,
  MetrologyDomainError,
  InvalidExactDecimalError,
} from '../../src/core/decimal.js';
import { calculateNawiMpe } from '../../src/metrology/mpe.js';
import {
  calculateTrueIndication,
  calculateZeroError,
  evaluateStepObservation,
  evaluateNawiSession,
} from '../../src/metrology/nawi.evaluator.js';
import { validateReferenceStandards } from '../../src/metrology/standards.validator.js';
import {
  ApplicationStateMachine,
  SessionStateMachine,
  CertificateStateMachine,
  PaymentStateMachine,
  StandardStateMachine,
} from '../../src/core/state-machines/index.js';
import {
  DomainError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  GuardConditionFailedError,
  InvalidStateTransitionError,
  UnauthorizedTransitionError,
} from '../../src/core/errors.js';
import { SecurityContext } from '../../src/core/types.js';

describe('Tier 2: Boundary & Corner Cases Suite (10 Boundary Categories, >=5 Tests Each)', () => {
  const traderSec: SecurityContext = {
    userId: 'usr-trader-01',
    tenantId: 'tenant-delhi-central',
    role: 'OWNER',
    jurisdictionId: 'jur-dl-01',
  };

  const lmoSec: SecurityContext = {
    userId: 'lmo-officer-01',
    tenantId: 'tenant-delhi-central',
    role: 'LMO',
    jurisdictionId: 'jur-dl-01',
  };

  const supSec: SecurityContext = {
    userId: 'sup-officer-01',
    tenantId: 'tenant-delhi-central',
    role: 'SUPERVISOR',
    jurisdictionId: 'jur-dl-01',
  };

  const otherTenantSec: SecurityContext = {
    userId: 'usr-mumbai-01',
    tenantId: 'tenant-maharashtra-mumbai',
    role: 'OWNER',
  };

  /* -------------------------------------------------------------------------- */
  /* Boundary 1: Zero Load & Near-Zero Turning Point Boundaries                 */
  /* -------------------------------------------------------------------------- */
  describe('Boundary 1: Zero Load & Near-Zero Turning Point Tolerances', () => {
    const e = '0.005'; // 5g -> max allowed zero error 0.25e = 0.00125 kg

    it('T2.1.1 should pass when zero load error is exactly +0.25e boundary', () => {
      // I_0 = 0.000, delta_L = 0.00125 -> P_0 = 0.000 + 0.0025 - 0.00125 = +0.00125 kg (+0.25e)
      const res = calculateZeroError('0.000', e, '0.00125');
      expect(res.E0.toString()).toBe('0.00125');
      expect(res.isWithinZeroTolerance).toBe(true);
    });

    it('T2.1.2 should pass when zero load error is exactly -0.25e boundary', () => {
      // I_0 = 0.000, delta_L = 0.00375 -> P_0 = 0.000 + 0.0025 - 0.00375 = -0.00125 kg (-0.25e)
      const res = calculateZeroError('0.000', e, '0.00375');
      expect(res.E0.toString()).toBe('-0.00125');
      expect(res.isWithinZeroTolerance).toBe(true);
    });

    it('T2.1.3 should fail when zero load error exceeds +0.25e by smallest decimal quantum (+0.250001e)', () => {
      // delta_L = 0.001249 -> P_0 = 0.001251 > 0.001250
      const res = calculateZeroError('0.000', e, '0.001249');
      expect(res.isWithinZeroTolerance).toBe(false);
    });

    it('T2.1.4 should fail when zero load error exceeds -0.25e by smallest decimal quantum (-0.250001e)', () => {
      // delta_L = 0.003751 -> P_0 = -0.001251
      const res = calculateZeroError('0.000', e, '0.003751');
      expect(res.isWithinZeroTolerance).toBe(false);
    });

    it('T2.1.5 should handle zero test when delta_L is zero or equal to scale interval e', () => {
      // delta_L = 0 -> P_0 = 0.5e = 0.0025 kg > 0.25e -> FAILS
      const zeroZero = calculateZeroError('0.000', e, '0.0');
      expect(zeroZero.isWithinZeroTolerance).toBe(false);

      // delta_L = e (0.005) -> P_0 = -0.5e = -0.0025 kg -> FAILS
      const zeroE = calculateZeroError('0.000', e, '0.005');
      expect(zeroE.isWithinZeroTolerance).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Boundary 2: Maximum Capacity & Over-Capacity Boundaries                    */
  /* -------------------------------------------------------------------------- */
  describe('Boundary 2: Maximum Capacity & Full Scale Envelope Boundaries', () => {
    const specs = {
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: '0.005',
      min_capacity: '0.1',
      max_capacity: '30.0',
    };

    it('T2.2.1 should evaluate observation exactly at Max capacity (30.0 kg, m=6000e)', () => {
      const obs = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 1,
        nominal_load: '30.0',
        raw_indication_reading: '30.003', // Error = +0.003 kg <= 1.5e (0.0075 kg)
        delta_L: '0.0025',
      };
      const res = evaluateStepObservation(obs, '0.005', 'CLASS_III', '0.0', true);
      expect(res.is_within_mpe).toBe(true);
      expect(res.mpe_allowed.toString()).toBe('0.0075');
    });

    it('T2.2.2 should evaluate observation exactly at Min capacity (0.1 kg, m=20e)', () => {
      const obs = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 1,
        nominal_load: '0.1',
        raw_indication_reading: '0.100',
      };
      const res = evaluateStepObservation(obs, '0.005', 'CLASS_III', '0.0', true);
      expect(res.is_within_mpe).toBe(true);
      expect(res.mpe_allowed.toString()).toBe('0.0025');
    });

    it('T2.2.3 should evaluate boundary load with corrected error exactly equal to positive MPE (+0.0075 kg)', () => {
      const obs = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 1,
        nominal_load: '30.0',
        raw_indication_reading: '30.0075', // Exact positive MPE
        delta_L: '0.0025',
      };
      const res = evaluateStepObservation(obs, '0.005', 'CLASS_III', '0.0', true);
      expect(res.is_within_mpe).toBe(true);
    });

    it('T2.2.4 should evaluate boundary load with corrected error exactly equal to negative MPE (-0.0075 kg)', () => {
      const obs = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 1,
        nominal_load: '30.0',
        raw_indication_reading: '29.9925', // Exact negative MPE (-0.0075 kg)
        delta_L: '0.0025',
      };
      const res = evaluateStepObservation(obs, '0.005', 'CLASS_III', '0.0', true);
      expect(res.is_within_mpe).toBe(true);
    });

    it('T2.2.5 should fail when error at Max capacity exceeds MPE by 0.0001 kg', () => {
      const obs = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 1,
        nominal_load: '30.0',
        raw_indication_reading: '30.0076', // Error = +0.0076 > 0.0075 MPE
        delta_L: '0.0025',
      };
      const res = evaluateStepObservation(obs, '0.005', 'CLASS_III', '0.0', true);
      expect(res.is_within_mpe).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Boundary 3: Stepped MPE Exact Boundary Discontinuity Points                */
  /* -------------------------------------------------------------------------- */
  describe('Boundary 3: Stepped MPE Exact Discontinuity Points', () => {
    const e = '0.005'; // 5g

    it('T2.3.1 should return MPE = 0.5e at Class III boundary m = 500e (2.5 kg)', () => {
      const mpe500 = calculateNawiMpe('2.5', e, 'CLASS_III', true);
      expect(mpe500.factorInE.toString()).toBe('0.5');
      expect(mpe500.mpeInMass.toString()).toBe('0.0025');
    });

    it('T2.3.2 should step MPE to 1.0e immediately at m = 500.000001e (2.500000005 kg)', () => {
      const mpeStep1 = calculateNawiMpe('2.500000005', e, 'CLASS_III', true);
      expect(mpeStep1.factorInE.toString()).toBe('1');
      expect(mpeStep1.mpeInMass.toString()).toBe('0.005');
    });

    it('T2.3.3 should return MPE = 1.0e at Class III boundary m = 2000e (10.0 kg)', () => {
      const mpe2000 = calculateNawiMpe('10.0', e, 'CLASS_III', true);
      expect(mpe2000.factorInE.toString()).toBe('1');
      expect(mpe2000.mpeInMass.toString()).toBe('0.005');
    });

    it('T2.3.4 should step MPE to 1.5e immediately at m = 2000.000001e (10.000000005 kg)', () => {
      const mpeStep2 = calculateNawiMpe('10.000000005', e, 'CLASS_III', true);
      expect(mpeStep2.factorInE.toString()).toBe('1.5');
      expect(mpeStep2.mpeInMass.toString()).toBe('0.0075');
    });

    it('T2.3.5 should return MPE = 0.5e at Class IIII boundary m = 50e (500 kg for e=10kg)', () => {
      const e4 = '10.0';
      const mpe50 = calculateNawiMpe('500.0', e4, 'CLASS_IIII', true);
      expect(mpe50.factorInE.toString()).toBe('0.5');

      const mpe51 = calculateNawiMpe('500.00001', e4, 'CLASS_IIII', true);
      expect(mpe51.factorInE.toString()).toBe('1');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Boundary 4: Reference Standard Calibration Expiry Boundary                 */
  /* -------------------------------------------------------------------------- */
  describe('Boundary 4: Reference Standard Calibration Expiry Date Boundary', () => {
    it('T2.4.1 should PASS when test timestamp is exactly on the calibration valid_until date', () => {
      const standards = [
        {
          standard_id: 'STD-EXACT-DAY',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2025-08-25T00:00:00Z',
          valid_until: '2026-08-25T23:59:59Z',
          calibration_status: 'ACTIVE',
        },
      ];
      const testTimestamp = '2026-08-25T12:00:00Z';
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testTimestamp);
      expect(res.isValid).toBe(true);
    });

    it('T2.4.2 should FAIL CLOSED when test timestamp is 1 second after calibration valid_until', () => {
      const standards = [
        {
          standard_id: 'STD-1SEC-EXPIRED',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2025-08-25T00:00:00Z',
          valid_until: '2026-08-25T12:00:00Z',
          calibration_status: 'ACTIVE',
        },
      ];
      const testTimestamp = '2026-08-25T12:00:01Z';
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testTimestamp);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
    });

    it('T2.4.3 should FAIL CLOSED when test timestamp is 1 day before calibration effective date', () => {
      const standards = [
        {
          standard_id: 'STD-FUTURE-CAL',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2026-09-01T00:00:00Z',
          valid_until: '2028-09-01T00:00:00Z',
          calibration_status: 'ACTIVE',
        },
      ];
      const testTimestamp = '2026-08-25T10:00:00Z';
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testTimestamp);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('precedes calibration effective date'))).toBe(true);
    });

    it('T2.4.4 should PASS when test timestamp is exactly on the calibration effective start date', () => {
      const standards = [
        {
          standard_id: 'STD-START-DAY',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2026-08-25T00:00:00Z',
          valid_until: '2028-08-25T00:00:00Z',
          calibration_status: 'ACTIVE',
        },
      ];
      const testTimestamp = '2026-08-25T00:00:00Z';
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testTimestamp);
      expect(res.isValid).toBe(true);
    });

    it('T2.4.5 should handle empty standards list as incomplete verification', () => {
      const res = validateReferenceStandards([], 'CLASS_III', '0.005');
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Boundary 5: Quarantined & Incompatible Reference Standard States           */
  /* -------------------------------------------------------------------------- */
  describe('Boundary 5: Quarantined & Incompatible Standard States', () => {
    it('T2.5.1 should fail closed when standard calibration_status is DUE_CALIBRATION but expired', () => {
      const standards = [
        {
          standard_id: 'STD-DUE-EXP',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2024-01-01',
          valid_until: '2026-08-01',
          calibration_status: 'DUE_CALIBRATION',
        },
      ];
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', '2026-08-25');
      expect(res.isValid).toBe(false);
    });

    it('T2.5.2 should allow standard in DUE_CALIBRATION state if valid_until has not passed', () => {
      const standards = [
        {
          standard_id: 'STD-DUE-VALID',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2025-01-01',
          valid_until: '2026-09-01', // Due within 30 days but not yet expired on 2026-08-25
          calibration_status: 'DUE_CALIBRATION',
        },
      ];
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', '2026-08-25');
      expect(res.isValid).toBe(true);
    });

    it('T2.5.3 should fail closed with OUTSIDE_AUTHORIZATION_SCOPE when standard class is unknown/prohibited', () => {
      const standards = [
        {
          standard_id: 'STD-INVALID-CLASS',
          accuracy_class: 'M3',
          denomination_mass: '5.0',
          calibrated_at: '2025-01-01',
          valid_until: '2027-01-01',
          calibration_status: 'ACTIVE',
        },
      ];
      const res = validateReferenceStandards(standards, 'CLASS_I', '0.00001', '2026-08-25');
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('OUTSIDE_AUTHORIZATION_SCOPE');
    });

    it('T2.5.4 should throw error on unknown instrument accuracy class', () => {
      const standards = [
        {
          standard_id: 'STD-01',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2025-01-01',
          valid_until: '2027-01-01',
        },
      ];
      expect(() => validateReferenceStandards(standards, 'CLASS_NON_EXISTENT', '0.005')).toThrow(
        MetrologyDomainError
      );
    });

    it('T2.5.5 should fail closed when standard status is RETIRED or UNDER_CALIBRATION', () => {
      const standards = [
        {
          standard_id: 'STD-RETIRED',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2025-01-01',
          valid_until: '2027-01-01',
          calibration_status: 'RETIRED',
        },
      ];
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', '2026-08-25');
      expect(res.isValid).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Boundary 6: Out-of-Order & Illegal State Machine Transitions               */
  /* -------------------------------------------------------------------------- */
  describe('Boundary 6: Out-of-Order State Machine Transition Invariants', () => {
    it('T2.6.1 should reject direct jump from DRAFT to COMPLETED on Application', () => {
      const app = {
        application_id: 'app-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'DRAFT' as const,
        version: 1,
      };
      expect(() => ApplicationStateMachine.complete(app, lmoSec, true)).toThrow(InvalidStateTransitionError);
    });

    it('T2.6.2 should reject scheduling before scrutiny acceptance or payment', () => {
      const app = {
        application_id: 'app-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'DRAFT' as const,
        version: 1,
      };
      expect(() =>
        ApplicationStateMachine.schedule(app, lmoSec, '2026-08-28T10:00:00Z', '2026-08-28T12:00:00Z', 'lmo-01')
      ).toThrow(InvalidStateTransitionError);
    });

    it('T2.6.3 should reject starting verification session without identity confirmation', () => {
      const sess = {
        session_id: 'sess-01',
        tenant_id: 'tenant-delhi-central',
        status: 'PLANNED' as const,
      };
      expect(() => SessionStateMachine.startSession(sess, lmoSec)).toThrow(InvalidStateTransitionError);
    });

    it('T2.6.4 should reject issuing certificate for unfinalized verification session', () => {
      const cert = {
        certificate_id: 'cert-01',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'REVOKED' as const,
        session_id: 'sess-01',
      };
      expect(() => CertificateStateMachine.issue(cert, lmoSec, 'SIG-01')).toThrow(InvalidStateTransitionError);
    });

    it('T2.6.5 should reject mutation or re-issuance of a REVOKED certificate', () => {
      const cert = {
        certificate_id: 'cert-01',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'REVOKED' as const,
        session_id: 'sess-01',
      };
      expect(() => CertificateStateMachine.revoke(cert, supSec, 'Double revoke')).toThrow(
        InvalidStateTransitionError
      );
      expect(() => CertificateStateMachine.reinstate(cert, supSec, 'Try unrevoke')).toThrow(
        InvalidStateTransitionError
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Boundary 7: Invalid Roles & Unauthorized Access                            */
  /* -------------------------------------------------------------------------- */
  describe('Boundary 7: Role Authorization & Privilege Escalation Guards', () => {
    it('T2.7.1 should block OWNER from executing departmental scrutiny', () => {
      const app = {
        application_id: 'app-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'SUBMITTED' as const,
        version: 1,
      };
      expect(() => ApplicationStateMachine.beginScrutiny(app, traderSec)).toThrow(ForbiddenError);
    });

    it('T2.7.2 should block OWNER from recording statutory verification disposition', () => {
      const sess = {
        session_id: 'sess-01',
        tenant_id: 'tenant-delhi-central',
        status: 'SUBMITTED' as const,
      };
      expect(() =>
        SessionStateMachine.recordDisposition(sess, traderSec, 'VERIFICATION_PASSED_PENDING_AUTHORIZATION')
      ).toThrow(ForbiddenError);
    });

    it('T2.7.3 should block LMO from executing supervisor reinstatement', () => {
      const cert = {
        certificate_id: 'cert-01',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'SUSPENDED' as const,
        session_id: 'sess-01',
      };
      expect(() => CertificateStateMachine.reinstate(cert, lmoSec, 'LMO attempt')).toThrow(ForbiddenError);
    });

    it('T2.7.4 should block LMO from executing certificate revocation', () => {
      const cert = {
        certificate_id: 'cert-01',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-01',
      };
      expect(() => CertificateStateMachine.revoke(cert, lmoSec, 'LMO attempt')).toThrow(ForbiddenError);
    });

    it('T2.7.5 should block OWNER from submitting observation test results', () => {
      const sess = {
        session_id: 'sess-01',
        tenant_id: 'tenant-delhi-central',
        status: 'IN_PROGRESS' as const,
      };
      expect(() => SessionStateMachine.submitObservations(sess, traderSec, 5)).toThrow(ForbiddenError);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Boundary 8: Negative Tolerances, Negative Nominal Loads & Bad Strings      */
  /* -------------------------------------------------------------------------- */
  describe('Boundary 8: Negative Values & Malformed Inputs Rejection', () => {
    it('T2.8.1 should reject negative nominal load in MPE calculation', () => {
      expect(() => calculateNawiMpe('-5.0', '0.005', 'CLASS_III')).toThrow(MetrologyDomainError);
    });

    it('T2.8.2 should reject negative verification scale interval e', () => {
      expect(() => calculateNawiMpe('10.0', '-0.005', 'CLASS_III')).toThrow(MetrologyDomainError);
    });

    it('T2.8.3 should reject zero verification scale interval e', () => {
      expect(() => calculateNawiMpe('10.0', '0', 'CLASS_III')).toThrow(MetrologyDomainError);
    });

    it('T2.8.4 should reject non-numeric string inputs in exact decimal constructor', () => {
      expect(() => exactDecimal('abc')).toThrow(InvalidExactDecimalError);
      expect(() => exactDecimal('12.34.56')).toThrow(InvalidExactDecimalError);
    });

    it('T2.8.5 should reject schedule slot where end is before start', () => {
      const app = {
        application_id: 'app-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'ACCEPTED' as const,
        version: 1,
      };
      expect(() =>
        ApplicationStateMachine.schedule(
          app,
          lmoSec,
          '2026-08-28T12:00:00Z',
          '2026-08-28T10:00:00Z', // End before start
          'lmo-01'
        )
      ).toThrow(GuardConditionFailedError);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Boundary 9: Empty Inputs & Missing Mandatory Requirements                  */
  /* -------------------------------------------------------------------------- */
  describe('Boundary 9: Empty Inputs & Guard Condition Failures', () => {
    it('T2.9.1 should fail application submission if declaration is not accepted', () => {
      const app = {
        application_id: 'app-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'DRAFT' as const,
        applicant_declaration_accepted: false,
        version: 1,
      };
      expect(() => ApplicationStateMachine.submit(app, traderSec)).toThrow(GuardConditionFailedError);
    });

    it('T2.9.2 should fail scrutiny query when query text is empty string or whitespace', () => {
      const app = {
        application_id: 'app-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'UNDER_SCRUTINY' as const,
        version: 1,
      };
      expect(() => ApplicationStateMachine.raiseQuery(app, lmoSec, '   ')).toThrow(GuardConditionFailedError);
    });

    it('T2.9.3 should fail application rejection when rejection reason is omitted', () => {
      const app = {
        application_id: 'app-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'UNDER_SCRUTINY' as const,
        version: 1,
      };
      expect(() => ApplicationStateMachine.reject(app, lmoSec, '')).toThrow(GuardConditionFailedError);
    });

    it('T2.9.4 should fail certificate suspension when reason is omitted', () => {
      const cert = {
        certificate_id: 'cert-01',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-01',
      };
      expect(() => CertificateStateMachine.suspend(cert, lmoSec, '')).toThrow(GuardConditionFailedError);
    });

    it('T2.9.5 should fail session observation submission when observation list is empty', () => {
      const sess = {
        session_id: 'sess-01',
        tenant_id: 'tenant-delhi-central',
        status: 'IN_PROGRESS' as const,
      };
      expect(() => SessionStateMachine.submitObservations(sess, lmoSec, 0)).toThrow(
        GuardConditionFailedError
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Boundary 10: Cross-Tenant Isolation Violations                             */
  /* -------------------------------------------------------------------------- */
  describe('Boundary 10: Cross-Tenant Boundary Penetration Resistance', () => {
    it('T2.10.1 should reject cross-tenant application submission', () => {
      const delhiApp = {
        application_id: 'app-dl-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'DRAFT' as const,
        applicant_declaration_accepted: true,
        version: 1,
      };
      expect(() => ApplicationStateMachine.submit(delhiApp, otherTenantSec)).toThrow(
        UnauthorizedTransitionError
      );
    });

    it('T2.10.2 should reject cross-tenant application scrutiny by out-of-tenant officer', () => {
      const outOfTenantOfficer: SecurityContext = {
        userId: 'lmo-mumbai-01',
        tenantId: 'tenant-maharashtra-mumbai',
        role: 'LMO',
      };
      const delhiApp = {
        application_id: 'app-dl-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'SUBMITTED' as const,
        version: 1,
      };
      expect(() => ApplicationStateMachine.beginScrutiny(delhiApp, outOfTenantOfficer)).toThrow(
        UnauthorizedTransitionError
      );
    });

    it('T2.10.3 should reject cross-tenant session identity confirmation', () => {
      const delhiSess = {
        session_id: 'sess-dl-01',
        tenant_id: 'tenant-delhi-central',
        status: 'PLANNED' as const,
      };
      expect(() => SessionStateMachine.confirmIdentity(delhiSess, otherTenantSec, true)).toThrow(
        UnauthorizedTransitionError
      );
    });

    it('T2.10.4 should reject cross-tenant certificate issuance', () => {
      const outOfTenantOfficer: SecurityContext = {
        userId: 'lmo-mumbai-01',
        tenantId: 'tenant-maharashtra-mumbai',
        role: 'LMO',
      };
      const delhiCert = {
        certificate_id: 'cert-dl-01',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'DRAFT' as const,
        session_id: 'sess-dl-01',
      };
      expect(() => CertificateStateMachine.issue(delhiCert, outOfTenantOfficer, 'SIG-01')).toThrow(
        UnauthorizedTransitionError
      );
    });

    it('T2.10.5 should reject cross-tenant standard recalibration', () => {
      const outOfTenantOfficer: SecurityContext = {
        userId: 'lmo-mumbai-01',
        tenantId: 'tenant-maharashtra-mumbai',
        role: 'LMO',
      };
      const delhiStd = {
        standard_id: 'std-dl-01',
        tenant_id: 'tenant-delhi-central',
        calibration_status: 'UNDER_CALIBRATION' as const,
        valid_until: '2026-08-01',
      };
      expect(() => StandardStateMachine.recalibrate(delhiStd, outOfTenantOfficer, '2028-01-01')).toThrow(
        UnauthorizedTransitionError
      );
    });
  });
});
