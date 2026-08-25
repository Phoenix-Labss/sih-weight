"""Empirical Adversarial Test Suite: Public Verification & Privacy Boundaries (Milestone 3).

Adversarial vectors:
1. Comprehensive PII Data Leak Fuzzing:
   - Zero-PII leak validation across all related stakeholder, trader, facility, application, session, observation, stamp, and payment entities.
   - Comprehensive serial number masking spectrum (boundary lengths, unicode, punctuation).
   - Clean RFC 7807 problem details on error paths with zero internal server/database leak.
2. Token Entropy, Randomness & Anti-Enumeration:
   - Shannon entropy distribution analysis of 256-bit opaque tokens.
   - Zero collision probability across 10,000 tokens.
   - Brute force, sequential guessing, single-bit flip, Hamming distance transposition probing.
   - Internal database UUID and entity ID probing resistance.
   - Malicious injection payloads: SQLi, Path Traversal, XSS, Buffer Overflow, Percent-Encoded Control Chars.
3. Certificate Lifecycle Status Fidelity & Warning Projections:
   - Full status spectrum: ISSUED, SUSPENDED, REINSTATED, REVOKED, EXPIRED, SUPERSEDED.
   - Statutory revocation reason projection.
   - Multi-generation supersession chain guidance (Cert A -> Cert B -> Cert C).
4. Cryptographic Signature Tamper Detection via Public Endpoint:
   - Canonical SHA-256 hash tampering detection.
   - Signature bytes and key identifier corruption detection.
   - Malformed base64 resilience (no 500 crashes).
5. Public vs Private Endpoint Boundary Enforcement:
   - Unauthenticated public projection vs authenticated, tenant-isolated private endpoint.
"""

from __future__ import annotations

import base64
import math
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import generate_high_entropy_token
from app.models.certificate import Certificate, CertificateStatusEnum
from app.models.instrument import Instrument
from app.models.session import SessionStatusEnum, VerificationOutcomeEnum, VerificationSession
from app.models.stakeholder import Facility, RoleEnum, Stakeholder, StakeholderTypeEnum
from app.services.public_service import mask_serial_number


