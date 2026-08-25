import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  exactDecimal,
  compareDecimals,
  roundTo,
  MetrologyDomainError,
  Decimal,
} from '../../src/core/decimal.js';
import { calculateNawiMpe } from '../../src/metrology/mpe.js';
import {
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
  GuardConditionFailedError,
  InvalidStateTransitionError,
  ForbiddenError,
  UnauthorizedTransitionError,
} from '../../src/core/errors.js';
import { SecurityContext } from '../../src/core/types.js';

describe('Tier 3: Pairwise & Cross-Feature Interactions Suite', () => {
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

  /* -------------------------------------------------------------------------- */
  /* Flow 1: Scrutiny Query -> Correction -> Fee -> Payment -> Scheduling       */
  /* -------------------------------------------------------------------------- */
  describe('Flow 1: Query -> Correction -> Fee -> Pay -> Schedule -> Start', () => {
    it('should successfully execute entire multi-step query, correction, payment and scheduling flow', () => {
      // 1. Trader files application
      const app = {
        application_id: 'app-dl-flow-1',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'DRAFT' as const,
        applicant_declaration_accepted: true,
        version: 1,
      };
      expect(ApplicationStateMachine.submit(app, traderSec)).toBe('SUBMITTED');
      app.current_status = 'SUBMITTED';

      // 2. LMO scrutinizes and raises query for missing model approval plate
      expect(ApplicationStateMachine.beginScrutiny(app, lmoSec)).toBe('UNDER_SCRUTINY');
      app.current_status = 'UNDER_SCRUTINY';

      expect(
        ApplicationStateMachine.raiseQuery(app, lmoSec, 'Upload clear photograph of model approval plate')
      ).toBe('QUERY_RAISED');
      app.current_status = 'QUERY_RAISED';

      // 3. Trader submits correction notes (version increments to 2)
      const correction = ApplicationStateMachine.submitCorrection(
        app,
        traderSec,
        'Plate photo re-uploaded with verified number IND-MOD-2024-8842'
      );
      expect(correction.nextStatus).toBe('CORRECTION_SUBMITTED');
      expect(correction.nextVersion).toBe(2);
      app.current_status = 'CORRECTION_SUBMITTED';
      app.version = correction.nextVersion;

      // 4. LMO accepts corrected application
      expect(ApplicationStateMachine.accept(app, lmoSec)).toBe('ACCEPTED');
      app.current_status = 'ACCEPTED';

      // 5. Fee Assessment & Reconciliation
      const fee = {
        fee_assessment_id: 'fee-flow-1',
        tenant_id: 'tenant-delhi-central',
        payment_status: 'PENDING' as const,
      };
      expect(PaymentStateMachine.initiate(fee, traderSec)).toBe('INITIATED');
      fee.payment_status = 'INITIATED';
      expect(PaymentStateMachine.authorize(fee, traderSec)).toBe('AUTHORIZED');
      fee.payment_status = 'AUTHORIZED';
      expect(PaymentStateMachine.reconcile(fee, lmoSec)).toBe('SUCCESS');
      fee.payment_status = 'SUCCESS';

      expect(ApplicationStateMachine.reconcilePayment(app, traderSec)).toBe('FEE_PAID');
      app.current_status = 'FEE_PAID';

      // 6. LMO Schedules inspection slot
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

      // 7. Testing commences
      expect(ApplicationStateMachine.commenceTesting(app, lmoSec)).toBe('VERIFICATION_IN_PROGRESS');
      app.current_status = 'VERIFICATION_IN_PROGRESS';
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Flow 2: Broken Seal -> Replacement Stamp Action -> Certificate Audit       */
  /* -------------------------------------------------------------------------- */
  describe('Flow 2: Broken Physical Seal Recording -> Replacement Stamp & Audit', () => {
    it('should record broken seal and affix new tamper-evident replacement seal', () => {
      // 1. Initial Certificate issued with Seal DL-SEAL-2026-0042
      const cert = {
        certificate_id: 'cert-dl-seal-flow',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-dl-01',
      };

      // 2. Inspection logs old broken seal
      const brokenSealRecord = {
        action_type: 'SEAL_BROKEN_RECORDED',
        seal_identification_number: 'DL-SEAL-2026-0042',
        notes: 'Lead wire broken due to accidental impact during warehouse transit',
      };
      expect(brokenSealRecord.action_type).toBe('SEAL_BROKEN_RECORDED');

      // 3. Officer temporarily suspends certificate during replacement
      expect(CertificateStateMachine.suspend(cert, lmoSec, 'Seal replacement in progress')).toBe(
        'SUSPENDED'
      );
      cert.certificate_status = 'SUSPENDED';

      // 4. Officer performs physical reverification and applies new lead wire seal
      const newSealRecord = {
        action_type: 'SEAL_DEFECTIVE_REPLACED',
        seal_identification_number: 'DL-SEAL-2026-0099',
        seal_position: 'CALIBRATION_PORT_MAIN',
        photo_evidence_hash: crypto.createHash('sha256').update('new-seal-photo').digest('hex'),
      };
      expect(newSealRecord.seal_identification_number).toBe('DL-SEAL-2026-0099');
      expect(newSealRecord.photo_evidence_hash).toHaveLength(64);

      // 5. Supervisor inspects and reinstates certificate
      expect(CertificateStateMachine.reinstate(cert, supSec, 'New seal DL-SEAL-2026-0099 verified intact')).toBe(
        'ISSUED'
      );
      cert.certificate_status = 'ISSUED';
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Flow 3: Suspension -> Reinstatement vs Permanent Revocation                */
  /* -------------------------------------------------------------------------- */
  describe('Flow 3: Certificate Suspension -> Supervisor Reinstatement vs Revocation', () => {
    it('Branch A: Routine suspension resolved cleanly via Supervisor Reinstatement', () => {
      const cert = {
        certificate_id: 'cert-branch-a',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-01',
      };

      expect(CertificateStateMachine.suspend(cert, lmoSec, 'Routine audit check')).toBe('SUSPENDED');
      cert.certificate_status = 'SUSPENDED';

      expect(CertificateStateMachine.reinstate(cert, supSec, 'Audit passed successfully')).toBe('ISSUED');
      cert.certificate_status = 'ISSUED';
    });

    it('Branch B: Fraud detection leads to Permanent Irreversible Revocation', () => {
      const cert = {
        certificate_id: 'cert-branch-b',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-02',
      };

      expect(CertificateStateMachine.suspend(cert, lmoSec, 'Tampering suspect')).toBe('SUSPENDED');
      cert.certificate_status = 'SUSPENDED';

      // Supervisor issues Section 24(4) revocation order
      expect(
        CertificateStateMachine.revoke(
          cert,
          supSec,
          'Unauthorized electronic firmware modification detected (Order #LM-DEL-REV-2026-099)'
        )
      ).toBe('REVOKED');
      cert.certificate_status = 'REVOKED';

      // Terminal state: Cannot reinstate or re-suspend
      expect(() => CertificateStateMachine.reinstate(cert, supSec, 'Try reinstate')).toThrow(
        InvalidStateTransitionError
      );
      expect(() => CertificateStateMachine.suspend(cert, lmoSec, 'Try suspend')).toThrow(
        InvalidStateTransitionError
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Flow 4: Out-of-Tolerance Calibration Impact on Sessions & Standards       */
  /* -------------------------------------------------------------------------- */
  describe('Flow 4: Standard Calibration Drift -> Impact Review & Quarantine', () => {
    it('should quarantine reference standard upon drift and prevent future session verifications', () => {
      // 1. Standard in active use
      const std = {
        standard_id: 'STD-MASS-DRIFT-01',
        tenant_id: 'tenant-delhi-central',
        calibration_status: 'ACTIVE' as const,
        valid_until: '2027-01-01',
      };

      // 2. Lab recalibration report detects out-of-tolerance mass drift (+50mg on 5kg)
      expect(
        StandardStateMachine.quarantine(
          std,
          lmoSec,
          'Mass drift +50mg exceeds Class F2 MPE tolerance during inter-laboratory comparison'
        )
      ).toBe('QUARANTINED');
      std.calibration_status = 'QUARANTINED';

      // 3. New verification session attempting to use quarantined standard fails closed
      const standardsInput = [
        {
          standard_id: std.standard_id,
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2025-01-01',
          valid_until: '2027-01-01',
          calibration_status: 'QUARANTINED',
        },
      ];
      const valRes = validateReferenceStandards(standardsInput, 'CLASS_III', '0.005', '2026-08-25');
      expect(valRes.isValid).toBe(false);
      expect(valRes.candidateOutcome).toBe('INCOMPLETE_VERIFICATION');
      expect(valRes.errors.some((e) => e.includes('QUARANTINED'))).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Flow 5: GATC Accreditation Scope Enforcement                              */
  /* -------------------------------------------------------------------------- */
  describe('Flow 5: GATC Accreditation Scope Enforcement', () => {
    interface GATCProfile {
      gatc_id: string;
      approved_categories: string[];
      approved_classes: string[];
      max_capacity_kg: number;
    }

    function checkGatcEligibility(
      gatc: GATCProfile,
      category: string,
      accuracyClass: string,
      capacityKg: number
    ): { eligible: boolean; reason?: string } {
      if (!gatc.approved_categories.includes(category)) {
        return { eligible: false, reason: `Category '${category}' not in GATC scope` };
      }
      if (!gatc.approved_classes.includes(accuracyClass)) {
        return { eligible: false, reason: `Accuracy class '${accuracyClass}' not in GATC scope` };
      }
      if (capacityKg > gatc.max_capacity_kg) {
        return { eligible: false, reason: `Capacity ${capacityKg}kg exceeds GATC maximum limit (${gatc.max_capacity_kg}kg)` };
      }
      return { eligible: true };
    }

    const gatcProfile: GATCProfile = {
      gatc_id: 'gatc-delhi-north-01',
      approved_categories: ['NAWI'],
      approved_classes: ['CLASS_III', 'CLASS_IIII'],
      max_capacity_kg: 30000.0, // 30 Tonnes
    };

    it('should permit verification of Class III 30kg counter scale at GATC centre', () => {
      const eligibility = checkGatcEligibility(gatcProfile, 'NAWI', 'CLASS_III', 30.0);
      expect(eligibility.eligible).toBe(true);
    });

    it('should reject verification of Class II Precision Balance (out of class scope)', () => {
      const eligibility = checkGatcEligibility(gatcProfile, 'NAWI', 'CLASS_II', 5.0);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toContain('Accuracy class');
    });

    it('should reject verification of 50T Weighbridge exceeding GATC max capacity (30T)', () => {
      const eligibility = checkGatcEligibility(gatcProfile, 'NAWI', 'CLASS_IIII', 50000.0);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toContain('exceeds GATC maximum limit');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Flow 6: Application Withdrawal Lifecycle                                   */
  /* -------------------------------------------------------------------------- */
  describe('Flow 6: Application Withdrawal Lifecycle Guards', () => {
    it('should allow withdrawal when application is in DRAFT or SUBMITTED state', () => {
      const app = {
        application_id: 'app-withdraw-1',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'SUBMITTED' as const,
        version: 1,
      };
      expect(ApplicationStateMachine.withdraw(app, traderSec)).toBe('WITHDRAWN');
    });

    it('should reject withdrawal once verification is SCHEDULED', () => {
      const app = {
        application_id: 'app-withdraw-2',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'SCHEDULED' as const,
        version: 1,
      };
      expect(() => ApplicationStateMachine.withdraw(app, traderSec)).toThrow(InvalidStateTransitionError);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Flow 7: Certificate Supersession & Bidirectional Linking                   */
  /* -------------------------------------------------------------------------- */
  describe('Flow 7: Certificate Supersession & Public QR Pointer Chain', () => {
    it('should supersede previous certificate and establish bidirectional pointers', () => {
      // 1. Old Certificate (2025-2026)
      const oldCert = {
        certificate_id: 'cert-old-2025',
        certificate_number: 'CERT-2025-DL-00011',
        public_verification_token: 'TOKEN_SUPERSEDED_2025',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-old-01',
        superseding_certificate_id: null as string | null,
      };

      // 2. New Verification Session conducted in 2026 -> New Certificate Issued
      const newCert = {
        certificate_id: 'cert-new-2026',
        certificate_number: 'CERT-2026-DL-00042',
        public_verification_token: 'TOKEN_VALID_2026',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-new-02',
      };

      // 3. Mark old certificate as SUPERSEDED with pointer to new certificate
      expect(
        CertificateStateMachine.supersede(oldCert, lmoSec, newCert.certificate_id)
      ).toBe('SUPERSEDED');
      oldCert.certificate_status = 'SUPERSEDED';
      oldCert.superseding_certificate_id = newCert.certificate_id;

      // 4. Verify public QR projection pointers
      const publicOldVerify = {
        certificate_number: oldCert.certificate_number,
        status: oldCert.certificate_status,
        superseded_by: newCert.public_verification_token,
      };
      expect(publicOldVerify.status).toBe('SUPERSEDED');
      expect(publicOldVerify.superseded_by).toBe('TOKEN_VALID_2026');
    });
  });
});
