import crypto from 'node:crypto';
import { canonicalJsonBytes } from './canonical-json.js';

export interface Ed25519KeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
  keyId: string;
}

/**
 * Computes SHA-256 hash as a 64-character lowercase hexadecimal string
 */
export function sha256Hex(data: string | Buffer | unknown): string {
  let buffer: Buffer;
  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (typeof data === 'string') {
    buffer = Buffer.from(data, 'utf8');
  } else {
    buffer = canonicalJsonBytes(data);
  }
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Computes SHA-256 hash as a Buffer
 */
export function sha256Buffer(data: string | Buffer): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Generates an Ed25519 keypair for cryptographic certificate signing
 */
export function generateEd25519KeyPair(keyId = 'key-01'): Ed25519KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    keyId,
  };
}

/**
 * Signs data or hash using an Ed25519 private key
 */
export function signEd25519(data: string | Buffer, privateKeyPem: string): string {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const signature = crypto.sign(null, buffer, privateKeyPem);
  return signature.toString('base64');
}

/**
 * Verifies an Ed25519 signature
 */
export function verifyEd25519(data: string | Buffer, signatureBase64: string, publicKeyPem: string): boolean {
  try {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
    return crypto.verify(null, buffer, publicKeyPem, signatureBuffer);
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison preventing timing attacks
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
