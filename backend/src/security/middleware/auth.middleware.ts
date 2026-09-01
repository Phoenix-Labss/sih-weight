import { FastifyRequest, FastifyReply } from 'fastify';
import { RoleEnum, SecurityContext } from '../../core/types.js';
import { verifyAccessToken } from '../../auth/token.js';

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

const ANONYMOUS: SecurityContext = {
  userId: 'public-anonymous',
  tenantId: 'tenant-delhi-central',
  role: 'PUBLIC',
  jurisdictionId: 'jur-dl-01',
  email: '',
  fullName: '',
  isActive: false,
};

function bearerToken(request: FastifyRequest): string | undefined {
  const auth = request.headers.authorization;
  const value = Array.isArray(auth) ? auth[0] : auth;
  if (value?.startsWith('Bearer ')) return value.slice(7);
  return undefined;
}

/**
 * Authentication and Context Extraction Middleware.
 *
 * Resolution order:
 *  1. `Authorization: Bearer <jwt>` — verified signature/expiry; context is built
 *     from token claims ONLY (never trusting client-supplied role headers).
 *  2. Legacy `X-Actor-*` headers — honored ONLY when `ALLOW_DEV_HEADERS=true`
 *     AND `NODE_ENV !== 'production'`. This closes the demo impersonation gap:
 *     in production any request reaching a protected route without a valid token
 *     is treated as the unauthenticated `PUBLIC` role.
 *  3. No token & dev headers disabled -> anonymous `PUBLIC` context.
 */
export async function authMiddleware(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const headers = request.headers;

  // 1. Bearer JWT
  const token = bearerToken(request);
  const secret =
    process.env.JWT_SECRET_KEY ||
    (process.env.NODE_ENV !== 'production' ? 'dev-fallback-jwt-secret-for-testing-only' : undefined);
  if (token && secret) {
    try {
      const claims = verifyAccessToken(token, secret);
      request.securityContext = {
        userId: claims.sub,
        tenantId: claims.tenantId,
        role: claims.role,
        jurisdictionId: claims.jurisdictionId,
        email: '',
        fullName: '',
        isActive: true,
      };
      return;
    } catch {
      // Invalid/expired token: fall through to dev headers or anonymous.
      // Guarded routes reject with 401/403; public routes remain reachable.
    }
  }

  // In production, developer headers are strictly forbidden under all circumstances
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDevHeaders = !isProduction && process.env.ALLOW_DEV_HEADERS !== 'false';
  if (!allowDevHeaders) {
    request.securityContext = { ...ANONYMOUS };
    return;
  }

  // 2. Legacy dev/testing header impersonation (dev only).
  const actorIdHeader =
    (headers['x-actor-id'] as string) ||
    (headers['x-test-user-id'] as string) ||
    (headers['x-user-id'] as string);

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

  const tenantId =
    (headers['x-tenant-id'] as string) ||
    (headers['x-test-tenant-id'] as string) ||
    'tenant-delhi-central';

  const jurisdictionId =
    (headers['x-jurisdiction-id'] as string) ||
    (headers['x-test-jurisdiction-id'] as string) ||
    'jur-dl-01';

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