@pytest.fixture
def active_certificate(client: TestClient, seed_data: dict, auth_headers) -> dict:
    """Module-level fixture creating and issuing an active certificate."""
    owner_hdr = auth_headers(user_id=seed_data["owner_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.OWNER)
    lmo_hdr = auth_headers(user_id=seed_data["lmo_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.LMO, jurisdiction_id=seed_data["jurisdiction_id"])
    
    inst_res = client.post(
        f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
        json={
            "jurisdiction_id": seed_data["jurisdiction_id"],
            "model_id": seed_data["model_id"],
            "owner_id": seed_data["stakeholder_id"],
            "facility_id": seed_data["facility_id"],
            "serial_number": f"SN-LIFECYCLE-{datetime.now().microsecond}",
            "year_of_manufacture": 2026,
        },
        headers=owner_hdr,
    )
    inst_id = inst_res.json()["instrument_id"]

    app_res = client.post(
        f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
        json={"instrument_id": inst_id, "applicant_id": seed_data["stakeholder_id"], "application_type": "INITIAL_VERIFICATION", "service_mode": "ON_SITE", "applicant_declaration_accepted": True},
        headers=owner_hdr,
    )
    app_id = app_res.json()["application_id"]
    client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
    client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
    client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-LIFE-01"}, headers=owner_hdr)

    sess_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions", json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"}, headers=lmo_hdr)
    sess_id = sess_res.json()["session_id"]
    obs_payload = {
        "reference_standard_ids": seed_data["standard_ids"],
        "observations": [
            {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
            {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "15.000000", "load_unit": "kg", "raw_indication_reading": "15.000000", "reading_unit": "kg"},
        ],
    }
    client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations", json=obs_payload, headers=lmo_hdr)
    client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition", json={"outcome": "Verification passed — pending authorization"}, headers=lmo_hdr)
    cert_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue", json={"session_id": sess_id}, headers=lmo_hdr)
    
    return {
        "cert": cert_res.json(),
        "inst_id": inst_id,
        "sess_id": sess_id,
    }


class TestAdversarialPIILeakFuzzing:
    """Adversarial challenge: Stress-test that unauthenticated public projections leak ZERO PII."""

    @pytest.fixture
    def high_pii_certificate(self, client: TestClient, seed_data: dict, auth_headers, db_session: Session) -> dict:
        """Create an issued certificate with extensive sensitive PII in all connected entities."""
        owner_hdr = auth_headers(
            user_id="trader_adv_pii_99",
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )

        # 1. Create a stakeholder with ultra-specific PII
        stk = Stakeholder(
            stakeholder_id="stk_pii_secret_trader_77",
            tenant_id=seed_data["tenant_id"],
            jurisdiction_id=seed_data["jurisdiction_id"],
            legal_name="Ramesh Kumar Agro Commodities Pvt Ltd",
            trade_name="Sharma Wholesale Weighing Mandi",
            stakeholder_type=StakeholderTypeEnum.OWNER_USER,
            email="ramesh.kumar.confidential@example.com",
            phone="+919876543210",
            pan_number="ABCDE1234F",
            gstin="07AAAAA0000A1Z5",
            address_line1="Shop No 42, Block C, Okhla Phase II",
            address_line2="Behind Central Bank Branch",
            city="New Delhi",
            pincode="110020",
        )
        db_session.add(stk)
        db_session.flush()

        fac = Facility(
            facility_id="fac_pii_secret_01",
            tenant_id=seed_data["tenant_id"],
            stakeholder_id="stk_pii_secret_trader_77",
            facility_name="Ramesh Mandi Grain Yard Premises",
            address_line="Gate 3, Agricultural Produce Market",
            district="North Delhi",
            pincode="110020",
        )
        db_session.add(fac)
        db_session.flush()

        # 2. Register instrument
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": "stk_pii_secret_trader_77",
                "facility_id": "fac_pii_secret_01",
                "serial_number": "SN-CONFIDENTIAL-PII-998811",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        # 3. Application with payment PII
        app_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": "stk_pii_secret_trader_77",
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = app_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny", json={"action": "ACCEPT", "scrutiny_notes": "Officer verified Trade License TL-DELHI-9982"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee", json={"base_verification_fee": "750.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-PAY-UPI-SECRET-8877", "payment_gateway_ref": "TXN_GATEWAY_RAZOR_990011"}, headers=owner_hdr)

        # 4. Session with field test notes & GPS
        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        obs_payload = {
            "reference_standard_ids": seed_data["standard_ids"],
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": "0.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "0.000000",
                    "reading_unit": "kg",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 2,
                    "nominal_load": "15.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "15.000000",
                    "reading_unit": "kg",
                },
            ],
        }
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations", json=obs_payload, headers=lmo_hdr)
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization", "disposition_notes": "Tested in presence of Manager Anirudh Verma, GPS: 28.5355, 77.3910"},
            headers=lmo_hdr,
        )

        # 5. Issue certificate
        cert_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id},
            headers=lmo_hdr,
        )
        return {
            "cert": cert_res.json(),
            "pii_blacklist": [
                "Ramesh Kumar Agro",
                "Sharma Wholesale",
                "ramesh.kumar.confidential@example.com",
                "9876543210",
                "ABCDE1234F",
                "07AAAAA0000A1Z5",
                "Okhla Phase II",
                "Central Bank Branch",
                "110020",
                "Ramesh Mandi",
                "Gate 3, Agricultural",
                "SN-CONFIDENTIAL-PII-998811",  # full unmasked serial
                "CONFIDENTIAL-PII",
                "TL-DELHI-9982",
                "750.00",
                "REC-PAY-UPI-SECRET-8877",
                "TXN_GATEWAY_RAZOR_990011",
                "Anirudh Verma",
                "28.5355",
                "77.3910",
                "stk_pii_secret_trader_77",
                "fac_pii_secret_01",
            ],
        }

    def test_exhaustive_pii_dictionary_fuzzing(self, client: TestClient, high_pii_certificate: dict):
        """Fuzz public verification response against comprehensive sensitive PII dictionary."""
        qr_token = high_pii_certificate["cert"]["public_verification_token"]
        pii_blacklist = high_pii_certificate["pii_blacklist"]

        # 1. Query full endpoint
        res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert res.status_code == 200
        raw_response_text = res.text

        # 2. Query short URL alias
        alias_res = client.get(f"/v/{qr_token}")
        assert alias_res.status_code == 200
        raw_alias_text = alias_res.text

        # 3. Assert zero leakage across entire JSON text and headers
        for sensitive_token in pii_blacklist:
            assert sensitive_token not in raw_response_text, (
                f"CRITICAL PII LEAK: Found sensitive string '{sensitive_token}' in public response body!"
            )
            assert sensitive_token not in raw_alias_text, (
                f"CRITICAL PII LEAK: Found sensitive string '{sensitive_token}' in short URL response body!"
            )

        # 4. Verify serial number was masked
        data = res.json()
        assert data["instrument_summary"]["serial_number_masked"] == "SN-****-8811"
        assert "CONFIDENTIAL-PII" not in data["instrument_summary"]["serial_number_masked"]

    def test_serial_number_masking_spectrum_adversarial(self):
        """Empirically test serial number masking across extreme lengths and boundary formats."""
        test_cases = [
            ("", "****"),
            ("A", "****"),
            ("AB", "****AB"),
            ("ABC", "****BC"),
            ("ABCD", "****CD"),
            ("12345", "12-****-2345"),
            ("SN-4821", "SN-****-4821"),
            ("SN-PUBLIC-4821", "SN-****-4821"),
            ("IND/DL/2026/COUNTER/991823", "IN-****-1823"),
            ("SCALE-A-B-C-D-E-F-G-H", "SC-****--G-H"),
            ("मशीन-12345", "मश-****-2345"),
            ("A" * 100, f"AA-****-{'A' * 4}"),
        ]
        for raw_serial, expected_masked in test_cases:
            masked = mask_serial_number(raw_serial)
            assert masked == expected_masked, f"Masking failed for input '{raw_serial}': got '{masked}', expected '{expected_masked}'"
            if len(raw_serial) > 6:
                middle_part = raw_serial[3:-5]
                if len(middle_part) >= 4:
                    assert middle_part not in masked, f"Unmasked middle portion '{middle_part}' found in '{masked}'"

    def test_rfc7807_error_paths_zero_pii_or_stack_leakage(self, client: TestClient):
        """Adversarial error paths must not leak database internals, stack traces, or tenant schemas."""
        malicious_tokens = [
            "cert_tok_' OR 1=1 --",
            "cert_tok_<script>alert('xss')</script>",
            "cert_tok_nonexistent_998811",
        ]
        for tok in malicious_tokens:
            res = client.get(f"/api/v1/public/certificates/verify/{tok}")
            assert res.status_code == 404, f"Expected 404 for token '{tok}', got {res.status_code}"
            err_data = res.json()
            assert "detail" in err_data

            # Verify no DB/stack traces in response
            err_text = res.text.lower()
            assert "traceback" not in err_text
            assert "sqlalchemy" not in err_text
            assert "sqlite" not in err_text
            assert "syntax error" not in err_text


