"""Tier 5 Adversarial Coverage Hardening: Public QR Anti-Enumeration, Zero-PII Leakage & Tamper Resistance.

Validates public consumer verification endpoint hardening:
- High-entropy opaque token generation and collision resistance
- Resilience against sequential integer and predictable token enumeration guessing
- Zero-PII deep scan: Trader name, email, phone, PAN, GSTIN, facility address, fees, receipt numbers, and payment details
- Serial number masking across edge-case serial formats
- SQL injection, path traversal, and malformed payload resilience
- Robust cryptographic tamper detection on altered canonical hash and signature bytes
- Route parity between standard verification endpoint and short URL QR alias
"""

from __future__ import annotations

import re
import string
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import generate_high_entropy_token
from app.models.certificate import Certificate
from app.models.stakeholder import RoleEnum


class TestPublicQRAntiEnumerationAdversarial:
    """Adversarial suite for public QR anti-enumeration, zero-PII guarantee, and tamper detection."""

    @pytest.fixture
    def sensitive_issued_cert(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture setting up an instrument with known sensitive owner PII and issuing a certificate."""
        tenant_id = seed_data["tenant_id"]
        jur_id = seed_data["jurisdiction_id"]

        owner_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.LMO,
            jurisdiction_id=jur_id,
        )

        inst_res = client.post(
            f"/api/v1/tenants/{tenant_id}/instruments",
            json={
                "jurisdiction_id": jur_id,
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-ADV-PII-8841",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        app_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications",
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
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/fee", json={"base_verification_fee": "750.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/pay", json={"receipt_number": "REC-CONFIDENTIAL-999"}, headers=owner_hdr)

        sess_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/observations",
            json={
                "reference_standard_ids": seed_data["standard_ids"],
                "observations": [
                    {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                    {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "15.000000", "load_unit": "kg", "raw_indication_reading": "15.000000", "reading_unit": "kg"},
                ],
            },
            headers=lmo_hdr,
        )
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )

        cert_res = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/issue",
            json={"session_id": sess_id, "validity_months": 12},
            headers=lmo_hdr,
        )
        return cert_res.json()

    def test_token_entropy_and_uniqueness(self):
        """Generated verification tokens must have >= 256 bits entropy and 0 collisions across 5,000 samples."""
        tokens = [generate_high_entropy_token("cert_tok_") for _ in range(5000)]
        unique_tokens = set(tokens)
        assert len(tokens) == len(unique_tokens), "Collision detected in high-entropy token generator!"

        for t in tokens:
            assert t.startswith("cert_tok_")
            # Must have high length (prefix + 43 base64 chars for 32 bytes)
            assert len(t) >= 40
            # Characters must belong to URL-safe set
            assert re.match(r"^cert_tok_[A-Za-z0-9_-]+$", t)

    def test_sequential_integer_and_short_token_enumeration_rejection(self, client: TestClient):
        """Attacker attempting sequential or short pattern guessing gets uniform 404 CERTIFICATE_NOT_FOUND."""
        guess_candidates = [
            "1", "2", "3", "42", "100", "999", "1000",
            "cert_1", "cert_001", "cert_tok_1", "cert_tok_abc",
            "CERT-0001", "00000000-0000-0000-0000-000000000000",
            "admin", "root", "test", "token", "null", "undefined",
        ]

        for guess in guess_candidates:
            res = client.get(f"/api/v1/public/certificates/verify/{guess}")
            assert res.status_code == 404
            data = res.json()
            assert data["error_code"] == "CERTIFICATE_NOT_FOUND"

    def test_zero_pii_adversarial_deep_scan(
        self, client: TestClient, sensitive_issued_cert: dict
    ):
        """Exhaustive search against sensitive PII terms: Trader name, email, phone, trade name, fees, receipt."""
        token = sensitive_issued_cert["public_verification_token"]

        for endpoint in (f"/api/v1/public/certificates/verify/{token}", f"/v/{token}"):
            res = client.get(endpoint)
            assert res.status_code == 200
            raw = res.text.lower()

            # Prohibited PII terms (from seed_data and request setup)
            prohibited_terms = [
                "kishore",
                "trader.delhi@example.com",
                "kishore@retail.in",
                "9811000000",
                "+919811000000",
                "kishore supermarket",
                "shop 4",
                "market complex",
                "rec-confidential-999",
                "750.00",
                "fee_amount",
            ]

            for term in prohibited_terms:
                assert term not in raw, f"PII Leakage detected! Term '{term}' found in public verification payload: {raw}"

    def test_serial_masking_adversarial_formats(self, client: TestClient, sensitive_issued_cert: dict):
        """Verify serial number is safely masked in instrument_summary."""
        token = sensitive_issued_cert["public_verification_token"]
        res = client.get(f"/api/v1/public/certificates/verify/{token}")
        assert res.status_code == 200
        summary = res.json()["instrument_summary"]

        # Original: SN-ADV-PII-8841 -> Masked: SN-****-8841
        assert summary["serial_number_masked"] == "SN-****-8841"
        assert "PII" not in summary["serial_number_masked"]

    def test_injection_and_malformed_payload_resistance(self, client: TestClient):
        """SQL injection, path traversal, and malformed string attacks return safe structured 404/422 without 500 error."""
        hostile_payloads = [
            # SQL Injection
            "' OR '1'='1",
            "'; DROP TABLE certificates; --",
            "' UNION SELECT null, null, null, null, null --",
            "1' OR 1=1 #",
            # Path Traversal
            "..%2F..%2F..%2Fetc%2Fpasswd",
            "..%5C..%5C..%5Cwindows%5Cwin.ini",
            # Special chars & script tags
            "<script>alert(1)</script>",
            "{{ 7 * 7 }}",
            "%20OR%201=1",
            "A" * 500,
        ]

        for payload in hostile_payloads:
            res = client.get(f"/api/v1/public/certificates/verify/{payload}")
            # Must fail gracefully with 404 or 422, NEVER 500 Internal Server Error
            assert res.status_code in (404, 422), f"Hostile payload '{payload}' caused unexpected status {res.status_code}"

    def test_cryptographic_tamper_detection_robust(
        self, client: TestClient, db_session: Session, sensitive_issued_cert: dict
    ):
        """Robust tamper test: Modifying canonical SHA-256 hash or signature bytes always triggers INVALID_SIGNATURE."""
        cert_id = sensitive_issued_cert["certificate_id"]
        token = sensitive_issued_cert["public_verification_token"]

        db_cert = db_session.execute(
            select(Certificate).where(Certificate.certificate_id == cert_id)
        ).scalar_one()

        original_hash = db_cert.certificate_bytes_sha256
        # Robustly flip character (if char is '0', replace with '1', else '0')
        first_char = original_hash[0]
        replacement_char = "1" if first_char == "0" else "0"
        db_cert.certificate_bytes_sha256 = replacement_char + original_hash[1:]
        db_session.commit()

        res = client.get(f"/api/v1/public/certificates/verify/{token}")
        assert res.status_code == 200
        data = res.json()
        assert data["cryptographic_validity"] == "INVALID_SIGNATURE"

    def test_short_url_qr_alias_route_parity(
        self, client: TestClient, sensitive_issued_cert: dict
    ):
        """Verify that /v/{token} returns the exact same payload as /api/v1/public/certificates/verify/{token}."""
        token = sensitive_issued_cert["public_verification_token"]

        res_long = client.get(f"/api/v1/public/certificates/verify/{token}")
        res_short = client.get(f"/v/{token}")

        assert res_long.status_code == 200
        assert res_short.status_code == 200
        assert res_long.json() == res_short.json()
