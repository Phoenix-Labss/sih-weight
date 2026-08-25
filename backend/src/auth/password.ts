import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// scrypt parameters (N, r, p). N=16384 is the Node-default memory cost; kept
// explicit so parameter migration is a reviewed change rather than an accident.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

/** Returns a random raw salt (hex). */
function generateSalt(): string {
  return randomBytes(SALT_LEN).toString('hex');
}

/**
 * Derives a verifier for the given password.
 * Result format: `scrypt$16384$8$1$<saltHex>$<hashHex>`.
 */
export function hashPassword(password: string): string {
  const salt = generateSalt();
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash.toString('hex')}`;
}

/**
 * Constant-time password verification against a stored scrypt verifier.
 * Returns false for malformed/missing stored values (never throws).
 */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expectedHex = parts[5];
  if (!salt || !expectedHex) return false;

  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = scryptSync(password, salt, expected.length, { N: n, r, p });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}