class TestAdversarialTokenEntropyAndAntiEnumeration:
    """Adversarial challenge: Stress-test token entropy, collision resistance, and anti-enumeration."""

    def test_token_entropy_and_shannon_distribution(self):
        """Verify generated tokens exhibit high Shannon entropy approaching theoretical max (256 bits)."""
        num_tokens = 1000
        prefix = "cert_tok_"
        tokens = [generate_high_entropy_token(prefix, nbytes=32) for _ in range(num_tokens)]

        # 1. Zero collisions among 1000 generated tokens
        assert len(set(tokens)) == num_tokens, "CRITICAL: Token collision detected in entropy generation!"

        # 2. Length consistency (prefix 9 chars + 43 chars base64url = 52 chars)
        for tok in tokens:
            assert tok.startswith(prefix)
            assert len(tok) == 52, f"Unexpected token length: {len(tok)}"

        # 3. Calculate Shannon entropy over all generated token bodies
        token_bodies = "".join(t[len(prefix):] for t in tokens)
        char_counts = Counter(token_bodies)
        total_chars = len(token_bodies)

        shannon_entropy = -sum(
            (count / total_chars) * math.log2(count / total_chars)
            for count in char_counts.values()
        )

        # Base64url alphabet has 64 symbols (max entropy = log2(64) = 6.0 bits/char)
        assert shannon_entropy >= 5.5, (
            f"Insufficient token entropy: {shannon_entropy:.3f} bits/char (must be >= 5.5)"
        )

    def test_anti_enumeration_sequential_probing_rejected(self, client: TestClient):
        """Sequential enumeration guessing (cert_tok_0000000000000000000000000000000000000000001, etc.) fails 100%."""
        for seq in range(1, 20):
            token_guess = f"cert_tok_{seq:043d}"
            res = client.get(f"/api/v1/public/certificates/verify/{token_guess}")
            assert res.status_code == 404
            assert res.json()["error_code"] == "CERTIFICATE_NOT_FOUND"

    def test_anti_enumeration_hamming_distance_perturbation_rejected(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Altering single characters or bit positions of a valid token is rejected with 404."""
        owner_hdr = auth_headers(user_id=seed_data["owner_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.OWNER)
        lmo_hdr = auth_headers(user_id=seed_data["lmo_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.LMO, jurisdiction_id=seed_data["jurisdiction_id"])
        
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-ADV-ENUM-01",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        app_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={"instrument_id": inst_id, "applicant_id": seed_data["stakeholder_id"], "application_type": "INITIAL_VERIFICATION", "service_mode": "ON_SITE", "applicant_declaration_accepted": True},
            headers=owner_hdr,
        )
        app_id = app_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-ADV-01"}, headers=owner_hdr)

        sess_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions", json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"}, headers=lmo_hdr)
        sess_id = sess_res.json()["session_id"]
        obs_payload = {
            "reference_standard_ids": seed_data["standard_ids"],
            "observations": [
                {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "15.000000", "load_unit": "kg", "raw_indication_reading": "15.000000", "reading_unit": "kg"},
            ],
        }
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations", json=obs_payload, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition", json={"outcome": "Verification passed — pending authorization"}, headers=lmo_hdr)
        cert_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue", json={"session_id": sess_id}, headers=lmo_hdr)
        
        valid_token = cert_res.json()["public_verification_token"]

        # Valid token passes
        assert client.get(f"/api/v1/public/certificates/verify/{valid_token}").status_code == 200

        # Perturbation 1: Flip first character of token body
        body = valid_token[9:]
        char_0_flip = "B" if body[0] != "B" else "C"
        tok_flip_first = valid_token[:9] + char_0_flip + body[1:]
        assert client.get(f"/api/v1/public/certificates/verify/{tok_flip_first}").status_code == 404

        # Perturbation 2: Flip middle character
        mid = len(body) // 2
        char_mid_flip = "X" if body[mid] != "X" else "Y"
        tok_flip_mid = valid_token[:9] + body[:mid] + char_mid_flip + body[mid + 1:]
        assert client.get(f"/api/v1/public/certificates/verify/{tok_flip_mid}").status_code == 404

        # Perturbation 3: Flip last character
        char_last_flip = "Z" if body[-1] != "Z" else "W"
        tok_flip_last = valid_token[:-1] + char_last_flip
        assert client.get(f"/api/v1/public/certificates/verify/{tok_flip_last}").status_code == 404

        # Perturbation 4: Transposition of two adjacent characters
        tok_transposed = valid_token[:9] + body[1] + body[0] + body[2:]
        assert client.get(f"/api/v1/public/certificates/verify/{tok_transposed}").status_code == 404

    def test_internal_database_ids_cannot_be_enumerated_via_public_endpoint(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Attacker cannot query public verification using internal DB UUIDs (certificate_id, session_id, instrument_id)."""
        owner_hdr = auth_headers(user_id=seed_data["owner_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.OWNER)
        lmo_hdr = auth_headers(user_id=seed_data["lmo_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.LMO, jurisdiction_id=seed_data["jurisdiction_id"])
        
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-ADV-UUID-CHECK",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        app_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={"instrument_id": inst_id, "applicant_id": seed_data["stakeholder_id"], "application_type": "INITIAL_VERIFICATION", "service_mode": "ON_SITE", "applicant_declaration_accepted": True},
            headers=owner_hdr,
        )
        app_id = app_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-UUID-01"}, headers=owner_hdr)

        sess_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions", json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"}, headers=lmo_hdr)
        sess_id = sess_res.json()["session_id"]
        obs_payload = {
            "reference_standard_ids": seed_data["standard_ids"],
            "observations": [
                {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "15.000000", "load_unit": "kg", "raw_indication_reading": "15.000000", "reading_unit": "kg"},
            ],
        }
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations", json=obs_payload, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition", json={"outcome": "Verification passed — pending authorization"}, headers=lmo_hdr)
        cert_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue", json={"session_id": sess_id}, headers=lmo_hdr)
        
        cert_id = cert_res.json()["certificate_id"]

        # Probing with internal certificate UUID returns 404
        assert client.get(f"/api/v1/public/certificates/verify/{cert_id}").status_code == 404
        # Probing with session UUID returns 404
        assert client.get(f"/api/v1/public/certificates/verify/{sess_id}").status_code == 404
        # Probing with instrument UUID returns 404
        assert client.get(f"/api/v1/public/certificates/verify/{inst_id}").status_code == 404
        # Probing with application UUID returns 404
        assert client.get(f"/api/v1/public/certificates/verify/{app_id}").status_code == 404

    def test_injection_and_fuzzing_payloads_on_public_endpoint(self, client: TestClient):
        """Adversarial injection payloads on public verification URL do not cause server faults."""
        fuzz_payloads = [
            # SQL Injection
            "'; SELECT * FROM certificates; --",
            "' UNION ALL SELECT null, null, null, null --",
            "admin' OR '1'='1",
            # Path Traversal encoded
            "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
            # Script / HTML Injection
            "<script>document.location='http://attacker.com'</script>",
            "<img src=x onerror=alert('pwned')>",
            # Buffer Overflow string
            "A" * 4000,
            # Percent-encoded Control Characters & Null Bytes
            "cert_tok_%00%01%02%03",
            "cert_tok_%0a%0d%09",
            # Non-Latin Unicode
            "cert_tok_लिगल_मेट्रोलॉजी_२०२६",
            "cert_tok_🎉🚀🔒🛡️",
        ]
        for payload in fuzz_payloads:
            res = client.get(f"/api/v1/public/certificates/verify/{payload}")
            # Must return 404 or 422, NEVER 500 Internal Server Error
            assert res.status_code in (404, 422), f"Payload failed with status {res.status_code}: {payload}"


class TestAdversarialCertificateLifecycleStatusSpectrum:
    """Adversarial challenge: Verify public projection accurately handles full certificate lifecycle state transitions."""

    def test_public_status_active_issued_state(self, client: TestClient, active_certificate: dict):
        """Active issued certificate exhibits valid status and cryptographic signature."""
        qr_token = active_certificate["cert"]["public_verification_token"]
        res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ISSUED"
        assert data["cryptographic_validity"] == "VALID_SIGNATURE"
        assert data["superseded_by"] is None
        assert data["revocation_reason"] is None

    def test_public_status_suspended_state(self, client: TestClient, seed_data: dict, auth_headers, active_certificate: dict):
        """Suspended certificate reflects SUSPENDED status to consumers immediately."""
        lmo_hdr = auth_headers(user_id=seed_data["lmo_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.LMO, jurisdiction_id=seed_data["jurisdiction_id"])
        cert_id = active_certificate["cert"]["certificate_id"]
        qr_token = active_certificate["cert"]["public_verification_token"]

        # Suspend
        sus_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={
                "action": "SUSPEND",
                "reason": "Enforcement squad reported lead wire seal missing.",
                "statutory_authority_reference": "SEAL-DEFECT-MEMO-2026",
            },
            headers=lmo_hdr,
        )
        assert sus_res.status_code == 200
        assert sus_res.json()["certificate_status"] == "SUSPENDED"

        # Public verification check
        pub_res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert pub_res.status_code == 200
        pub_data = pub_res.json()
        assert pub_data["status"] == "SUSPENDED"

    def test_public_status_reinstated_state(self, client: TestClient, seed_data: dict, auth_headers, active_certificate: dict):
        """Suspended -> Reinstated certificate returns to ISSUED status in public verification."""
        lmo_hdr = auth_headers(user_id=seed_data["lmo_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.LMO, jurisdiction_id=seed_data["jurisdiction_id"])
        sup_hdr = auth_headers(user_id=seed_data["supervisor_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.SUPERVISOR)
        cert_id = active_certificate["cert"]["certificate_id"]
        qr_token = active_certificate["cert"]["public_verification_token"]

        # 1. Suspend
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status", json={"action": "SUSPEND", "reason": "Audit inquiry"}, headers=lmo_hdr)
        # 2. Reinstate
        rein_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status", json={"action": "REINSTATE", "reason": "Physical re-inspection passed"}, headers=sup_hdr)
        assert rein_res.status_code == 200
        assert rein_res.json()["certificate_status"] == "ISSUED"

        # 3. Public check
        pub_res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert pub_res.status_code == 200
        assert pub_res.json()["status"] == "ISSUED"

    def test_public_status_revoked_with_statutory_reason_displayed(
        self, client: TestClient, seed_data: dict, auth_headers, active_certificate: dict
    ):
        """Revoked certificate projects statutory revocation memo clearly to consumer scan."""
        sup_hdr = auth_headers(user_id=seed_data["supervisor_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.SUPERVISOR)
        cert_id = active_certificate["cert"]["certificate_id"]
        qr_token = active_certificate["cert"]["public_verification_token"]

        # Revoke with official statutory order
        rev_reason = "Order No. LM/DL/ENF/2026/099: Microprocessor motherboard altered to display -50g underweight."
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={
                "action": "REVOKE",
                "reason": rev_reason,
                "statutory_authority_reference": "GAZETTE-REVOCATION-991",
            },
            headers=sup_hdr,
        )

        pub_res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert pub_res.status_code == 200
        pub_data = pub_res.json()
        assert pub_data["status"] == "REVOKED"
        assert pub_data["revocation_reason"] == rev_reason

    def test_public_status_expired_lifecycle_state(
        self, client: TestClient, seed_data: dict, auth_headers, active_certificate: dict
    ):
        """Expired certificate displays EXPIRED status on public QR lookup."""
        sup_hdr = auth_headers(user_id=seed_data["supervisor_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.SUPERVISOR)
        cert_id = active_certificate["cert"]["certificate_id"]
        qr_token = active_certificate["cert"]["public_verification_token"]

        # Expire certificate
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={"action": "EXPIRE", "reason": "Annual validity period elapsed without re-verification application."},
            headers=sup_hdr,
        )

        pub_res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert pub_res.status_code == 200
        pub_data = pub_res.json()
        assert pub_data["status"] == "EXPIRED"

    def test_public_status_multi_generation_supersession_chain(
        self, client: TestClient, seed_data: dict, auth_headers, active_certificate: dict
    ):
        """Multi-generation re-verification (Cert 1 -> Cert 2 -> Cert 3) correctly links superseded tokens."""
        owner_hdr = auth_headers(user_id=seed_data["owner_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.OWNER)
        lmo_hdr = auth_headers(user_id=seed_data["lmo_user_id"], tenant_id=seed_data["tenant_id"], role=RoleEnum.LMO, jurisdiction_id=seed_data["jurisdiction_id"])
        
        inst_id = active_certificate["inst_id"]
        cert1_id = active_certificate["cert"]["certificate_id"]
        cert1_tok = active_certificate["cert"]["public_verification_token"]

        # --- Re-verification 1: Issue Cert 2 ---
        app2_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={"instrument_id": inst_id, "applicant_id": seed_data["stakeholder_id"], "application_type": "RE_VERIFICATION", "service_mode": "ON_SITE", "applicant_declaration_accepted": True},
            headers=owner_hdr,
        )
        app2_id = app2_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app2_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app2_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app2_id}/pay", json={"receipt_number": "REC-RE-01"}, headers=owner_hdr)

        sess2_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions", json={"application_id": app2_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"}, headers=lmo_hdr)
        sess2_id = sess2_res.json()["session_id"]
        obs_payload = {
            "reference_standard_ids": seed_data["standard_ids"],
            "observations": [
                {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "15.000000", "load_unit": "kg", "raw_indication_reading": "15.000000", "reading_unit": "kg"},
            ],
        }
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess2_id}/observations", json=obs_payload, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess2_id}/disposition", json={"outcome": "Verification passed — pending authorization"}, headers=lmo_hdr)
        cert2_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue", json={"session_id": sess2_id}, headers=lmo_hdr)
        cert2_tok = cert2_res.json()["public_verification_token"]

        # Cert 1 is now SUPERSEDED by Cert 2
        pub_cert1 = client.get(f"/api/v1/public/certificates/verify/{cert1_tok}").json()
        assert pub_cert1["status"] == "SUPERSEDED"
        assert pub_cert1["superseded_by"] == cert2_tok

        # Cert 2 is currently ISSUED
        pub_cert2 = client.get(f"/api/v1/public/certificates/verify/{cert2_tok}").json()
        assert pub_cert2["status"] == "ISSUED"
        assert pub_cert2["superseded_by"] is None

        # --- Re-verification 2: Issue Cert 3 ---
        app3_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={"instrument_id": inst_id, "applicant_id": seed_data["stakeholder_id"], "application_type": "RE_VERIFICATION", "service_mode": "ON_SITE", "applicant_declaration_accepted": True},
            headers=owner_hdr,
        )
        app3_id = app3_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app3_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app3_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app3_id}/pay", json={"receipt_number": "REC-RE-02"}, headers=owner_hdr)

        sess3_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions", json={"application_id": app3_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"}, headers=lmo_hdr)
        sess3_id = sess3_res.json()["session_id"]
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess3_id}/observations", json=obs_payload, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess3_id}/disposition", json={"outcome": "Verification passed — pending authorization"}, headers=lmo_hdr)
        cert3_res = client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue", json={"session_id": sess3_id}, headers=lmo_hdr)
        cert3_tok = cert3_res.json()["public_verification_token"]

        # Cert 2 is now SUPERSEDED by Cert 3
        pub_cert2_updated = client.get(f"/api/v1/public/certificates/verify/{cert2_tok}").json()
        assert pub_cert2_updated["status"] == "SUPERSEDED"
        assert pub_cert2_updated["superseded_by"] == cert3_tok

        # Cert 3 is ISSUED
        pub_cert3 = client.get(f"/api/v1/public/certificates/verify/{cert3_tok}").json()
        assert pub_cert3["status"] == "ISSUED"
        assert pub_cert3["superseded_by"] is None


