import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../../core/errors.js';

/**
 * Tenant Isolation Guard
 *
 * Enforces strict multi-tenant boundary checks:
 * Rejects any request where the path parameter :tenantId does not match
 * the authenticated context tenant ID (unless actor is system ADMIN).
 */
export async function tenantGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const params = request.params as Record<string, string> | undefined;
  if (!params) {
    return;
  }

  const requestedTenantId = params.tenantId || params.tenant_id;
  if (!requestedTenantId) {
    return;
  }

  const actorTenantId = request.securityContext?.tenantId;
  const actorRole = request.securityContext?.role;

  // ADMIN can access across tenants for system supervision
  if (actorRole === 'ADMIN') {
    return;
  }

  if (actorTenantId && requestedTenantId !== actorTenantId) {
    throw new ForbiddenError(
      `Cross-tenant access violation: Request tenant '${requestedTenantId}' does not match actor tenant '${actorTenantId}'`,
      'TENANT_ACCESS_DENIED'
    );
  }
}
