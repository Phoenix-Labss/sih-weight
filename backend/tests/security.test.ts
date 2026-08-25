import { describe, it, expect } from 'vitest';
import { canonicalJsonStringify, canonicalJsonBytes } from '../src/security/canonical-json.js';
import { sha256Hex, generateEd25519KeyPair, signEd25519, verifyEd25519, timingSafeEqualStrings } from '../src/security/crypto.js';
import { hsmDscProvider } from '../src/security/hsm-dsc.provider.js';
import { generateOpaqueQrToken, maskSerialNumber } from '../src/security/qr-token.js';
import { generateCertificatePdf } from '../src/security/pdf-generator.js';
import { exactDecimal } from '../src/core/decimal.js';

describe('Security & Cryptography Engine', () => {
  describe('RFC 8785 JSON Canonicalization Scheme (JCS)', () => {
    it('sorts object keys lexicographically at all nesting depths', () => {
      const obj = {
        z: 1,
        a: 2,
        m: {
          beta: 'world',
          alpha: 'hello',
        },
      };
      const canonical = canonicalJsonStringify(obj);
      expect(canonical).toBe('{"a":2,"m":{"alpha":"hello","beta":"world"},"z":1}');
    });

    it('strips all whitespace and handles primitives deterministically', () => {
      const obj = { bool: true, nil: null, num: 42, str: 'legal metrology' };
      const canonical = canonicalJsonStringify(obj);
      expect(canonical).toBe('{"bool":true,"nil":null,"num":42,"str":"legal metrology"}');
    });

    it('serializes Decimal.js objects deterministically', () => {
      const dec = exactDecimal('15.5');
      const obj = { load: dec, interval: exactDecimal('0.005') };
      const canonical = canonicalJsonStringify(obj);
      expect(canonical).toBe('{"interval":"0.005","load":"15.5"}');
    });

    it('serializes Date instances to ISO strings', () => {
      const date = new Date('2026-08-25T10:00:00.000Z');
      const obj = { timestamp: date };
      const canonical = canonicalJsonStringify(obj);
      expect(canonical).toBe('{"timestamp":"2026-08-25T10:00:00.000Z"}');
    });

    it('converts to UTF-8 buffer matching string representation', () => {
      const obj = { cert: 'CERT-001' };
      const buf = canonicalJsonBytes(obj);
      expect(buf.toString('utf8')).toBe('{"cert":"CERT-001"}');
    });
  });

  describe('Cryptographic Primitives & SHA-256', () => {
    it('computes 64-char lowercase hexadecimal SHA-256 digest', () => {
      const payload = { cert_number: 'CERT-2026-DL-00042' };
      const hash = sha256Hex(payload);
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    it('produces identical SHA-256 for differently ordered equivalent objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 2, a: 1 };
      expect(sha256Hex(obj1)).toBe(sha256Hex(obj2));
    });

    it('generates Ed25519 keypair and signs/verifies data correctly', () => {
      const keyPair = generateEd25519KeyPair('test-key');
      expect(keyPair.publicKeyPem).toContain('BEGIN PUBLIC KEY');
      expect(keyPair.privateKeyPem).toContain('BEGIN PRIVATE KEY');

      const message = 'Legal Metrology Statutory Certificate Payload';
      const signature = signEd25519(message, keyPair.privateKeyPem);
      expect(signature).toBeDefined();

      const isValid = verifyEd25519(message, signature, keyPair.publicKeyPem);
      expect(isValid).toBe(true);

      const isInvalid = verifyEd25519('Tampered Message', signature, keyPair.publicKeyPem);
      expect(isInvalid).toBe(false);
    });

    it('performs constant-time string comparison', () => {
      expect(timingSafeEqualStrings('exact_hash_123', 'exact_hash_123')).toBe(true);
      expect(timingSafeEqualStrings('exact_hash_123', 'different_hash_')).toBe(false);
      expect(timingSafeEqualStrings('exact_hash_123', 'short')).toBe(false);
    });
  });

  describe('Simulated HSM DSC Provider & Key Rotation', () => {
    it('signs and verifies canonical digest with active key ring version', async () => {
      const hash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
      const context = {
        signer_id: 'lmo-officer-01',
        signer_role: 'LMO',
        jurisdiction_id: 'jur-dl-01',
      };

      const result = await hsmDscProvider.signHash(hash, context);
      expect(result.algorithm).toBe('Ed25519-SHA256');
      expect(result.key_identifier).toContain('v2:key_lmo-officer-01_jur-dl-01');
      expect(result.digital_signature_reference).toContain('SIG-ED25519-DL-2026-LMO');

      const verification = hsmDscProvider.verifyDigitalSignatureReference(
        hash,
        result.digital_signature_reference,
        result.signed_at_utc
      );
      expect(verification.isValid).toBe(true);
    });

    it('fails verification on bit flip or tampered digest', async () => {
      const hash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
      const context = {
        signer_id: 'lmo-officer-01',
        signer_role: 'LMO',
        jurisdiction_id: 'jur-dl-01',
      };

      const result = await hsmDscProvider.signHash(hash, context);
      const tamperedHash = '5f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';

      const verification = hsmDscProvider.verifyDigitalSignatureReference(
        tamperedHash,
        result.digital_signature_reference,
        result.signed_at_utc
      );
      expect(verification.isValid).toBe(false);
    });

    it('supports rotating active key version to v3 while verifying historical v1/v2 signatures', async () => {
      const hash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
      const context = {
        signer_id: 'lmo-officer-01',
        signer_role: 'LMO',
        jurisdiction_id: 'jur-dl-01',
      };

      // Sign under v1
      const resultV1 = await hsmDscProvider.signHash(hash, context, 'v1');
      expect(resultV1.key_identifier).toContain('v1:');

      // Rotate active to v3
      hsmDscProvider.rotateActiveVersion('v3');

      // Sign under v3
      const resultV3 = await hsmDscProvider.signHash(hash, context);
      expect(resultV3.key_identifier).toContain('v3:');

      // Verify v1 historical signature
      const verV1 = hsmDscProvider.verifyDigitalSignatureReference(
        hash,
        resultV1.digital_signature_reference,
        resultV1.signed_at_utc
      );
      expect(verV1.isValid).toBe(true);

      // Verify v3 signature
      const verV3 = hsmDscProvider.verifyDigitalSignatureReference(
        hash,
        resultV3.digital_signature_reference,
        resultV3.signed_at_utc
      );
      expect(verV3.isValid).toBe(true);

      // Restore v2 for subsequent tests
      hsmDscProvider.rotateActiveVersion('v2');
    });
  });

  describe('256-bit Opaque QR Tokens & Serial Masking', () => {
    it('generates 256-bit high-entropy opaque tokens', () => {
      const tokenFormatted = generateOpaqueQrToken('formatted');
      expect(tokenFormatted.startsWith('TOK-CERT-')).toBe(true);

      const tokenBase64 = generateOpaqueQrToken('base64url');
      expect(tokenBase64.startsWith('cert_tok_')).toBe(true);

      const tokenHex = generateOpaqueQrToken('hex');
      expect(tokenHex).toHaveLength(64);
    });

    it('masks instrument serial numbers preserving physical sticker comparison', () => {
      expect(maskSerialNumber('SN-2026-DL-9941')).toBe('SN-****-9941');
      expect(maskSerialNumber('IND-MOD-8842')).toBe('IND-****-8842');
      expect(maskSerialNumber('8842')).toBe('****');
      expect(maskSerialNumber('12345678')).toBe('******5678');
      expect(maskSerialNumber(null)).toBe('******');
    });
  });

  describe('Statutory PDF Generator', () => {
    it('generates valid binary PDF buffer with standard %PDF-1.4 header and trailer', () => {
      const pdf = generateCertificatePdf({
        certificateNumber: 'CERT-2026-DL-00042',
        qrToken: 'TOK-CERT-8F3E92B104A7D9E6',
        issueDate: '2026-08-23',
        validUntil: '2027-08-22',
        status: 'ISSUED',
        instrument: {
          category: 'NAWI',
          subtype: 'Electronic Counter Scale',
          modelName: 'Eagle Scale Model E-30',
          serialNumber: 'SN-2026-DL-9941',
          accuracyClass: 'CLASS_III',
          maxCapacity: 30,
          minCapacity: 0.1,
          scaleIntervalE: 0.005,
          unit: 'kg',
        },
        authority: 'Office of Controller of Legal Metrology Delhi',
        officerName: 'Dr. Ramesh Kumar',
        officerDesignation: 'Legal Metrology Officer',
        sha256Hash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
        sealNumber: 'DL-SEAL-2026-0042',
      });

      expect(Buffer.isBuffer(pdf)).toBe(true);
      const str = pdf.toString('utf8');
      expect(str.startsWith('%PDF-1.4')).toBe(true);
      expect(str).toContain('%%EOF');
      expect(str).toContain('CERT-2026-DL-00042');
      expect(str).toContain('DL-SEAL-2026-0042');
    });
  });
});
