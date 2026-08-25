import { SessionStatusEnum, VerificationOutcomeEnum, RoleEnum, SecurityContext } from '../types.js';
import {
  ForbiddenError,
  GuardConditionFailedError,
  InvalidStateTransitionError,
  UnauthorizedTransitionError,
} from '../errors.js';

export interface SessionStateContext {
  session_id: string;
  tenant_id: string;
  status: SessionStatusEnum;
  automated_evaluation_flag?: boolean | null;
  outcome?: VerificationOutcomeEnum | null;
  finalized_at?: Date | null;
}

export class SessionStateMachine {
  private static checkAuthorization(
    context: SessionStateContext,
    security: SecurityContext,
    allowedRoles: RoleEnum[]
  ): void {
    if (security.tenantId !== context.tenant_id && security.role !== 'ADMIN') {
      throw new UnauthorizedTransitionError(
        `Cross-tenant violation: Caller tenant '${security.tenantId}' does not match session tenant '${context.tenant_id}'`
      );
    }
    if (!allowedRoles.includes(security.role)) {
      throw new ForbiddenError(`Role '${security.role}' is not authorized for verification session modification`);
    }
  }

  /**
   * Confirm physical serial identity (PLANNED -> IDENTITY_CONFIRMED)
   */
  public static confirmIdentity(
    context: SessionStateContext,
    security: SecurityContext,
    serialVerified: boolean
  ): SessionStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'GATC_VERIFIER', 'ADMIN']);

    if (context.status !== 'PLANNED') {
      throw new InvalidStateTransitionError(context.status, 'IDENTITY_CONFIRMED', 'Can only confirm identity from PLANNED');
    }

    if (!serialVerified) {
      throw new GuardConditionFailedError(
        'Physical serial number must be verified on-site prior to testing',
        'SERIAL_VERIFICATION_REQUIRED'
      );
    }

    return 'IDENTITY_CONFIRMED';
  }

  /**
   * Start test execution (IDENTITY_CONFIRMED -> IN_PROGRESS)
   */
  public static startSession(context: SessionStateContext, security: SecurityContext): SessionStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'GATC_VERIFIER', 'ADMIN']);

    if (context.status !== 'IDENTITY_CONFIRMED') {
      throw new InvalidStateTransitionError(
        context.status,
        'IN_PROGRESS',
        'Physical identity must be confirmed before starting testing'
      );
    }

    return 'IN_PROGRESS';
  }

  /**
   * Submit observations (IN_PROGRESS -> SUBMITTED)
   */
  public static submitObservations(
    context: SessionStateContext,
    security: SecurityContext,
    observationCount: number
  ): SessionStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'GATC_VERIFIER', 'ADMIN']);

    if (context.status !== 'IN_PROGRESS' && context.status !== 'SUBMITTED') {
      throw new InvalidStateTransitionError(
        context.status,
        'SUBMITTED',
        'Session must be IN_PROGRESS to submit observations'
      );
    }

    if (observationCount === 0) {
      throw new GuardConditionFailedError('Cannot submit empty observations list', 'OBSERVATIONS_REQUIRED');
    }

    return 'SUBMITTED';
  }

  /**
   * Record statutory officer disposition (SUBMITTED -> FINALIZED)
   */
  public static recordDisposition(
    context: SessionStateContext,
    security: SecurityContext,
    outcome: VerificationOutcomeEnum,
    dispositionNotes?: string
  ): { nextStatus: SessionStatusEnum; outcome: VerificationOutcomeEnum } {
    this.checkAuthorization(context, security, ['LMO', 'GATC_VERIFIER', 'ADMIN']);

    if (context.status !== 'SUBMITTED' && context.status !== 'IN_PROGRESS') {
      throw new InvalidStateTransitionError(
        context.status,
        'FINALIZED',
        'Can only record statutory disposition for SUBMITTED session'
      );
    }

    // Statutory Guard: Cannot grant PASSED if automated calculation failed
    if (outcome === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION' && context.automated_evaluation_flag === false) {
      throw new GuardConditionFailedError(
        'Cannot grant passed disposition when deterministic statutory calculation evaluated to failure',
        'DETERMINISTIC_PASS_REQUIRED'
      );
    }

    return {
      nextStatus: 'FINALIZED',
      outcome,
    };
  }
}
