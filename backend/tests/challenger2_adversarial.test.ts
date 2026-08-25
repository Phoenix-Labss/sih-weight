import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { canonicalJsonStringify, canonicalJsonBytes } from '../src/security/canonical-json.js';
import {
  sha256Hex,
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  timingSafeEqualStrings,
} from '../src/security/crypto.js';
import { hsmDscProvider, HsmDscProvider } from '../src/security/hsm-dsc.provider.js';
import { generateOpaqueQrToken, maskSerialNumber } from '../src/security/qr-token.js';
import { CertificateStateMachine } from '../src/core/state-machines/certificate.machine.js';
import { ApplicationStateMachine } from '../src/core/state-machines/application.machine.js';
import { SessionStateMachine } from '../src/core/state-machines/session.machine.js';
import { ForbiddenError, UnauthorizedTransitionError } from '../src/core/errors.js';
import { SecurityContext } from '../src/core/types.js';

describe('Challenger 2 — Adversarial Security, Cryptography, Multi-Tenancy & Privacy Gate', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ===========================================================================
  // 1. Cryptographic Tamper Detection & Avalanche Effect
  // ===========================================================================
  describe('Vector 1: Cryptographic Tamper Detection & Avalanche Effect', () => {
    const baseSnapshot = {
      certificate_number: 'CERT-2026-DL-00042',
      instrument: {
        accuracy_class: 'CLASS_III',
        category: 'NAWI',
        max_capacity: '30.0',
        min_capacity: '0.1',
        model_approval_number: 'IND-DL-2025-NAWI-001',
        model_name: 'Eagle Electronic Counter Scale Model E-30',
        scale_interval_e: '0.005',
        serial_number: 'SN-2026-DL-9941',
        subtype: 'Electronic Counter Scale',
        unit: 'kg',
      },
      reference_standards: [
        {
          certificate: 'NPLI-CAL-2025-F2-0042',
          standard_id: 'STD-MASS-CLASS-F2-001',
          valid_until: '2027-01-14',
        },
      ],
      session: {
        outcome: 'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
        procedure_pack_checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        procedure_pack_id: 'PROC-NAWI-CLASS-III-2026',
        session_id: 'sess-test-canonical-001',
      },
      tenant_id: 'tenant-delhi-central',
      validity: {
        issue_date: '2026-08-25',
        valid_until: '2027-08-24',
      },
      verifier: {
        jurisdiction_id: 'jur-dl-01',
        officer_id: 'lmo-officer-01',
        role: 'LMO',
      },
    };

    it('canonicalizes JSON deterministically regardless of key order or whitespace', () => {
      const reorderedSnapshot = {
        verifier: {
          role: 'LMO',
          officer_id: 'lmo-officer-01',
          jurisdiction_id: 'jur-dl-01',
        },
        validity: {
          valid_until: '2027-08-24',
          issue_date: '2026-08-25',
        },
        tenant_id: 'tenant-delhi-central',
        session: {
          session_id: 'sess-test-canonical-001',
          procedure_pack_id: 'PROC-NAWI-CLASS-III-2026',
          procedure_pack_checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          outcome: 'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
        },
        reference_standards: [
          {
            valid_until: '2027-01-14',
            standard_id: 'STD-MASS-CLASS-F2-001',
            certificate: 'NPLI-CAL-2025-F2-0042',
          },
        ],
        instrument: {
          unit: 'kg',
          subtype: 'Electronic Counter Scale',
          serial_number: 'SN-2026-DL-9941',
          scale_interval_e: '0.005',
          model_name: 'Eagle Electronic Counter Scale Model E-30',
          model_approval_number: 'IND-DL-2025-NAWI-001',
          min_capacity: '0.1',
          max_capacity: '30.0',
          category: 'NAWI',
          accuracy_class: 'CLASS_III',
        },
        certificate_number: 'CERT-2026-DL-00042',
      };

      const canon1 = canonicalJsonStringify(baseSnapshot);
      const canon2 = canonicalJsonStringify(reorderedSnapshot);
      expect(canon1).toBe(canon2);

      const hash1 = sha256Hex(baseSnapshot);
      const hash2 = sha256Hex(reorderedSnapshot);
      expect(hash1).toBe(hash2);
    });

    it('triggers avalanche effect and verification failure when mutating exactly 1 byte in canonical snapshot', async () => {
      const canonicalStr = canonicalJsonStringify(baseSnapshot);
      const originalHash = sha256Hex(baseSnapshot);

      const signerContext = {
        signer_id: 'lmo-officer-01',
        signer_role: 'LMO',
        jurisdiction_id: 'jur-dl-01',
      };
      const signedResult = await hsmDscProvider.signHash(originalHash, signerContext, 'v2');

      // Mutate 1 character in serial number: '9941' -> '9942'
      const mutatedSnapshot = JSON.parse(JSON.stringify(baseSnapshot));
      mutatedSnapshot.instrument.serial_number = 'SN-2026-DL-9942';
      const tamperedHash = sha256Hex(mutatedSnapshot);

      // Verify SHA-256 avalanche effect (> 20 hex characters changed out of 64)
      expect(tamperedHash).not.toBe(originalHash);
      let diffCount = 0;
      for (let i = 0; i < 64; i++) {
        if (originalHash[i] !== tamperedHash[i]) diffCount++;
      }
      expect(diffCount).toBeGreaterThanOrEqual(25); // Standard SHA-256 avalanche ~50% bit flip

      // Verify signature verification strictly fails
      const verifyResult = hsmDscProvider.verifyDigitalSignatureReference(
        tamperedHash,
        signedResult.digital_signature_reference,
        signedResult.signed_at_utc
      );
      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.reason).toContain('Signature verification failed');
    });

    it('fails verification on single character mutation in outcome or capacity', async () => {
      const originalHash = sha256Hex(baseSnapshot);
      const signedResult = await hsmDscProvider.signHash(originalHash, {
        signer_id: 'lmo-officer-01',
        signer_role: 'LMO',
        jurisdiction_id: 'jur-dl-01',
      });

      // Tamper outcome: 'VERIFICATION_PASSED_PENDING_AUTHORIZATION' -> 'VERIFICATION_FAILED'
      const tampered1 = JSON.parse(JSON.stringify(baseSnapshot));
      tampered1.session.outcome = 'VERIFICATION_FAILED';
      const hashTampered1 = sha256Hex(tampered1);
      expect(
        hsmDscProvider.verifyDigitalSignatureReference(
          hashTampered1,
          signedResult.digital_signature_reference,
          signedResult.signed_at_utc
        ).isValid
      ).toBe(false);

      // Tamper max_capacity: '30.0' -> '300.0'
      const tampered2 = JSON.parse(JSON.stringify(baseSnapshot));
      tampered2.instrument.max_capacity = '300.0';
      const hashTampered2 = sha256Hex(tampered2);
      expect(
        hsmDscProvider.verifyDigitalSignatureReference(
          hashTampered2,
          signedResult.digital_signature_reference,
          signedResult.signed_at_utc
        ).isValid
      ).toBe(false);
    });

    it('fails verification when 1 character is mutated in Ed25519 signature base64', async () => {
      const originalHash = sha256Hex(baseSnapshot);
      const signedResult = await hsmDscProvider.signHash(originalHash, {
        signer_id: 'lmo-officer-01',
        signer_role: 'LMO',
        jurisdiction_id: 'jur-dl-01',
      });

      // Split signature reference: format SIG-REF:signature_base64:key_identifier
      const parts = signedResult.digital_signature_reference.split(':');
      const sigBase64 = parts[1];
      const keyId = parts.slice(2).join(':');

      // Flip a byte in the middle of decoded signature buffer to guarantee invalid signature
      const sigBuf = Buffer.from(sigBase64, 'base64');
      sigBuf[10] = sigBuf[10] ^ 0xff;
      const corruptedSigBase64 = sigBuf.toString('base64');

      const corruptedSigRef = `${parts[0]}:${corruptedSigBase64}:${keyId}`;

      const verifyResult = hsmDscProvider.verifyDigitalSignatureReference(
        originalHash,
        corruptedSigRef,
        signedResult.signed_at_utc
      );
      expect(verifyResult.isValid).toBe(false);
    });

    it('fails verification when signature timestamp is tampered with', async () => {
      const originalHash = sha256Hex(baseSnapshot);
      const signedResult = await hsmDscProvider.signHash(originalHash, {
        signer_id: 'lmo-officer-01',
        signer_role: 'LMO',
        jurisdiction_id: 'jur-dl-01',
      });

      // Provide forged timestamp 1 second later
      const forgedTimestamp = new Date(new Date(signedResult.signed_at_utc).getTime() + 1000).toISOString();

      const verifyResult = hsmDscProvider.verifyDigitalSignatureReference(
        originalHash,
        signedResult.digital_signature_reference,
        forgedTimestamp
      );
      expect(verifyResult.isValid).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Ed25519 Signature Replay Across Key Versions & Invalid Keys
  // ===========================================================================
  describe('Vector 2: Ed25519 Signature Replay & Key Version Isolation', () => {
    const testHash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
    const context = {
      signer_id: 'lmo-officer-01',
      signer_role: 'LMO',
      jurisdiction_id: 'jur-dl-01',
    };

    it('rejects signature replay when key version is substituted (v1 signature claimed as v2)', async () => {
      // Sign with v1 key
      const sigV1 = await hsmDscProvider.signHash(testHash, context, 'v1');
      expect(sigV1.key_identifier).toContain('v1:');

      // Attempt to verify with v2 key identifier
      const substitutedKeyId = sigV1.key_identifier.replace('v1:', 'v2:');
      const parts = sigV1.digital_signature_reference.split(':');
      const replayedSigRef = `${parts[0]}:${parts[1]}:${substitutedKeyId}`;

      const verifyResult = hsmDscProvider.verifyDigitalSignatureReference(
        testHash,
        replayedSigRef,
        sigV1.signed_at_utc
      );
      expect(verifyResult.isValid).toBe(false);
    });

    it('rejects signature replay when v2 signature is claimed as v1', async () => {
      // Sign with v2 key
      const sigV2 = await hsmDscProvider.signHash(testHash, context, 'v2');
      expect(sigV2.key_identifier).toContain('v2:');

      // Attempt to verify claiming v1
      const substitutedKeyId = sigV2.key_identifier.replace('v2:', 'v1:');
      const parts = sigV2.digital_signature_reference.split(':');
      const replayedSigRef = `${parts[0]}:${parts[1]}:${substitutedKeyId}`;

      const verifyResult = hsmDscProvider.verifyDigitalSignatureReference(
        testHash,
        replayedSigRef,
        sigV2.signed_at_utc
      );
      expect(verifyResult.isValid).toBe(false);
    });

    it('strictly fails verification for forged signature from unknown key version (v99)', async () => {
      const parts = ['SIG-ED25519-DL-2026-LMO-FAKE', 'dGhpcyBpcyBhIGZha2Ugc2lnbmF0dXJl', 'v99:key_unknown_jur-dl-01'];
      const fakeSigRef = parts.join(':');

      const result = hsmDscProvider.verifyDigitalSignatureReference(testHash, fakeSigRef);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Unknown key version 'v99'");
    });

    it('strictly fails verification for forged signature created with rogue external private key', async () => {
      // Generate rogue keypair
      const rogueKey = generateEd25519KeyPair('rogue-key');
      const payload = `${testHash}:v2:key_lmo-officer-01_jur-dl-01:2026-08-25T10:00:00.000Z`;
      const forgedSigBase64 = signEd25519(payload, rogueKey.privateKeyPem);

      const fakeSigRef = `SIG-ED25519-DL-2026-LMO-ROGUE:${forgedSigBase64}:v2:key_lmo-officer-01_jur-dl-01`;

      const result = hsmDscProvider.verifyDigitalSignatureReference(
        testHash,
        fakeSigRef,
        '2026-08-25T10:00:00.000Z'
      );
      expect(result.isValid).toBe(false);
    });

    it('strictly fails cross-payload signature replay (replaying cert A signature onto cert B)', async () => {
      const hashA = sha256Hex({ cert: 'CERT-A' });
      const hashB = sha256Hex({ cert: 'CERT-B' });

      const sigA = await hsmDscProvider.signHash(hashA, context, 'v2');

      // Attempt to use sigA against hashB
      const result = hsmDscProvider.verifyDigitalSignatureReference(
        hashB,
        sigA.digital_signature_reference,
        sigA.signed_at_utc
      );
      expect(result.isValid).toBe(false);
    });

    it('supports rotating active key to v3 without invalidating historical v1/v2 certificates', async () => {
      // 1. Sign cert1 with v1
      const sig1 = await hsmDscProvider.signHash(testHash, context, 'v1');
      // 2. Sign cert2 with v2
      const sig2 = await hsmDscProvider.signHash(testHash, context, 'v2');

      // 3. Rotate active key to v3
      hsmDscProvider.rotateActiveVersion('v3');

      // 4. Sign cert3 with active (v3)
      const sig3 = await hsmDscProvider.signHash(testHash, context);
      expect(sig3.key_identifier).toContain('v3:');

      // 5. Verify all three signatures
      const v1Check = hsmDscProvider.verifyDigitalSignatureReference(testHash, sig1.digital_signature_reference, sig1.signed_at_utc);
      const v2Check = hsmDscProvider.verifyDigitalSignatureReference(testHash, sig2.digital_signature_reference, sig2.signed_at_utc);
      const v3Check = hsmDscProvider.verifyDigitalSignatureReference(testHash, sig3.digital_signature_reference, sig3.signed_at_utc);

      expect(v1Check.isValid).toBe(true);
      expect(v1Check.keyVersion).toBe('v1');

      expect(v2Check.isValid).toBe(true);
      expect(v2Check.keyVersion).toBe('v2');

      expect(v3Check.isValid).toBe(true);
      expect(v3Check.keyVersion).toBe('v3');

      // Restore v2 as active
      hsmDscProvider.rotateActiveVersion('v2');
    });
  });

  // ===========================================================================
  // 3. 256-Bit Opaque QR Token Entropy & Non-Sequential Generation
  // ===========================================================================
  describe('Vector 3: 256-Bit Opaque QR Token Entropy & Non-Sequential Generation', () => {
    it('generates 10,000 unique tokens with zero collisions', () => {
      const count = 10000;
      const formattedSet = new Set<string>();
      const base64Set = new Set<string>();

      for (let i = 0; i < count; i++) {
        formattedSet.add(generateOpaqueQrToken('formatted'));
        base64Set.add(generateOpaqueQrToken('base64url'));
      }

      expect(formattedSet.size).toBe(count);
      expect(base64Set.size).toBe(count);
    });

    it('exhibits high Shannon entropy (>= 7.9 bits per byte on raw 256-bit random tokens)', () => {
      // Sample 2,000 32-byte (256-bit) tokens = 64,000 bytes
      const sampleSize = 2000;
      const byteCounts = new Uint32Array(256);
      let totalBytes = 0;

      for (let i = 0; i < sampleSize; i++) {
        const hex = generateOpaqueQrToken('hex'); // 64 hex chars = 32 bytes
        const buf = Buffer.from(hex, 'hex');
        for (const b of buf) {
          byteCounts[b]++;
          totalBytes++;
        }
      }

      // Calculate Shannon entropy: H = - sum(p_i * log2(p_i))
      let entropy = 0;
      for (let i = 0; i < 256; i++) {
        if (byteCounts[i] > 0) {
          const p = byteCounts[i] / totalBytes;
          entropy -= p * Math.log2(p);
        }
      }

      // Max theoretical entropy is 8.0 bits/byte for uniform distribution
      expect(entropy).toBeGreaterThanOrEqual(7.9);
    });

    it('guarantees non-sequential tokens with large edit distance between consecutive tokens', () => {
      const t1 = generateOpaqueQrToken('formatted');
      const t2 = generateOpaqueQrToken('formatted');
      const t3 = generateOpaqueQrToken('formatted');

      // Ensure tokens differ in random hex suffix
      expect(t1).not.toBe(t2);
      expect(t2).not.toBe(t3);

      const suffix1 = t1.replace('TOK-CERT-', '');
      const suffix2 = t2.replace('TOK-CERT-', '');

      // Assert no arithmetic sequence (e.g. not suffix1 + 1)
      const num1 = BigInt(`0x${suffix1}`);
      const num2 = BigInt(`0x${suffix2}`);
      const diff = num1 > num2 ? num1 - num2 : num2 - num1;
      expect(diff).toBeGreaterThan(1000000n);
    });

    it('strictly returns 404 for brute-force probes with synthesized non-existent tokens', async () => {
      // Generate 50 random fake tokens
      const fakeTokens = Array.from({ length: 50 }, () => generateOpaqueQrToken('formatted'));

      for (const token of fakeTokens) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/public/certificates/verify/${token}`,
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().detail).toContain('not found');
      }
    });
  });

  // ===========================================================================
  // 4. Cross-Tenant Penetration & IDOR Boundary
  // ===========================================================================
  describe('Vector 4: Cross-Tenant Penetration & IDOR Boundary', () => {
    it('blocks reading Tenant B instruments using Tenant A credentials (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/tenant-mumbai-zone/instruments',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Cross-tenant access violation');
    });

    it('blocks reading Tenant B applications using Tenant A credentials (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/tenant-mumbai-zone/applications',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'APPLICANT',
          'x-actor-id': 'usr-trader-01',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Cross-tenant access violation');
    });

    it('blocks creating application in Tenant B using Tenant A credentials (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-mumbai-zone/applications',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'APPLICANT',
          'x-actor-id': 'usr-trader-01',
        },
        payload: {
          instrument_id: 'inst-001',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Cross-tenant access violation');
    });

    it('blocks reading Tenant B sessions using Tenant A credentials (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/tenant-mumbai-zone/sessions',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'LMO',
          'x-actor-id': 'lmo-officer-01',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Cross-tenant access violation');
    });

    it('blocks reading Tenant B certificates using Tenant A credentials (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/tenant-mumbai-zone/certificates',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Cross-tenant access violation');
    });

    it('blocks issuing certificate in Tenant B using Tenant A credentials (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-mumbai-zone/certificates/issue',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'LMO',
          'x-actor-id': 'lmo-officer-01',
        },
        payload: {
          session_id: 'sess-001',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Cross-tenant access violation');
    });

    it('enforces database-level tenant isolation when requesting record from another tenant via own tenant path (404 Not Found)', async () => {
      // Query a non-existent or foreign ID under tenant-delhi-central
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/tenant-delhi-central/instruments/inst-mumbai-foreign-999',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
        },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().detail).toContain('not found in tenant');
    });

    it('state machines strictly throw UnauthorizedTransitionError on cross-tenant context mismatch', () => {
      const certCtx = {
        certificate_id: 'cert-delhi-001',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-001',
      };

      const attackerSecurity: SecurityContext = {
        userId: 'usr-mumbai-01',
        tenantId: 'tenant-mumbai-zone',
        role: 'LMO',
        jurisdictionId: 'jur-mh-01',
        isActive: true,
      };

      expect(() => CertificateStateMachine.suspend(certCtx, attackerSecurity, 'Rogue cross-tenant suspend')).toThrow(
        UnauthorizedTransitionError
      );

      expect(() =>
        CertificateStateMachine.issue(
          { ...certCtx, certificate_status: 'DRAFT' },
          attackerSecurity,
          'SIG-REF:test:v2:test'
        )
      ).toThrow(UnauthorizedTransitionError);

      expect(() =>
        CertificateStateMachine.revoke(certCtx, { ...attackerSecurity, role: 'SUPERVISOR' }, 'Rogue cross-tenant revoke')
      ).toThrow(UnauthorizedTransitionError);

      // Test SessionStateMachine cross-tenant guard
      const sessCtx = {
        session_id: 'sess-delhi-001',
        tenant_id: 'tenant-delhi-central',
        status: 'PLANNED' as const,
        application_id: 'app-001',
        instrument_id: 'inst-001',
      };
      expect(() => SessionStateMachine.confirmIdentity(sessCtx, attackerSecurity, true)).toThrow(
        UnauthorizedTransitionError
      );

      // Test ApplicationStateMachine cross-tenant guard
      const appCtx = {
        application_id: 'app-delhi-001',
        tenant_id: 'tenant-delhi-central',
        current_status: 'DRAFT' as const,
        instrument_id: 'inst-001',
        applicant_id: 'usr-trader-01',
        version: 1,
      };
      expect(() => ApplicationStateMachine.submit(appCtx, attackerSecurity)).toThrow(
        UnauthorizedTransitionError
      );
    });
  });

  // ===========================================================================
  // 5. Role Privilege Escalation & Separation of Duties
  // ===========================================================================
  describe('Vector 5: Role Privilege Escalation & Separation of Duties', () => {
    it('blocks citizen/trader (OWNER/APPLICANT) from performing officer-only scrutiny (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/applications/app-dl-2026-00142/scrutiny',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
        payload: { action: 'ACCEPT' },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Access denied');
    });

    it('blocks citizen/trader from assessing statutory fees (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/applications/app-dl-2026-00142/fee',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
        payload: { base_verification_fee: 1000 },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Access denied');
    });

    it('blocks citizen/trader from scheduling verification slot (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/applications/app-dl-2026-00142/schedule',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
        payload: {
          slot_start: '2026-08-30T10:00:00Z',
          slot_end: '2026-08-30T12:00:00Z',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Access denied');
    });

    it('blocks citizen/trader from starting verification session (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/sessions/sess-test-01/start',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Access denied');
    });

    it('blocks citizen/trader from submitting observations (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/sessions/sess-test-01/observations',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
        payload: {
          reference_standard_ids: ['STD-01'],
          observations: [],
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Access denied');
    });

    it('blocks citizen/trader from recording statutory verification disposition (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/sessions/sess-test-01/disposition',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
        payload: {
          outcome: 'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Access denied');
    });

    it('blocks citizen/trader from issuing certificates (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants/tenant-delhi-central/certificates/issue',
        headers: {
          'x-tenant-id': 'tenant-delhi-central',
          'x-actor-role': 'OWNER',
          'x-actor-id': 'usr-trader-01',
        },
        payload: { session_id: 'sess-test-01' },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().detail).toContain('Access denied');
    });

    it('blocks LMO from revoking certificates without SUPERVISOR / CONTROLLER role (403 Forbidden)', async () => {
      // First ensure an active certificate exists
      const activeCert = await prisma.certificate.findFirst({
        where: { tenant_id: 'tenant-delhi-central', certificate_status: 'ISSUED' },
      });

      if (activeCert) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/tenants/tenant-delhi-central/certificates/${activeCert.certificate_id}/status`,
          headers: {
            'x-tenant-id': 'tenant-delhi-central',
            'x-actor-role': 'LMO',
            'x-actor-id': 'lmo-officer-01',
          },
          payload: {
            action: 'REVOKE',
            reason: 'Attempted unauthorized revocation by field LMO.',
          },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().detail).toContain("Role 'LMO' is not authorized");
      }
    });

    it('blocks LMO from reinstating suspended certificates without SUPERVISOR / CONTROLLER role (403 Forbidden)', async () => {
      const suspendedCert = await prisma.certificate.findFirst({
        where: { tenant_id: 'tenant-delhi-central', certificate_status: 'SUSPENDED' },
      });

      if (suspendedCert) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/tenants/tenant-delhi-central/certificates/${suspendedCert.certificate_id}/status`,
          headers: {
            'x-tenant-id': 'tenant-delhi-central',
            'x-actor-role': 'LMO',
            'x-actor-id': 'lmo-officer-01',
          },
          payload: {
            action: 'REINSTATE',
            reason: 'Attempted unauthorized reinstatement by field LMO.',
          },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().detail).toContain("Role 'LMO' is not authorized");
      }
    });

    it('state machines directly enforce role separation for all lifecycle operations', () => {
      const certCtx = {
        certificate_id: 'cert-delhi-001',
        tenant_id: 'tenant-delhi-central',
        certificate_status: 'ISSUED' as const,
        session_id: 'sess-001',
      };

      const lmoSecurity: SecurityContext = {
        userId: 'lmo-officer-01',
        tenantId: 'tenant-delhi-central',
        role: 'LMO',
        jurisdictionId: 'jur-dl-01',
        isActive: true,
      };

      // LMO CAN suspend
      expect(CertificateStateMachine.suspend(certCtx, lmoSecurity, 'Routine inspection')).toBe('SUSPENDED');

      // LMO CANNOT revoke
      expect(() => CertificateStateMachine.revoke(certCtx, lmoSecurity, 'Unlawful revocation')).toThrow(
        ForbiddenError
      );

      // LMO CANNOT reinstate
      expect(() =>
        CertificateStateMachine.reinstate({ ...certCtx, certificate_status: 'SUSPENDED' }, lmoSecurity, 'Unlawful reinstate')
      ).toThrow(ForbiddenError);

      // SUPERVISOR CAN revoke
      const supervisorSecurity: SecurityContext = {
        ...lmoSecurity,
        userId: 'sup-officer-01',
        role: 'SUPERVISOR',
      };
      expect(CertificateStateMachine.revoke(certCtx, supervisorSecurity, 'Statutory order')).toBe('REVOKED');
    });
  });

  // ===========================================================================
  // 6. Public QR Verification Privacy & Zero PII Leakage
  // ===========================================================================
  describe('Vector 6: Public QR Verification Privacy & Zero PII Leakage', () => {
    it('verifies public QR endpoint returns zero trader PII or financial details for TOKEN_VALID_2026', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/public/certificates/verify/TOKEN_VALID_2026',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();

      // Assert verified certificate attributes
      expect(data.certificate_number).toBe('CERT-2026-DL-00042');
      expect(data.status).toBe('ISSUED');
      expect(data.cryptographic_validity).toBe('VALID_SIGNATURE');
      expect(data.verification_date).toBeDefined();
      expect(data.valid_until).toBeDefined();

      // Assert NO trader PII is leaked
      expect(data.owner_name).toBeUndefined();
      expect(data.applicant_name).toBeUndefined();
      expect(data.owner_id).toBeUndefined();
      expect(data.applicant_id).toBeUndefined();
      expect(data.email).toBeUndefined();
      expect(data.phone).toBeUndefined();
      expect(data.mobile).toBeUndefined();
      expect(data.address).toBeUndefined();
      expect(data.facility_name).toBeUndefined();
      expect(data.pincode).toBeUndefined();

      // Assert NO financial or fee data is leaked
      expect(data.fee).toBeUndefined();
      expect(data.fee_amount).toBeUndefined();
      expect(data.amount).toBeUndefined();
      expect(data.payment_gateway_ref).toBeUndefined();
      expect(data.receipt_number).toBeUndefined();
      expect(data.transaction_id).toBeUndefined();
      expect(data.challan_number).toBeUndefined();

      // Assert serial number is strictly masked
      expect(data.instrument_summary.masked_serial_number).toBeDefined();
      expect(data.instrument_summary.masked_serial_number).toContain('****');
      expect(data.instrument_summary.masked_serial_number).not.toBe('SN-2026-DL-9941'); // Raw unmasked must not appear
    });

    it('masks serial numbers across diverse statutory serial formats', () => {
      expect(maskSerialNumber('SN-2026-DL-9941')).toBe('SN-****-9941');
      expect(maskSerialNumber('IND-MOD-8842')).toBe('IND-****-8842');
      expect(maskSerialNumber('A-B-C-1234')).toBe('A-****-1234');
      expect(maskSerialNumber('1234567890')).toBe('12****7890');
      expect(maskSerialNumber('123456')).toBe('******3456');
      expect(maskSerialNumber('9941')).toBe('****');
      expect(maskSerialNumber('12')).toBe('****');
      expect(maskSerialNumber('')).toBe('******');
      expect(maskSerialNumber(undefined)).toBe('******');
    });

    it('warns public clearly on revoked certificate without exposing internal investigator notes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/public/certificates/verify/TOKEN_REVOKED_2026',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.status).toBe('REVOKED');
      expect(data.cryptographic_validity).toBe('INVALID_SIGNATURE');
      expect(data.revocation_reason).toBeDefined();

      // PII must still be absent
      expect(data.owner_name).toBeUndefined();
      expect(data.owner_id).toBeUndefined();
      expect(data.email).toBeUndefined();
    });

    it('warns public clearly on superseded certificate with link to new certificate token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v/TOKEN_SUPERSEDED_2025',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.status).toBe('SUPERSEDED');
      expect(data.superseded_by).toBe('TOKEN_VALID_2026');
      expect(data.owner_name).toBeUndefined();
    });

    it('public PDF download generates redacted PDF without trader PII', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/public/certificates/TOKEN_VALID_2026/pdf',
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');

      const pdfText = res.rawPayload.toString('utf8');
      expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
      expect(pdfText).toContain('CERT-2026-DL-00042');
      expect(pdfText).toContain('PUBLIC STATUTORY VERIFICATION RECORD');

      // Verify trader name / PII is not in public PDF
      expect(pdfText).not.toContain('usr-trader-01');
      expect(pdfText).not.toContain('usr-trader-01@legalmetrology.gov.in');
    });
  });
});