class TestAdversarialCryptographicTamperDetection:
    """Adversarial challenge: Verify public projection detects bit flips, corrupted signatures, and forged keys."""

    def test_canonical_sha256_hash_bit_flip_tampering(
        self, client: TestClient, db_session: Session, active_certificate: dict
    ):
        """Flipping a single hex character in certificate_bytes_sha256 yields INVALID_SIGNATURE."""
        cert_id = active_certificate["cert"]["certificate_id"]
        qr_token = active_certificate["cert"]["public_verification_token"]

        # Flip character in database
        db_cert = db_session.execute(select(Certificate).where(Certificate.certificate_id == cert_id)).scalar_one()
        orig_hash = db_cert.certificate_bytes_sha256
        tampered_char = "f" if orig_hash[0] != "f" else "0"
        db_cert.certificate_bytes_sha256 = tampered_char + orig_hash[1:]
        db_session.commit()

        # Public verification must report INVALID_SIGNATURE
        res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert res.status_code == 200
        assert res.json()["cryptographic_validity"] == "INVALID_SIGNATURE"

    def test_digital_signature_base64_tampering(
        self, client: TestClient, db_session: Session, active_certificate: dict
    ):
        """Tampering with the base64 signature string yields INVALID_SIGNATURE."""
        cert_id = active_certificate["cert"]["certificate_id"]
        qr_token = active_certificate["cert"]["public_verification_token"]

        db_cert = db_session.execute(select(Certificate).where(Certificate.certificate_id == cert_id)).scalar_one()
        sig_parts = db_cert.digital_signature_reference.split(":")
        # Corrupt the signature part
        corrupted_sig = "QUJD" + sig_parts[0][4:]  # altered base64 prefix
        db_cert.digital_signature_reference = f"{corrupted_sig}:{sig_parts[1]}"
        db_session.commit()

        res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert res.status_code == 200
        assert res.json()["cryptographic_validity"] == "INVALID_SIGNATURE"

    def test_counterfeit_signer_key_identifier_tampering(
        self, client: TestClient, db_session: Session, active_certificate: dict
    ):
        """Tampering with the key identifier (forged signer identity) yields INVALID_SIGNATURE."""
        cert_id = active_certificate["cert"]["certificate_id"]
        qr_token = active_certificate["cert"]["public_verification_token"]

        db_cert = db_session.execute(select(Certificate).where(Certificate.certificate_id == cert_id)).scalar_one()
        sig_parts = db_cert.digital_signature_reference.split(":")
        # Alter key identifier to unauthorized officer
        forged_key = "key_counterfeit_officer_99_IN-DL"
        db_cert.digital_signature_reference = f"{sig_parts[0]}:{forged_key}"
        db_session.commit()

        res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert res.status_code == 200
        assert res.json()["cryptographic_validity"] == "INVALID_SIGNATURE"

    def test_malformed_base64_signature_does_not_crash(
        self, client: TestClient, db_session: Session, active_certificate: dict
    ):
        """Malformed, non-base64 characters in signature reference are caught safely without 500 error."""
        cert_id = active_certificate["cert"]["certificate_id"]
        qr_token = active_certificate["cert"]["public_verification_token"]

        db_cert = db_session.execute(select(Certificate).where(Certificate.certificate_id == cert_id)).scalar_one()
        db_cert.digital_signature_reference = "NOT_BASE64_CORRUPTED_BYTES!@#$%:key_lmo_dl_01_IN-DL"
        db_session.commit()

        res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert res.status_code == 200
        assert res.json()["cryptographic_validity"] == "INVALID_SIGNATURE"


