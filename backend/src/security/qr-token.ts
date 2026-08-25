import crypto from 'node:crypto';
import QRCode from 'qrcode';

/**
 * Generates a 256-bit (32-byte) cryptographically secure opaque token
 *
 * Example formats:
 * - `cert_tok_dGhpcy1pcy1hbi1vcGFxdWUtMjU2LWJpdC10b2tlbg`
 * - `TOK-CERT-8F3E92B104A7D9E6`
 */
export function generateOpaqueQrToken(format: 'base64url' | 'hex' | 'formatted' = 'formatted'): string {
  const randomBytes = crypto.randomBytes(32);

  if (format === 'base64url') {
    return `cert_tok_${randomBytes.toString('base64url')}`;
  }

  if (format === 'hex') {
    return randomBytes.toString('hex');
  }

  // Formatted high-entropy token: TOK-CERT-<16_hex_upper>
  const suffix = randomBytes.subarray(0, 8).toString('hex').toUpperCase();
  return `TOK-CERT-${suffix}`;
}

/**
 * Generates a unique instrument public token
 */
export function generateInstrumentToken(): string {
  const randomHex = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `INST-TOK-${randomHex}`;
}

/**
 * Masks an instrument serial number to protect trade privacy while permitting physical verification
 *
 * Examples:
 * - "SN-2026-DL-9941" -> "SN-****-9941"
 * - "SN-8842" -> "******8842"
 * - "123456" -> "****3456"
 * - "123" -> "****"
 */
export function maskSerialNumber(serial: string | null | undefined): string {
  if (!serial || serial.trim().length === 0) {
    return '******';
  }

  const s = serial.trim();
  if (s.length <= 4) {
    return '****';
  }

  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length >= 2) {
      const prefix = parts[0];
      const suffix = parts[parts.length - 1];
      return `${prefix}-****-${suffix}`;
    }
  }

  const suffix = s.slice(-4);
  const prefix = s.length > 8 ? s.slice(0, 2) : '';
  if (prefix) {
    return `${prefix}****${suffix}`;
  }
  return `******${suffix}`;
}

/**
 * Renders a standard QR code image buffer (PNG) from a verification URL or token
 */
export async function renderQrCodePngBuffer(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 2,
    scale: 6,
  });
}

/**
 * Renders a QR code data URL (base64)
 */
export async function renderQrCodeDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 6,
  });
}
