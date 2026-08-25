import { CertificateStatusEnum, RoleEnum, SecurityContext } from '../types.js';
import {
  ForbiddenError,
  GuardConditionFailedError,
  InvalidStateTransitionError,
  UnauthorizedTransitionError,
} from '../errors.js';

export interface CertificateStateContext {
  certificate_id: string;
  tenant_id: string;
  certificate_status: CertificateStatusEnum;
  session_id: string;
  digital_signature_reference?: string | null;
  superseding_certificate_id?: string | null;
}

export class CertificateStateMachine {
  private static checkAuthorization(
    context: CertificateStateContext,
    security: SecurityContext,
    allowedRoles: RoleEnum[]
  ): void {
    if (security.tenantId !== context.tenant_id && security.role !== 'ADMIN') {
      throw new UnauthorizedTransitionError(
        `Cross-tenant violation: Caller tenant '${security.tenantId}' does not match certificate tenant '${context.tenant_id}'`
      );
    }
    if (!allowedRoles.includes(security.role)) {
      throw new ForbiddenError(`Role '${security.role}' is not authorized for certificate status operations`);
    }
  }

  /**
   * Issue & cryptographically sign certificate (DRAFT / PENDING_SIGNATURE / SIGNING_FAILED -> ISSUED)
   */
  public static issue(
    context: CertificateStateContext,
    security: SecurityContext,
    signatureReference: string
  ): CertificateStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    const validSources: CertificateStatusEnum[] = ['DRAFT', 'PENDING_SIGNATURE', 'SIGNING_FAILED'];

    if (!validSources.includes(context.certificate_status)) {
      throw new InvalidStateTransitionError(
        context.certificate_status,
        'ISSUED',
        'Can only issue from DRAFT, PENDING_SIGNATURE, or SIGNING_FAILED'
      );
    }

    if (!signatureReference || signatureReference.trim().length === 0) {
      throw new GuardConditionFailedError(
        'Digital signature reference is mandatory to issue certificate',
        'SIGNATURE_REQUIRED'
      );
    }

    return 'ISSUED';
  }

  /**
   * Suspend active certificate (ISSUED -> SUSPENDED)
   */
  public static suspend(
    context: CertificateStateContext,
    security: SecurityContext,
    reason?: string
  ): CertificateStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    if (context.certificate_status !== 'ISSUED') {
      throw new InvalidStateTransitionError(
        context.certificate_status,
        'SUSPENDED',
        'Can only suspend an active ISSUED certificate'
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new GuardConditionFailedError('Suspension reason cannot be empty', 'REASON_REQUIRED');
    }

    return 'SUSPENDED';
  }

  /**
   * Reinstate suspended certificate (SUSPENDED -> ISSUED) - Supervisor/Controller only
   */
  public static reinstate(
    context: CertificateStateContext,
    security: SecurityContext,
    reason?: string
  ): CertificateStatusEnum {
    this.checkAuthorization(context, security, ['SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    if (context.certificate_status !== 'SUSPENDED') {
      throw new InvalidStateTransitionError(
        context.certificate_status,
        'ISSUED',
        'Can only reinstate a SUSPENDED certificate'
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new GuardConditionFailedError('Reinstatement reason cannot be empty', 'REASON_REQUIRED');
    }

    return 'ISSUED';
  }

  /**
   * Revoke certificate (ISSUED / SUSPENDED -> REVOKED) - Terminal & Irreversible
   */
  public static revoke(
    context: CertificateStateContext,
    security: SecurityContext,
    reason?: string
  ): CertificateStatusEnum {
    this.checkAuthorization(context, security, ['SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    if (context.certificate_status === 'REVOKED') {
      throw new InvalidStateTransitionError(
        context.certificate_status,
        'REVOKED',
        'Certificate is already revoked (Terminal state)'
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new GuardConditionFailedError('Revocation reason cannot be empty', 'REVOCATION_REASON_REQUIRED');
    }

    return 'REVOKED';
  }

  /**
   * Supersede certificate (ISSUED / SUSPENDED -> SUPERSEDED)
   */
  public static supersede(
    context: CertificateStateContext,
    security: SecurityContext,
    supersedingCertificateId?: string
  ): CertificateStatusEnum {
    this.checkAuthorization(context, security, ['LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN']);

    const validSources: CertificateStatusEnum[] = ['ISSUED', 'SUSPENDED'];

    if (!validSources.includes(context.certificate_status)) {
      throw new InvalidStateTransitionError(
        context.certificate_status,
        'SUPERSEDED',
        'Can only supersede an ISSUED or SUSPENDED certificate'
      );
    }

    return 'SUPERSEDED';
  }

  /**
   * Expire certificate (ISSUED / SUSPENDED -> EXPIRED)
   */
  public static expire(context: CertificateStateContext, security: SecurityContext): CertificateStatusEnum {
    const validSources: CertificateStatusEnum[] = ['ISSUED', 'SUSPENDED'];

    if (!validSources.includes(context.certificate_status)) {
      throw new InvalidStateTransitionError(context.certificate_status, 'EXPIRED');
    }

    return 'EXPIRED';
  }
}
