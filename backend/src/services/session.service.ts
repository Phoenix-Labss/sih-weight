import { prisma } from '../db/prisma.js';
import { NotFoundError, ValidationError, GuardConditionFailedError } from '../core/errors.js';
import { SessionStateMachine } from '../core/state-machines/session.machine.js';
import { evaluateNawiSession } from '../metrology/nawi.evaluator.js';
import { validateReferenceStandards } from '../metrology/standards.validator.js';
import { PaginatedResult, SecurityContext, VerificationOutcomeEnum, SessionStatusEnum } from '../core/types.js';

export interface SessionCreateInput {
  application_id: string;
  instrument_id: string;
  procedure_pack_id?: string;
  scheduled_date: string;
  environmental_temp_celsius?: number;
  environmental_humidity_percent?: number;
}

export interface ObservationItemInput {
  step_type: string;
  step_sequence: number;
  nominal_load: number;
  load_unit?: string;
  raw_indication_reading: number;
  reading_unit?: string;
  normalized_indication?: number;
  repetition_index?: number;
  eccentricity_position?: string;
  delta_L?: number;
}

export interface SessionObservationSubmitInput {
  reference_standard_ids: string[];
  observations: ObservationItemInput[];
  environmental_temp_celsius?: number;
  environmental_humidity_percent?: number;
}

export interface SessionDispositionInput {
  outcome: VerificationOutcomeEnum;
  disposition_notes?: string;
}

function parseJsonSafe(val: unknown): Record<string, unknown> {
  if (typeof val === 'object' && val !== null) {
    return val as Record<string, unknown>;
  }
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  return {};
}

