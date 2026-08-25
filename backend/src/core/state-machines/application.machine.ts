import { ApplicationStatusEnum, RoleEnum, SecurityContext } from '../types.js';
import {
  ForbiddenError,
  GuardConditionFailedError,
  InvalidStateTransitionError,
  UnauthorizedTransitionError,
} from '../errors.js';

export interface ApplicationStateContext {
  application_id: string;
  tenant_id: string;
  jurisdiction_id: string;
  current_status: ApplicationStatusEnum;
  applicant_declaration_accepted?: boolean;
  version: number;
  assigned_lmo_id?: string | null;
  assigned_gatc_id?: string | null;
  fee_assessment_id?: string | null;
}

export class ApplicationStateMachine {
  /**
   * Validates tenancy and actor authorization before executing transitions
   */
  private static checkAuthorization(
    context: ApplicationStateContext,
    securityContext: SecurityContext,
    allowedRoles: RoleEnum[]
  ): void {
    // 1. Tenancy check
    if (securityContext.tenantId !== context.tenant_id && securityContext.role !== 'ADMIN') {
      throw new UnauthorizedTransitionError(
        `Cross-tenant violation: Caller tenant '${securityContext.tenantId}' does not match resource tenant '${context.tenant_id}'`
      );
    }

    // 2. Role check
    if (!allowedRoles.includes(securityContext.role)) {
      throw new ForbiddenError(
        `Role '${securityContext.role}' is not authorized. Required: ${allowedRoles.join(', ')}`
      );
    }
  }

  /**
   * Submit application (DRAFT -> SUBMITTED)
   */
  public static submit(context: ApplicationStateContext, security: SecurityContext): ApplicationStatusEnum {
    this.checkAuthorization(context, security, ['OWNER', 'APPLICANT', 'ADMIN']);

    if (context.current_status !== 'DRAFT') {
      throw new InvalidStateTransitionError(context.current_status, 'SUBMITTED', 'Can only submit from DRAFT');
    }

    if (!context.applicant_declaration_accepted) {
      throw new GuardConditionFailedError(
        'Applicant declaration must be accepted prior to submission',
        'DECLARATION_REQUIRED'
      );
    }

    return 'SUBMITTED';
  }

  /**
   * Withdraw application (DRAFT / SUBMITTED / UNDER_SCRUTINY / QUERY_RAISED -> WITHDRAWN)
   */
  public static withdraw(context: ApplicationStateContext, security: SecurityContext): ApplicationStatusEnum {
    this.checkAuthorization(context, security, ['OWNER', 'APPLICANT', 'ADMIN']);

    const allowedSourceStates: ApplicationStatusEnum[] = [
      'DRAFT',
      'SUBMITTED',
      'UNDER_SCRUTINY',
      'QUERY_RAISED',
      'QUERY_RESPONDED',
      'CORRECTION_SUBMITTED',
    ];

    if (!allowedSourceStates.includes(context.current_status)) {
      throw new InvalidStateTransitionError(
        context.current_status,
        'WITHDRAWN',
        'Cannot withdraw once fees are paid or verification is scheduled'
      );
    }

    return 'WITHDRAWN';
  }

  /**
   * Begin scrutiny (SUBMITTED / CORRECTION_SUBMITTED / QUERY_RESPONDED -> UNDER_SCRUTINY)
   */
  public static beginScrutiny(context: ApplicationStateContext, security: SecurityContext): ApplicationStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    const validSources: ApplicationStatusEnum[] = [
      'SUBMITTED',
      'CORRECTION_SUBMITTED',
      'QUERY_RESPONDED',
      'UNDER_SCRUTINY',
    ];

    if (!validSources.includes(context.current_status)) {
      throw new InvalidStateTransitionError(context.current_status, 'UNDER_SCRUTINY');
    }

