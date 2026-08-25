import { ReferenceStandardStatusEnum, RoleEnum, SecurityContext } from '../types.js';
import {
  ForbiddenError,
  GuardConditionFailedError,
  InvalidStateTransitionError,
  UnauthorizedTransitionError,
} from '../errors.js';

export interface StandardStateContext {
  standard_id: string;
  tenant_id: string;
  calibration_status: ReferenceStandardStatusEnum;
  valid_until: Date | string;
}

export class StandardStateMachine {
  private static checkAuthorization(
    context: StandardStateContext,
    security: SecurityContext,
    allowedRoles: RoleEnum[]
  ): void {
    if (security.tenantId !== context.tenant_id && security.role !== 'ADMIN') {
      throw new UnauthorizedTransitionError(
        `Cross-tenant violation: Caller tenant '${security.tenantId}' does not match standard tenant '${context.tenant_id}'`
      );
    }
    if (!allowedRoles.includes(security.role)) {
      throw new ForbiddenError(`Role '${security.role}' is not authorized for reference standard operations`);
    }
  }

  /**
   * Mark standard due for calibration (ACTIVE -> DUE_CALIBRATION)
   */
  public static markDue(context: StandardStateContext, security: SecurityContext): ReferenceStandardStatusEnum {
    if (context.calibration_status !== 'ACTIVE') {
      throw new InvalidStateTransitionError(context.calibration_status, 'DUE_CALIBRATION');
    }
    return 'DUE_CALIBRATION';
  }

  /**
   * Send standard for calibration (ACTIVE / DUE_CALIBRATION / EXPIRED -> UNDER_CALIBRATION)
   */
  public static sendForCalibration(
    context: StandardStateContext,
    security: SecurityContext
  ): ReferenceStandardStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    const validSources: ReferenceStandardStatusEnum[] = ['ACTIVE', 'DUE_CALIBRATION', 'EXPIRED'];

    if (!validSources.includes(context.calibration_status)) {
      throw new InvalidStateTransitionError(context.calibration_status, 'UNDER_CALIBRATION');
    }

    return 'UNDER_CALIBRATION';
  }

  /**
   * Recalibrate standard with new certificate (UNDER_CALIBRATION / DUE_CALIBRATION / EXPIRED / QUARANTINED -> ACTIVE)
   */
  public static recalibrate(
    context: StandardStateContext,
    security: SecurityContext,
    newValidUntil: Date | string
  ): ReferenceStandardStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    const exp = new Date(newValidUntil);
    if (isNaN(exp.getTime()) || exp.getTime() <= Date.now()) {
      throw new GuardConditionFailedError('New calibration valid_until must be in the future', 'INVALID_EXPIRY');
    }

    return 'ACTIVE';
  }

  /**
   * Quarantine standard for drift or damage (ACTIVE / DUE_CALIBRATION / UNDER_CALIBRATION / EXPIRED -> QUARANTINED)
   */
  public static quarantine(
    context: StandardStateContext,
    security: SecurityContext,
    reason?: string
  ): ReferenceStandardStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    if (context.calibration_status === 'RETIRED') {
      throw new InvalidStateTransitionError(context.calibration_status, 'QUARANTINED', 'Cannot quarantine retired asset');
    }

    if (!reason || reason.trim().length === 0) {
      throw new GuardConditionFailedError('Quarantine reason must be provided', 'REASON_REQUIRED');
    }

    return 'QUARANTINED';
  }

  /**
   * Retire standard (Any -> RETIRED) - Terminal
   */
  public static retire(context: StandardStateContext, security: SecurityContext): ReferenceStandardStatusEnum {
    this.checkAuthorization(context, security, ['SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    if (context.calibration_status === 'RETIRED') {
      throw new InvalidStateTransitionError(context.calibration_status, 'RETIRED', 'Standard is already retired');
    }

    return 'RETIRED';
  }
}
