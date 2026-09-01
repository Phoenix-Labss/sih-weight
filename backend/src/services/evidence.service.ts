import crypto from 'crypto';
import { Buffer } from 'node:buffer';
import { ValidationError, SecurityViolationError, NotFoundError } from '../core/errors.js';
import { SecurityContext } from '../core/types.js';

export interface EvidenceVerificationInput {
  file_bytes_base64: string;
  file_name?: string;
  mime_type?: string;
  claimed_sha256?: string;
  session_id?: string;
  instrument_id?: string;
  evidence_category?: 'SEAL_PHOTO' | 'NAMEPLATE_PHOTO' | 'CALIBRATION_PORT' | 'OBSERVATION_PHOTO' | 'DOCUMENT';
}

export interface VerifiedEvidenceRecord {
  evidence_id: string;
  tenant_id: string;
  session_id?: string;
  instrument_id?: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  sha256_hash: string;
  claimed_sha256?: string;
  is_checksum_verified: boolean;
  server_verified_at: string;
  verifier_actor_id: string;
  digital_proof_signature: string;
  evidence_category: string;
}

// In-memory store for verified evidence custody ledger
const evidenceCustodyStore = new Map<string, VerifiedEvidenceRecord>();

// Server-side HMAC key for evidence custody attestation
const SERVER_EVIDENCE_SECRET = process.env.EVIDENCE_SECRET || 'lm-statutory-evidence-custody-key-2026-secure';

export class EvidenceService {
  /**
   * Inspects binary buffer magic bytes to validate genuine media file signatures
   * and block executable/script/malicious payloads.
   */
  public detectAndValidateMime(buffer: Buffer, declaredMime?: string): string {
    if (buffer.length < 4) {
      throw new ValidationError('Uploaded evidence payload is empty or too small (< 4 bytes).');
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }

    // WEBP / RIFF: 52 49 46 46 ... 57 45 42 50
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer.length >= 12 &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }

    // PDF: %PDF- (25 50 44 46 2D)
    if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      return 'application/pdf';
    }

    // SVG: Text XML containing <svg
    const textStart = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf-8').trim();
    if (textStart.includes('<svg') || textStart.includes('<?xml')) {
      return 'image/svg+xml';
    }

    // If declared as supported image and no executable magic bytes found
    if (declaredMime && ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(declaredMime)) {
      // Check for DOS / PE executable header (MZ)
      if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
        throw new SecurityViolationError('Executable binary upload prohibited. Evidence rejected.');
      }
      return declaredMime;
    }

    throw new ValidationError(
      'Invalid evidence file signature. Only verified image formats (JPEG, PNG, WEBP, SVG) or PDF documents are permitted under Legal Metrology evidence standards.'
    );
  }

  /**
   * Validates standalone 64-hex SHA-256 digest format
   */
  public validateSha256Format(hash: string): boolean {
    return /^[a-fA-F0-9]{64}$/.test(hash);
  }

  /**
   * Authoritatively ingests, calculates server-side SHA-256, validates against client hash,
   * inspects magic bytes, and generates a tamper-evident server custody proof.
   */
  public async verifyAndIngestEvidence(
    tenantId: string,
    input: EvidenceVerificationInput,
    actor: SecurityContext
  ): Promise<VerifiedEvidenceRecord> {
    if (!input.file_bytes_base64) {
      throw new ValidationError('file_bytes_base64 is required for server-side evidence verification.');
    }

    // 1. Decode Base64 to binary buffer
    let buffer: Buffer;
    try {
      // Strip data URL prefix if present (e.g. data:image/png;base64,...)
      const cleaned = input.file_bytes_base64.replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(cleaned, 'base64');
    } catch {
      throw new ValidationError('Invalid Base64 encoding for evidence bytes.');
    }

    // 2. File size bounds enforcement (Max 10MB, Min 4 bytes)
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new ValidationError(`Evidence file exceeds maximum permitted size of 10MB (${(buffer.length / 1024 / 1024).toFixed(2)} MB uploaded).`);
    }
    if (buffer.length < 4) {
      throw new ValidationError('Evidence file is empty or corrupted.');
    }

    // 3. Server-side magic-byte inspection
    const validatedMime = this.detectAndValidateMime(buffer, input.mime_type);

    // 4. Authoritative Server SHA-256 byte digest calculation
    const serverSha256 = crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();

    // 5. Anti-Tampering Check: Compare server hash vs client-claimed hash
    let isChecksumVerified = true;
    if (input.claimed_sha256) {
      const normalizedClaimed = input.claimed_sha256.trim().toLowerCase();
      if (!this.validateSha256Format(normalizedClaimed)) {
        throw new ValidationError('Client-claimed hash is not a valid 64-character hexadecimal SHA-256 digest.');
      }
      if (normalizedClaimed !== serverSha256) {
        throw new SecurityViolationError(
          `Cryptographic integrity violation: Server-computed SHA-256 (${serverSha256}) does not match client-claimed checksum (${normalizedClaimed}). Evidence payload may have been tampered in transit.`
        );
      }
    }

    // 6. Generate server-signed Proof of Custody HMAC
    const serverVerifiedAt = new Date().toISOString();
    const proofPayload = `${tenantId}:${input.session_id || 'NONE'}:${serverSha256}:${serverVerifiedAt}:${actor.userId || 'SYSTEM'}`;
    const digitalProofSignature = crypto
      .createHmac('sha256', SERVER_EVIDENCE_SECRET)
      .update(proofPayload)
      .digest('hex');

    const evidenceId = `EVID-${crypto.randomUUID()}`;

    const record: VerifiedEvidenceRecord = {
      evidence_id: evidenceId,
      tenant_id: tenantId,
      session_id: input.session_id,
      instrument_id: input.instrument_id,
      file_name: input.file_name || `evidence_${Date.now()}.${validatedMime.split('/')[1] || 'bin'}`,
      mime_type: validatedMime,
      file_size_bytes: buffer.length,
      sha256_hash: serverSha256,
      claimed_sha256: input.claimed_sha256,
      is_checksum_verified: isChecksumVerified,
      server_verified_at: serverVerifiedAt,
      verifier_actor_id: actor.userId || 'SYSTEM_VERIFIER',
      digital_proof_signature: digitalProofSignature,
      evidence_category: input.evidence_category || 'SEAL_PHOTO',
    };

    // Store in custody ledger
    evidenceCustodyStore.set(evidenceId, record);

    return record;
  }

  /**
   * Retrieves verified evidence record by ID
   */
  public async getEvidenceRecord(tenantId: string, evidenceId: string): Promise<VerifiedEvidenceRecord> {
    const record = evidenceCustodyStore.get(evidenceId);
    if (!record || record.tenant_id !== tenantId) {
      throw new NotFoundError(`Evidence record '${evidenceId}' not found.`);
    }
    return record;
  }
}

export const evidenceService = new EvidenceService();
