import { FastifyRequest, FastifyReply } from 'fastify';
import { RoleEnum, SecurityContext } from '../../core/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    securityContext: SecurityContext;
  }
}

const VALID_ROLES: Set<RoleEnum> = new Set([
  'OWNER',
  'APPLICANT',
  'LMO',
  'GATC_VERIFIER',
  'SUPERVISOR',
  'CONTROLLER',
  'ADMIN',
  'PUBLIC',
]);

/**
 * Authentication and Context Extraction Middleware
 *
 * Reads statutory headers from incoming HTTP requests with resilient fallbacks
 * for demonstration, integration testing, and local development.
 */
export async function authMiddleware(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const headers = request.headers;

  // Extract Actor ID
  const actorIdHeader =
    (headers['x-actor-id'] as string) ||
    (headers['x-test-user-id'] as string) ||
    (headers['x-user-id'] as string);

  // Extract Role
  const roleHeaderRaw =
    (headers['x-actor-role'] as string) ||
    (headers['x-test-role'] as string) ||
    (headers['x-role'] as string);

  let role: RoleEnum = 'OWNER';
  if (roleHeaderRaw && VALID_ROLES.has(roleHeaderRaw.toUpperCase() as RoleEnum)) {
    role = roleHeaderRaw.toUpperCase() as RoleEnum;
  } else if (actorIdHeader?.startsWith('lmo-')) {
    role = 'LMO';
  } else if (actorIdHeader?.startsWith('sup-')) {
    role = 'SUPERVISOR';
  } else if (actorIdHeader?.startsWith('adm-')) {
    role = 'ADMIN';
  }

  // Extract Tenant ID
  const tenantId =
    (headers['x-tenant-id'] as string) ||
    (headers['x-test-tenant-id'] as string) ||
    'tenant-delhi-central';

  // Extract Jurisdiction ID
  const jurisdictionId =
    (headers['x-jurisdiction-id'] as string) ||
    (headers['x-test-jurisdiction-id'] as string) ||
    'jur-dl-01';

  // Default User ID
  const userId = actorIdHeader || (role === 'LMO' ? 'lmo-officer-01' : 'usr-trader-01');

  request.securityContext = {
    userId,
    tenantId,
    role,
    jurisdictionId,
    email: `${userId}@legalmetrology.gov.in`,
    fullName: role === 'LMO' ? 'Legal Metrology Officer' : 'Trader Stakeholder',
    isActive: true,
  };
}
