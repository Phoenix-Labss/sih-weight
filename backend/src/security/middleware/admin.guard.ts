import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../../core/errors.js';

/**
 * Strict ADMIN-only guard for the admin control-plane surface.
 *
 * Unlike `requireRoles`, this guard grants access exclusively to the `ADMIN`
 * role. It intentionally does NOT reuse the `ADMIN` super-user override logic
 * of `rbacGuard` because the admin portal offers broad, cross-tenant database
 * visibility and master-data mutation; only a genuine `ADMIN` actor may pass.
 */
export async function requireAdminGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const actorRole = request.securityContext?.role;
  const actorId = request.securityContext?.userId;

  if (!actorRole) {
    throw new UnauthorizedError('Actor statutory role not identified in context');
  }

  if (actorRole !== 'ADMIN') {
    throw new ForbiddenError(
      `Access denied: Admin portal requires role 'ADMIN', current role is '${actorRole}'. ` +
        'Every admin action is independently audited.',
      'FORBIDDEN_ADMIN_ONLY'
    );
  }

  if (!actorId) {
    throw new UnauthorizedError('Admin actor identity not identified in context');
  }
}

/**
 * Guard that allows ADMIN, CONTROLLER, and SUPERVISOR roles for administrative governance and dual-control approvals.
 */
export async function requireGovernanceGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const actorRole = request.securityContext?.role;
  const actorId = request.securityContext?.userId;

  if (!actorRole) {
    throw new UnauthorizedError('Actor statutory role not identified in context');
  }

  if (actorRole !== 'ADMIN' && actorRole !== 'CONTROLLER' && actorRole !== 'SUPERVISOR') {
    throw new ForbiddenError(
      `Access denied: Governance control plane requires role 'ADMIN', 'CONTROLLER', or 'SUPERVISOR', current role is '${actorRole}'.`,
      'FORBIDDEN_GOVERNANCE_ONLY'
    );
  }

  if (!actorId) {
    throw new UnauthorizedError('Governance actor identity not identified in context');
  }
}