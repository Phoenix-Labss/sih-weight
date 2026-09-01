import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

describe('Fastify REST API & Domain Integration Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('Health Checks & Root Aliases', () => {
    it('returns healthy status on /health and /api/v1/health', async () => {
      const res1 = await app.inject({ method: 'GET', url: '/health' });
      expect(res1.statusCode).toBe(200);
      expect(res1.json().status).toBe('HEALTHY');

      const res2 = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().status).toBe('HEALTHY');
    });
  });

  describe('Multi-Tenant Boundary & RBAC Guards', () => {
    it('allows access when request tenant matches actor tenant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/tenant-delhi-central/instruments',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().items).toBeDefined();
    });

    it('rejects cross-tenant access with 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/tenant-mumbai-zone/instruments',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Cross-tenant access violation');
    });

    it('rejects officer-only actions when called by a trader (OWNER)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/applications/app-dl-2026-00142/scrutiny',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
        payload: {
          action: 'ACCEPT',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Access denied');
    });
  });

  describe('Instrument & Model Endpoints', () => {
    it('lists approved instrument models', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/tenant-delhi-central/instruments/models',
      });
      expect(res.statusCode).toBe(200);
      const models = res.json();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThanOrEqual(3);
      expect(models.some((m: any) => m.model_id === 'MOD-NAWI-01')).toBe(true);
    });

    it('registers a new instrument unit and retrieves it', async () => {
      const serialNumber = `SN-TEST-${Date.now()}`;
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/instruments',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
        payload: {
          model_id: 'MOD-NAWI-01',
          owner_id: 'usr-trader-01',
          facility_id: 'fac-retail-01',
          serial_number: serialNumber,
          year_of_manufacture: 2025,
          intended_use: 'Integration Test Scale',
        },
      });

      expect(regRes.statusCode).toBe(201);
      const instrument = regRes.json();
      expect(instrument.instrument_id).toBeDefined();
      expect(instrument.public_instrument_token).toBeDefined();
      expect(instrument.current_status).toBe('UNVERIFIED');
      expect(instrument.model.accuracy_class).toBe('CLASS_III');

      // Fetch by ID
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants/tenant-delhi-central/instruments/${instrument.instrument_id}`,
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().serial_number).toBe(serialNumber);
    });
  });

  describe('Full End-to-End Statutory Verification & Certification Workflow', () => {
    let createdInstrumentId: string;
    let createdApplicationId: string;
    let createdSessionId: string;
    let issuedCertificateId: string;
    let issuedQrToken: string;

    it('1. Files a new verification application in DRAFT state', async () => {
      // First create an instrument
      const instRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/instruments',
        payload: {
          model_id: 'MOD-NAWI-01',
          owner_id: 'usr-trader-01',
          facility_id: 'fac-retail-01',
          serial_number: `SN-FLOW-${Date.now()}`,
          year_of_manufacture: 2025,
        },
      });
      createdInstrumentId = instRes.json().instrument_id;

      // File application without declaration (DRAFT)
      const appRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/applications',
        payload: {
          instrument_id: createdInstrumentId,
          applicant_id: 'usr-trader-01',
          application_type: 'INITIAL_VERIFICATION',
          service_mode: 'ON_SITE',
          applicant_declaration_accepted: false,
        },
      });

      expect(appRes.statusCode).toBe(201);
      const appData = appRes.json();
      createdApplicationId = appData.application_id;
      expect(appData.current_status).toBe('DRAFT');
      expect(appData.fee_assessment).toBeDefined();
    });

    it('2. Submits draft application to SUBMITTED state', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/applications/${createdApplicationId}/submit`,
        payload: {},
      });

      expect(submitRes.statusCode).toBe(200);
      expect(submitRes.json().current_status).toBe('SUBMITTED');
    });

    it('3. LMO raises scrutiny query and Trader submits correction', async () => {
      // Officer queries application
      const queryRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/applications/${createdApplicationId}/scrutiny`,
        headers: { 'x-actor-role': 'LMO', 'x-actor-id': 'lmo-officer-01' },
        payload: {
          action: 'QUERY',
          query_text: 'Please clarify serial number plate photo.',
        },
      });
      expect(queryRes.statusCode).toBe(200);
      expect(queryRes.json().current_status).toBe('QUERY_RAISED');

      // Trader responds with correction
      const corrRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/applications/${createdApplicationId}/correction`,
        payload: {
          correction_notes: 'Uploaded verified high-resolution photograph of pattern approval plate.',
        },
      });
      expect(corrRes.statusCode).toBe(200);
      expect(corrRes.json().current_status).toBe('CORRECTION_SUBMITTED');
    });

    it('4. LMO accepts application, assesses fees, and reconciles payment', async () => {
      // Accept application
      const acceptRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/applications/${createdApplicationId}/scrutiny`,
        headers: { 'x-actor-role': 'LMO', 'x-actor-id': 'lmo-officer-01' },
        payload: {
          action: 'ACCEPT',
          notes: 'Accepted after review of clarified documents.',
        },
      });
      expect(acceptRes.statusCode).toBe(200);
      expect(acceptRes.json().current_status).toBe('FEE_PENDING');

      // Assess statutory fees
      const feeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/applications/${createdApplicationId}/fee`,
        headers: { 'x-actor-role': 'LMO', 'x-actor-id': 'lmo-officer-01' },
        payload: {
          base_verification_fee: 1000.0,
          user_charge: 200.0,
          late_fee: 0.0,
        },
      });
      expect(feeRes.statusCode).toBe(200);
      expect(feeRes.json().fee_assessment.total_assessed_amount).toBe(1200);

      // Reconcile payment
      const payRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/applications/${createdApplicationId}/pay`,
        payload: {
          payment_gateway_ref: `SBIEPAY-TEST-${Date.now()}`,
          receipt_number: `RCPT-2026-TEST-${Date.now()}`,
        },
      });
      expect(payRes.statusCode).toBe(200);
      expect(payRes.json().current_status).toBe('PAYMENT_RECONCILED');
    });

    it('4.5. Checks live inspection slot availability for date', async () => {
      const availRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/tenant-delhi-central/applications/slots/availability?date=2026-08-28',
      });
      expect(availRes.statusCode).toBe(200);
      const data = availRes.json();
      expect(data.slots).toHaveLength(6);
      expect(data.total_fleet_size).toBe(10);
      expect(data.slots[0].is_available).toBe(true);
      expect(data.slots[0].total_capacity).toBe(10);
    });

    it('5. Schedules verification slot and creates PLANNED session (as Trader / OWNER)', async () => {
      const schedRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/applications/${createdApplicationId}/appointment`,
        headers: { 'x-actor-role': 'OWNER', 'x-actor-id': 'usr-trader-01' },
        payload: {
          slot_start: '2026-08-28T10:00:00Z',
          slot_end: '2026-08-28T12:00:00Z',
          assigned_lmo_id: 'lmo-officer-01',
        },
      });
      expect(schedRes.statusCode).toBe(200);
      expect(schedRes.json().current_status).toBe('SCHEDULED');

      // Fetch the created VerificationSession
      const sessGet = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants/tenant-delhi-central/sessions/${createdApplicationId}`,
      });
      expect(sessGet.statusCode).toBe(200);
      const sessData = sessGet.json();
      createdSessionId = sessData.session_id;
      expect(sessData.status).toBe('PLANNED');
    });

    it('6. Confirms physical identity and starts session', async () => {
      // Confirm Identity
      const idRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/sessions/${createdSessionId}/identity?serial_verified=true`,
        headers: { 'x-actor-role': 'LMO', 'x-actor-id': 'lmo-officer-01' },
      });
      expect(idRes.statusCode).toBe(200);
      expect(idRes.json().status).toBe('IDENTITY_CONFIRMED');

      // Start Session
      const startRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/sessions/${createdSessionId}/start`,
        headers: { 'x-actor-role': 'LMO', 'x-actor-id': 'lmo-officer-01' },
      });
      expect(startRes.statusCode).toBe(200);
      expect(startRes.json().status).toBe('IN_PROGRESS');
      expect(startRes.json().actual_test_timestamp).toBeDefined();
    });

    it('7. Submits statutory NAWI test observations and computes deterministic evaluation', async () => {
      const obsRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/sessions/${createdSessionId}/observations`,
        headers: { 'x-actor-role': 'LMO', 'x-actor-id': 'lmo-officer-01' },
        payload: {
          reference_standard_ids: ['STD-MASS-CLASS-F2-001', 'STD-MASS-CLASS-M1-002'],
          environmental_temp_celsius: 24.5,
          environmental_humidity_percent: 55.0,
          observations: [
            {
              step_type: 'ZERO_TEST',
              step_sequence: 1,
              nominal_load: 0.0,
              load_unit: 'kg',
              raw_indication_reading: 0.0,
              reading_unit: 'kg',
              delta_L: 0.0025,
            },
            {
              step_type: 'INCREASING_LOAD',
              step_sequence: 2,
              nominal_load: 0.1,
              load_unit: 'kg',
              raw_indication_reading: 0.1,
              reading_unit: 'kg',
              delta_L: 0.0025,
            },
            {
              step_type: 'INCREASING_LOAD',
              step_sequence: 3,
              nominal_load: 2.5,
              load_unit: 'kg',
              raw_indication_reading: 2.501,
              reading_unit: 'kg',
              delta_L: 0.0025,
            },
            {
              step_type: 'INCREASING_LOAD',
              step_sequence: 4,
              nominal_load: 10.0,
              load_unit: 'kg',
              raw_indication_reading: 10.002,
              reading_unit: 'kg',
              delta_L: 0.0025,
            },
            {
              step_type: 'INCREASING_LOAD',
              step_sequence: 5,
              nominal_load: 30.0,
              load_unit: 'kg',
              raw_indication_reading: 30.004,
              reading_unit: 'kg',
              delta_L: 0.0025,
            },
            {
              step_type: 'ECCENTRICITY',
              step_sequence: 6,
              nominal_load: 10.0,
              load_unit: 'kg',
              raw_indication_reading: 10.001,
              eccentricity_position: 'CENTER',
              delta_L: 0.0025,
            },
            {
              step_type: 'REPEATABILITY',
              step_sequence: 7,
              nominal_load: 15.0,
              load_unit: 'kg',
              raw_indication_reading: 15.001,
              repetition_index: 1,
              delta_L: 0.0025,
            },
            {
              step_type: 'REPEATABILITY',
              step_sequence: 8,
              nominal_load: 15.0,
              load_unit: 'kg',
              raw_indication_reading: 15.001,
              repetition_index: 2,
              delta_L: 0.0025,
            },
            {
              step_type: 'REPEATABILITY',
              step_sequence: 9,
              nominal_load: 15.0,
              load_unit: 'kg',
              raw_indication_reading: 15.001,
              repetition_index: 3,
              delta_L: 0.0025,
            },
          ],
        },
      });

      expect(obsRes.statusCode).toBe(200);
      const sessData = obsRes.json();
      expect(sessData.status).toBe('SUBMITTED');
      expect(sessData.automated_evaluation_flag).toBe(true);
      expect(sessData.observations.length).toBe(9);
      expect(sessData.observations[0].calculation_trace.P).toBeDefined();
    });

    it('8. Records physical lead wire seal action and lists stamps', async () => {
      const stampRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/sessions/${createdSessionId}/stamps`,
        headers: { 'x-actor-role': 'LMO', 'x-actor-id': 'lmo-officer-01' },
        payload: {
          action_type: 'SEAL_APPLIED',
          seal_type: 'LEAD_WIRE_SEAL',
          seal_identification_number: 'DL-SEAL-2026-TEST-99',
          seal_position: 'CALIBRATION_PORT_MAIN',
          notes: 'Official Delhi LM lead wire seal affixed.',
        },
      });
      expect(stampRes.statusCode).toBe(201);
      expect(stampRes.json().seal_identification_number).toBe('DL-SEAL-2026-TEST-99');

      // List stamps
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants/tenant-delhi-central/sessions/${createdSessionId}/stamps`,
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().length).toBeGreaterThanOrEqual(1);
    });

    it('9. Records statutory disposition and finalizes session', async () => {
      const dispRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/sessions/${createdSessionId}/disposition`,
        headers: { 'x-actor-role': 'LMO', 'x-actor-id': 'lmo-officer-01' },
        payload: {
          outcome: 'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
          disposition_notes: 'All test points verified within statutory Class III MPE limits.',
        },
      });
      expect(dispRes.statusCode).toBe(200);
      expect(dispRes.json().status).toBe('FINALIZED');
      expect(dispRes.json().outcome).toBe('VERIFICATION_PASSED_PENDING_AUTHORIZATION');
    });

    it('10. Issues and cryptographically signs digital certificate', async () => {
      const issueRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/certificates/issue',
        headers: { 'x-actor-role': 'LMO', 'x-actor-id': 'lmo-officer-01' },
        payload: {
          session_id: createdSessionId,
          validity_months: 12,
          signer_notes: 'Authorized statutory certificate issued following NAWI Class III procedure compliance.',
        },
      });

      expect(issueRes.statusCode).toBe(201);
      const cert = issueRes.json();
      issuedCertificateId = cert.certificate_id;
      issuedQrToken = cert.public_verification_token;

      expect(cert.certificate_number).toBeDefined();
      expect(cert.certificate_status).toBe('ISSUED');
      expect(cert.certificate_bytes_sha256).toHaveLength(64);
      expect(cert.digital_signature_reference).toContain('SIG-ED25519-DL-2026-LMO');
      expect(cert.valid_until).toBeDefined();
    });

    it('11. Suspends and reinstates certificate lifecycle status', async () => {
      // Suspend
      const suspRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/certificates/${issuedCertificateId}/status`,
        headers: { 'x-actor-role': 'LMO', 'x-actor-id': 'lmo-officer-01' },
        payload: {
          action: 'SUSPEND',
          reason: 'Routine inspection temporary suspension.',
        },
      });
      expect(suspRes.statusCode).toBe(200);
      expect(suspRes.json().certificate_status).toBe('SUSPENDED');

      // Reinstate
      const reinstRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tenants/tenant-delhi-central/certificates/${issuedCertificateId}/status`,
        headers: { 'x-actor-role': 'SUPERVISOR', 'x-actor-id': 'sup-officer-01' },
        payload: {
          action: 'REINSTATE',
          reason: 'Reinstated following inspection clearance.',
        },
      });
      expect(reinstRes.statusCode).toBe(200);
      expect(reinstRes.json().certificate_status).toBe('ISSUED');
    });

    it('12. Downloads binary PDF certificate', async () => {
      const pdfRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants/tenant-delhi-central/certificates/${issuedCertificateId}/pdf`,
      });
      expect(pdfRes.statusCode).toBe(200);
      expect(pdfRes.headers['content-type']).toBe('application/pdf');
      expect(pdfRes.rawPayload.toString('utf8').startsWith('%PDF-1.4')).toBe(true);

      // Also test alias /certificates/:id/pdf
      const aliasPdfRes = await app.inject({
        method: 'GET',
        url: `/certificates/${issuedCertificateId}/pdf`,
      });
      expect(aliasPdfRes.statusCode).toBe(200);
      expect(aliasPdfRes.headers['content-type']).toBe('application/pdf');
    });

    it('13. Verifies certificate via public zero-PII endpoint and aliases', async () => {
      const verifyRes = await app.inject({
        method: 'GET',
        url: `/api/v1/public/certificates/verify/${issuedQrToken}`,
      });
      expect(verifyRes.statusCode).toBe(200);
      const pubData = verifyRes.json();
      expect(pubData.status).toBe('ISSUED');
      expect(pubData.cryptographic_validity).toBe('VALID_SIGNATURE');
      expect(pubData.instrument_summary.masked_serial_number).toContain('****');
      expect(pubData.instrument_summary.accuracy_class).toContain('Class III');

      // Test short scanner alias /v/:qrReference
      const vRes = await app.inject({
        method: 'GET',
        url: `/v/${issuedQrToken}`,
      });
      expect(vRes.statusCode).toBe(200);
      expect(vRes.json().certificate_number).toBe(pubData.certificate_number);

      // Test scanner alias /verify/qr/:qrReference
      const qrRes = await app.inject({
        method: 'GET',
        url: `/verify/qr/${issuedQrToken}`,
      });
      expect(qrRes.statusCode).toBe(200);
      expect(qrRes.json().certificate_number).toBe(pubData.certificate_number);

      // Test public PDF download
      const pubPdf = await app.inject({
        method: 'GET',
        url: `/api/v1/public/certificates/${issuedQrToken}/pdf`,
      });
      expect(pubPdf.statusCode).toBe(200);
      expect(pubPdf.headers['content-type']).toBe('application/pdf');
    });
  });

  describe('Public Fixtures Verification Map', () => {
    it('verifies standard demonstration token TOKEN_VALID_2026', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/public/certificates/verify/TOKEN_VALID_2026',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.certificate_number).toBe('CERT-2026-DL-00042');
      expect(data.status).toBe('ISSUED');
      expect(data.cryptographic_validity).toBe('VALID_SIGNATURE');
    });

    it('verifies standard demonstration token TOKEN_EXPIRED_2025', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v/TOKEN_EXPIRED_2025',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.certificate_number).toBe('CERT-2025-DL-00918');
      expect(data.status).toBe('EXPIRED');
    });

    it('verifies standard demonstration token TOKEN_SUSPENDED_2026', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/verify/qr/TOKEN_SUSPENDED_2026',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.certificate_number).toBe('CERT-2026-DL-00311');
      expect(data.status).toBe('SUSPENDED');
      expect(data.revocation_reason).toBeDefined();
    });

    it('verifies standard demonstration token TOKEN_REVOKED_2026 with INVALID_SIGNATURE', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v/TOKEN_REVOKED_2026',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.certificate_number).toBe('CERT-2026-DL-00109');
      expect(data.status).toBe('REVOKED');
      expect(data.cryptographic_validity).toBe('INVALID_SIGNATURE');
    });

    it('verifies standard demonstration token TOKEN_SUPERSEDED_2025 with supersession link', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v/TOKEN_SUPERSEDED_2025',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.certificate_number).toBe('CERT-2025-DL-00011');
      expect(data.status).toBe('SUPERSEDED');
      expect(data.superseded_by).toBe('TOKEN_VALID_2026');
    });
  });
});
