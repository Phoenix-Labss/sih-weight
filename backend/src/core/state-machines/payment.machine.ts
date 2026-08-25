import { PaymentStatusEnum, RoleEnum, SecurityContext } from '../types.js';
import {
  ForbiddenError,
  InvalidStateTransitionError,
  UnauthorizedTransitionError,
} from '../errors.js';

export interface PaymentStateContext {
  fee_assessment_id: string;
  tenant_id: string;
  payment_status: PaymentStatusEnum;
  payment_gateway_ref?: string | null;
  receipt_number?: string | null;
}

export class PaymentStateMachine {
  private static checkAuthorization(
    context: PaymentStateContext,
    security: SecurityContext,
    allowedRoles: RoleEnum[]
  ): void {
    if (security.tenantId !== context.tenant_id && security.role !== 'ADMIN') {
      throw new UnauthorizedTransitionError(
        `Cross-tenant violation: Caller tenant '${security.tenantId}' does not match payment tenant '${context.tenant_id}'`
      );
    }
    if (!allowedRoles.includes(security.role)) {
      throw new ForbiddenError(`Role '${security.role}' is not authorized for payment operations`);
    }
  }

  /**
   * Initiate payment (PENDING / NOT_ASSESSED -> INITIATED)
   */
  public static initiate(context: PaymentStateContext, security: SecurityContext): PaymentStatusEnum {
    this.checkAuthorization(context, security, ['OWNER', 'APPLICANT', 'ADMIN']);

    const validSources: PaymentStatusEnum[] = ['PENDING', 'PAYMENT_PENDING', 'NOT_ASSESSED'];

    if (!validSources.includes(context.payment_status)) {
      throw new InvalidStateTransitionError(context.payment_status, 'INITIATED');
    }

    return 'INITIATED';
  }

  /**
   * Authorize payment via gateway webhook (INITIATED / PENDING -> AUTHORIZED)
   */
  public static authorize(context: PaymentStateContext, security: SecurityContext): PaymentStatusEnum {
    const validSources: PaymentStatusEnum[] = ['INITIATED', 'PAYMENT_INITIATED', 'PENDING', 'PAYMENT_PENDING'];

    if (!validSources.includes(context.payment_status)) {
      throw new InvalidStateTransitionError(context.payment_status, 'AUTHORIZED');
    }

    return 'AUTHORIZED';
  }

  /**
   * Reconcile payment against treasury ledger (AUTHORIZED / INITIATED / PENDING -> SUCCESS/RECONCILED)
   */
  public static reconcile(context: PaymentStateContext, security: SecurityContext): PaymentStatusEnum {
    this.checkAuthorization(context, security, ['OWNER', 'APPLICANT', 'LMO', 'SUPERVISOR', 'ADMIN']);

    const validSources: PaymentStatusEnum[] = [
      'AUTHORIZED',
      'PAYMENT_AUTHORIZED',
      'INITIATED',
      'PAYMENT_INITIATED',
      'PENDING',
      'PAYMENT_PENDING',
    ];

    if (!validSources.includes(context.payment_status)) {
      throw new InvalidStateTransitionError(context.payment_status, 'SUCCESS');
    }

    return 'SUCCESS';
  }

  /**
   * Mark payment failed (INITIATED / PENDING / AUTHORIZED -> FAILED) - Terminal
   */
  public static fail(context: PaymentStateContext, security: SecurityContext): PaymentStatusEnum {
    const validSources: PaymentStatusEnum[] = [
      'PENDING',
      'PAYMENT_PENDING',
      'INITIATED',
      'PAYMENT_INITIATED',
      'AUTHORIZED',
      'PAYMENT_AUTHORIZED',
    ];

    if (!validSources.includes(context.payment_status)) {
      throw new InvalidStateTransitionError(context.payment_status, 'FAILED');
    }

    return 'FAILED';
  }

  /**
   * Refund payment (SUCCESS / RECONCILED -> REFUNDED) - Terminal
   */
  public static refund(context: PaymentStateContext, security: SecurityContext): PaymentStatusEnum {
    this.checkAuthorization(context, security, ['SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    const validSources: PaymentStatusEnum[] = ['SUCCESS', 'RECONCILED', 'PAYMENT_RECONCILED'];

    if (!validSources.includes(context.payment_status)) {
      throw new InvalidStateTransitionError(context.payment_status, 'REFUNDED');
    }

    return 'REFUNDED';
  }
}
