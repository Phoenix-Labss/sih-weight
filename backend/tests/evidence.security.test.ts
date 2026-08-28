import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';

describe('Evidence Cryptographic Security & Anti-Tampering Custody Gate', () => {
  let app: FastifyInstance;
  const tenantId = 'TENANT-DELHI-001';

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  ]);

  it('authoritatively computes SHA-256 digest on the server for genuine media upload', async () => {
    const expectedServerSha256 = crypto.createHash('sha256').update(validPngBuffer).digest('hex');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${tenantId}/evidence/verify-and-ingest`,
      headers: {
        'x-tenant-id': tenantId,
        'x-actor-role': 'LMO',
        'x-actor-id': 'USER-LMO-001',
      },
      payload: {
        file_bytes_base64: validPngBuffer.toString('base64'),
        file_name: 'test_seal.png',
        mime_type: 'image/png',
        claimed_sha256: expectedServerSha256,
        evidence_category: 'SEAL_PHOTO',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.sha256_hash).toBe(expectedServerSha256);
    expect(body.is_checksum_verified).toBe(true);
    expect(body.mime_type).toBe('image/png');
    expect(body.digital_proof_signature).toBeDefined();
    expect(body.evidence_id).toMatch(/^EVID-/);
  });

  it('detects and blocks in-transit tampering when client-claimed hash does not match server calculation', async () => {
    const fakeClientHash = '0000000000000000000000000000000000000000000000000000000000000000';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${tenantId}/evidence/verify-and-ingest`,
      headers: {
        'x-tenant-id': tenantId,
        'x-actor-role': 'LMO',
        'x-actor-id': 'USER-LMO-001',
      },
      payload: {
        file_bytes_base64: validPngBuffer.toString('base64'),
        file_name: 'tampered_seal.png',
        mime_type: 'image/png',
        claimed_sha256: fakeClientHash, // TAMPERED CHECKSUM
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.detail).toContain('Cryptographic integrity violation');
  });

  it('inspects magic bytes and rejects executable / malicious files disguised as images', async () => {
    // DOS/PE executable header: MZ (4D 5A)
    const fakeExecutableBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${tenantId}/evidence/verify-and-ingest`,
      headers: {
        'x-tenant-id': tenantId,
        'x-actor-role': 'LMO',
        'x-actor-id': 'USER-LMO-001',
      },
      payload: {
        file_bytes_base64: fakeExecutableBuffer.toString('base64'),
        file_name: 'malicious.png',
        mime_type: 'image/png',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.detail).toContain('Executable binary upload prohibited');
  });

  it('rejects invalid / malformed SHA-256 format during stamp recording', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${tenantId}/sessions/NON_EXISTENT/stamps`,
      headers: {
        'x-tenant-id': tenantId,
        'x-actor-role': 'LMO',
        'x-actor-id': 'USER-LMO-001',
      },
      payload: {
        seal_identification_number: 'DL-SEAL-2026-9999',
        seal_position: 'CALIBRATION_PORT',
        photo_evidence_hash: 'not-a-valid-64-hex-sha256', // INVALID FORMAT
      },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.detail).toContain('64-character hexadecimal SHA-256');
  });
});
