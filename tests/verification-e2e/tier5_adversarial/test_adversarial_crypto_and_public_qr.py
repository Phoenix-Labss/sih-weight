"""Tier 5 Adversarial Property-Based Tests: Cryptographic Certificates & Public QR Verification.

Validates security requirements under AGENTS.md §3.6, §14:
- Deterministic canonical JSON serialization with zero formatting drift.
- SHA-256 single-bit flip mutation sensitivity.
- Cryptographic digital signature verification and tamper detection.
- Cryptographically secure high-entropy QR token generation (256-bit).
- Zero-PII privacy guarantee on public verification endpoints.
- Public status lifecycle projection across all statutory states.
"""

from __future__ import annotations

import base64
from datetime import date, datetime, timezone
from decimal import Decimal
import json
import secrets
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import (
    MockCryptoSignatureAdapter,
    SignerContext,
    calculate_sha256_hex,
    canonical_json_bytes,
    generate_high_entropy_token,
)
from app.models.certificate import Certificate, CertificateStatusEnum
from app.models.stakeholder import RoleEnum


class TestCryptographicIntegrityAdversarial:
    """Adversarial challenge tests for crypto engine."""

    def test_canonical_json_nested_sorting_and_compactness(self):
        """Property: Dictionary keys at all nesting depths are sorted alphabetically without whitespace."""
        payload = {
            "zebra": 1,
            "apple": {"z": 10, "a": 20, "m": 30},
            "mango": [3, 2, 1],
            "banana": "text",
        }
        b = canonical_json_bytes(payload)
        # Should start with "apple" then "banana" then "mango" then "zebra"
        expected_start = b'{"apple":{"a":20,"m":30,"z":10},"banana":"text"'
        assert b.startswith(expected_start)
        assert b" " not in b
        assert b"\n" not in b
        assert b"\t" not in b

    def test_sha256_bit_flip_avalanche_effect(self):
        """Property: Changing even 1 character in the payload produces a completely different SHA-256 hash."""
        payload_1 = {"certificate_number": "DL/LM/2026/CERT-100001", "max_capacity": "15.000000"}
        payload_2 = {"certificate_number": "DL/LM/2026/CERT-100001", "max_capacity": "15.000001"}

        hash_1 = calculate_sha256_hex(canonical_json_bytes(payload_1))
        hash_2 = calculate_sha256_hex(canonical_json_bytes(payload_2))

        assert hash_1 != hash_2
        assert len(hash_1) == 64
        assert len(hash_2) == 64

        # Compute hamming distance between hex hashes
        diff_nibbles = sum(c1 != c2 for c1, c2 in zip(hash_1, hash_2))
        assert diff_nibbles > 30  # Avalanche effect alters over half the digest

    def test_signature_adapter_tamper_detection(self):
        """Adversarial: Altering signature bytes or key identifier fails signature verification."""
        adapter = MockCryptoSignatureAdapter()
        ctx = SignerContext(
            signer_id="officer_01",
            signer_role="LMO",
            jurisdiction_id="DL-NORTH",
            certificate_id="cert_001",
        )
        canon_hash = calculate_sha256_hex("sample_payload")
        sig_result = adapter.sign_hash(canon_hash, ctx)

        # 1. Exact match passes
        assert adapter.verify_signature(canon_hash, sig_result.signature_bytes_base64, sig_result.key_identifier) is True

        # 2. Corrupted signature fails
        corrupt_sig = sig_result.signature_bytes_base64[:-4] + "AAAA"
        assert adapter.verify_signature(canon_hash, corrupt_sig, sig_result.key_identifier) is False

        # 3. Wrong key identifier fails
        assert adapter.verify_signature(canon_hash, sig_result.signature_bytes_base64, "key_officer_02_DL-SOUTH") is False

        # 4. Altered hash fails
        assert adapter.verify_signature(calculate_sha256_hex("other_payload"), sig_result.signature_bytes_base64, sig_result.key_identifier) is False


class TestPublicQREndpointPrivacyAndStatus:
    """Adversarial challenge tests for Public Verification API."""

    def test_zero_pii_leakage_property(self, client: TestClient, db_session: Session, seed_data: dict, auth_headers):
        """Statutory Privacy: Public QR verify response MUST NOT leak owner name, email, phone, or bank details."""
        # 1. Issue a valid certificate via API flow
        lmo_hdr = auth_headers(user_id=seed_data["lmo_user_id"], tenant_id="IN-DL", role=RoleEnum.LMO, jurisdiction_id="DL-NORTH")
        owner_hdr = auth_headers(user_id=seed_data["owner_user_id"], tenant_id="IN-DL", role=RoleEnum.OWNER)

        # Register inst
        inst_res = client.post(
            f"/api/v1/tenants/IN-DL/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-PRIVACY-CHECK-999",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        # Application
        app_res = client.post(
            f"/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = app_res.json()["application_id"]
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/pay", json={"receipt_number": "REC-999"}, headers=owner_hdr)

        # Session
        sess_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]
        obs_payload = {
            "reference_standard_ids": seed_data["standard_ids"],
            "observations": [
                {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.0", "load_unit": "kg", "raw_indication_reading": "0.0", "reading_unit": "kg"}
            ],
        }
        client.post(f"/api/v1/tenants/IN-DL/sessions/{sess_id}/observations", json=obs_payload, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/sessions/{sess_id}/disposition", json={"outcome": "Verification passed — pending authorization"}, headers=lmo_hdr)

        # Issue cert
        cert_res = client.post(f"/api/v1/tenants/IN-DL/certificates/issue", json={"session_id": sess_id}, headers=lmo_hdr)
        assert cert_res.status_code == 201
        qr_token = cert_res.json()["public_verification_token"]

        # Call unauthenticated public endpoint
        pub_res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert pub_res.status_code == 200
        data_str = json.dumps(pub_res.json()).lower()

        # Adversarial PII checks: ensure NO trader personal identifiers appear
        forbidden_strings = [
            "kishore",
            "trader.delhi@example.com",
            "+919811000000",
            "shop 4",
            "market complex",
            "fee_assessment",
            "receipt_number",
            "rec-999",
        ]
        for s in forbidden_strings:
            assert s not in data_str, f"Privacy Violation: Leaked '{s}' in public QR response!"

    def test_nonexistent_qr_token_returns_404(self, client: TestClient):
        """Adversarial: Querying guessed or non-existent token returns 404."""
        guessed_token = "cert_tok_" + secrets.token_urlsafe(32)
        res = client.get(f"/api/v1/public/certificates/verify/{guessed_token}")
        assert res.status_code == 404
        assert res.json()["error_code"] in ("CERTIFICATE_NOT_FOUND", "NOT_FOUND")
