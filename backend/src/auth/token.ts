import { createHmac, createHash, randomBytes, randomUUID } from 'node:crypto';
import { RoleEnum } from '../core/types.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const REFRESH_COOKIE = 'lm_refresh';
export const CSRF_COOKIE = 'lm_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export interface AccessTokenPayload {
  sub: string;
  role: RoleEnum;
  tenantId: string;
  jurisdictionId: string;
  iat: number;
  exp: number;
}

function base64urlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}
function base64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/** Signs a short-lived HS256 access token. */
export function signAccessToken(
  payload: { sub: string; role: RoleEnum; tenantId: string; jurisdictionId: string },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): string {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64urlEncode(
    JSON.stringify({
      sub: payload.sub,
      role: payload.role,
      tenantId: payload.tenantId,
      jurisdictionId: payload.jurisdictionId,
      iat: nowSeconds,
      exp: nowSeconds + ACCESS_TOKEN_TTL_SECONDS,
    })
  );
  const signingInput = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

/**
 * Verifies a JWT signature and expiry. Throws on invalid/expired token.
 * Returns the decoded claims on success.
 */
export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed access token');

  const [header, body, signature] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (signature !== expected) throw new Error('Invalid access token signature');

  let payload: AccessTokenPayload;
  try {
    payload = JSON.parse(base64urlDecode(body)) as AccessTokenPayload;
  } catch {
    throw new Error('Malformed access token payload');
  }
  if (!payload.exp || typeof payload.exp !== 'number') throw new Error('Access token missing expiry');
  if (payload.exp <= Math.floor(Date.now() / 1000)) throw new Error('Access token expired');
  return payload;
}

/** Generates a 256-bit opaque refresh token plus its SHA-256 hash for storage. */
export function issueOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256Hex(token) };
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// --- HTTP cookie helpers (dependency-free) ---

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  maxAge?: number; // seconds; omit for a session cookie (dev)
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  return parts.join('; ');
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

export const newFamilyId = (): string => randomUUID();