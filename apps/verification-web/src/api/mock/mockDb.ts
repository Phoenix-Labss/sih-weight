import { Instrument, InstrumentModel, InstrumentRegisterRequest } from '../../types/instrument';
import {
  Application,
  ApplicationCorrectionRequest,
  ApplicationCreateRequest,
  ApplicationScheduleRequest,
  ApplicationScrutinyRequest,
  FeeAssessmentCreate,
  PaymentReconcileRequest,
} from '../../types/application';
import {
  Observation,
  ObservationItemInput,
  SessionCreateRequest,
  SessionDispositionRequest,
  VerificationSession,
} from '../../types/session';
import { PhysicalStamp, PhysicalStampRecordRequest } from '../../types/stamp';
import { Certificate, CertificateIssueRequest, CertificateStatusUpdateRequest } from '../../types/certificate';
import { PublicCertificateVerifyResponse } from '../../types/public';
import {
  mockApplications,
  mockCertificates,
  mockInstruments,
  mockModels,
  mockPublicVerifyMap,
  mockSessions,
  mockStamps,
} from './mockFixtures';
import { evaluateNAWIObservation } from '../../utils/nawiCalculations';

const STORAGE_PREFIX = 'emetrology_clean_v1_';

function loadOrInit<T>(key: string, initial: T): T {
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Fallback to initial
  }
  return JSON.parse(JSON.stringify(initial));
}

function save<T>(key: string, data: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch {
    // Ignore storage quota
  }
}

export class MockDatabase {
  private models: InstrumentModel[];
  private instruments: Instrument[];
  private applications: Application[];
  private sessions: VerificationSession[];
  private stamps: PhysicalStamp[];
  private certificates: Certificate[];
  private publicMap: Record<string, PublicCertificateVerifyResponse>;

  constructor() {
    this.models = loadOrInit('models', mockModels);
    this.instruments = loadOrInit('instruments', mockInstruments);
    this.applications = loadOrInit('applications', mockApplications);
    this.sessions = loadOrInit('sessions', mockSessions);
    this.stamps = loadOrInit('stamps', mockStamps);
    this.certificates = loadOrInit('certificates', mockCertificates);
    this.publicMap = loadOrInit('publicMap', mockPublicVerifyMap);
  }

  // --- Instruments ---
  public getModels(): InstrumentModel[] {
    return this.models;
  }

  public getModel(id: string): InstrumentModel | undefined {
    return this.models.find((m) => m.model_id === id || m.model_approval_number === id);
  }

  public getInstruments(tenantId?: string): Instrument[] {
    const list = tenantId
      ? this.instruments.filter((i) => i.tenant_id === tenantId)
      : this.instruments;
    return list.map((i) => ({ ...i }));
  }

  public getInstrument(id: string): Instrument | undefined {
    return this.instruments.find((i) => i.instrument_id === id || i.public_instrument_token === id);
  }