    return 'UNDER_SCRUTINY';
  }

  /**
   * Raise query (UNDER_SCRUTINY -> QUERY_RAISED)
   */
  public static raiseQuery(
    context: ApplicationStateContext,
    security: SecurityContext,
    queryText?: string
  ): ApplicationStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    if (context.current_status !== 'UNDER_SCRUTINY' && context.current_status !== 'SUBMITTED') {
      throw new InvalidStateTransitionError(
        context.current_status,
        'QUERY_RAISED',
        'Can only raise query from UNDER_SCRUTINY or SUBMITTED'
      );
    }

    if (!queryText || queryText.trim().length === 0) {
      throw new GuardConditionFailedError('Query text cannot be empty', 'QUERY_TEXT_REQUIRED');
    }

    return 'QUERY_RAISED';
  }

  /**
   * Submit correction (QUERY_RAISED -> CORRECTION_SUBMITTED)
   */
  public static submitCorrection(
    context: ApplicationStateContext,
    security: SecurityContext,
    notes?: string
  ): { nextStatus: ApplicationStatusEnum; nextVersion: number } {
    this.checkAuthorization(context, security, ['OWNER', 'APPLICANT', 'ADMIN']);

    if (context.current_status !== 'QUERY_RAISED') {
      throw new InvalidStateTransitionError(
        context.current_status,
        'CORRECTION_SUBMITTED',
        'Can only submit correction for an active QUERY_RAISED state'
      );
    }

    if (!notes || notes.trim().length === 0) {
      throw new GuardConditionFailedError('Correction notes cannot be empty', 'CORRECTION_NOTES_REQUIRED');
    }

    return {
      nextStatus: 'CORRECTION_SUBMITTED',
      nextVersion: context.version + 1,
    };
  }

  /**
   * Accept application (UNDER_SCRUTINY / SUBMITTED -> ACCEPTED or FEE_PENDING)
   */
  public static accept(context: ApplicationStateContext, security: SecurityContext): ApplicationStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    const validSources: ApplicationStatusEnum[] = [
      'UNDER_SCRUTINY',
      'SUBMITTED',
      'CORRECTION_SUBMITTED',
      'QUERY_RESPONDED',
    ];

    if (!validSources.includes(context.current_status)) {
      throw new InvalidStateTransitionError(context.current_status, 'ACCEPTED');
    }

    return 'ACCEPTED';
  }

  /**
   * Reject application (UNDER_SCRUTINY / SUBMITTED -> REJECTED)
   */
  public static reject(
    context: ApplicationStateContext,
    security: SecurityContext,
    rejectionReason?: string
  ): ApplicationStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    const validSources: ApplicationStatusEnum[] = [
      'DRAFT',
      'SUBMITTED',
      'UNDER_SCRUTINY',
      'QUERY_RAISED',
      'CORRECTION_SUBMITTED',
      'QUERY_RESPONDED',
    ];

    if (!validSources.includes(context.current_status)) {
      throw new InvalidStateTransitionError(context.current_status, 'REJECTED');
    }

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new GuardConditionFailedError('Rejection reason cannot be empty', 'REJECTION_REASON_REQUIRED');
    }

    return 'REJECTED';
  }

  /**
   * Reconcile payment (FEE_PENDING / ACCEPTED -> FEE_PAID)
   */
  public static reconcilePayment(context: ApplicationStateContext, security: SecurityContext): ApplicationStatusEnum {
    this.checkAuthorization(context, security, ['OWNER', 'APPLICANT', 'LMO', 'ADMIN']);

    const validSources: ApplicationStatusEnum[] = [
      'FEE_PENDING',
      'ACCEPTED',
      'PAYMENT_PROCESSING',
      'UNDER_SCRUTINY',
    ];

    if (!validSources.includes(context.current_status)) {
      throw new InvalidStateTransitionError(context.current_status, 'FEE_PAID');
    }

    return 'FEE_PAID';
  }

  /**
   * Schedule verification (FEE_PAID / ACCEPTED / PAYMENT_RECONCILED -> SCHEDULED)
   */
  public static schedule(
    context: ApplicationStateContext,
    security: SecurityContext,
    slotStart: Date | string,
    slotEnd: Date | string,
    assignedLmoId?: string | null,
    assignedGatcId?: string | null
  ): ApplicationStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    const validSources: ApplicationStatusEnum[] = [
      'ACCEPTED',
      'FEE_PENDING',
      'FEE_PAID',
      'PAYMENT_RECONCILED',
      'SCHEDULED',
    ];

    if (!validSources.includes(context.current_status)) {
      throw new InvalidStateTransitionError(context.current_status, 'SCHEDULED');
    }

    const start = new Date(slotStart);
    const end = new Date(slotEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      throw new GuardConditionFailedError('Schedule slot end must be after slot start', 'INVALID_SCHEDULE_WINDOW');
    }

    if (!assignedLmoId && !assignedGatcId) {
      throw new GuardConditionFailedError(
        'Either assigned LMO or assigned GATC must be specified for scheduling',
        'ASSIGNED_VERIFIER_REQUIRED'
      );
    }

    return 'SCHEDULED';
  }

  /**
   * Commence testing (SCHEDULED -> VERIFICATION_IN_PROGRESS)
   */
  public static commenceTesting(context: ApplicationStateContext, security: SecurityContext): ApplicationStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'GATC_VERIFIER', 'ADMIN']);

    const validSources: ApplicationStatusEnum[] = ['SCHEDULED', 'FEE_PAID', 'PAYMENT_RECONCILED'];

    if (!validSources.includes(context.current_status)) {
      throw new InvalidStateTransitionError(context.current_status, 'VERIFICATION_IN_PROGRESS');
    }

    return 'VERIFICATION_IN_PROGRESS';
  }

  /**
   * Complete application (VERIFICATION_IN_PROGRESS -> COMPLETED)
   */
  public static complete(
    context: ApplicationStateContext,
    security: SecurityContext,
    isSessionFinalized: boolean
  ): ApplicationStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'GATC_VERIFIER', 'ADMIN']);

    if (context.current_status !== 'VERIFICATION_IN_PROGRESS' && context.current_status !== 'SCHEDULED') {
      throw new InvalidStateTransitionError(context.current_status, 'COMPLETED');
    }

    if (!isSessionFinalized) {
      throw new GuardConditionFailedError(
        'Cannot complete application before verification session is finalized',
        'SESSION_FINALIZATION_REQUIRED'
      );
    }

    return 'COMPLETED';
  }
}
