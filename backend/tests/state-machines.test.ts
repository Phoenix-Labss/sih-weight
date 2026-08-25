import { describe, it, expect } from 'vitest';
import {
  ApplicationStateMachine,
  SessionStateMachine,
  CertificateStateMachine,
  PaymentStateMachine,
  StandardStateMachine,
} from '../src/core/state-machines/index.js';
import { SecurityContext } from '../src/core/types.js';
import {
  ForbiddenError,
  GuardConditionFailedError,
  InvalidStateTransitionError,
  UnauthorizedTransitionError,
} from '../src/core/errors.js';

describe('Statutory State Machines & Security Isolation', () => {
  const traderContext: SecurityContext = {
    userId: 'usr-trader-01',
    tenantId: 'tenant-delhi-central',
    role: 'OWNER',
  };

  const lmoContext: SecurityContext = {
    userId: 'lmo-officer-01',
    tenantId: 'tenant-delhi-central',
    role: 'LMO',
  };

  const supervisorContext: SecurityContext = {
    userId: 'sup-officer-01',
    tenantId: 'tenant-delhi-central',
    role: 'SUPERVISOR',
  };

  const crossTenantOfficer: SecurityContext = {
    userId: 'lmo-mh-01',
    tenantId: 'tenant-maharashtra-01',
    role: 'LMO',
  };

  describe('Application State Machine', () => {
    const appBase = {
      application_id: 'app-001',
      tenant_id: 'tenant-delhi-central',
      jurisdiction_id: 'jur-dl-01',
      version: 1,
    };

    it('should submit draft application when declaration is accepted', () => {
      const next = ApplicationStateMachine.submit(
        { ...appBase, current_status: 'DRAFT', applicant_declaration_accepted: true },
        traderContext
      );
      expect(next).toBe('SUBMITTED');
    });

    it('should reject submission if applicant declaration is not accepted', () => {
      expect(() =>
        ApplicationStateMachine.submit(
          { ...appBase, current_status: 'DRAFT', applicant_declaration_accepted: false },
          traderContext
        )
      ).toThrow(GuardConditionFailedError);
    });

    it('should block cross-tenant officer from scrutinizing application', () => {
      expect(() =>
        ApplicationStateMachine.beginScrutiny(
          { ...appBase, current_status: 'SUBMITTED' },
          crossTenantOfficer
        )
      ).toThrow(UnauthorizedTransitionError);
    });

    it('should transition to QUERY_RAISED and allow correction with version bump', () => {
      const queryStatus = ApplicationStateMachine.raiseQuery(
        { ...appBase, current_status: 'UNDER_SCRUTINY' },
        lmoContext,
        'Pattern approval certificate missing'
      );
      expect(queryStatus).toBe('QUERY_RAISED');

      const corr = ApplicationStateMachine.submitCorrection(
        { ...appBase, current_status: 'QUERY_RAISED', version: 1 },
        traderContext,
        'Certificate uploaded'
      );
      expect(corr.nextStatus).toBe('CORRECTION_SUBMITTED');
      expect(corr.nextVersion).toBe(2);
    });

    it('should complete full happy path to SCHEDULED and COMPLETED', () => {
      const accepted = ApplicationStateMachine.accept(
        { ...appBase, current_status: 'UNDER_SCRUTINY' },
        lmoContext
      );
      expect(accepted).toBe('ACCEPTED');

      const paid = ApplicationStateMachine.reconcilePayment(
        { ...appBase, current_status: 'FEE_PENDING' },
        traderContext
      );
      expect(paid).toBe('FEE_PAID');

      const scheduled = ApplicationStateMachine.schedule(
        { ...appBase, current_status: 'FEE_PAID' },
        lmoContext,
        '2026-08-28T10:00:00Z',
        '2026-08-28T12:00:00Z',
        'lmo-officer-01'
      );
      expect(scheduled).toBe('SCHEDULED');

      const inProgress = ApplicationStateMachine.commenceTesting(
        { ...appBase, current_status: 'SCHEDULED' },
        lmoContext
      );
      expect(inProgress).toBe('VERIFICATION_IN_PROGRESS');

      const completed = ApplicationStateMachine.complete(
        { ...appBase, current_status: 'VERIFICATION_IN_PROGRESS' },
        lmoContext,
        true
      );
      expect(completed).toBe('COMPLETED');
    });
  });

  describe('Verification Session State Machine', () => {
    const sessionBase = {
      session_id: 'sess-001',
      tenant_id: 'tenant-delhi-central',
    };

    it('should execute lifecycle: PLANNED -> IDENTITY_CONFIRMED -> IN_PROGRESS -> SUBMITTED -> FINALIZED', () => {
      const idConf = SessionStateMachine.confirmIdentity(
        { ...sessionBase, status: 'PLANNED' },
        lmoContext,
        true
      );
      expect(idConf).toBe('IDENTITY_CONFIRMED');

      const inProg = SessionStateMachine.startSession(
        { ...sessionBase, status: 'IDENTITY_CONFIRMED' },
        lmoContext
      );
      expect(inProg).toBe('IN_PROGRESS');

      const submitted = SessionStateMachine.submitObservations(
        { ...sessionBase, status: 'IN_PROGRESS' },
        lmoContext,
        5
      );
      expect(submitted).toBe('SUBMITTED');

      const finalized = SessionStateMachine.recordDisposition(
        { ...sessionBase, status: 'SUBMITTED', automated_evaluation_flag: true },
        lmoContext,
        'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
        'Approved by LMO'
      );
      expect(finalized.nextStatus).toBe('FINALIZED');
      expect(finalized.outcome).toBe('VERIFICATION_PASSED_PENDING_AUTHORIZATION');
    });

    it('should block PASSED outcome if automated calculation flag is false', () => {
      expect(() =>
        SessionStateMachine.recordDisposition(
          { ...sessionBase, status: 'SUBMITTED', automated_evaluation_flag: false },
          lmoContext,
          'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
        )
      ).toThrow(GuardConditionFailedError);
    });
  });

  describe('Certificate State Machine', () => {
    const certBase = {
      certificate_id: 'cert-001',
      tenant_id: 'tenant-delhi-central',
      session_id: 'sess-001',
    };

    it('should issue certificate from DRAFT', () => {
      const issued = CertificateStateMachine.issue(
        { ...certBase, certificate_status: 'DRAFT' },
        lmoContext,
        'SIG-ED25519-001'
      );
      expect(issued).toBe('ISSUED');
    });

    it('should suspend and reinstate certificate', () => {
      const suspended = CertificateStateMachine.suspend(
        { ...certBase, certificate_status: 'ISSUED' },
        lmoContext,
        'Seal damaged'
      );
      expect(suspended).toBe('SUSPENDED');

      const reinstated = CertificateStateMachine.reinstate(
        { ...certBase, certificate_status: 'SUSPENDED' },
        supervisorContext,
        'Seal verified and replaced'
      );
      expect(reinstated).toBe('ISSUED');
    });

    it('should revoke certificate permanently and reject reinstatement', () => {
      const revoked = CertificateStateMachine.revoke(
        { ...certBase, certificate_status: 'ISSUED' },
        supervisorContext,
        'Tampered electronics'
      );
      expect(revoked).toBe('REVOKED');

      expect(() =>
        CertificateStateMachine.reinstate(
          { ...certBase, certificate_status: 'REVOKED' },
          supervisorContext,
          'Attempted reinstatement'
        )
      ).toThrow(InvalidStateTransitionError);
    });
  });

  describe('Payment State Machine', () => {
    const payBase = {
      fee_assessment_id: 'fee-001',
      tenant_id: 'tenant-delhi-central',
    };

    it('should transition through PENDING -> INITIATED -> AUTHORIZED -> SUCCESS -> REFUNDED', () => {
      const initiated = PaymentStateMachine.initiate(
        { ...payBase, payment_status: 'PENDING' },
        traderContext
      );
      expect(initiated).toBe('INITIATED');

      const authorized = PaymentStateMachine.authorize(
        { ...payBase, payment_status: 'INITIATED' },
        lmoContext
      );
      expect(authorized).toBe('AUTHORIZED');

      const reconciled = PaymentStateMachine.reconcile(
        { ...payBase, payment_status: 'AUTHORIZED' },
        lmoContext
      );
      expect(reconciled).toBe('SUCCESS');

      const refunded = PaymentStateMachine.refund(
        { ...payBase, payment_status: 'SUCCESS' },
        supervisorContext
      );
      expect(refunded).toBe('REFUNDED');
    });
  });

  describe('Standard State Machine', () => {
    const stdBase = {
      standard_id: 'std-001',
      tenant_id: 'tenant-delhi-central',
      valid_until: '2027-01-01',
    };

    it('should manage standard lifecycle through DUE -> UNDER_CALIBRATION -> ACTIVE -> QUARANTINED -> RETIRED', () => {
      const due = StandardStateMachine.markDue(
        { ...stdBase, calibration_status: 'ACTIVE' },
        lmoContext
      );
      expect(due).toBe('DUE_CALIBRATION');

      const underCal = StandardStateMachine.sendForCalibration(
        { ...stdBase, calibration_status: 'DUE_CALIBRATION' },
        lmoContext
      );
      expect(underCal).toBe('UNDER_CALIBRATION');

      const active = StandardStateMachine.recalibrate(
        { ...stdBase, calibration_status: 'UNDER_CALIBRATION' },
        lmoContext,
        '2028-01-01'
      );
      expect(active).toBe('ACTIVE');

      const quarantined = StandardStateMachine.quarantine(
        { ...stdBase, calibration_status: 'ACTIVE' },
        lmoContext,
        'Mass drift observed'
      );
      expect(quarantined).toBe('QUARANTINED');

      const retired = StandardStateMachine.retire(
        { ...stdBase, calibration_status: 'QUARANTINED' },
        supervisorContext
      );
      expect(retired).toBe('RETIRED');
    });
  });
});
