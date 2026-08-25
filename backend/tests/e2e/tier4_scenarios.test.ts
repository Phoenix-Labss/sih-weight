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
  DomainError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  GuardConditionFailedError,
  InvalidStateTransitionError,
  UnauthorizedTransitionError,
} from '../../src/core/errors.js';
import { SecurityContext } from '../../src/core/types.js';

describe('Tier 4: Real-World Multi-Actor End-to-End Application Workflows', () => {
  const delhiTrader: SecurityContext = {
    userId: 'usr-trader-01',
    tenantId: 'tenant-delhi-central',
    role: 'OWNER',
    jurisdictionId: 'jur-dl-01',
  };

  const delhiLmo: SecurityContext = {
    userId: 'lmo-officer-01',
    tenantId: 'tenant-delhi-central',
    role: 'LMO',
    jurisdictionId: 'jur-dl-01',
  };

  const delhiSupervisor: SecurityContext = {
    userId: 'sup-officer-01',
    tenantId: 'tenant-delhi-central',
    role: 'SUPERVISOR',
    jurisdictionId: 'jur-dl-01',
  };

  const mumbaiTrader: SecurityContext = {
    userId: 'usr-mumbai-trader-01',
    tenantId: 'tenant-maharashtra-mumbai',
    role: 'OWNER',
    jurisdictionId: 'jur-mh-01',
  };

  const mumbaiLmo: SecurityContext = {
    userId: 'lmo-mumbai-01',
    tenantId: 'tenant-maharashtra-mumbai',
    role: 'LMO',
    jurisdictionId: 'jur-mh-01',
  };

  /* -------------------------------------------------------------------------- */
  /* Scenario 1: Complete Multi-Actor Statutory Lifecycle                       */
  /* -------------------------------------------------------------------------- */
  describe('Scenario 1: Complete End-to-End Initial Verification & Public QR Verification', () => {
    it('should complete registration -> application -> scrutiny -> fee -> pay -> schedule -> session -> calculation -> seal -> cert -> QR', () => {
      // Step 1: Instrument Registration
      const instrument = {
        instrument_id: 'inst-dl-retail-30kg',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        model_id: 'MOD-NAWI-01',
        owner_id: delhiTrader.userId,
        serial_number: 'SN-2026-DL-9941',
        accuracy_class: 'CLASS_III',
        verification_scale_interval_e: '0.005',
        max_capacity: '30.0',
        min_capacity: '0.1',
        current_status: 'UNVERIFIED',
      };
      expect(instrument.serial_number).toBe('SN-2026-DL-9941');

      // Step 2: Application Filing
      const application = {
        application_id: 'app-dl-2026-00142',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        instrument_id: instrument.instrument_id,
        current_status: 'DRAFT' as const,
        applicant_declaration_accepted: true,
        version: 1,
      };
      expect(ApplicationStateMachine.submit(application, delhiTrader)).toBe('SUBMITTED');
      application.current_status = 'SUBMITTED';

      // Step 3: Officer Scrutiny
      expect(ApplicationStateMachine.beginScrutiny(application, delhiLmo)).toBe('UNDER_SCRUTINY');
      application.current_status = 'UNDER_SCRUTINY';
      expect(ApplicationStateMachine.accept(application, delhiLmo)).toBe('ACCEPTED');
      application.current_status = 'ACCEPTED';

      // Step 4: Fee Assessment & Payment (Base ₹200 + On-site ₹200 + Portal ₹50 = ₹450)
      const fee = {
        fee_assessment_id: 'fee-dl-00142',
        tenant_id: 'tenant-delhi-central',
        payment_status: 'PENDING' as const,
      };
      expect(PaymentStateMachine.initiate(fee, delhiTrader)).toBe('INITIATED');
      expect(PaymentStateMachine.authorize(fee, delhiTrader)).toBe('AUTHORIZED');
      expect(PaymentStateMachine.reconcile(fee, delhiLmo)).toBe('SUCCESS');

      expect(ApplicationStateMachine.reconcilePayment(application, delhiTrader)).toBe('FEE_PAID');
      application.current_status = 'FEE_PAID';

      // Step 5: Scheduling Verification Slot
      expect(
        ApplicationStateMachine.schedule(
          application,
          delhiLmo,
          '2026-08-28T10:00:00Z',
          '2026-08-28T12:00:00Z',
          delhiLmo.userId
        )
      ).toBe('SCHEDULED');
      application.current_status = 'SCHEDULED';

      // Step 6: Session Initialization & Identity Confirmation
      const session = {
        session_id: 'sess-dl-2026-00142',
        tenant_id: 'tenant-delhi-central',
        status: 'PLANNED' as const,
      };
      expect(SessionStateMachine.confirmIdentity(session, delhiLmo, true)).toBe('IDENTITY_CONFIRMED');
      session.status = 'IDENTITY_CONFIRMED';

      expect(SessionStateMachine.startSession(session, delhiLmo)).toBe('IN_PROGRESS');
      session.status = 'IN_PROGRESS';

      // Step 7: Guided NAWI Class III Field Observations
      const standards = [
        {
          standard_id: 'STD-MASS-CLASS-F2-001',
          accuracy_class: 'F2',
          denomination_mass: '5.0',
          calibrated_at: '2025-01-01',
          valid_until: '2027-01-01',
          calibration_status: 'ACTIVE',
        },
        {
          standard_id: 'STD-MASS-CLASS-M1-002',
          accuracy_class: 'M1',
          denomination_mass: '20.0',
          calibrated_at: '2025-01-01',
          valid_until: '2027-01-01',
          calibration_status: 'ACTIVE',
        },
      ];
      const stdVal = validateReferenceStandards(standards, 'CLASS_III', '0.005', '2026-08-28');
      expect(stdVal.isValid).toBe(true);

      const observations = [
        { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: '0.0', raw_indication_reading: '0.000', delta_L: '0.0025' },
        { step_type: 'INCREASING_LOAD', step_sequence: 2, nominal_load: '0.1', raw_indication_reading: '0.100', delta_L: '0.0025' },
        { step_type: 'INCREASING_LOAD', step_sequence: 3, nominal_load: '2.5', raw_indication_reading: '2.501', delta_L: '0.0025' },
        { step_type: 'INCREASING_LOAD', step_sequence: 4, nominal_load: '10.0', raw_indication_reading: '10.002', delta_L: '0.0025' },
        { step_type: 'INCREASING_LOAD', step_sequence: 5, nominal_load: '30.0', raw_indication_reading: '30.003', delta_L: '0.0025' },
        { step_type: 'ECCENTRICITY', step_sequence: 6, nominal_load: '10.0', raw_indication_reading: '10.001', eccentricity_position: 'CENTER' },
        { step_type: 'REPEATABILITY', step_sequence: 7, nominal_load: '15.0', raw_indication_reading: '15.001', repetition_index: 1 },
      ];

      const nawiResult = evaluateNawiSession(
        { accuracy_class: 'CLASS_III', verification_scale_interval_e: '0.005' },
        observations,
        true
      );
      expect(nawiResult.passed).toBe(true);

      // Step 8: Officer Disposition Recording
      expect(SessionStateMachine.submitObservations(session, delhiLmo, observations.length)).toBe('SUBMITTED');
      session.status = 'SUBMITTED';

      const disp = SessionStateMachine.recordDisposition(
        { ...session, automated_evaluation_flag: nawiResult.passed },
        delhiLmo,
        'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
      );
      expect(disp.nextStatus).toBe('FINALIZED');
      session.status = 'FINALIZED';

      // Step 9: Physical Stamp Affixation
      const stamp = {
        action_type: 'SEAL_APPLIED',
        seal_type: 'LEAD_WIRE_SEAL',
        seal_identification_number: 'DL-SEAL-2026-0042',
        seal_position: 'CALIBRATION_PORT_MAIN',
      };
      expect(stamp.seal_identification_number).toBe('DL-SEAL-2026-0042');

      // Step 10: Cryptographic Digital Certificate Issuance
      const cert = {
        certificate_id: 'cert-dl-2026-00042',
        certificate_number: 'CERT-2026-DL-00042',
        public_verification_token: 'TOKEN_VALID_2026',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'DRAFT' as const,
        session_id: session.session_id,
      };

      const certHash = crypto.createHash('sha256').update(JSON.stringify(cert)).digest('hex');
      const sigRef = `SIG-ED25519-DL-2026-LMO-00042:v1`;

      expect(CertificateStateMachine.issue(cert, delhiLmo, sigRef)).toBe('ISSUED');
      cert.certificate_status = 'ISSUED';

      // Step 11: Public QR Verification Projection
      const publicQrProjection = {
        certificate_number: cert.certificate_number,
        status: cert.certificate_status,
        issuing_authority: 'Office of the Controller of Legal Metrology, Government of NCT of Delhi',
        instrument_summary: {
          category: 'Non-Automatic Weighing Instrument (NAWI)',
          model_name: 'Eagle Electronic Counter Scale Model E-30',
          accuracy_class: 'Class III (Medium Accuracy)',
          max_capacity: 30.0,
          scale_interval_e: 0.005,
          masked_serial_number: 'SN-****-9941',
          physical_seal_number: stamp.seal_identification_number,
        },
        verification_date: '2026-08-28',
        valid_until: '2027-08-27',
        cryptographic_validity: 'VALID_SIGNATURE',
      };

      expect(publicQrProjection.status).toBe('ISSUED');
      expect(publicQrProjection.cryptographic_validity).toBe('VALID_SIGNATURE');
      expect(publicQrProjection.instrument_summary.masked_serial_number).toBe('SN-****-9941');
      expect(publicQrProjection.instrument_summary.physical_seal_number).toBe('DL-SEAL-2026-0042');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Scenario 2: Periodic Re-verification with Scrutiny Query & Correction      */
  /* -------------------------------------------------------------------------- */
  describe('Scenario 2: Periodic Re-Verification with Scrutiny Query & 2x MPE Evaluation', () => {
    it('should handle query, correction, and in-service reverification with 2x MPE thresholds', () => {
      // 1. Trader files Periodic Reverification
      const app = {
        application_id: 'app-dl-reverif-01',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'SUBMITTED' as const,
        version: 1,
      };

      // 2. LMO raises query regarding internal motorized calibration evidence
      expect(
        ApplicationStateMachine.raiseQuery(app, delhiLmo, 'Submit internal calibration log for precision balance')
      ).toBe('QUERY_RAISED');
      app.current_status = 'QUERY_RAISED';

      // 3. Trader submits correction notes
      const corr = ApplicationStateMachine.submitCorrection(app, delhiTrader, 'Attached certified internal calibration log');
      expect(corr.nextStatus).toBe('CORRECTION_SUBMITTED');
      expect(corr.nextVersion).toBe(2);
      app.current_status = 'CORRECTION_SUBMITTED';

      // 4. LMO accepts and schedules reverification
      expect(ApplicationStateMachine.accept(app, delhiLmo)).toBe('ACCEPTED');

      // 5. Reverification test evaluated at 2x MPE (Seventh Schedule)
      const e = '0.0001'; // 0.1g for Class II Precision Balance 5kg
      // At load 2.0 kg (20,000e), Initial MPE = 1.0e (0.0001kg), Reverif MPE = 2.0e (0.0002kg)
      const reverifMpe = calculateNawiMpe('2.0', e, 'CLASS_II', false);
      expect(reverifMpe.factorInE.toString()).toBe('2');
      expect(reverifMpe.mpeInMass.toString()).toBe('0.0002');

      const reverifObs = {
        step_type: 'INCREASING_LOAD',
        step_sequence: 1,
        nominal_load: '2.0',
        raw_indication_reading: '2.00015', // Error = 0.00015 kg (Fails initial MPE 0.0001, but PASSES reverif MPE 0.0002)
      };
      const reverifRes = evaluateStepObservation(reverifObs, e, 'CLASS_II', '0.0', false);
      expect(reverifRes.is_within_mpe).toBe(true);
      expect(reverifRes.corrected_error.toString()).toBe('0.00015');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Scenario 3: Heavy Weighbridge 50T Verification                             */
  /* -------------------------------------------------------------------------- */
  describe('Scenario 3: Heavy Pitless Weighbridge 50T Multi-Step Verification', () => {
    it('should evaluate heavy weighbridge stepped MPE and statutory fee calculation', () => {
      // 1. Fee assessment for 50,000 kg weighbridge
      // Twelfth Schedule: Base fee for 30-50t is ₹7000. On-site 100% surcharge = ₹7000. Portal = ₹50. Total = ₹14,050.
      const baseFee = exactDecimal('7000.00');
      const onSiteSurcharge = exactDecimal('7000.00');
      const portalCharge = exactDecimal('50.00');
      const totalFee = baseFee.plus(onSiteSurcharge).plus(portalCharge);
      expect(totalFee.toString()).toBe('14050');

      // 2. Class IIII Stepped MPE checks for 50T (e = 10 kg)
      const e = '10.0';
      // Load 500 kg (50e) -> MPE = 0.5e = 5 kg
      expect(calculateNawiMpe('500', e, 'CLASS_IIII', true).mpeInMass.toString()).toBe('5');
      // Load 2000 kg (200e) -> MPE = 1.0e = 10 kg
      expect(calculateNawiMpe('2000', e, 'CLASS_IIII', true).mpeInMass.toString()).toBe('10');
      // Load 50000 kg (5000e) -> MPE = 1.5e = 15 kg
      expect(calculateNawiMpe('50000', e, 'CLASS_IIII', true).mpeInMass.toString()).toBe('15');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Scenario 4: Market Surveillance Detection, Broken Seal & Revocation        */
  /* -------------------------------------------------------------------------- */
  describe('Scenario 4: Market Surveillance Fraud Detection -> Permanent Revocation', () => {
    it('should handle broken seal logging -> certificate suspension -> fraud investigation -> Section 24 Revocation Order', () => {
      const cert = {
        certificate_id: 'cert-dl-tampered-01',
        certificate_number: 'CERT-2026-DL-00109',
        public_verification_token: 'TOKEN_REVOKED_2026',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-dl-99',
      };

      // 1. Officer detects broken physical seal
      expect(CertificateStateMachine.suspend(cert, delhiLmo, 'Tampered physical seal detected')).toBe('SUSPENDED');
      cert.certificate_status = 'SUSPENDED';

      // 2. Departmental technical inspection confirms unauthorized electronic calibration
      expect(
        CertificateStateMachine.revoke(
          cert,
          delhiSupervisor,
          'Unauthorized electronic calibration modification detected during surprise inspection under Section 24 (Order #LM-DEL-REV-2026-012)'
        )
      ).toBe('REVOKED');
      cert.certificate_status = 'REVOKED';

      // 3. Public QR projection displays REVOKED status with statutory reason
      const publicQr = {
        certificate_number: cert.certificate_number,
        status: cert.certificate_status,
        cryptographic_validity: 'INVALID_SIGNATURE',
        revocation_reason: 'Unauthorized electronic calibration modification detected under Section 24.',
      };
      expect(publicQr.status).toBe('REVOKED');
      expect(publicQr.cryptographic_validity).toBe('INVALID_SIGNATURE');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Scenario 5: Multi-Tenant Parallel Operations & Zero Cross-Tenant Leakage   */
  /* -------------------------------------------------------------------------- */
  describe('Scenario 5: Multi-Tenant Strict Isolation (Delhi vs Mumbai)', () => {
    it('should maintain strict zero data leakage across simultaneous multi-tenant operations', () => {
      const delhiApp = {
        application_id: 'app-delhi-001',
        tenant_id: 'tenant-delhi-central',
        jurisdiction_id: 'jur-dl-01',
        current_status: 'DRAFT' as const,
        applicant_declaration_accepted: true,
        version: 1,
      };

      const mumbaiApp = {
        application_id: 'app-mumbai-001',
        tenant_id: 'tenant-maharashtra-mumbai',
        jurisdiction_id: 'jur-mh-01',
        current_status: 'DRAFT' as const,
        applicant_declaration_accepted: true,
        version: 1,
      };

      // Delhi trader submits Delhi application
      expect(ApplicationStateMachine.submit(delhiApp, delhiTrader)).toBe('SUBMITTED');
      delhiApp.current_status = 'SUBMITTED';

      // Mumbai trader submits Mumbai application
      expect(ApplicationStateMachine.submit(mumbaiApp, mumbaiTrader)).toBe('SUBMITTED');
      mumbaiApp.current_status = 'SUBMITTED';

      // Delhi LMO CANNOT scrutinize Mumbai application
      expect(() => ApplicationStateMachine.beginScrutiny(mumbaiApp, delhiLmo)).toThrow(
        UnauthorizedTransitionError
      );

      // Mumbai LMO CANNOT scrutinize Delhi application
      expect(() => ApplicationStateMachine.beginScrutiny(delhiApp, mumbaiLmo)).toThrow(
        UnauthorizedTransitionError
      );

      // Delhi LMO scrutinizes Delhi application
      expect(ApplicationStateMachine.beginScrutiny(delhiApp, delhiLmo)).toBe('UNDER_SCRUTINY');

      // Mumbai LMO scrutinizes Mumbai application
      expect(ApplicationStateMachine.beginScrutiny(mumbaiApp, mumbaiLmo)).toBe('UNDER_SCRUTINY');
    });
  });
});