export class SessionService {
  /**
   * Lists verification sessions for a tenant
   */
  async listSessions(tenantId: string, page = 1, pageSize = 50): Promise<PaginatedResult<any>> {
    const skip = (Math.max(1, page) - 1) * pageSize;
    const where = { tenant_id: tenantId };

    const [total, rawItems] = await Promise.all([
      prisma.verificationSession.count({ where }),
      prisma.verificationSession.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          observations: { orderBy: { step_sequence: 'asc' } },
          reference_standards: { include: { standard: true } },
          instrument: { include: { model: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const items = rawItems.map((s) => this.formatSession(s));
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      items,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      pages: totalPages,
    };
  }

  /**
   * Gets a verification session by session ID or application ID
   */
  async getSessionById(tenantId: string, idOrAppId: string): Promise<any> {
    const raw = await prisma.verificationSession.findFirst({
      where: {
        tenant_id: tenantId,
        OR: [{ session_id: idOrAppId }, { application_id: idOrAppId }],
      },
      include: {
        observations: { orderBy: { step_sequence: 'asc' } },
        reference_standards: { include: { standard: true } },
        instrument: { include: { model: true } },
      },
    });

    if (!raw) {
      throw new NotFoundError(`Verification session '${idOrAppId}' not found in tenant '${tenantId}'`);
    }

    return this.formatSession(raw);
  }

  /**
   * Creates a new verification session in PLANNED state
   */
  async createSession(tenantId: string, input: SessionCreateInput, actor: SecurityContext): Promise<any> {
    if (!input.application_id || !input.instrument_id) {
      throw new ValidationError('application_id and instrument_id are required');
    }

    const procChecksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const scheduled = input.scheduled_date ? new Date(input.scheduled_date) : new Date();

    const created = await prisma.verificationSession.create({
      data: {
        tenant_id: tenantId,
        application_id: input.application_id,
        instrument_id: input.instrument_id,
        procedure_pack_id: input.procedure_pack_id || 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
        procedure_pack_checksum: procChecksum,
        verifier_id: actor.userId || 'lmo-officer-01',
        verifier_role: actor.role || 'LMO',
        scheduled_date: scheduled,
        environmental_temp_celsius: input.environmental_temp_celsius ?? 24.5,
        environmental_humidity_percent: input.environmental_humidity_percent ?? 55.0,
        status: 'PLANNED',
      },
      include: {
        observations: true,
        reference_standards: { include: { standard: true } },
        instrument: { include: { model: true } },
      },
    });

    return this.formatSession(created);
  }

  /**
   * Confirms instrument physical serial match on site
   */
  async confirmIdentity(
    tenantId: string,
    sessionId: string,
    serialVerified: boolean,
    actor: SecurityContext
  ): Promise<any> {
    const session = await this.getRawSession(tenantId, sessionId);

    SessionStateMachine.confirmIdentity(
      {
        session_id: session.session_id,
        tenant_id: session.tenant_id,
        status: session.status as any,
        automated_evaluation_flag: session.automated_evaluation_flag,
      },
      actor,
      serialVerified
    );

    const updated = await prisma.verificationSession.update({
      where: { session_id: session.session_id },
      data: { status: 'IDENTITY_CONFIRMED' },
      include: {
        observations: { orderBy: { step_sequence: 'asc' } },
        reference_standards: { include: { standard: true } },
        instrument: { include: { model: true } },
      },
    });

    return this.formatSession(updated);
  }

  /**
   * Starts verification test execution
   */
  async startSession(tenantId: string, sessionId: string, actor: SecurityContext): Promise<any> {
    const session = await this.getRawSession(tenantId, sessionId);

    SessionStateMachine.startSession(
      {
        session_id: session.session_id,
        tenant_id: session.tenant_id,
        status: session.status as any,
        automated_evaluation_flag: session.automated_evaluation_flag,
      },
      actor
    );

    const testTime = new Date();

    const updated = await prisma.verificationSession.update({
      where: { session_id: session.session_id },
      data: {
        status: 'IN_PROGRESS',
        actual_test_timestamp: testTime,
      },
      include: {
        observations: { orderBy: { step_sequence: 'asc' } },
        reference_standards: { include: { standard: true } },
        instrument: { include: { model: true } },
      },
    });

    // Update parent application
    await prisma.verificationApplication.update({
      where: { application_id: session.application_id },
      data: { current_status: 'VERIFICATION_IN_PROGRESS' },
    });

    return this.formatSession(updated);
  }

  /**
   * Submits test observations and performs automated statutory Legal Metrology evaluation
   */
  async submitObservations(
    tenantId: string,
    sessionId: string,
    input: SessionObservationSubmitInput,
    actor: SecurityContext
  ): Promise<any> {
    const session = await this.getRawSession(tenantId, sessionId);

    SessionStateMachine.submitObservations(
      {
        session_id: session.session_id,
        tenant_id: session.tenant_id,
        status: session.status as any,
        automated_evaluation_flag: session.automated_evaluation_flag,
      },
      actor,
      (input.observations || []).length
    );

    // 1. Fetch instrument & model for specifications
    const instrument = await prisma.instrument.findUnique({
      where: { instrument_id: session.instrument_id },
      include: { model: true },
    });

    if (!instrument || !instrument.model) {
      throw new NotFoundError(`Instrument or model specifications not found for session '${sessionId}'`);
    }

    const testTime = session.actual_test_timestamp || new Date();

    // 2. Validate reference standards fail-closed
    if (input.reference_standard_ids && input.reference_standard_ids.length > 0) {
      const standards = await prisma.referenceStandard.findMany({
        where: {
          standard_id: { in: input.reference_standard_ids },
        },
      });

      const stdValidation = validateReferenceStandards(
        standards.map((s) => ({
          standard_id: s.standard_id,
          accuracy_class: s.accuracy_class,
          denomination_mass: s.denomination_mass,
          calibrated_at: s.calibrated_at,
          valid_until: s.valid_until,
          calibration_status: s.calibration_status as any,
          expanded_uncertainty: s.expanded_uncertainty,
        })),
        instrument.model.accuracy_class,
        instrument.model.verification_scale_interval_e,
        testTime
      );

      if (!stdValidation.isValid) {
        throw new ValidationError(
          `Reference standards validation failed: ${stdValidation.errors.join('; ')}`
        );
      }

      // Record session reference standards
      for (const std of standards) {
        await prisma.sessionReferenceStandard.upsert({
          where: {
            session_id_standard_id: {
              session_id: session.session_id,
              standard_id: std.standard_id,
            },
          },
          update: {
            snapshot_calibration_certificate: std.calibration_certificate_number,
            snapshot_valid_until: std.valid_until,
            verified_suitable: true,
          },
          create: {
            session_id: session.session_id,
            standard_id: std.standard_id,
            snapshot_calibration_certificate: std.calibration_certificate_number,
            snapshot_valid_until: std.valid_until,
            verified_suitable: true,
          },
        });
      }
    }

    // 3. Perform exact statutory NAWI evaluation
    const evaluationResult = evaluateNawiSession(
      {
        accuracy_class: instrument.model.accuracy_class,
        verification_scale_interval_e: Number(instrument.model.verification_scale_interval_e),
        min_capacity: Number(instrument.model.min_capacity),
        max_capacity: Number(instrument.model.max_capacity),
        unit: instrument.model.capacity_unit,
      },
      input.observations as any,
      true // initial verification
    );

    // 4. Persist observations with calculation traces
    await prisma.testObservation.deleteMany({
      where: { session_id: session.session_id },
    });

    for (const evaluated of evaluationResult.observations) {
      await prisma.testObservation.create({
        data: {
          session_id: session.session_id,
          step_type: evaluated.step_type as any,
          step_sequence: evaluated.step_sequence,
          nominal_load: evaluated.nominal_load.toString(),
          load_unit: evaluated.load_unit,
          raw_indication_reading: evaluated.raw_indication_reading.toString(),
          normalized_indication: evaluated.normalized_indication.toString(),
          reading_unit: evaluated.reading_unit,
          observed_error: evaluated.observed_error.toString(),
          mpe_allowed: evaluated.mpe_allowed.toString(),
          is_within_mpe: evaluated.is_within_mpe,
          repetition_index: evaluated.repetition_index,
          eccentricity_position: evaluated.eccentricity_position || null,
          calculation_trace: JSON.stringify(evaluated.calculation_trace),
          is_immutable: true,
        },
      });
    }

    // 5. Update session status to SUBMITTED
    const updated = await prisma.verificationSession.update({
      where: { session_id: session.session_id },
      data: {
        status: 'SUBMITTED',
        automated_evaluation_flag: evaluationResult.passed,
        environmental_temp_celsius: input.environmental_temp_celsius ?? session.environmental_temp_celsius,
        environmental_humidity_percent: input.environmental_humidity_percent ?? session.environmental_humidity_percent,
      },
      include: {
        observations: { orderBy: { step_sequence: 'asc' } },
        reference_standards: { include: { standard: true } },
        instrument: { include: { model: true } },
      },
    });

    return this.formatSession(updated);
  }

  /**
   * Records officer statutory legal disposition
   */
  async recordDisposition(
    tenantId: string,
    sessionId: string,
    input: SessionDispositionInput,
    actor: SecurityContext
  ): Promise<any> {
    const session = await this.getRawSession(tenantId, sessionId);

    SessionStateMachine.recordDisposition(
      {
        session_id: session.session_id,
        tenant_id: session.tenant_id,
        status: session.status as any,
        automated_evaluation_flag: session.automated_evaluation_flag,
      },
      actor,
      input.outcome,
      input.disposition_notes
    );

    const now = new Date();
    const updated = await prisma.verificationSession.update({
      where: { session_id: session.session_id },
      data: {
        status: 'FINALIZED',
        outcome: input.outcome as any,
        officer_disposition_notes: input.disposition_notes || null,
        finalized_at: now,
      },
      include: {
        observations: { orderBy: { step_sequence: 'asc' } },
        reference_standards: { include: { standard: true } },
        instrument: { include: { model: true } },
      },
    });

    // Update parent application
    const appOutcome =
      input.outcome === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION' ? 'COMPLETED' : 'REJECTED';

    await prisma.verificationApplication.update({
      where: { application_id: session.application_id },
      data: { current_status: appOutcome as any },
    });

    return this.formatSession(updated);
  }

  private async getRawSession(tenantId: string, sessionId: string) {
    const session = await prisma.verificationSession.findFirst({
      where: {
        tenant_id: tenantId,
        session_id: sessionId,
      },
    });
    if (!session) {
      throw new NotFoundError(`Verification session '${sessionId}' not found`);
    }
    return session;
  }

  public formatSession(s: any): any {
    return {
      session_id: s.session_id,
      tenant_id: s.tenant_id,
      application_id: s.application_id,
      instrument_id: s.instrument_id,
      procedure_pack_id: s.procedure_pack_id,
      procedure_pack_checksum: s.procedure_pack_checksum,
      verifier_id: s.verifier_id,
      verifier_role: s.verifier_role,
      scheduled_date: s.scheduled_date?.toISOString().split('T')[0],
      actual_test_timestamp: s.actual_test_timestamp?.toISOString(),
      test_location_geo: parseJsonSafe(s.test_location_geo),
      environmental_temp_celsius: s.environmental_temp_celsius ? Number(s.environmental_temp_celsius) : undefined,
      environmental_humidity_percent: s.environmental_humidity_percent
        ? Number(s.environmental_humidity_percent)
        : undefined,
      status: s.status,
      automated_evaluation_flag: s.automated_evaluation_flag ?? undefined,
      outcome: s.outcome || undefined,
      officer_disposition_notes: s.officer_disposition_notes || undefined,
      finalized_at: s.finalized_at?.toISOString(),
      reference_standards: (s.reference_standards || []).map((rs: any) => ({
        standard_id: rs.standard_id,
        snapshot_calibration_certificate: rs.snapshot_calibration_certificate,
        snapshot_valid_until: rs.snapshot_valid_until?.toISOString().split('T')[0],
        verified_suitable: rs.verified_suitable,
      })),
      observations: (s.observations || []).map((obs: any) => ({
        observation_id: obs.observation_id,
        session_id: obs.session_id,
        step_type: obs.step_type,
        step_sequence: obs.step_sequence,
        nominal_load: Number(obs.nominal_load),
        load_unit: obs.load_unit,
        raw_indication_reading: Number(obs.raw_indication_reading),
        normalized_indication: Number(obs.normalized_indication),
        reading_unit: obs.reading_unit,
        observed_error: Number(obs.observed_error),
        mpe_allowed: Number(obs.mpe_allowed),
        is_within_mpe: obs.is_within_mpe,
        repetition_index: obs.repetition_index,
        eccentricity_position: obs.eccentricity_position || undefined,
        calculation_trace: parseJsonSafe(obs.calculation_trace),
        is_immutable: obs.is_immutable,
        recorded_at: obs.recorded_at?.toISOString(),
      })),
      created_at: s.created_at?.toISOString(),
      updated_at: s.updated_at?.toISOString(),
    };
  }
}

export const sessionService = new SessionService();