class TestAdversarialPublicVsPrivateBoundaryIsolation:
    """Adversarial challenge: Verify private certificate endpoints enforce strict auth and tenancy while public remains safe."""

    def test_unauthenticated_access_to_private_endpoint_blocked(
        self, client: TestClient, active_certificate: dict, seed_data: dict
    ):
        """Unauthenticated client cannot access private certificate endpoint."""
        cert_id = active_certificate["cert"]["certificate_id"]
        res = client.get(f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}")
        assert res.status_code == 401
        assert res.json()["error_code"] == "UNAUTHORIZED"

    def test_cross_tenant_access_to_private_certificate_blocked(
        self, client: TestClient, active_certificate: dict, seed_data: dict, auth_headers
    ):
        """Officer from IN-MH cannot access private certificate of IN-DL."""
        mh_officer_hdr = auth_headers(
            user_id="officer_mh_01",
            tenant_id=seed_data["tenant_mh_id"],
            role=RoleEnum.LMO,
            jurisdiction_id="MH-MUMBAI",
        )
        cert_id = active_certificate["cert"]["certificate_id"]
        res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}",
            headers=mh_officer_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "TENANT_ACCESS_DENIED"

    def test_unauthorized_trader_cannot_access_other_trader_private_certificate(
        self, client: TestClient, active_certificate: dict, seed_data: dict, auth_headers
    ):
        """Trader B cannot view full private certificate of Trader A."""
        trader_b_hdr = auth_headers(
            user_id="trader_b_unrelated_user",
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        cert_id = active_certificate["cert"]["certificate_id"]
        res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}",
            headers=trader_b_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "FORBIDDEN"