  public registerInstrument(tenantId: string, req: InstrumentRegisterRequest): Instrument {
    const model = this.getModel(req.model_id) || this.models[0];
    const newInst: Instrument = {
      instrument_id: `INST-${Date.now().toString().slice(-4)}`,
      public_instrument_token: `TOK-INST-DL-${Math.floor(1000 + Math.random() * 9000)}`,
      tenant_id: tenantId,
      jurisdiction_id: req.jurisdiction_id || 'jur-dl-01',
      model_id: model.model_id,
      owner_id: req.owner_id,
      facility_id: req.facility_id,
      serial_number: req.serial_number,
      year_of_manufacture: req.year_of_manufacture,
      intended_use: req.intended_use || 'Commercial Trade Weighing',
      installation_location_notes: req.installation_location_notes,
      current_status: 'UNVERIFIED',
      model: model,
      components: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.instruments.unshift(newInst);
    save('instruments', this.instruments);
    return newInst;
  }

  // --- Applications ---
  public getApplications(tenantId?: string): Application[] {
    const list = tenantId
      ? this.applications.filter((a) => a.tenant_id === tenantId)
      : this.applications;
    return list.map((a) => ({ ...a, fee_assessment: a.fee_assessment ? { ...a.fee_assessment } : undefined }));
  }

  public getApplication(id: string): Application | undefined {
    return this.applications.find(
      (a) =>
        a.application_id === id ||
        a.application_id.toLowerCase() === id.toLowerCase() ||
        a.application_number === id ||
        a.application_number.toLowerCase() === id.toLowerCase()
    );
  }

  public createApplication(tenantId: string, req: ApplicationCreateRequest): Application {
    const inst = this.getInstrument(req.instrument_id);
    const newApp: Application = {
      application_id: `APP-${Date.now().toString().slice(-4)}`,
      application_number: `APP-2026-DL-${Math.floor(10000 + Math.random() * 90000)}`,
      tenant_id: tenantId,
      jurisdiction_id: inst?.jurisdiction_id || 'jur-dl-01',
      instrument_id: req.instrument_id,
      applicant_id: req.applicant_id,
      application_type: req.application_type || 'INITIAL_VERIFICATION',
      service_mode: req.service_mode || 'ON_SITE',
      preferred_verification_date: req.preferred_verification_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      current_status: 'SUBMITTED',
      applicant_declaration_accepted: req.applicant_declaration_accepted ?? true,
      version: 1,
      fee_assessment: {
        fee_assessment_id: `FEE-${Date.now().toString().slice(-4)}`,
        tenant_id: tenantId,
        policy_version: 'POL-FEES-2026.1',
        base_verification_fee: 1000.0,
        user_charge: 200.0,
        late_fee: 0.0,
        total_assessed_amount: 1200.0,
        currency: 'INR',
        payment_status: 'NOT_ASSESSED',
        created_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.applications.unshift(newApp);
    save('applications', this.applications);
    return newApp;
  }

  public submitApplication(appId: string): Application {
    const app = this.getApplication(appId);
    if (!app) throw new Error('Application not found');
    app.current_status = 'SUBMITTED';
    app.updated_at = new Date().toISOString();
    save('applications', this.applications);
    return app;
  }

  public scrutinizeApplication(appId: string, req: ApplicationScrutinyRequest): Application {
    const app = this.getApplication(appId);
    if (!app) throw new Error('Application not found');

    if (req.action === 'ACCEPT') {
      app.current_status = 'FEE_PENDING';
      app.scrutiny_notes = req.notes || 'Accepted after statutory document verification.';
      app.active_query = undefined;
      // Create a default fee_assessment so the Pay Fees button appears on the
      // trader dashboard. Without it, `isFeePending` stays false because
      // `Boolean(application.fee_assessment)` is false.
      if (!app.fee_assessment) {
        app.fee_assessment = {
          fee_assessment_id: `FEE-${Date.now().toString().slice(-4)}`,
          tenant_id: app.tenant_id,
          policy_version: 'POL-FEES-2026.1',
          base_verification_fee: 750,
          user_charge: 0,
          late_fee: 0,
          total_assessed_amount: 750,
          currency: 'INR',
          payment_status: 'PAYMENT_PENDING',
          created_at: new Date().toISOString(),
        };
      } else {
        app.fee_assessment.payment_status = 'PAYMENT_PENDING';
      }
    } else if (req.action === 'QUERY') {
      app.current_status = 'QUERY_RAISED';
      app.active_query = req.query_text || 'Please clarify application specifications.';
      app.query_raised_at = new Date().toISOString();
      app.scrutiny_notes = req.notes;
    } else if (req.action === 'REJECT') {
      app.current_status = 'REJECTED';
      app.rejection_reason = req.rejection_reason || 'Application rejected under statutory grounds.';
      app.scrutiny_notes = req.notes;
    }

    app.version += 1;
    app.updated_at = new Date().toISOString();
    save('applications', this.applications);
    return app;
  }

  public submitCorrection(appId: string, req: ApplicationCorrectionRequest): Application {
    const app = this.getApplication(appId);
    if (!app) throw new Error('Application not found');
    app.current_status = 'QUERY_RESPONDED';
    app.scrutiny_notes = `Applicant response: ${req.correction_notes}`;
    app.version += 1;
    app.updated_at = new Date().toISOString();
    save('applications', this.applications);
    return app;
  }

  public assessFee(appId: string, req: FeeAssessmentCreate): Application {
    const app = this.getApplication(appId);
    if (!app) throw new Error('Application not found');
    const userCharge = req.user_charge || 0;
    const lateFee = req.late_fee || 0;
    const total = req.base_verification_fee + userCharge + lateFee;

    app.fee_assessment = {
      fee_assessment_id: `FEE-${Date.now().toString().slice(-4)}`,
      tenant_id: app.tenant_id,
      policy_version: req.policy_version || 'POL-FEES-2026.1',
      base_verification_fee: req.base_verification_fee,
      user_charge: userCharge,
      late_fee: lateFee,
      total_assessed_amount: total,
      currency: 'INR',
      payment_status: 'PAYMENT_PENDING',
      created_at: new Date().toISOString(),
    };
    app.current_status = 'FEE_PENDING';
    app.updated_at = new Date().toISOString();
    save('applications', this.applications);
    return app;
  }

  public reconcilePayment(appId: string, req: PaymentReconcileRequest): Application {
    const app = this.getApplication(appId);
    if (!app) throw new Error('Application not found');

    if (!app.fee_assessment) {
      app.fee_assessment = {
        fee_assessment_id: `FEE-${app.application_id}`,
        tenant_id: app.tenant_id,
        policy_version: 'SCH-XII-2024.1',
        base_verification_fee: 750.0,
        user_charge: 0.0,
        late_fee: 0.0,
        total_assessed_amount: 750.0,
        currency: 'INR',
        payment_status: 'PAYMENT_PENDING',
        created_at: new Date().toISOString(),
      };
    }

    app.fee_assessment.payment_status = 'PAYMENT_RECONCILED';
    app.fee_assessment.payment_gateway_ref = req.payment_gateway_ref || `SBIEPAY-${Date.now()}`;
    app.fee_assessment.treasury_challan_number = `CHL-DL-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    app.fee_assessment.receipt_number = req.receipt_number || `RCPT-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    app.fee_assessment.paid_at = new Date().toISOString();

    app.current_status = 'PAYMENT_RECONCILED';
    app.updated_at = new Date().toISOString();
    save('applications', this.applications);
    return { ...app, fee_assessment: { ...app.fee_assessment } };
  }

  public getSlotAvailability(
    tenantId: string,
    jurisdictionId: string,
    dateStr: string
  ): {
    date: string;
    jurisdiction_id: string;
    jurisdiction_name: string;
    total_fleet_size: number;
    slots: Array<{
      slot_id: string;
      start_time: string;
      end_time: string;
      total_capacity: number;
      booked_count: number;
      remaining_slots: number;
      is_available: boolean;
    }>;
  } {
    const totalFleetSize = 10;
    const standardSlotWindows = [
      { slot_id: '09:00-10:30', start_time: '09:00', end_time: '10:30' },
      { slot_id: '10:30-12:00', start_time: '10:30', end_time: '12:00' },
      // 12:00 - 13:00 is Official Lunch & Recess (no bookings)
      { slot_id: '13:00-14:30', start_time: '13:00', end_time: '14:30' },
      { slot_id: '14:30-16:00', start_time: '14:30', end_time: '16:00' },
      { slot_id: '16:00-17:30', start_time: '16:00', end_time: '17:30' },
      { slot_id: '17:30-19:00', start_time: '17:30', end_time: '19:00' },
    ];

    const bookedCounts: Record<string, number> = {};
    for (const app of this.applications) {
      if (app.current_status === 'SCHEDULED' && app.scheduled_slot_start) {
        const appDate = app.scheduled_slot_start.split('T')[0];
        if (appDate === dateStr) {
          const startTime = app.scheduled_slot_start.split('T')[1]?.slice(0, 5);
          const endTime = app.scheduled_slot_end ? app.scheduled_slot_end.split('T')[1]?.slice(0, 5) : '';
          const slotKey = `${startTime}-${endTime}`;
          const matched = standardSlotWindows.find((w) => w.slot_id === slotKey || w.start_time === startTime);
          if (matched) {
            bookedCounts[matched.slot_id] = (bookedCounts[matched.slot_id] || 0) + 1;
          }
        }
      }
    }

    return {
      date: dateStr,
      jurisdiction_id: jurisdictionId || 'JUR-DL-01',
      jurisdiction_name: 'Central Delhi Zone (JUR-DL-01)',
      total_fleet_size: totalFleetSize,
      slots: standardSlotWindows.map((w) => {
        const booked = bookedCounts[w.slot_id] || 0;
        const remaining = Math.max(0, totalFleetSize - booked);
        return {
          slot_id: w.slot_id,
          start_time: w.start_time,
          end_time: w.end_time,
          total_capacity: totalFleetSize,
          booked_count: booked,
          remaining_slots: remaining,
          is_available: remaining > 0,
        };
      }),
    };
  }

  public scheduleApplication(appId: string, req: ApplicationScheduleRequest, fallbackApp?: Application): Application {
    let app = this.getApplication(appId);
    if (!app && fallbackApp) {
      app = this.getApplication(fallbackApp.application_id) || this.getApplication(fallbackApp.application_number);
    }
    if (!app && fallbackApp) {
      app = { ...fallbackApp };
      this.applications.unshift(app);
    }
    if (!app) {
      app = this.applications.find(
        (a) =>
          a.application_id.includes(appId) ||
          a.application_number.includes(appId) ||
          (fallbackApp && (a.application_id === fallbackApp.application_id || a.application_number === fallbackApp.application_number))
      );
    }
    if (!app) {
      if (fallbackApp) {
        app = { ...fallbackApp };
        this.applications.unshift(app);
      } else {
        throw new Error('Application not found');
      }
    }

    const dateStr = req.slot_start.split('T')[0];
    const avail = this.getSlotAvailability(app.tenant_id, app.jurisdiction_id, dateStr);
    const startHour = req.slot_start.split('T')[1]?.slice(0, 5);
    const targetSlot = avail.slots.find((s) => s.start_time === startHour || req.slot_start.includes(s.start_time));
    if (targetSlot && targetSlot.remaining_slots <= 0) {
      throw new Error(`Time slot ${targetSlot.slot_id} is fully booked (${targetSlot.total_capacity} inspection capacity reached). Please select another slot or date.`);
    }

    app.scheduled_slot_start = req.slot_start;
    app.scheduled_slot_end = req.slot_end;
    app.assigned_lmo_id = req.assigned_lmo_id || 'lmo-officer-01';
    app.assigned_gatc_id = req.assigned_gatc_id;
    app.current_status = 'SCHEDULED';
    app.updated_at = new Date().toISOString();
    save('applications', this.applications);

    // Also auto-create a verification session in PLANNED state if none exists or existing is finalized
    const existing = this.sessions.find((s) => s.application_id === appId && s.status !== 'FINALIZED');
    if (!existing) {
      this.createSession(app.tenant_id, {
        application_id: app.application_id,
        instrument_id: app.instrument_id,
        scheduled_date: req.slot_start.split('T')[0],
      });
    }

    return { ...app };
  }

  // --- Sessions ---
  public getSessions(tenantId?: string): VerificationSession[] {
    const list = tenantId
      ? this.sessions.filter((s) => s.tenant_id === tenantId)
      : this.sessions;
    return list.map((s) => ({ ...s }));
  }

  public getSession(id: string): VerificationSession | undefined {
    let sess = this.sessions.find(
      (s) =>
        s.session_id === id ||
        s.session_id.toLowerCase() === id.toLowerCase() ||
        s.application_id === id
    );

    if (!sess) {
      // Fallback: If id matches an existing application, auto-create or find planned session
      const app = this.getApplication(id);
      if (app) {
        sess = this.sessions.find((s) => s.instrument_id === app.instrument_id);
        if (!sess) {
          sess = this.createSession(app.tenant_id, {
            application_id: app.application_id,
            instrument_id: app.instrument_id,
            scheduled_date: app.scheduled_slot_start?.split('T')[0] || new Date().toISOString().split('T')[0],
          });
        }
      }
    }

    return sess;
  }

  public createSession(tenantId: string, req: SessionCreateRequest): VerificationSession {
    const newSession: VerificationSession = {
      session_id: `SESS-${Date.now().toString().slice(-4)}`,
      tenant_id: tenantId,
      application_id: req.application_id,
      instrument_id: req.instrument_id,
      procedure_pack_id: req.procedure_pack_id || 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      procedure_pack_checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      verifier_id: 'lmo-officer-01',
      verifier_role: 'LEGAL_METROLOGY_OFFICER',
      scheduled_date: req.scheduled_date,
      environmental_temp_celsius: req.environmental_temp_celsius || 24.0,
      environmental_humidity_percent: req.environmental_humidity_percent || 55.0,
      status: 'PLANNED',
      reference_standards: [
        {
          standard_id: 'STD-MASS-CLASS-F2-001',
          snapshot_calibration_certificate: 'CAL-NPL-2025-F2-089',
          snapshot_valid_until: '2027-05-15T00:00:00Z',
          verified_suitable: true,
        },
      ],
      observations: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.sessions.unshift(newSession);
    save('sessions', this.sessions);
    return newSession;
  }

  public confirmIdentity(sessionId: string, serialVerified: boolean): VerificationSession {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Verification session '${sessionId}' was not found in the database.`);
    }
    if (!serialVerified) {
      throw new Error('Serial number physical verification failed. Serial number must match the registry.');
    }

    session.status = 'IDENTITY_CONFIRMED';
    session.updated_at = new Date().toISOString();
    save('sessions', this.sessions);
    return session;
  }

  public startSession(sessionId: string): VerificationSession {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Verification session '${sessionId}' was not found in the database. Please ensure the application has been scheduled.`);
    }

    if (session.status !== 'IDENTITY_CONFIRMED') {
      throw new Error("Physical Serial Check Required: You must inspect the physical instrument nameplate and confirm the serial match before starting test execution.");
    }

    session.status = 'IN_PROGRESS';
    session.actual_test_timestamp = new Date().toISOString();
    session.updated_at = new Date().toISOString();
    save('sessions', this.sessions);

    // Update application state
    const app = this.getApplication(session.application_id);
    if (app) {
      app.current_status = 'VERIFICATION_IN_PROGRESS';
      save('applications', this.applications);
    }

    return session;
  }

  public submitObservations(
    sessionId: string,
    standardIds: string[],
    rawObservations: ObservationItemInput[],
    temp?: number,
    humidity?: number
  ): VerificationSession {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const inst = this.getInstrument(session.instrument_id);
    const scaleInterval = inst?.model?.verification_scale_interval_e || 0.005;
    const accuracyClass = inst?.model?.accuracy_class || 'CLASS_III';

    // Find Zero Error E0 from zero test if present
    const zeroItem = rawObservations.find((o) => o.step_type === 'ZERO_TEST');
    const zeroErrorE0 = zeroItem ? (zeroItem.raw_indication_reading || 0) : 0;

    let allPass = true;
    const evaluatedObs: Observation[] = rawObservations.map((obs, idx) => {
      const evalRes = evaluateNAWIObservation({
        nominalLoad: obs.nominal_load,
        rawIndication: obs.raw_indication_reading,
        deltaL: obs.delta_L,
        scaleIntervalE: scaleInterval,
        accuracyClass: accuracyClass,
        zeroErrorE0: obs.step_type === 'ZERO_TEST' ? 0 : zeroErrorE0,
      });

      if (!evalRes.isWithinMpe) {
        allPass = false;
      }

      return {
        observation_id: `OBS-${sessionId}-${idx + 1}`,
        session_id: sessionId,
        step_type: obs.step_type,
        step_sequence: obs.step_sequence || idx + 1,
        nominal_load: obs.nominal_load,
        load_unit: obs.load_unit || 'kg',
        raw_indication_reading: obs.raw_indication_reading,
        normalized_indication: evalRes.normalizedIndication,
        reading_unit: obs.reading_unit || 'kg',
        observed_error: evalRes.observedError,
        mpe_allowed: evalRes.mpeAllowed,
        is_within_mpe: evalRes.isWithinMpe,
        repetition_index: obs.repetition_index || 1,
        eccentricity_position: obs.eccentricity_position,
        calculation_trace: evalRes.calculationTrace,
        is_immutable: true,
        recorded_at: new Date().toISOString(),
      };
    });

    session.observations = evaluatedObs;
    session.status = 'SUBMITTED';
    session.automated_evaluation_flag = allPass;
    if (temp !== undefined) session.environmental_temp_celsius = temp;
    if (humidity !== undefined) session.environmental_humidity_percent = humidity;
    session.reference_standards = standardIds.map((sid) => ({
      standard_id: sid,
      snapshot_calibration_certificate: 'CAL-OFFICIAL-VALID',
      snapshot_valid_until: '2027-08-30T00:00:00Z',
      verified_suitable: true,
    }));
    session.updated_at = new Date().toISOString();
    save('sessions', this.sessions);
    return session;
  }

  public recordDisposition(sessionId: string, req: SessionDispositionRequest): VerificationSession {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    session.outcome = req.outcome;
    session.officer_disposition_notes = req.disposition_notes;
    session.status = 'FINALIZED';
    session.finalized_at = new Date().toISOString();
    session.updated_at = new Date().toISOString();
    save('sessions', this.sessions);

    const app = this.getApplication(session.application_id);
    if (app && req.outcome === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION') {
      app.current_status = 'COMPLETED';
      if (app.fee_assessment && app.fee_assessment.payment_status !== 'PAYMENT_RECONCILED') {
        app.fee_assessment.payment_status = 'PAYMENT_RECONCILED';
        app.fee_assessment.treasury_challan_number = app.fee_assessment.treasury_challan_number || `CHL-DL-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        app.fee_assessment.receipt_number = app.fee_assessment.receipt_number || `RCPT-2026-${Math.floor(100000 + Math.random() * 900000)}`;
        app.fee_assessment.paid_at = app.fee_assessment.paid_at || new Date().toISOString();
      }
      save('applications', this.applications);
    } else if (app && req.outcome === 'VERIFICATION_FAILED') {
      app.current_status = 'REJECTED';
      save('applications', this.applications);
    }

    return session;
  }

  // --- Stamps ---
  public getStamps(sessionId?: string): PhysicalStamp[] {
    if (sessionId) {
      return this.stamps.filter((s) => s.session_id === sessionId);
    }
    return this.stamps;
  }

  public recordStamp(tenantId: string, sessionId: string, req: PhysicalStampRecordRequest): PhysicalStamp {
    const session = this.getSession(sessionId);
    const sealNum = (req.seal_identification_number || '').trim();
    // Prevent duplicate stamp entries for the same seal number in the same session
    const existing = this.stamps.find(
      (s) => s.session_id === sessionId && s.seal_identification_number.trim().toLowerCase() === sealNum.toLowerCase()
    );
    if (existing) {
      existing.seal_position = req.seal_position || existing.seal_position;
      existing.photo_evidence_hash = req.photo_evidence_hash || existing.photo_evidence_hash;
      existing.notes = req.notes || existing.notes;
      save('stamps', this.stamps);
      return existing;
    }

    const newStamp: PhysicalStamp = {
      stamp_action_id: `STAMP-${Date.now().toString().slice(-4)}`,
      tenant_id: tenantId,
      session_id: sessionId,
      instrument_id: req.instrument_id || session?.instrument_id || 'INST-001',
      verifier_id: 'lmo-officer-01',
      action_type: req.action_type || 'SEAL_APPLIED',
      seal_type: req.seal_type || 'LEAD_WIRE_SEAL',
      seal_identification_number: sealNum,
      seal_position: req.seal_position,
      photo_evidence_hash: req.photo_evidence_hash || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      action_timestamp: new Date().toISOString(),
      notes: req.notes,
      created_at: new Date().toISOString(),
    };
    this.stamps.unshift(newStamp);
    save('stamps', this.stamps);
    return newStamp;
  }

  // --- Certificates ---
  public getCertificates(tenantId?: string): Certificate[] {
    if (tenantId) {
      return this.certificates.filter((c) => c.tenant_id === tenantId);
    }
    return this.certificates;
  }

  public getCertificate(id: string): Certificate | undefined {
    return this.certificates.find((c) => c.certificate_id === id || c.public_verification_token === id);
  }

  public issueCertificate(tenantId: string, req: CertificateIssueRequest): Certificate {
    const session = this.getSession(req.session_id);
    if (!session) throw new Error('Session not found');
    if (session.outcome !== 'VERIFICATION_PASSED_PENDING_AUTHORIZATION') {
      throw new Error('Cannot issue certificate without passing disposition');
    }

    const inst = this.getInstrument(session.instrument_id);
    const issueDate = new Date();
    const validUntil = new Date(issueDate);
    validUntil.setMonth(validUntil.getMonth() + (req.validity_months || 12));
    validUntil.setDate(validUntil.getDate() - 1);

    const token = `TOK-CERT-${Date.now().toString().slice(-6)}`;
    const certNum = `CERT-2026-DL-${Math.floor(10000 + Math.random() * 90000)}`;

    const newCert: Certificate = {
      certificate_id: `CERT-${Date.now().toString().slice(-4)}`,
      certificate_number: certNum,
      public_verification_token: token,
      tenant_id: tenantId,
      session_id: session.session_id,
      instrument_id: session.instrument_id,
      owner_id: inst?.owner_id || 'usr-trader-01',
      procedure_pack_id: session.procedure_pack_id,
      verifier_id: session.verifier_id,
      signer_id: 'lmo-officer-01',
      issue_date: issueDate.toISOString().split('T')[0],
      valid_until: validUntil.toISOString().split('T')[0],
      certificate_status: 'ISSUED',
      certificate_bytes_sha256: 'a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01',
      digital_signature_reference: `SIG-ED25519-DL-2026-LMO-${Math.floor(10000 + Math.random() * 90000)}`,
      signature_timestamp: new Date().toISOString(),
      qr_code_payload: `http://localhost:5173/#/verify/${token}`,
      status_events: [
        {
          status_event_id: `EVT-${Date.now()}`,
          certificate_id: certNum,
          previous_status: 'DRAFT',
          new_status: 'ISSUED',
          actor_id: 'lmo-officer-01',
          reason: req.signer_notes || 'Statutory verification completed with full compliance.',
          event_timestamp: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.certificates.unshift(newCert);
    save('certificates', this.certificates);

    // Update Instrument verification due date and status
    if (inst) {
      inst.current_status = 'VERIFIED';
      inst.latest_certificate_id = newCert.certificate_id;
      inst.verification_due_date = newCert.valid_until;
      save('instruments', this.instruments);
    }

    // Ensure parent application is COMPLETED and fee is marked reconciled
    const app = this.getApplication(session.application_id);
    if (app) {
      app.current_status = 'COMPLETED';
      if (app.fee_assessment && app.fee_assessment.payment_status !== 'PAYMENT_RECONCILED') {
        app.fee_assessment.payment_status = 'PAYMENT_RECONCILED';
        app.fee_assessment.treasury_challan_number = app.fee_assessment.treasury_challan_number || `CHL-DL-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        app.fee_assessment.receipt_number = app.fee_assessment.receipt_number || `RCPT-2026-${Math.floor(100000 + Math.random() * 900000)}`;
        app.fee_assessment.paid_at = app.fee_assessment.paid_at || new Date().toISOString();
      }
      save('applications', this.applications);
    }

    // Add to public verify projection
    this.publicMap[token] = {
      certificate_number: certNum,
      status: 'ISSUED',
      issuing_authority: 'Office of the Controller of Legal Metrology, Government of NCT of Delhi (Central Zone)',
      instrument_summary: {
        category: inst?.model?.category || 'NAWI',
        subtype: inst?.model?.subtype || 'Counter Electronic Scale',
        model_name: inst?.model?.model_name || 'Eagle Electronic Counter Scale Model E-30',
        accuracy_class: inst?.model?.accuracy_class || 'Class III',
        max_capacity: inst?.model?.max_capacity || 30.0,
        min_capacity: inst?.model?.min_capacity || 0.1,
        capacity_unit: inst?.model?.capacity_unit || 'kg',
        scale_interval_e: inst?.model?.verification_scale_interval_e || 0.005,
        scale_interval_unit: inst?.model?.scale_interval_unit || 'kg',
        masked_serial_number: inst ? `******${inst.serial_number.slice(-4)}` : '******8842',
        physical_seal_number: `DL-SEAL-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      },
      verification_date: newCert.issue_date,
      valid_until: newCert.valid_until,
      cryptographic_validity: 'VALID_SIGNATURE',
      certificate_hash: newCert.certificate_bytes_sha256 || 'hash',
    };
    save('publicMap', this.publicMap);

    return newCert;
  }

  public updateCertificateStatus(id: string, req: CertificateStatusUpdateRequest): Certificate {
    const cert = this.getCertificate(id);
    if (!cert) throw new Error('Certificate not found');

    const prev = cert.certificate_status;
    let nextStatus = prev;

    if (req.action === 'SUSPEND') nextStatus = 'SUSPENDED';
    else if (req.action === 'REINSTATE') nextStatus = 'ISSUED';
    else if (req.action === 'REVOKE') nextStatus = 'REVOKED';
    else if (req.action === 'SUPERSEDE') {
      nextStatus = 'SUPERSEDED';
      cert.superseding_certificate_id = req.superseding_certificate_id;
    } else if (req.action === 'EXPIRE') nextStatus = 'EXPIRED';

    cert.certificate_status = nextStatus;
    cert.status_events.push({
      status_event_id: `EVT-${Date.now()}`,
      certificate_id: cert.certificate_id,
      previous_status: prev,
      new_status: nextStatus,
      actor_id: 'lmo-officer-01',
      reason: req.reason,
      statutory_authority_reference: req.statutory_authority_reference,
      event_timestamp: new Date().toISOString(),
    });
    cert.updated_at = new Date().toISOString();
    save('certificates', this.certificates);

    if (this.publicMap[cert.public_verification_token]) {
      this.publicMap[cert.public_verification_token].status = nextStatus;
      if (req.action === 'REVOKE' || req.action === 'SUSPEND') {
        this.publicMap[cert.public_verification_token].revocation_reason = req.reason;
      }
      if (req.action === 'SUPERSEDE' && req.superseding_certificate_id) {
        this.publicMap[cert.public_verification_token].superseded_by = req.superseding_certificate_id;
      }
      save('publicMap', this.publicMap);
    }

    return cert;
  }

  // --- Public Verify ---
  public verifyPublic(token: string): PublicCertificateVerifyResponse {
    const cleanToken = token?.trim();
    if (!cleanToken) {
      throw new Error('Verification token is required');
    }

    // 1. Direct match in publicMap
    if (this.publicMap[cleanToken]) {
      return this.publicMap[cleanToken];
    }

    // 2. Match certificate number in publicMap
    const byCertNumber = Object.values(this.publicMap).find((c) => c.certificate_number === cleanToken);
    if (byCertNumber) return byCertNumber;

    // 3. Search in certificates database
    const cert = this.certificates.find(
      (c) =>
        c.public_verification_token === cleanToken ||
        c.certificate_number === cleanToken ||
        c.certificate_id === cleanToken
    );

    if (cert) {
      const inst = this.instruments.find((i) => i.instrument_id === cert.instrument_id);
      const proj: PublicCertificateVerifyResponse = {
        certificate_number: cert.certificate_number,
        status: (cert.certificate_status as any) || 'ISSUED',
        issuing_authority: 'Office of the Controller of Legal Metrology, Government of NCT of Delhi (Central Zone)',
        instrument_summary: {
          category: inst?.model?.category || 'Non-Automatic Weighing Instrument (NAWI)',
          subtype: inst?.model?.subtype || 'Commercial Counter Scale',
          model_name: inst?.model?.model_name || 'Eagle Electronic Counter Scale Model E-30',
          accuracy_class: inst?.model?.accuracy_class || 'Class III (Medium Accuracy)',
          max_capacity: inst?.model?.max_capacity || 30.0,
          min_capacity: inst?.model?.min_capacity || 0.1,
          capacity_unit: inst?.model?.capacity_unit || 'kg',
          scale_interval_e: inst?.model?.verification_scale_interval_e || 0.005,
          scale_interval_unit: inst?.model?.scale_interval_unit || 'kg',
          masked_serial_number: inst ? `******${inst.serial_number.slice(-4)}` : '******8842',
          physical_seal_number: 'DL-SEAL-2026-0042',
        },
        verification_date: cert.issue_date || '2026-08-28',
        valid_until: cert.valid_until || '2027-08-27',
        cryptographic_validity: 'VALID_SIGNATURE',
        certificate_hash: cert.certificate_bytes_sha256 || '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
      };
      this.publicMap[cleanToken] = proj;
      save('publicMap', this.publicMap);
      return proj;
    }

    // 4. If token is valid certificate token format (e.g. TOK-CERT-6DA94A5EBD93E7F6 or TOK-...), create verified projection
    if (cleanToken.startsWith('TOK-CERT-') || cleanToken.startsWith('TOK-') || cleanToken.startsWith('CERT-')) {
      const cleanAlphanumeric = cleanToken.replace(/[^A-Za-z0-9]/g, '');
      const suffix = cleanAlphanumeric.slice(-4).toUpperCase() || '8842';
      const dynProj: PublicCertificateVerifyResponse = {
        certificate_number: cleanToken.startsWith('CERT-') ? cleanToken : `CERT-2026-DL-0${suffix}`,
        status: 'ISSUED',
        issuing_authority: 'Office of the Controller of Legal Metrology, Government of NCT of Delhi (Central Zone)',
        instrument_summary: {
          category: 'Non-Automatic Weighing Instrument (NAWI)',
          subtype: 'Commercial Electronic Counter Scale',
          model_name: 'Eagle Electronic Counter Scale Model E-30',
          accuracy_class: 'Class III (Medium Accuracy)',
          max_capacity: 30.0,
          min_capacity: 0.1,
          capacity_unit: 'kg',
          scale_interval_e: 0.005,
          scale_interval_unit: 'kg',
          masked_serial_number: `******${suffix}`,
          physical_seal_number: `DL-SEAL-2026-${suffix}`,
        },
        verification_date: '2026-08-28',
        valid_until: '2027-08-27',
        cryptographic_validity: 'VALID_SIGNATURE',
        certificate_hash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
      };
      this.publicMap[cleanToken] = dynProj;
      save('publicMap', this.publicMap);
      return dynProj;
    }

    throw new Error('Certificate not found or invalid token');
  }

  public resetToDefaults(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('emetrology_') || k.startsWith('mock_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
    this.models = JSON.parse(JSON.stringify(mockModels));
    this.instruments = JSON.parse(JSON.stringify(mockInstruments));
    this.applications = JSON.parse(JSON.stringify(mockApplications));
    this.sessions = JSON.parse(JSON.stringify(mockSessions));
    this.stamps = JSON.parse(JSON.stringify(mockStamps));
    this.certificates = JSON.parse(JSON.stringify(mockCertificates));
    this.publicMap = JSON.parse(JSON.stringify(mockPublicVerifyMap));
  }
  public async verifyAndIngestEvidence(tenantId: string, payload: any): Promise<any> {
    const rawSha256 = payload.claimed_sha256 || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
    return {
      evidence_id: `EVID-${Math.random().toString(36).substring(2, 9)}`,
      tenant_id: tenantId,
      session_id: payload.session_id,
      instrument_id: payload.instrument_id,
      file_name: payload.file_name || 'evidence_photo.png',
      mime_type: payload.mime_type || 'image/png',
      file_size_bytes: 1024 * 145,
      sha256_hash: rawSha256,
      claimed_sha256: payload.claimed_sha256,
      is_checksum_verified: true,
      server_verified_at: new Date().toISOString(),
      verifier_actor_id: 'OFFICER-LMO-DELHI',
      digital_proof_signature: `HMAC-CUSTODY-${Math.random().toString(16).substring(2, 18).toUpperCase()}`,
      evidence_category: payload.evidence_category || 'SEAL_PHOTO',
    };
  }
}

export const mockDb = new MockDatabase();
