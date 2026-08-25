import { FastifyRequest, FastifyReply } from 'fastify';
import { RoleEnum } from '../../core/types.js';
import { ForbiddenError } from '../../core/errors.js';

/**
 * Role-Based Access Control (RBAC) Guard Factory
 *
 * Produces a Fastify preHandler hook ensuring the authenticated actor
 * has one of the required statutory roles.
 */
export function requireRoles(...allowedRoles: RoleEnum[]) {
  return async function rbacHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const actorRole = request.securityContext?.role;

    if (!actorRole) {
      throw new ForbiddenError('Actor statutory role not identified in context');
    }

    if (actorRole === 'ADMIN') {
      return; // ADMIN has super-user override
    }

    if (!allowedRoles.includes(actorRole)) {
      throw new ForbiddenError(
        `Access denied: Action requires one of [${allowedRoles.join(', ')}], current role is '${actorRole}'`,
        'FORBIDDEN_ROLE'
      );
    }
  };
}

/**
 * Jurisdiction Matching Guard
 */
export function requireJurisdictionMatch(targetJurisdictionIdExtractor: (req: FastifyRequest) => string | undefined) {
  return async function jurisdictionHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const actorRole = request.securityContext?.role;
    if (actorRole === 'ADMIN' || actorRole === 'SUPERVISOR' || actorRole === 'CONTROLLER') {
      return;
    }

    const actorJurisdiction = request.securityContext?.jurisdictionId;
    const targetJurisdiction = targetJurisdictionIdExtractor(request);

    if (targetJurisdiction && actorJurisdiction && targetJurisdiction !== actorJurisdiction) {
      throw new ForbiddenError(
        `Action outside assigned jurisdiction: Officer posted in '${actorJurisdiction}', target is '${targetJurisdiction}'`,
        'OUTSIDE_JURISDICTION'
      );
    }
  };
}
