import { prisma } from '../db/prisma.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import { ApplicationStateMachine } from '../core/state-machines/application.machine.js';
import { PaginatedResult, SecurityContext, ApplicationStatusEnum, ApplicationTypeEnum, ServiceModeEnum } from '../core/types.js';

export interface ApplicationCreateInput {
  instrument_id: string;
  applicant_id?: string;
  application_type?: ApplicationTypeEnum | string;
  service_mode?: ServiceModeEnum | string;
  preferred_verification_date?: string;
  applicant_declaration_accepted?: boolean;
}

export interface ApplicationScrutinyInput {
  action: 'ACCEPT' | 'QUERY' | 'REJECT';
  notes?: string;
  query_text?: string;
  rejection_reason?: string;
}

export interface FeeAssessmentInput {
  base_verification_fee: number;
  user_charge?: number;
  late_fee?: number;
  policy_version?: string;
}

export interface PaymentReconcileInput {
  receipt_number?: string;
  payment_gateway_ref?: string;
}

export interface ApplicationScheduleInput {
  slot_start: string;
  slot_end: string;
  assigned_lmo_id?: string;
  assigned_gatc_id?: string;
}

export class ApplicationService {
  /**
   * Lists applications for a tenant with pagination and optional applicant filtering
   */
  async listApplications(
    tenantId: string,
    page = 1,
    pageSize = 50,
    applicantId?: string
  ): Promise<PaginatedResult<any>> {
    const skip = (Math.max(1, page) - 1) * pageSize;
    const where: any = { tenant_id: tenantId };
    if (applicantId) {
      const user = await prisma.user.findUnique({ where: { user_id: applicantId } });
      if (user && user.stakeholder_id) {
        where.applicant_id = user.stakeholder_id;
      } else {
        where.applicant_id = applicantId;
      }
    }

    const [total, rawItems] = await Promise.all([
      prisma.verificationApplication.count({ where }),
      prisma.verificationApplication.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          fee_assessment: true,
          instrument: {
            include: { model: true },
          },
          applicant: true,
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const items = rawItems.map((app) => this.formatApplication(app));
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
   * Gets an application by ID or application number
   */
  async getApplicationById(tenantId: string, idOrNumber: string): Promise<any> {
    const raw = await prisma.verificationApplication.findFirst({
      where: {
        tenant_id: tenantId,
        OR: [{ application_id: idOrNumber }, { application_number: idOrNumber }],
      },
      include: {
        fee_assessment: true,
        instrument: {
          include: { model: true },
        },
        applicant: true,
      },
    });

    if (!raw) {
      throw new NotFoundError(`Application '${idOrNumber}' not found in tenant '${tenantId}'`);
    }

    return this.formatApplication(raw);
  }

  /**
   * Files a new verification application
   */
  async createApplication(
    tenantId: string,
    input: ApplicationCreateInput,
    _actor?: SecurityContext
  ): Promise<any> {
    if (!input.instrument_id) {
      throw new ValidationError('instrument_id is required');
    }

    // Verify instrument exists
    const instrument = await prisma.instrument.findUnique({
      where: { instrument_id: input.instrument_id },
    });
    if (!instrument) {
      throw new NotFoundError(`Instrument '${input.instrument_id}' not found`);
    }

    // Resolve applicant_id (could be stakeholder_id or user_id)
    let applicantStakeholderId = input.applicant_id || instrument.owner_id || 'stk-trader-01';
    const stakeholder = await prisma.stakeholder.findUnique({
      where: { stakeholder_id: applicantStakeholderId },
    });
    if (!stakeholder) {
      const user = await prisma.user.findUnique({
        where: { user_id: applicantStakeholderId },
      });
      if (user && user.stakeholder_id) {
        applicantStakeholderId = user.stakeholder_id;
      } else {
        const defaultStakeholder = await prisma.stakeholder.findFirst({
          where: { tenant_id: tenantId },
        });
        if (defaultStakeholder) {
          applicantStakeholderId = defaultStakeholder.stakeholder_id;
        }
      }
    }

    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const appNumber = `APP-2026-DL-${randomDigits}`;

    // Create Initial Fee Assessment
    const baseFee = 1000.0;
    const userCharge = 200.0;
    const totalAssessed = baseFee + userCharge;

    const fee = await prisma.feeAssessment.create({
      data: {
        tenant_id: tenantId,
        policy_version: 'POL-FEES-2026.1',
        base_verification_fee: baseFee,
        user_charge: userCharge,
        late_fee: 0.0,
        total_assessed_amount: totalAssessed,
        currency: 'INR',
        payment_status: 'PENDING',
      },
    });

    const isDeclarationAccepted = Boolean(input.applicant_declaration_accepted);
    const initialStatus = isDeclarationAccepted ? 'SUBMITTED' : 'DRAFT';

    const created = await prisma.verificationApplication.create({
      data: {
        application_number: appNumber,
        tenant_id: tenantId,
        jurisdiction_id: instrument.jurisdiction_id,
        instrument_id: input.instrument_id,
        applicant_id: applicantStakeholderId,
        application_type: (input.application_type as any) || 'INITIAL_VERIFICATION',
        service_mode: (input.service_mode as any) || 'ON_SITE',
        preferred_verification_date: input.preferred_verification_date
          ? new Date(input.preferred_verification_date)
          : new Date(Date.now() + 3 * 24 * 3600 * 1000),
        applicant_declaration_accepted: isDeclarationAccepted,
        current_status: initialStatus,
        fee_assessment_id: fee.fee_assessment_id,
        version: 1,
      },
      include: {
        fee_assessment: true,
        instrument: {
          include: { model: true },
        },
        applicant: true,
      },
    });

    return this.formatApplication(created);
  }

  /**
   * Submits a draft application
   */
  async submitApplication(tenantId: string, applicationId: string, actor: SecurityContext): Promise<any> {
    const app = await this.getRawApplication(tenantId, applicationId);

    ApplicationStateMachine.submit(
      {
        application_id: app.application_id,
        tenant_id: app.tenant_id,
        jurisdiction_id: app.jurisdiction_id,
        current_status: app.current_status as any,
        applicant_declaration_accepted: true,
        version: app.version,
      },
      actor
    );

    const updated = await prisma.verificationApplication.update({
      where: { application_id: app.application_id },
      data: {
        current_status: 'SUBMITTED',
        applicant_declaration_accepted: true,
        version: app.version + 1,
      },
      include: {
        fee_assessment: true,
        instrument: { include: { model: true } },
        applicant: true,
      },
    });

    return this.formatApplication(updated);
  }

  /**
   * Scrutinizes an application (Accept, Query, Reject)
   */
  async scrutinizeApplication(
    tenantId: string,
    applicationId: string,
    input: ApplicationScrutinyInput,
    actor: SecurityContext
  ): Promise<any> {
    const app = await this.getRawApplication(tenantId, applicationId);

    const context = {
      application_id: app.application_id,
      tenant_id: app.tenant_id,
      jurisdiction_id: app.jurisdiction_id,
      current_status: app.current_status as any,
      applicant_declaration_accepted: app.applicant_declaration_accepted,
      version: app.version,
    };

    let nextStatus: ApplicationStatusEnum = 'FEE_PENDING';
    let activeQuery: string | null = null;
    let queryRaisedAt: Date | null = null;
    let rejectionReason: string | null = null;

    if (input.action === 'ACCEPT') {
      ApplicationStateMachine.accept(context, actor);
      nextStatus = 'FEE_PENDING';
      if (app.fee_assessment_id) {
        await prisma.feeAssessment.update({
          where: { fee_assessment_id: app.fee_assessment_id },
          data: { payment_status: 'PAYMENT_PENDING' },
        });
      } else {
        const newFee = await prisma.feeAssessment.create({
          data: {
            tenant_id: tenantId,
            base_verification_fee: 750.0,
            user_charge: 0.0,
            late_fee: 0.0,
            total_assessed_amount: 750.0,
            policy_version: 'POL-FEES-2026.1',
            payment_status: 'PAYMENT_PENDING',
          },
        });
        await prisma.verificationApplication.update({
          where: { application_id: app.application_id },
          data: { fee_assessment_id: newFee.fee_assessment_id },
        });
      }
    } else if (input.action === 'QUERY') {
      activeQuery = input.query_text || input.notes || 'Additional clarification required for submitted specifications';
      ApplicationStateMachine.raiseQuery(context, actor, activeQuery);
      nextStatus = 'QUERY_RAISED';
      queryRaisedAt = new Date();
    } else if (input.action === 'REJECT') {
      rejectionReason = input.rejection_reason || input.notes || 'Application rejected during departmental scrutiny';
      ApplicationStateMachine.reject(context, actor, rejectionReason);
      nextStatus = 'REJECTED';
    } else {
      throw new ValidationError(`Invalid scrutiny action: ${input.action}`);
    }

    const updated = await prisma.verificationApplication.update({
      where: { application_id: app.application_id },
      data: {
        current_status: nextStatus,
        scrutiny_notes: input.notes || undefined,
        active_query: activeQuery,
        query_raised_at: queryRaisedAt,
        rejection_reason: rejectionReason,
        version: app.version + 1,
      },
      include: {
        fee_assessment: true,
        instrument: { include: { model: true } },
        applicant: true,
      },
    });

    return this.formatApplication(updated);
  }

  /**
   * Submits a correction in response to a query
   */
  async submitCorrection(
    tenantId: string,
    applicationId: string,
    correctionNotes: string,
    actor: SecurityContext
  ): Promise<any> {
    const app = await this.getRawApplication(tenantId, applicationId);

    ApplicationStateMachine.submitCorrection(
      {
        application_id: app.application_id,
        tenant_id: app.tenant_id,
        jurisdiction_id: app.jurisdiction_id,
        current_status: app.current_status as any,
        applicant_declaration_accepted: app.applicant_declaration_accepted,
        version: app.version,
      },
      actor,
      correctionNotes
    );

    const updated = await prisma.verificationApplication.update({
      where: { application_id: app.application_id },
      data: {
        current_status: 'CORRECTION_SUBMITTED',
        active_query: null,
        scrutiny_notes: `Correction submitted: ${correctionNotes}`,
        version: app.version + 1,
      },
      include: {
        fee_assessment: true,
        instrument: { include: { model: true } },
        applicant: true,
      },
    });

    return this.formatApplication(updated);
  }

  /**
   * Assesses statutory fees for an application
   */
  async assessFees(
    tenantId: string,
    applicationId: string,
    input: FeeAssessmentInput,
    _actor: SecurityContext
  ): Promise<any> {
    const app = await this.getRawApplication(tenantId, applicationId);

    const baseFee = Number(input.base_verification_fee) || 1000.0;
    const userCharge = Number(input.user_charge) || 0.0;
    const lateFee = Number(input.late_fee) || 0.0;
    const totalAmount = baseFee + userCharge + lateFee;

    let feeId = app.fee_assessment_id;

    if (feeId) {
      await prisma.feeAssessment.update({
        where: { fee_assessment_id: feeId },
        data: {
          base_verification_fee: baseFee,
          user_charge: userCharge,
          late_fee: lateFee,
          total_assessed_amount: totalAmount,
          policy_version: input.policy_version || 'POL-FEES-2026.1',
          payment_status: 'PAYMENT_PENDING',
        },
      });
    } else {
      const newFee = await prisma.feeAssessment.create({
        data: {
          tenant_id: tenantId,
          base_verification_fee: baseFee,
          user_charge: userCharge,
          late_fee: lateFee,
          total_assessed_amount: totalAmount,
          policy_version: input.policy_version || 'POL-FEES-2026.1',
          payment_status: 'PAYMENT_PENDING',
        },
      });
      feeId = newFee.fee_assessment_id;
    }

    const updated = await prisma.verificationApplication.update({
      where: { application_id: app.application_id },
      data: {
        fee_assessment_id: feeId,
        current_status: 'FEE_PENDING',
      },
      include: {
        fee_assessment: true,
        instrument: { include: { model: true } },
        applicant: true,
      },
    });

    return this.formatApplication(updated);
  }

  /**
   * Reconciles payment for an application
   */
  async reconcilePayment(
    tenantId: string,
    applicationId: string,
    input: PaymentReconcileInput,
    actor: SecurityContext
  ): Promise<any> {
    const app = await this.getRawApplication(tenantId, applicationId);

    ApplicationStateMachine.reconcilePayment(
      {
        application_id: app.application_id,
        tenant_id: app.tenant_id,
        jurisdiction_id: app.jurisdiction_id,
        current_status: app.current_status as any,
        version: app.version,
      },
      actor
    );

    const receiptNum = input.receipt_number || `RCPT-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const challanNum = `CHALLAN-TREASURY-${Math.floor(1000000 + Math.random() * 9000000)}`;
    const gatewayRef = input.payment_gateway_ref || `SBIEPAY-${Date.now()}`;

    if (app.fee_assessment_id) {
      await prisma.feeAssessment.update({
        where: { fee_assessment_id: app.fee_assessment_id },
        data: {
          payment_status: 'PAYMENT_RECONCILED',
          receipt_number: receiptNum,
          treasury_challan_number: challanNum,
          payment_gateway_ref: gatewayRef,
          paid_at: new Date(),
        },
      });
    } else {
      const newFee = await prisma.feeAssessment.create({
        data: {
          tenant_id: tenantId,
          base_verification_fee: 750.0,
          user_charge: 0.0,
          late_fee: 0.0,
          total_assessed_amount: 750.0,
          policy_version: 'POL-FEES-2026.1',
          payment_status: 'PAYMENT_RECONCILED',
          receipt_number: receiptNum,
          treasury_challan_number: challanNum,
          payment_gateway_ref: gatewayRef,
          paid_at: new Date(),
        },
      });
      await prisma.verificationApplication.update({
        where: { application_id: app.application_id },
        data: { fee_assessment_id: newFee.fee_assessment_id },
      });
    }

    const updated = await prisma.verificationApplication.update({
      where: { application_id: app.application_id },
      data: {
        current_status: 'PAYMENT_RECONCILED',
      },
      include: {
        fee_assessment: true,
        instrument: { include: { model: true } },
        applicant: true,
      },
    });

    return this.formatApplication(updated);
  }

  /**
   * Schedules a verification inspection slot and assigns an officer
   */
  async scheduleApplication(
    tenantId: string,
    applicationId: string,
    input: ApplicationScheduleInput,
    actor: SecurityContext
  ): Promise<any> {
    const app = await this.getRawApplication(tenantId, applicationId);

    const assignedLmoId = input.assigned_lmo_id || actor.userId || 'lmo-officer-01';
    const slotStart = new Date(input.slot_start);
    const slotEnd = new Date(input.slot_end);

    ApplicationStateMachine.schedule(
      {
        application_id: app.application_id,
        tenant_id: app.tenant_id,
        jurisdiction_id: app.jurisdiction_id,
        current_status: app.current_status as any,
        version: app.version,
      },
      actor,
      slotStart,
      slotEnd,
      assignedLmoId,
      input.assigned_gatc_id
    );

    const updated = await prisma.verificationApplication.update({
      where: { application_id: app.application_id },
      data: {
        current_status: 'SCHEDULED',
        scheduled_slot_start: slotStart,
        scheduled_slot_end: slotEnd,
        assigned_lmo_id: assignedLmoId,
        assigned_gatc_id: input.assigned_gatc_id || null,
      },
      include: {
        fee_assessment: true,
        instrument: { include: { model: true } },
        applicant: true,
      },
    });

    // Auto-create or verify planned VerificationSession exists
    const existingSession = await prisma.verificationSession.findFirst({
      where: { application_id: app.application_id },
    });

    if (!existingSession) {
      const procPackChecksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      await prisma.verificationSession.create({
        data: {
          tenant_id: tenantId,
          application_id: app.application_id,
          instrument_id: app.instrument_id,
          procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
          procedure_pack_checksum: procPackChecksum,
          verifier_id: assignedLmoId,
          verifier_role: 'LMO',
          scheduled_date: slotStart,
          status: 'PLANNED',
        },
      });
    }

    return this.formatApplication(updated);
  }

  private async getRawApplication(tenantId: string, idOrNumber: string) {
    const app = await prisma.verificationApplication.findFirst({
      where: {
        tenant_id: tenantId,
        OR: [{ application_id: idOrNumber }, { application_number: idOrNumber }],
      },
    });
    if (!app) {
      throw new NotFoundError(`Application '${idOrNumber}' not found`);
    }
    return app;
  }

  public formatApplication(app: any): any {
    return {
      application_id: app.application_id,
      application_number: app.application_number,
      tenant_id: app.tenant_id,
      jurisdiction_id: app.jurisdiction_id,
      instrument_id: app.instrument_id,
      applicant_id: app.applicant_id,
      application_type: app.application_type,
      service_mode: app.service_mode,
      preferred_verification_date: app.preferred_verification_date
        ? app.preferred_verification_date.toISOString().split('T')[0]
        : undefined,
      scheduled_slot_start: app.scheduled_slot_start?.toISOString(),
      scheduled_slot_end: app.scheduled_slot_end?.toISOString(),
      assigned_lmo_id: app.assigned_lmo_id || undefined,
      assigned_gatc_id: app.assigned_gatc_id || undefined,
      fee_assessment_id: app.fee_assessment_id || undefined,
      current_status: app.current_status,
      scrutiny_notes: app.scrutiny_notes || undefined,
      rejection_reason: app.rejection_reason || undefined,
      active_query: app.active_query || undefined,
      query_raised_at: app.query_raised_at?.toISOString(),
      applicant_declaration_accepted: app.applicant_declaration_accepted,
      version: app.version,
      fee_assessment: app.fee_assessment ? this.formatFee(app.fee_assessment) : undefined,
      created_at: app.created_at?.toISOString(),
      updated_at: app.updated_at?.toISOString(),
    };
  }

  public formatFee(fee: any): any {
    return {
      fee_assessment_id: fee.fee_assessment_id,
      tenant_id: fee.tenant_id,
      policy_version: fee.policy_version,
      base_verification_fee: Number(fee.base_verification_fee),
      user_charge: Number(fee.user_charge),
      late_fee: Number(fee.late_fee),
      total_assessed_amount: Number(fee.total_assessed_amount),
      currency: fee.currency,
      payment_status: fee.payment_status,
      payment_gateway_ref: fee.payment_gateway_ref || undefined,
      treasury_challan_number: fee.treasury_challan_number || undefined,
      receipt_number: fee.receipt_number || undefined,
      paid_at: fee.paid_at?.toISOString(),
      created_at: fee.created_at?.toISOString(),
    };
  }
}

export const applicationService = new ApplicationService();
