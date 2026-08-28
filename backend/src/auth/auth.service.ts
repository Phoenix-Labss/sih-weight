import { prisma } from '../db/prisma.js';
import { UnauthorizedError, ForbiddenError, ValidationError, ConflictError } from '../core/errors.js';
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
const DEFAULT_TENANT = 'tenant-delhi-central';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleEnum;
  tenantId: string;
  jurisdictionId: string;
  organizationName?: string;
  isActive: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  // Optional Business / Legal Metrology entity details
  legalName?: string;
  tradeName?: string;
  stakeholderType?: 'OWNER_USER' | 'MANUFACTURER' | 'DEALER' | 'REPAIRER';
  identifierType?: 'GSTIN' | 'PAN' | 'TRADE_LICENSE' | 'AADHAAR_LAST4';
  identifierValue?: string;
  // Facility / Physical premises
  addressLine1?: string;
  city?: string;
  district?: string;
  pincode?: string;
  tenantId?: string;
  jurisdictionId?: string;
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

async function toPublicUserRow(row: {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string;
  is_active: boolean;
  stakeholder_id?: string | null;
}): Promise<PublicUser> {
  const lmo = await prisma.lMOProfile.findUnique({ where: { user_id: row.user_id } }).catch(() => null);
  let orgName: string | undefined;
  if (row.stakeholder_id) {
    const st = await prisma.stakeholder.findUnique({ where: { stakeholder_id: row.stakeholder_id } }).catch(() => null);
    if (st) orgName = st.trade_name || st.legal_name;
  }
  return {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role as RoleEnum,
    tenantId: row.tenant_id,
    jurisdictionId: lmo?.jurisdiction_id || DEFAULT_JURISDICTION,
    organizationName: orgName,
    isActive: row.is_active,
  };
}

export class AuthService {
  /**
   * Registers a new commercial trader or establishment under Legal Metrology Act, 2009.
   */
  async register(input: RegisterInput, ctx: AuthContext): Promise<AuthResult> {
    const email = input.email?.trim().toLowerCase();
    const fullName = input.fullName?.trim();
    const password = input.password;
    const phone = input.phone?.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('A valid email address is required', 'INVALID_EMAIL');
    }

    if (!fullName || fullName.length < 2) {
      throw new ValidationError('Full name is required (minimum 2 characters)', 'INVALID_NAME');
    }

    // CERT-In password policy: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_\-+=~`|\\(){}[\]:;"'<>,.?/]).{8,}$/;
    if (!password || !passwordRegex.test(password)) {
      throw new ValidationError(
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
        'WEAK_PASSWORD'
      );
    }

    // Validate phone number (Indian 10-digit mobile)
    const cleanPhone = (phone || '').replace(/[\s\-\+]/g, '');
    const tenDigitPhone = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
    if (!/^[6-9]\d{9}$/.test(tenDigitPhone)) {
      throw new ValidationError('A valid 10-digit Indian mobile number is required', 'INVALID_PHONE');
    }

    // Optional GSTIN / PAN validation
    let identifierType = input.identifierType;
    let identifierValue = input.identifierValue?.trim().toUpperCase();
    if (identifierValue) {
      if (identifierType === 'GSTIN' || (!identifierType && identifierValue.length === 15)) {
        identifierType = 'GSTIN';
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(identifierValue)) {
          throw new ValidationError('Invalid Indian GSTIN format (e.g. 07AAAAA0000A1Z5)', 'INVALID_GSTIN');
        }
      } else if (identifierType === 'PAN' || (!identifierType && identifierValue.length === 10)) {
        identifierType = 'PAN';
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(identifierValue)) {
          throw new ValidationError('Invalid Indian PAN format (e.g. ABCDE1234F)', 'INVALID_PAN');
        }
      }
    }

    // Optional Pincode validation
    const pincode = input.pincode?.trim() || '110001';
    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      throw new ValidationError('Invalid 6-digit Indian PIN Code', 'INVALID_PINCODE');
    }

    const tenantId = input.tenantId || DEFAULT_TENANT;
    const jurisdictionId = input.jurisdictionId || DEFAULT_JURISDICTION;

    // Check duplicate email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictError('An account with this email address is already registered. Please sign in.', 'EMAIL_EXISTS');
    }

    // Check duplicate identifier if provided
    if (identifierValue && identifierType) {
      const existingStakeholder = await prisma.stakeholder.findFirst({
        where: {
          tenant_id: tenantId,
          identifier_type: identifierType,
          identifier_value: identifierValue,
        },
      });
      if (existingStakeholder) {
        throw new ConflictError(`A business with this ${identifierType} (${identifierValue}) is already registered.`, 'IDENTIFIER_EXISTS');
      }
    }

    const legalName = input.legalName?.trim() || fullName;
    const tradeName = input.tradeName?.trim() || legalName;
    const stakeholderType = input.stakeholderType || 'OWNER_USER';

    // Execute atomic transaction
    const { user, stakeholder } = await prisma.$transaction(async (tx) => {
      const createdStakeholder = await tx.stakeholder.create({
        data: {
          tenant_id: tenantId,
          jurisdiction_id: jurisdictionId,
          legal_name: legalName,
          trade_name: tradeName,
          stakeholder_type: stakeholderType,
          identifier_type: identifierType || null,
          identifier_value: identifierValue || null,
          email,
          phone: tenDigitPhone,
          address_line1: input.addressLine1?.trim() || 'Establishment Address',
          city: input.city?.trim() || 'New Delhi',
          pincode,
          is_active: true,
        },
      });

      await tx.facility.create({
        data: {
          tenant_id: tenantId,
          stakeholder_id: createdStakeholder.stakeholder_id,
          facility_name: `${tradeName} (Main Premises)`,
          address_line: input.addressLine1?.trim() || 'Main Establishment Premises',
          district: input.district?.trim() || 'Central Delhi',
          pincode,
          is_active: true,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          tenant_id: tenantId,
          stakeholder_id: createdStakeholder.stakeholder_id,
          email,
          full_name: fullName,
          role: 'OWNER',
          password_hash: hashPassword(password),
          is_active: true,
        },
      });

      return { user: createdUser, stakeholder: createdStakeholder };
    });

    const refreshToken = await createRefreshRow(user.user_id, newFamilyId(), ctx);
    await audit(user.user_id, user.tenant_id, user.role, 'USER_REGISTERED');

    return {
      user: {
        id: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role as RoleEnum,
        tenantId: user.tenant_id,
        jurisdictionId,
        organizationName: stakeholder.trade_name || stakeholder.legal_name,
        isActive: user.is_active,
      },
      accessToken: accessFor({ id: user.user_id, role: user.role as RoleEnum, tenant_id: user.tenant_id }),
      refreshToken,
      csrf: makeCsrf(),
    };
  }

  /**
   * Checks availability of email or business identifier.
   */
  async checkAvailability(type: 'email' | 'identifier', value: string, tenantId = DEFAULT_TENANT): Promise<{ available: boolean }> {
    const cleanValue = value.trim();
    if (type === 'email') {
      const count = await prisma.user.count({ where: { email: cleanValue.toLowerCase() } });
      return { available: count === 0 };
    } else {
      const count = await prisma.stakeholder.count({
        where: { tenant_id: tenantId, identifier_value: cleanValue.toUpperCase() },
      });
      return { available: count === 0 };
    }
  }

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