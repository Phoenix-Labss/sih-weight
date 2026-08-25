import { prisma } from '../db/prisma.js';
import { UnauthorizedError, ForbiddenError } from '../core/errors.js';
import { verifyPassword, hashPassword } from './password.js';
import {
  signAccessToken,
  issueOpaqueToken,
  sha256Hex,
  REFRESH_TOKEN_TTL_SECONDS,
  newFamilyId,
} from './token.js';
import { RoleEnum } from '../core/types.js';

const DEFAULT_JURISDICTION = 'jur-dl-01';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleEnum;
  tenantId: string;
  jurisdictionId: string;
  isActive: boolean;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  csrf: string;
}

export interface AuthContext {
  ip?: string;
  userAgent?: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET_KEY;
  if (!secret) {
    // Dev fallback; production must set JWT_SECRET_KEY in environment.
    if (process.env.NODE_ENV !== 'production') return 'dev-fallback-jwt-secret-for-testing-only';
    throw new Error('JWT_SECRET_KEY is not configured');
  }
  return secret;
}

function makeCsrf(): string {
  return newFamilyId() + newFamilyId().replace(/-/g, '');
}

function accessFor(user: { id: string; role: RoleEnum; tenant_id: string }): string {
  return signAccessToken(
    { sub: user.id, role: user.role, tenantId: user.tenant_id, jurisdictionId: DEFAULT_JURISDICTION },
    getJwtSecret()
  );
}

async function audit(userId: string, tenantId: string, role: string, action: string): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenant_id: tenantId,
      actor_id: userId,
      actor_role: role,
      action,
      entity_type: 'auth',
      entity_id: userId || '',
      correlation_id: newFamilyId(),
      before_state: null,
      after_state: null,
      recorded_at: new Date(),
    },
  });
}

async function createRefreshRow(userId: string, familyId: string, ctx: AuthContext): Promise<string> {
  const { token, hash } = issueOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      family_id: familyId,
      token_hash: hash,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      created_by_ip: ctx.ip || null,
      user_agent: ctx.userAgent || null,
    },
  });
  return token;
}

async function toPublicUserRow(row: { user_id: string; email: string; full_name: string; role: string; tenant_id: string; is_active: boolean }): Promise<PublicUser> {
  const lmo = await prisma.lMOProfile.findUnique({ where: { user_id: row.user_id } }).catch(() => null);
  return {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role as RoleEnum,
    tenantId: row.tenant_id,
    jurisdictionId: lmo?.jurisdiction_id || DEFAULT_JURISDICTION,
    isActive: row.is_active,
  };
}

export class AuthService {
  async login(email: string, password: string, ctx: AuthContext): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user || !user.is_active || !user.password_hash) {
      await audit(user?.user_id || 'unknown', user?.tenant_id || 'tenant-delhi-central', user?.role || 'OWNER', 'LOGIN_FAILED');
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    if (!verifyPassword(password, user.password_hash)) {
      await audit(user.user_id, user.tenant_id, user.role, 'LOGIN_FAILED');
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const refreshToken = await createRefreshRow(user.user_id, newFamilyId(), ctx);
    await audit(user.user_id, user.tenant_id, user.role, 'LOGIN_SUCCESS');

    return {
      user: await toPublicUserRow(user),
      accessToken: accessFor({ id: user.user_id, role: user.role as RoleEnum, tenant_id: user.tenant_id }),
      refreshToken,
      csrf: makeCsrf(),
    };
  }

  /** Rotates a refresh token with reuse (theft) detection. */
  async rotateRefresh(oldToken: string, ctx: AuthContext): Promise<AuthResult> {
    const row = await prisma.refreshToken.findUnique({ where: { token_hash: sha256Hex(oldToken) } });
    if (!row) {
      throw new UnauthorizedError('Invalid or expired session', 'INVALID_REFRESH');
    }

    if (row.revoked_at) {
      await revokeFamily(row.family_id);
      await audit(row.user_id, row.user_id, 'SYSTEM', 'REFRESH_REUSE_DETECTED');
      throw new ForbiddenError('Session compromised. All active sessions were revoked.', 'SESSION_COMPROMISED');
    }
    if (row.expires_at < new Date()) {
      await revokeFamily(row.family_id);
      await audit(row.user_id, row.user_id, 'SYSTEM', 'REFRESH_EXPIRED');
      throw new UnauthorizedError('Session expired', 'SESSION_EXPIRED');
    }

    const user = await prisma.user.findUnique({ where: { user_id: row.user_id } });
    if (!user || !user.is_active) {
      throw new UnauthorizedError('Account is not active', 'ACCOUNT_INACTIVE');
    }

    const newToken = await prisma.$transaction(async (tx) => {
      const { token, hash } = issueOpaqueToken();
      const inserted = await tx.refreshToken.create({
        data: {
          user_id: row.user_id,
          family_id: row.family_id,
          token_hash: hash,
          expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
          created_by_ip: ctx.ip || null,
          user_agent: ctx.userAgent || null,
        },
      });
      await tx.refreshToken.update({
        where: { token_id: row.token_id },
        data: { revoked_at: new Date(), replaced_by_id: inserted.token_id },
      });
      return token;
    });

    return {
      user: await toPublicUserRow(user),
      accessToken: accessFor({ id: user.user_id, role: user.role as RoleEnum, tenant_id: user.tenant_id }),
      refreshToken: newToken,
      csrf: makeCsrf(),
    };
  }

  async logout(oldToken: string): Promise<void> {
    const row = await prisma.refreshToken.findUnique({ where: { token_hash: sha256Hex(oldToken) } });
    if (!row) return;
    await revokeFamily(row.family_id);
    await audit(row.user_id, row.user_id, 'SYSTEM', 'LOGOUT');
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
    return toPublicUserRow(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user || !user.password_hash) throw new UnauthorizedError('Invalid current password', 'INVALID_CREDENTIALS');
    if (!verifyPassword(currentPassword, user.password_hash)) {
      throw new UnauthorizedError('Invalid current password', 'INVALID_CREDENTIALS');
    }
    if (newPassword.length < 8) {
      throw new UnauthorizedError('Password must be at least 8 characters', 'WEAK_PASSWORD');
    }
    await prisma.$transaction([
      prisma.user.update({ where: { user_id: userId }, data: { password_hash: hashPassword(newPassword) } }),
      prisma.refreshToken.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } }),
    ]);
    await audit(userId, user.tenant_id, user.role, 'PASSWORD_CHANGED');
  }
}

async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { family_id: familyId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

export const authService = new AuthService();