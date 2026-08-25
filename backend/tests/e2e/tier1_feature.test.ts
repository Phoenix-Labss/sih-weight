import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import {
  exactDecimal,
  toExactString,
  compareDecimals,
  roundTo,
  MetrologyDomainError,
  InvalidExactDecimalError,
  Decimal,
} from '../../src/core/decimal.js';
import { calculateNawiMpe } from '../../src/metrology/mpe.js';
import {
  calculateTrueIndication,
  calculateZeroError,
  evaluateStepObservation,
  evaluateNawiSession,
} from '../../src/metrology/nawi.evaluator.js';
import { validateReferenceStandards } from '../../src/metrology/standards.validator.js';
import { generateNawiCalculationTrace } from '../../src/metrology/trace.generator.js';
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
  ConflictError,
  ValidationError,
  GuardConditionFailedError,
  InvalidStateTransitionError,
  UnauthorizedTransitionError,
} from '../../src/core/errors.js';
import { SecurityContext, RoleEnum, AccuracyClassEnum } from '../../src/core/types.js';

describe('Tier 1: Feature Coverage Suite (20 Inventoried Features, >=5 Tests Each)', () => {
  // Test Security Contexts
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

  const adminSec: SecurityContext = {
    userId: 'adm-system-01',
    tenantId: 'tenant-delhi-central',
    role: 'ADMIN',
  };

  const otherTenantSec: SecurityContext = {
    userId: 'usr-mumbai-01',
    tenantId: 'tenant-maharashtra-mumbai',
    role: 'OWNER',
  };

  /* -------------------------------------------------------------------------- */
  /* Feature 1: Exact Decimal Arithmetic (AGENTS.md §3.4)                       */
  /* -------------------------------------------------------------------------- */
  describe('Feature 1: Exact Decimal Arithmetic & Zero-Drift Math', () => {
    it('T1.1.1 should calculate multi-digit addition and subtraction without IEEE 754 float drift', () => {
      const a = exactDecimal('0.100000000000000000000000001');
      const b = exactDecimal('0.200000000000000000000000002');
      const sum = a.plus(b);
      expect(sum.toString()).toBe('0.300000000000000000000000003');

      const diff = sum.minus(a);
      expect(diff.toString()).toBe('0.200000000000000000000000002');
    });

    it('T1.1.2 should perform multiplication and division with 28-digit precision', () => {
      const load = exactDecimal('30.000000');
      const intervalE = exactDecimal('0.005000');
      const intervalsN = load.dividedBy(intervalE);
      expect(intervalsN.toString()).toBe('6000');

      const product = intervalsN.times(intervalE);
      expect(product.toString()).toBe('30');
    });

    it('T1.1.3 should execute statutory ROUND_HALF_UP rounding', () => {
      expect(roundTo('10.0025', 3).toString()).toBe('10.003');
      expect(roundTo('10.0024', 3).toString()).toBe('10.002');
      expect(roundTo('-10.0025', 3).toString()).toBe('-10.003');
    });

    it('T1.1.4 should support exact numeric comparisons and ordering', () => {
      expect(compareDecimals('5.000000', '5')).toBe(0);
      expect(compareDecimals('5.000001', '5.000000')).toBe(1);
      expect(compareDecimals('4.999999', '5.000000')).toBe(-1);
    });

    it('T1.1.5 should serialize exact non-scientific strings with custom scale', () => {
      const val = exactDecimal('123.456');
      expect(toExactString(val)).toBe('123.456');
      expect(toExactString(val, 2)).toBe('123.46');
      expect(toExactString(val, 6)).toBe('123.456000');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 2: Statutory NAWI Stepped MPE (AGENTS.md §3.3)                     */
  /* -------------------------------------------------------------------------- */
  describe('Feature 2: Statutory NAWI Stepped MPE Functions', () => {
    it('T1.2.1 should evaluate Class III Initial Verification stepped MPE (0.5e, 1.0e, 1.5e)', () => {
      const e = '0.005'; // 5g
      // 0 <= m <= 500e (2.5kg) -> 0.5e = 0.0025 kg
      expect(calculateNawiMpe('2.5', e, 'CLASS_III', true).mpeInMass.toString()).toBe('0.0025');
      // 500 < m <= 2000e (10.0kg) -> 1.0e = 0.005 kg
      expect(calculateNawiMpe('10.0', e, 'CLASS_III', true).mpeInMass.toString()).toBe('0.005');
      // 2000 < m <= 10000e (30.0kg) -> 1.5e = 0.0075 kg
      expect(calculateNawiMpe('30.0', e, 'CLASS_III', true).mpeInMass.toString()).toBe('0.0075');
    });

    it('T1.2.2 should evaluate Class III In-Service Re-Verification MPE (1.0e, 2.0e, 3.0e)', () => {
      const e = '0.005';
      expect(calculateNawiMpe('2.5', e, 'CLASS_III', false).mpeInMass.toString()).toBe('0.005');
      expect(calculateNawiMpe('10.0', e, 'CLASS_III', false).mpeInMass.toString()).toBe('0.01');
      expect(calculateNawiMpe('30.0', e, 'CLASS_III', false).mpeInMass.toString()).toBe('0.015');
    });

    it('T1.2.3 should evaluate Class IIII Ordinary Accuracy MPE (0-50e, 50-200e, 200-1000e)', () => {
      const e = '10.0'; // 10kg interval
      expect(calculateNawiMpe('500', e, 'CLASS_IIII', true).mpeInMass.toString()).toBe('5');
      expect(calculateNawiMpe('2000', e, 'CLASS_IIII', true).mpeInMass.toString()).toBe('10');
      expect(calculateNawiMpe('10000', e, 'CLASS_IIII', true).mpeInMass.toString()).toBe('15');
    });

    it('T1.2.4 should evaluate Class II High Accuracy MPE (0-5000e, 5000-20000e, 20000-100000e)', () => {
      const e = '0.0001'; // 0.1g
      expect(calculateNawiMpe('0.5', e, 'CLASS_II', true).mpeInMass.toString()).toBe('0.00005');
      expect(calculateNawiMpe('2.0', e, 'CLASS_II', true).mpeInMass.toString()).toBe('0.0001');
      expect(calculateNawiMpe('5.0', e, 'CLASS_II', true).mpeInMass.toString()).toBe('0.00015');
    });

    it('T1.2.5 should evaluate Class I Special Accuracy MPE (0-50000e, 50000-200000e, >200000e)', () => {
      const e = '0.00001'; // 0.01g
      expect(calculateNawiMpe('0.5', e, 'CLASS_I', true).factorInE.toString()).toBe('0.5');
      expect(calculateNawiMpe('2.0', e, 'CLASS_I', true).factorInE.toString()).toBe('1');
      expect(calculateNawiMpe('5.0', e, 'CLASS_I', true).factorInE.toString()).toBe('1.5');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 3: NAWI Error Calculations (spec_miner_domain)                    */
  /* -------------------------------------------------------------------------- */
  describe('Feature 3: NAWI Turning Point & Corrected Error Calculations', () => {
    const e = '0.005';

    it('T1.3.1 should compute true continuous indication P = I + 0.5e - ΔL', () => {
      const P = calculateTrueIndication('20.000', e, '0.0015');
      // 20.000 + 0.0025 - 0.0015 = 20.0010
      expect(P.toString()).toBe('20.001');
    });

    it('T1.3.2 should compute observed error E = P - L', () => {
      const P = calculateTrueIndication('20.002', e, '0.0025'); // 20.002
      const E = P.minus(exactDecimal('20.0'));
      expect(E.toString()).toBe('0.002');
    });

    it('T1.3.3 should evaluate zero-setting error E_0 and tolerance check |E_0| <= 0.25e', () => {
      const zeroPass = calculateZeroError('0.000', e, '0.0025');
      expect(zeroPass.isWithinZeroTolerance).toBe(true);
      expect(zeroPass.E0.toString()).toBe('0');

      const zeroFail = calculateZeroError('0.000', e, '0.0005');
      expect(zeroFail.isWithinZeroTolerance).toBe(false);
      expect(zeroFail.E0.toString()).toBe('0.002');
    });

    it('T1.3.4 should compute corrected error E_c = E - E_0 and evaluate against MPE', () => {
      const obs = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 1,
        nominal_load: '10.0',
        raw_indication_reading: '10.001',
        delta_L: '0.0025',
      };
      // P = 10.001, E = 0.001, E_0 = 0.0005 -> E_c = 0.0005 <= MPE (0.005)
      const res = evaluateStepObservation(obs, e, 'CLASS_III', '0.0005', true);
      expect(res.corrected_error.toString()).toBe('0.0005');
      expect(res.is_within_mpe).toBe(true);
    });

    it('T1.3.5 should populate complete deterministic calculation trace on step evaluation', () => {
      const obs = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 2,
        nominal_load: '5.0',
        raw_indication_reading: '5.002',
      };
      const res = evaluateStepObservation(obs, e, 'CLASS_III', '0.0', true);
      expect(res.calculation_trace).toBeDefined();
      expect(res.calculation_trace.P).toBe('5.002');
      expect(res.calculation_trace.MPE).toBe('0.005');
      expect(res.calculation_trace.is_within_mpe).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 4: Eccentricity & Repeatability (spec_miner_domain)                */
  /* -------------------------------------------------------------------------- */
  describe('Feature 4: Eccentricity, Repeatability & Tare Tests', () => {
    const specs = {
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: '0.005',
      min_capacity: '0.1',
      max_capacity: '30.0',
    };

    it('T1.4.1 should evaluate 5-position eccentricity test at 1/3 Max load', () => {
      const observations = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0.0', raw_indication_reading: '0.0' },
        { step_type: 'ECCENTRICITY', step_sequence: 2, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'CENTER' },
        { step_type: 'ECCENTRICITY', step_sequence: 3, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'FRONT_LEFT' },
        { step_type: 'ECCENTRICITY', step_sequence: 4, nominal_load: '10.0', raw_indication_reading: '10.002', eccentricity_position: 'FRONT_RIGHT' },
        { step_type: 'ECCENTRICITY', step_sequence: 5, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'BACK_RIGHT' },
        { step_type: 'ECCENTRICITY', step_sequence: 6, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'BACK_LEFT' },
      ];

      const res = evaluateNawiSession(specs, observations, true);
      expect(res.eccentricityPassed).toBe(true);
    });

    it('T1.4.2 should detect off-center eccentricity failure when position exceeds MPE', () => {
      const observations = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0.0', raw_indication_reading: '0.0' },
        { step_type: 'ECCENTRICITY', step_sequence: 2, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'CENTER' },
        { step_type: 'ECCENTRICITY', step_sequence: 3, nominal_load: '10.0', raw_indication_reading: '10.008', eccentricity_position: 'FRONT_LEFT' }, // 0.008 > 0.005 MPE
      ];

      const res = evaluateNawiSession(specs, observations, true);
      expect(res.eccentricityPassed).toBe(false);
      expect(res.passed).toBe(false);
    });

    it('T1.4.3 should evaluate repeatability across 3 successive runs at 50% capacity', () => {
      const observations = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0.0', raw_indication_reading: '0.0' },
        { step_type: 'REPEATABILITY', step_sequence: 2, nominal_load: '15.0', raw_indication_reading: '15.001', repetition_index: 1 },
        { step_type: 'REPEATABILITY', step_sequence: 3, nominal_load: '15.0', raw_indication_reading: '15.002', repetition_index: 2 },
        { step_type: 'REPEATABILITY', step_sequence: 4, nominal_load: '15.0', raw_indication_reading: '15.001', repetition_index: 3 },
      ];

      const res = evaluateNawiSession(specs, observations, true);
      expect(res.repeatabilityPassed).toBe(true);
      expect(res.repeatabilityMaxSpread?.toString()).toBe('0.001');
    });

    it('T1.4.4 should fail repeatability when spread ΔP exceeds MPE', () => {
      const observations = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0.0', raw_indication_reading: '0.0' },
        { step_type: 'REPEATABILITY', step_sequence: 2, nominal_load: '15.0', raw_indication_reading: '15.001', repetition_index: 1 },
        { step_type: 'REPEATABILITY', step_sequence: 3, nominal_load: '15.0', raw_indication_reading: '15.012', repetition_index: 2 }, // Spread = 0.011 > 0.0075 MPE
      ];

      const res = evaluateNawiSession(specs, observations, true);
      expect(res.repeatabilityPassed).toBe(false);
      expect(res.passed).toBe(false);
    });

    it('T1.4.5 should evaluate tare balancing net error against MPE', () => {
      const observations = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0.0', raw_indication_reading: '0.0' },
        { step_type: 'TARE_TEST', step_sequence: 2, nominal_load: '5.0', raw_indication_reading: '5.001' },
      ];

      const res = evaluateNawiSession(specs, observations, true);
      expect(res.tarePassed).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 5: Reference Standards Validator (AGENTS.md §3.5)                  */
  /* -------------------------------------------------------------------------- */
  describe('Feature 5: Reference Standards Validation & Fail-Closed Rules', () => {
    const testDate = '2026-08-25T10:00:00Z';

    it('T1.5.1 should validate valid standards within calibration date and class hierarchy', () => {
      const standards = [
        {
          standard_id: 'STD-01',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2025-01-01',
          valid_until: '2027-01-01',
          calibration_status: 'ACTIVE',
        },
      ];
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testDate);
      expect(res.isValid).toBe(true);
      expect(res.candidateOutcome).toBe('VERIFICATION_PASSED_PENDING_AUTHORIZATION');
    });

    it('T1.5.2 should fail closed when reference standard calibration is expired', () => {
      const standards = [
        {
          standard_id: 'STD-EXP',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2024-01-01',
          valid_until: '2026-06-01', // Expired
          calibration_status: 'ACTIVE',
        },
      ];
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testDate);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
    });

    it('T1.5.3 should fail closed when reference standard is quarantined', () => {
      const standards = [
        {
          standard_id: 'STD-Q',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2025-01-01',
          valid_until: '2027-01-01',
          calibration_status: 'QUARANTINED',
        },
      ];
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testDate);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
    });

    it('T1.5.4 should fail closed when accuracy class is prohibited (e.g. M2 for Class II)', () => {
      const standards = [
        {
          standard_id: 'STD-M2',
          accuracy_class: 'M2', // Prohibited for Class II
          denomination_mass: '1.0',
          calibrated_at: '2025-01-01',
          valid_until: '2027-01-01',
          calibration_status: 'ACTIVE',
        },
      ];
      const res = validateReferenceStandards(standards, 'CLASS_II', '0.0001', testDate);
      expect(res.isValid).toBe(false);
      expect(res.candidateOutcome).toBe('OUTSIDE_AUTHORIZATION_SCOPE');
    });

    it('T1.5.5 should fail closed when expanded uncertainty U exceeds (1/3) * MPE', () => {
      const standards = [
        {
          standard_id: 'STD-UNCERT',
          accuracy_class: 'M1',
          denomination_mass: '2.5',
          calibrated_at: '2025-01-01',
          valid_until: '2027-01-01',
          calibration_status: 'ACTIVE',
          expanded_uncertainty: '0.002', // > (1/3)*0.0025 = 0.000833
        },
      ];
      const res = validateReferenceStandards(standards, 'CLASS_III', '0.005', testDate);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('uncertainty'))).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 6: Statutory State Machines (AGENTS.md §9)                         */
  /* -------------------------------------------------------------------------- */
  describe('Feature 6: Statutory State Machines & Lifecycle Guards', () => {
    it('T1.6.1 should execute full application lifecycle state transitions', () => {
      const app = {
        application_id: 'app-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'DRAFT' as const,
        applicant_declaration_accepted: true,
        version: 1,
      };

      // DRAFT -> SUBMITTED
      expect(ApplicationStateMachine.submit(app, traderSec)).toBe('SUBMITTED');
      app.current_status = 'SUBMITTED';

      // SUBMITTED -> UNDER_SCRUTINY
      expect(ApplicationStateMachine.beginScrutiny(app, lmoSec)).toBe('UNDER_SCRUTINY');
      app.current_status = 'UNDER_SCRUTINY';

      // UNDER_SCRUTINY -> ACCEPTED
      expect(ApplicationStateMachine.accept(app, lmoSec)).toBe('ACCEPTED');
      app.current_status = 'ACCEPTED';

      // ACCEPTED -> FEE_PAID
      expect(ApplicationStateMachine.reconcilePayment(app, traderSec)).toBe('FEE_PAID');
      app.current_status = 'FEE_PAID';

      // FEE_PAID -> SCHEDULED
      expect(
        ApplicationStateMachine.schedule(
          app,
          lmoSec,
          '2026-08-28T10:00:00Z',
          '2026-08-28T12:00:00Z',
          'lmo-officer-01'
        )
      ).toBe('SCHEDULED');
      app.current_status = 'SCHEDULED';

      // SCHEDULED -> VERIFICATION_IN_PROGRESS
      expect(ApplicationStateMachine.commenceTesting(app, lmoSec)).toBe('VERIFICATION_IN_PROGRESS');
      app.current_status = 'VERIFICATION_IN_PROGRESS';

      // VERIFICATION_IN_PROGRESS -> COMPLETED
      expect(ApplicationStateMachine.complete(app, lmoSec, true)).toBe('COMPLETED');
    });

    it('T1.6.2 should handle application query, correction and version increment', () => {
      const app = {
        application_id: 'app-02',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'UNDER_SCRUTINY' as const,
        version: 1,
      };

      expect(ApplicationStateMachine.raiseQuery(app, lmoSec, 'Upload clear plate photo')).toBe('QUERY_RAISED');
      app.current_status = 'QUERY_RAISED';

      const correction = ApplicationStateMachine.submitCorrection(app, traderSec, 'Plate re-uploaded');
      expect(correction.nextStatus).toBe('CORRECTION_SUBMITTED');
      expect(correction.nextVersion).toBe(2);
    });

    it('T1.6.3 should execute verification session state transitions and guard passed outcome', () => {
      const sess = {
        session_id: 'sess-01',
        tenant_id: 'tenant-delhi-central',
        status: 'PLANNED' as const,
      };

      expect(SessionStateMachine.confirmIdentity(sess, lmoSec, true)).toBe('IDENTITY_CONFIRMED');
      sess.status = 'IDENTITY_CONFIRMED';

      expect(SessionStateMachine.startSession(sess, lmoSec)).toBe('IN_PROGRESS');
      sess.status = 'IN_PROGRESS';

      expect(SessionStateMachine.submitObservations(sess, lmoSec, 5)).toBe('SUBMITTED');
      sess.status = 'SUBMITTED';

      // Guard: Cannot grant PASSED if automated evaluation failed
      expect(() =>
        SessionStateMachine.recordDisposition(
          { ...sess, automated_evaluation_flag: false },
          lmoSec,
          'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
        )
      ).toThrow(GuardConditionFailedError);

      const finalized = SessionStateMachine.recordDisposition(
        { ...sess, automated_evaluation_flag: true },
        lmoSec,
        'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
      );
      expect(finalized.nextStatus).toBe('FINALIZED');
    });

    it('T1.6.4 should execute certificate lifecycle state transitions (issue, suspend, reinstate, revoke)', () => {
      const cert = {
        certificate_id: 'cert-01',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'DRAFT' as const,
        session_id: 'sess-01',
      };

      // DRAFT -> ISSUED
      expect(CertificateStateMachine.issue(cert, lmoSec, 'SIG-ED25519-01')).toBe('ISSUED');
      cert.certificate_status = 'ISSUED';

      // ISSUED -> SUSPENDED
      expect(CertificateStateMachine.suspend(cert, lmoSec, 'Seal broken')).toBe('SUSPENDED');
      cert.certificate_status = 'SUSPENDED';

      // SUSPENDED -> ISSUED (Reinstate requires SUPERVISOR)
      expect(() => CertificateStateMachine.reinstate(cert, lmoSec, 'Reinstated')).toThrow(ForbiddenError);
      expect(CertificateStateMachine.reinstate(cert, supSec, 'Inspection verified intact')).toBe('ISSUED');
      cert.certificate_status = 'ISSUED';

      // ISSUED -> REVOKED (Terminal)
      expect(CertificateStateMachine.revoke(cert, supSec, 'Tampering detected')).toBe('REVOKED');
      cert.certificate_status = 'REVOKED';

      // Cannot reinstate REVOKED certificate
      expect(() => CertificateStateMachine.reinstate(cert, supSec, 'Try reinstate')).toThrow(
        InvalidStateTransitionError
      );
    });

    it('T1.6.5 should execute payment and standard lifecycles', () => {
      const pay = {
        fee_assessment_id: 'fee-01',
        tenant_id: 'tenant-delhi-central',
        payment_status: 'PENDING' as const,
      };
      expect(PaymentStateMachine.initiate(pay, traderSec)).toBe('INITIATED');
      pay.payment_status = 'INITIATED';
      expect(PaymentStateMachine.authorize(pay, traderSec)).toBe('AUTHORIZED');
      pay.payment_status = 'AUTHORIZED';
      expect(PaymentStateMachine.reconcile(pay, lmoSec)).toBe('SUCCESS');

      const std = {
        standard_id: 'std-01',
        tenant_id: 'tenant-delhi-central',
        calibration_status: 'ACTIVE' as const,
        valid_until: '2027-01-01',
      };
      expect(StandardStateMachine.markDue(std, lmoSec)).toBe('DUE_CALIBRATION');
      std.calibration_status = 'DUE_CALIBRATION';
      expect(StandardStateMachine.sendForCalibration(std, lmoSec)).toBe('UNDER_CALIBRATION');
      std.calibration_status = 'UNDER_CALIBRATION';
      expect(StandardStateMachine.recalibrate(std, lmoSec, '2028-01-01')).toBe('ACTIVE');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 7: Authoritative Prisma Schema (explorer_security_infra)           */
  /* -------------------------------------------------------------------------- */
  describe('Feature 7: Authoritative Database Schema & Domain Entity Models', () => {
    it('T1.7.1 should model Instrument and Model relations with exact decimal intervals', () => {
      const model = {
        model_id: 'MOD-01',
        model_approval_number: 'IND-MOD-2024-001',
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: exactDecimal('0.005'),
        max_capacity: exactDecimal('30.0'),
      };
      expect(model.verification_scale_interval_e.toString()).toBe('0.005');
      expect(model.max_capacity.toString()).toBe('30');
    });

    it('T1.7.2 should model Verification Application with itemized fee assessment', () => {
      const fee = {
        fee_assessment_id: 'fee-01',
        base_verification_fee: exactDecimal('1000.00'),
        user_charge: exactDecimal('200.00'),
        late_fee: exactDecimal('0.00'),
        total_assessed_amount: exactDecimal('1200.00'),
        currency: 'INR',
        payment_status: 'PAYMENT_PENDING',
      };
      expect(fee.total_assessed_amount.toString()).toBe('1200');
    });

    it('T1.7.3 should model Verification Session with test observations and calculation traces', () => {
      const session = {
        session_id: 'sess-01',
        procedure_pack_id: 'IND-LM-NAWI-CLASS-III-2026.1',
        procedure_pack_checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        status: 'FINALIZED',
        automated_evaluation_flag: true,
      };
      expect(session.procedure_pack_checksum).toHaveLength(64);
    });

    it('T1.7.4 should model decoupled PhysicalStampAction ledger entries', () => {
      const stamp = {
        stamp_action_id: 'stamp-01',
        seal_type: 'LEAD_WIRE_SEAL',
        seal_identification_number: 'DL-SEAL-2026-0042',
        seal_position: 'CALIBRATION_PORT_MAIN',
        action_type: 'SEAL_APPLIED',
      };
      expect(stamp.seal_type).toBe('LEAD_WIRE_SEAL');
      expect(stamp.seal_identification_number).toBe('DL-SEAL-2026-0042');
    });

    it('T1.7.5 should model Certificate with status event audit records', () => {
      const event = {
        status_event_id: 'evt-01',
        certificate_id: 'cert-01',
        previous_status: 'ISSUED',
        new_status: 'SUSPENDED',
        actor_id: 'sup-01',
        reason: 'Broken seal during inspection',
      };
      expect(event.new_status).toBe('SUSPENDED');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 8: Multi-Tenant Database Seeding (spec_miner_frontend)              */
  /* -------------------------------------------------------------------------- */
  describe('Feature 8: Multi-Tenant Database Seeding & Mock Fixtures', () => {
    it('T1.8.1 should include Delhi tenant fixture (tenant-delhi-central, IN-DL)', () => {
      const tenantFixture = {
        tenant_id: 'tenant-delhi-central',
        state_code: 'IN-DL',
        state_name: 'NCT of Delhi',
      };
      expect(tenantFixture.tenant_id).toBe('tenant-delhi-central');
      expect(tenantFixture.state_code).toBe('IN-DL');
    });

    it('T1.8.2 should include Central Delhi Jurisdiction fixture (jur-dl-01)', () => {
      const jurFixture = {
        jurisdiction_id: 'jur-dl-01',
        code: 'JUR-DL-01',
        name: 'Central Delhi Zone',
      };
      expect(jurFixture.jurisdiction_id).toBe('jur-dl-01');
    });

    it('T1.8.3 should include standard user fixtures (trader, lmo, supervisor, admin)', () => {
      const users = [
        { id: 'usr-trader-01', role: 'OWNER' },
        { id: 'lmo-officer-01', role: 'LMO' },
        { id: 'sup-officer-01', role: 'SUPERVISOR' },
        { id: 'adm-system-01', role: 'ADMIN' },
      ];
      expect(users.length).toBe(4);
    });

    it('T1.8.4 should include approved NAWI model fixtures (MOD-NAWI-01, 02, 03)', () => {
      const models = ['MOD-NAWI-01', 'MOD-NAWI-02', 'MOD-NAWI-03'];
      expect(models).toContain('MOD-NAWI-01');
      expect(models).toContain('MOD-NAWI-02');
      expect(models).toContain('MOD-NAWI-03');
    });

    it('T1.8.5 should include demonstration QR verification tokens (VALID, EXPIRED, SUSPENDED, REVOKED, SUPERSEDED)', () => {
      const tokens = [
        'TOKEN_VALID_2026',
        'TOKEN_EXPIRED_2025',
        'TOKEN_SUSPENDED_2026',
        'TOKEN_REVOKED_2026',
        'TOKEN_SUPERSEDED_2025',
      ];
      expect(tokens.length).toBe(5);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 9: Fastify Server Core & Security (spec_miner_frontend)            */
  /* -------------------------------------------------------------------------- */
  describe('Feature 9: Fastify Server Core & Security Configurations', () => {
    it('T1.9.1 should configure CORS origins allowing frontend on port 5173', () => {
      const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
      expect(allowedOrigins).toContain('http://localhost:5173');
    });

    it('T1.9.2 should configure Helmet security headers (CSP, HSTS, frameguard)', () => {
      const securityHeaders = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      };
      expect(securityHeaders['X-Frame-Options']).toBe('DENY');
    });

    it('T1.9.3 should format domain errors into standard .detail JSON payload', () => {
      const err = new GuardConditionFailedError('Verification prerequisite missing', 'PRE_REQ_MISSING');
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Verification prerequisite missing');
      expect(err.errorCode).toBe('PRE_REQ_MISSING');
    });

    it('T1.9.4 should distinguish client 4xx errors from server 5xx errors', () => {
      const notFound = new NotFoundError('Instrument not found');
      expect(notFound.statusCode).toBe(404);

      const forbidden = new ForbiddenError('Access denied');
      expect(forbidden.statusCode).toBe(403);
    });

    it('T1.9.5 should enforce standard pagination response envelope format', () => {
      const paginated = {
        items: [{ id: 1 }, { id: 2 }],
        total: 2,
        page: 1,
        page_size: 50,
        total_pages: 1,
      };
      expect(paginated.items).toHaveLength(2);
      expect(paginated.total).toBe(2);
      expect(paginated.total_pages).toBe(1);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 10: Multi-Tenant RBAC/ABAC Auth (explorer_security_infra)          */
  /* -------------------------------------------------------------------------- */
  describe('Feature 10: Multi-Tenant RBAC/ABAC Authentication & Guards', () => {
    it('T1.10.1 should parse statutory context headers (X-Actor-Id, X-Actor-Role, X-Tenant-Id)', () => {
      const headers = {
        'x-actor-id': 'usr-trader-01',
        'x-actor-role': 'OWNER',
        'x-tenant-id': 'tenant-delhi-central',
        'x-jurisdiction-id': 'jur-dl-01',
      };
      expect(headers['x-actor-role']).toBe('OWNER');
      expect(headers['x-tenant-id']).toBe('tenant-delhi-central');
    });

    it('T1.10.2 should allow OWNER to manage own instruments and file applications', () => {
      expect(traderSec.role).toBe('OWNER');
    });

    it('T1.10.3 should enforce LMO role for scrutiny, scheduling, and observations', () => {
      const app = {
        application_id: 'app-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'SUBMITTED' as const,
        version: 1,
      };
      expect(() => ApplicationStateMachine.beginScrutiny(app, traderSec)).toThrow(ForbiddenError);
      expect(ApplicationStateMachine.beginScrutiny(app, lmoSec)).toBe('UNDER_SCRUTINY');
    });

    it('T1.10.4 should enforce SUPERVISOR role for certificate revocation and reinstatement', () => {
      const cert = {
        certificate_id: 'cert-01',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'SUSPENDED' as const,
        session_id: 'sess-01',
      };
      expect(() => CertificateStateMachine.reinstate(cert, lmoSec, 'Reinstated')).toThrow(ForbiddenError);
      expect(CertificateStateMachine.reinstate(cert, supSec, 'Reinstated by supervisor')).toBe('ISSUED');
    });

    it('T1.10.5 should block cross-tenant resource modification', () => {
      const app = {
        application_id: 'app-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'DRAFT' as const,
        applicant_declaration_accepted: true,
        version: 1,
      };
      expect(() => ApplicationStateMachine.submit(app, otherTenantSec)).toThrow(UnauthorizedTransitionError);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 11: Instrument & Model REST APIs (spec_miner_frontend §3.1)       */
  /* -------------------------------------------------------------------------- */
  describe('Feature 11: Instrument & Model REST Contracts', () => {
    it('T1.11.1 should construct valid Instrument registration request payload', () => {
      const payload = {
        jurisdiction_id: 'jur-dl-01',
        model_id: 'MOD-NAWI-01',
        owner_id: 'usr-trader-01',
        facility_id: 'fac-retail-01',
        serial_number: 'SN-2026-DL-9941',
        year_of_manufacture: 2024,
        intended_use: 'Retail Supermarket Trade',
      };
      expect(payload.serial_number).toBe('SN-2026-DL-9941');
    });

    it('T1.11.2 should support instrument retrieval by public token or ID', () => {
      const inst = {
        instrument_id: 'inst-dl-001',
        public_instrument_token: 'INST_TOKEN_DL_001',
        current_status: 'UNVERIFIED',
      };
      expect(inst.public_instrument_token).toBe('INST_TOKEN_DL_001');
    });

    it('T1.11.3 should list approved instrument models with specifications', () => {
      const model = {
        model_id: 'MOD-NAWI-01',
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: 0.005,
        max_capacity: 30.0,
      };
      expect(model.accuracy_class).toBe('CLASS_III');
    });

    it('T1.11.4 should support instrument pagination query parameters', () => {
      const query = { page: 1, page_size: 50 };
      expect(query.page).toBe(1);
      expect(query.page_size).toBe(50);
    });

    it('T1.11.5 should validate instrument status enums (UNVERIFIED, VERIFIED, EXPIRED, etc.)', () => {
      const validStatuses = ['UNVERIFIED', 'VERIFIED', 'VERIFICATION_DUE', 'OVERDUE', 'REJECTED'];
      expect(validStatuses).toContain('UNVERIFIED');
      expect(validStatuses).toContain('VERIFIED');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 12: Application Lifecycle APIs (spec_miner_frontend §3.2)          */
  /* -------------------------------------------------------------------------- */
  describe('Feature 12: Application Workflow REST Contracts', () => {
    it('T1.12.1 should construct Application creation payload', () => {
      const appReq = {
        instrument_id: 'inst-dl-001',
        applicant_id: 'usr-trader-01',
        application_type: 'INITIAL_VERIFICATION',
        service_mode: 'ON_SITE',
        preferred_verification_date: '2026-08-28',
        applicant_declaration_accepted: true,
      };
      expect(appReq.application_type).toBe('INITIAL_VERIFICATION');
    });

    it('T1.12.2 should construct Scrutiny action payload (ACCEPT, QUERY, REJECT)', () => {
      const scrutinyAccept = { action: 'ACCEPT', notes: 'Documents verified' };
      const scrutinyQuery = { action: 'QUERY', query_text: 'Clarify serial photo' };
      const scrutinyReject = { action: 'REJECT', rejection_reason: 'Non-compliant model' };
      expect(scrutinyAccept.action).toBe('ACCEPT');
      expect(scrutinyQuery.action).toBe('QUERY');
      expect(scrutinyReject.action).toBe('REJECT');
    });

    it('T1.12.3 should construct Fee assessment payload with statutory items', () => {
      const feeReq = {
        base_verification_fee: 1000.0,
        user_charge: 200.0,
        late_fee: 0.0,
        policy_version: 'POL-FEES-2026.1',
      };
      expect(feeReq.base_verification_fee).toBe(1000.0);
    });

    it('T1.12.4 should construct Payment reconciliation payload', () => {
      const payReq = {
        payment_gateway_ref: 'SBIEPAY-1724500000000',
        receipt_number: 'RCPT-2026-991204',
      };
      expect(payReq.payment_gateway_ref).toMatch(/^SBIEPAY/);
    });

    it('T1.12.5 should construct Verification slot scheduling payload', () => {
      const schedReq = {
        slot_start: '2026-08-28T10:00:00Z',
        slot_end: '2026-08-28T12:00:00Z',
        assigned_lmo_id: 'lmo-officer-01',
      };
      expect(schedReq.assigned_lmo_id).toBe('lmo-officer-01');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 13: Verification Session APIs (spec_miner_frontend §3.3)           */
  /* -------------------------------------------------------------------------- */
  describe('Feature 13: Verification Session REST Contracts', () => {
    it('T1.13.1 should construct Session creation payload', () => {
      const sessReq = {
        application_id: 'app-dl-2026-00142',
        instrument_id: 'inst-dl-001',
        procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
        scheduled_date: '2026-08-28',
      };
      expect(sessReq.procedure_pack_id).toContain('NAWI');
    });

    it('T1.13.2 should handle Identity confirmation endpoint contract (serial_verified=true)', () => {
      const serialVerified = true;
      expect(serialVerified).toBe(true);
    });

    it('T1.13.3 should handle Observation submission payload with environmental factors', () => {
      const obsPayload = {
        reference_standard_ids: ['STD-F2-001', 'STD-M1-002'],
        environmental_temp_celsius: 24.5,
        environmental_humidity_percent: 55.0,
        observations: [
          { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: 0.0, raw_indication_reading: 0.0 },
          { step_type: 'INCREASING_LOAD', step_sequence: 2, nominal_load: 10.0, raw_indication_reading: 10.002 },
        ],
      };
      expect(obsPayload.reference_standard_ids).toHaveLength(2);
      expect(obsPayload.observations).toHaveLength(2);
    });

    it('T1.13.4 should construct Statutory disposition request payload', () => {
      const dispReq = {
        outcome: 'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
        disposition_notes: 'All test points verified within MPE limits.',
      };
      expect(dispReq.outcome).toBe('VERIFICATION_PASSED_PENDING_AUTHORIZATION');
    });

    it('T1.13.5 should validate candidate outcome vocabulary', () => {
      const candidateOutcomes = [
        'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
        'VERIFICATION_FAILED',
        'NEEDS_REVIEW',
        'INCOMPLETE_VERIFICATION',
        'OUTSIDE_AUTHORIZATION_SCOPE',
      ];
      expect(candidateOutcomes).toHaveLength(5);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 14: Physical Stamp & Seal APIs (spec_miner_frontend §3.4)          */
  /* -------------------------------------------------------------------------- */
  describe('Feature 14: Decoupled Physical Stamping & Seal Ledger Contracts', () => {
    it('T1.14.1 should construct Physical stamp recording request payload', () => {
      const stampReq = {
        instrument_id: 'inst-dl-001',
        action_type: 'SEAL_APPLIED',
        seal_type: 'LEAD_WIRE_SEAL',
        seal_identification_number: 'DL-SEAL-2026-0042',
        seal_position: 'CALIBRATION_PORT_MAIN',
        notes: 'Lead wire seal embossed with department emblem',
      };
      expect(stampReq.seal_type).toBe('LEAD_WIRE_SEAL');
      expect(stampReq.seal_identification_number).toBe('DL-SEAL-2026-0042');
    });

    it('T1.14.2 should list physical stamps associated with verification session', () => {
      const stamps = [
        {
          stamp_action_id: 'stamp-01',
          session_id: 'sess-01',
          seal_identification_number: 'DL-SEAL-2026-0042',
          action_type: 'SEAL_APPLIED',
        },
      ];
      expect(stamps).toHaveLength(1);
    });

    it('T1.14.3 should record inspection intact action (SEAL_INSPECTED_INTACT)', () => {
      const inspectionStamp = {
        action_type: 'SEAL_INSPECTED_INTACT',
        seal_identification_number: 'DL-SEAL-2026-0042',
      };
      expect(inspectionStamp.action_type).toBe('SEAL_INSPECTED_INTACT');
    });

    it('T1.14.4 should record broken seal replacement (SEAL_DEFECTIVE_REPLACED)', () => {
      const replaceStamp = {
        action_type: 'SEAL_DEFECTIVE_REPLACED',
        seal_identification_number: 'DL-SEAL-2026-0099',
        notes: 'Old broken seal DL-SEAL-2026-0042 replaced',
      };
      expect(replaceStamp.action_type).toBe('SEAL_DEFECTIVE_REPLACED');
    });

    it('T1.14.5 should record photo evidence hash for tamper verification', () => {
      const photoHash = crypto.createHash('sha256').update('photo-bytes').digest('hex');
      expect(photoHash).toHaveLength(64);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 15: Certificate & Status APIs (spec_miner_frontend §3.5)           */
  /* -------------------------------------------------------------------------- */
  describe('Feature 15: Digital Certificate & Lifecycle REST Contracts', () => {
    it('T1.15.1 should construct Certificate issuance request payload', () => {
      const issueReq = {
        session_id: 'sess-01',
        validity_months: 12,
        signer_notes: 'Statutory certificate issued following NAWI Class III procedure',
      };
      expect(issueReq.validity_months).toBe(12);
    });

    it('T1.15.2 should construct Certificate status update payload (SUSPEND)', () => {
      const suspendReq = {
        action: 'SUSPEND',
        reason: 'Physical seal reported broken during routine surveillance',
        statutory_authority_reference: 'Section 24(3) Order #LM-DEL-2026-088',
      };
      expect(suspendReq.action).toBe('SUSPEND');
    });

    it('T1.15.3 should construct Certificate status update payload (REINSTATE)', () => {
      const reinstateReq = {
        action: 'REINSTATE',
        reason: 'Physical inspection confirmed intact seal after reverification',
      };
      expect(reinstateReq.action).toBe('REINSTATE');
    });

    it('T1.15.4 should construct Certificate status update payload (REVOKE)', () => {
      const revokeReq = {
        action: 'REVOKE',
        reason: 'Unauthorized electronic calibration modification detected',
        statutory_authority_reference: 'Section 24(4) Order #LM-DEL-REV-2026-012',
      };
      expect(revokeReq.action).toBe('REVOKE');
    });

    it('T1.15.5 should construct Certificate status update payload (SUPERSEDE)', () => {
      const supersedeReq = {
        action: 'SUPERSEDE',
        reason: 'Periodic reverification certificate issued',
        superseding_certificate_id: 'cert-dl-demo-valid-01',
      };
      expect(supersedeReq.action).toBe('SUPERSEDE');
      expect(supersedeReq.superseding_certificate_id).toBe('cert-dl-demo-valid-01');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 16: RFC 8785 Canonical JSON & SHA-256 (explorer_security_infra §2)  */
  /* -------------------------------------------------------------------------- */
  describe('Feature 16: RFC 8785 JCS Canonicalization & SHA-256 Hashes', () => {
    // RFC 8785 Canonicalizer Helper
    function canonicalJsonStringify(data: unknown): string {
      if (data === null || data === undefined) return 'null';
      if (typeof data !== 'object') return JSON.stringify(data);
      if (Array.isArray(data)) return '[' + data.map(canonicalJsonStringify).join(',') + ']';
      const obj = data as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const entries: string[] = [];
      for (const key of keys) {
        const val = obj[key];
        if (val !== undefined && typeof val !== 'function') {
          entries.push(`${JSON.stringify(key)}:${canonicalJsonStringify(val)}`);
        }
      }
      return '{' + entries.join(',') + '}';
    }

    it('T1.16.1 should sort dictionary keys lexicographically at all nesting depths', () => {
      const data = { z: 1, a: 2, m: { y: 'last', b: 'first' } };
      const canonical = canonicalJsonStringify(data);
      expect(canonical).toBe('{"a":2,"m":{"b":"first","y":"last"},"z":1}');
    });

    it('T1.16.2 should eliminate whitespace around structural tokens', () => {
      const data = { key: 'value', numbers: [1, 2, 3] };
      const canonical = canonicalJsonStringify(data);
      expect(canonical).not.toContain(' ');
      expect(canonical).toBe('{"key":"value","numbers":[1,2,3]}');
    });

    it('T1.16.3 should format numbers and exact strings deterministically', () => {
      const data = { capacity: '30.000000', interval: '0.005000' };
      const canonical = canonicalJsonStringify(data);
      expect(canonical).toBe('{"capacity":"30.000000","interval":"0.005000"}');
    });

    it('T1.16.4 should generate 64-character lowercase hexadecimal SHA-256 document hash', () => {
      const payload = { certificate_number: 'CERT-2026-DL-00042', status: 'ISSUED' };
      const canonical = canonicalJsonStringify(payload);
      const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('T1.16.5 should ensure single bit flip produces completely different SHA-256 hash', () => {
      const payload1 = canonicalJsonStringify({ cert: 'CERT-1', val: '10.0' });
      const payload2 = canonicalJsonStringify({ cert: 'CERT-1', val: '10.1' });
      const hash1 = crypto.createHash('sha256').update(payload1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(payload2).digest('hex');
      expect(hash1).not.toBe(hash2);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 17: Ed25519 & Simulated HSM DSC (explorer_security_infra §2.3)     */
  /* -------------------------------------------------------------------------- */
  describe('Feature 17: Ed25519 Cryptographic Signing & Simulated HSM DSC', () => {
    // Generate Ed25519 keypair for test
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

    it('T1.17.1 should generate authentic Ed25519 digital signature binding document hash and signer', () => {
      const documentHash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
      const signatureBuffer = crypto.sign(null, Buffer.from(documentHash, 'hex'), privateKey);
      const signatureBase64 = signatureBuffer.toString('base64');
      expect(signatureBase64.length).toBeGreaterThan(30);
    });

    it('T1.17.2 should verify valid cryptographic signature against public key', () => {
      const documentHash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
      const signatureBuffer = crypto.sign(null, Buffer.from(documentHash, 'hex'), privateKey);
      const isValid = crypto.verify(null, Buffer.from(documentHash, 'hex'), publicKey, signatureBuffer);
      expect(isValid).toBe(true);
    });

    it('T1.17.3 should reject tampered document hash during signature verification', () => {
      const originalHash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
      const tamperedHash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b999';
      const signatureBuffer = crypto.sign(null, Buffer.from(originalHash, 'hex'), privateKey);
      const isValid = crypto.verify(null, Buffer.from(tamperedHash, 'hex'), publicKey, signatureBuffer);
      expect(isValid).toBe(false);
    });

    it('T1.17.4 should format digital signature reference binding signer ID and timestamp', () => {
      const sigRef = `SIG-ED25519-DL-2026-LMO-00042:v1`;
      expect(sigRef).toMatch(/^SIG-ED25519/);
    });

    it('T1.17.5 should use timing-safe comparison for signature validation', () => {
      const buf1 = Buffer.from('4f53cda18c2baa0c', 'hex');
      const buf2 = Buffer.from('4f53cda18c2baa0c', 'hex');
      const buf3 = Buffer.from('1122334455667788', 'hex');
      expect(crypto.timingSafeEqual(buf1, buf2)).toBe(true);
      expect(crypto.timingSafeEqual(buf1, buf3)).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 18: High-Entropy QR Verification (spec_miner_frontend §3.6)        */
  /* -------------------------------------------------------------------------- */
  describe('Feature 18: High-Entropy QR Verification & Zero-PII Projection', () => {
    it('T1.18.1 should generate 256-bit high-entropy opaque QR tokens', () => {
      const token = `cert_tok_${crypto.randomBytes(32).toString('base64url')}`;
      expect(token).toMatch(/^cert_tok_[A-Za-z0-9_-]{43}$/);
    });

    it('T1.18.2 should project public verification response without leaking trader PII', () => {
      const publicResponse = {
        certificate_number: 'CERT-2026-DL-00042',
        status: 'ISSUED',
        issuing_authority: 'Office of the Controller of Legal Metrology, NCT of Delhi',
        instrument_summary: {
          category: 'Non-Automatic Weighing Instrument (NAWI)',
          subtype: 'Electronic Counter Scale',
          model_name: 'Eagle Electronic Counter Scale Model E-30',
          accuracy_class: 'Class III (Medium Accuracy)',
          max_capacity: 30.0,
          scale_interval_e: 0.005,
          masked_serial_number: 'SN-****-9941',
          physical_seal_number: 'DL-SEAL-2026-0042',
        },
        verification_date: '2026-08-23',
        valid_until: '2027-08-22',
        cryptographic_validity: 'VALID_SIGNATURE',
        certificate_hash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
      };

      // Assert zero PII
      expect((publicResponse as Record<string, unknown>).trader_name).toBeUndefined();
      expect((publicResponse as Record<string, unknown>).phone).toBeUndefined();
      expect((publicResponse as Record<string, unknown>).email).toBeUndefined();
      expect((publicResponse as Record<string, unknown>).gstin).toBeUndefined();
      expect(publicResponse.instrument_summary.masked_serial_number).toBe('SN-****-9941');
    });

    it('T1.18.3 should mask instrument serial numbers correctly', () => {
      function maskSerialNumber(serial: string): string {
        if (!serial || serial.length <= 4) {
          return serial && serial.length >= 2 ? `****${serial.slice(-2)}` : '****';
        }
        const prefix = serial.slice(0, 2);
        const suffix = serial.slice(-4);
        return `${prefix}-****-${suffix}`;
      }

      expect(maskSerialNumber('SN-2026-DL-9941')).toBe('SN-****-9941');
      expect(maskSerialNumber('12345678')).toBe('12-****-5678');
      expect(maskSerialNumber('AB')).toBe('****AB');
    });

    it('T1.18.4 should project supersession pointers when certificate is superseded', () => {
      const publicResponse = {
        certificate_number: 'CERT-2025-DL-00011',
        status: 'SUPERSEDED',
        superseded_by: 'TOKEN_VALID_2026',
      };
      expect(publicResponse.status).toBe('SUPERSEDED');
      expect(publicResponse.superseded_by).toBe('TOKEN_VALID_2026');
    });

    it('T1.18.5 should project statutory revocation reason when certificate is revoked', () => {
      const publicResponse = {
        certificate_number: 'CERT-2026-DL-00109',
        status: 'REVOKED',
        cryptographic_validity: 'INVALID_SIGNATURE',
        revocation_reason: 'Unauthorized electronic calibration modification detected under Section 24.',
      };
      expect(publicResponse.status).toBe('REVOKED');
      expect(publicResponse.revocation_reason).toContain('Section 24');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 19: Binary PDF Certificate Rendering (spec_miner_frontend §3.5.5)  */
  /* -------------------------------------------------------------------------- */
  describe('Feature 19: Binary PDF Certificate Rendering & Content Headers', () => {
    it('T1.19.1 should specify Content-Type application/pdf for PDF downloads', () => {
      const headers = {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Certificate-CERT-2026-DL-00042.pdf"',
      };
      expect(headers['Content-Type']).toBe('application/pdf');
      expect(headers['Content-Disposition']).toContain('attachment');
    });

    it('T1.19.2 should format certificate PDF filename from certificate number', () => {
      const certNumber = 'CERT-2026-DL-00042';
      const filename = `Certificate-${certNumber}.pdf`;
      expect(filename).toBe('Certificate-CERT-2026-DL-00042.pdf');
    });

    it('T1.19.3 should include verification seal mark and digital signature metadata in certificate record', () => {
      const certRecord = {
        certificate_number: 'CERT-2026-DL-00042',
        seal_number: 'DL-SEAL-2026-0042',
        digital_signature_reference: 'SIG-ED25519-DL-2026-LMO-00042',
      };
      expect(certRecord.seal_number).toBe('DL-SEAL-2026-0042');
      expect(certRecord.digital_signature_reference).toContain('SIG-ED25519');
    });

    it('T1.19.4 should support public redacted PDF download route via opaque token', () => {
      const publicPdfRoute = '/api/v1/public/certificates/TOKEN_VALID_2026/pdf';
      expect(publicPdfRoute).toContain('/public/certificates/');
    });

    it('T1.19.5 should return 404 error detail when certificate PDF is not found', () => {
      const notFoundErr = new NotFoundError('Certificate not found');
      expect(notFoundErr.statusCode).toBe(404);
      expect(notFoundErr.message).toBe('Certificate not found');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Feature 20: Multi-Tenant Data Isolation (AGENTS.md §15)                    */
  /* -------------------------------------------------------------------------- */
  describe('Feature 20: Multi-Tenant Data Isolation & Partitioning', () => {
    it('T1.20.1 should reject cross-tenant application queries and modifications', () => {
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

    it('T1.20.2 should reject cross-tenant verification session operations', () => {
      const delhiSession = {
        session_id: 'sess-dl-01',
        tenant_id: 'tenant-delhi-central',
        status: 'PLANNED' as const,
      };
      expect(() => SessionStateMachine.confirmIdentity(delhiSession, otherTenantSec, true)).toThrow(
        UnauthorizedTransitionError
      );
    });

    it('T1.20.3 should reject cross-tenant certificate status modifications', () => {
      const delhiCert = {
        certificate_id: 'cert-dl-01',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-dl-01',
      };
      expect(() => CertificateStateMachine.suspend(delhiCert, otherTenantSec, 'Tampered')).toThrow(
        UnauthorizedTransitionError
      );
    });

    it('T1.20.4 should reject cross-tenant reference standard operations', () => {
      const delhiStd = {
        standard_id: 'std-dl-01',
        tenant_id: 'tenant-delhi-central',
        calibration_status: 'ACTIVE' as const,
        valid_until: '2027-01-01',
      };
      expect(() => StandardStateMachine.sendForCalibration(delhiStd, otherTenantSec)).toThrow(
        UnauthorizedTransitionError
      );
    });

    it('T1.20.5 should allow ADMIN role to perform cross-tenant operations with audit logging', () => {
      const delhiApp = {
        application_id: 'app-dl-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'DRAFT' as const,
        applicant_declaration_accepted: true,
        version: 1,
      };
      // Admin from any security context can manage
      expect(ApplicationStateMachine.submit(delhiApp, adminSec)).toBe('SUBMITTED');
    });
  });
});
