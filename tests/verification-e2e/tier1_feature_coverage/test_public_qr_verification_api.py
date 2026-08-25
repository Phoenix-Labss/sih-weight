"""Tier 1 Feature Coverage: Unauthenticated Public QR Verification & Zero-PII Projection Endpoints.
"""

from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.certificate import Certificate
from app.models.stakeholder import RoleEnum


class TestPublicQRVerificationFeatureAPI:
    """E2E Test Suite: Comprehensive Feature Coverage for Public QR Verification."""

    @pytest.fixture
    def issued_cert(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture setting up and issuing a valid certificate."""
        owner_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        # Instrument
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-PUB-T1-5912",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        # Application
        app_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
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
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-PUB-T1"}, headers=owner_hdr)

        # Session
        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # Passing observations
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations",
            json={
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
            },
            headers=lmo_hdr,
        )
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )

        cert_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id},
            headers=lmo_hdr,
        )
        return cert_res.json()

    def test_public_qr_verification_valid_certificate(self, client: TestClient, issued_cert: dict):
        """Unauthenticated public consumer verifies certificate status via opaque token."""
        token = issued_cert["public_verification_token"]
        cert_num = issued_cert["certificate_number"]

        res = client.get(f"/api/v1/public/certificates/verify/{token}")
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["certificate_number"] == cert_num
        assert data["status"] == "ISSUED"
        assert data["cryptographic_validity"] == "VALID_SIGNATURE"
        assert len(data["certificate_hash"]) == 64
        assert "Department of Legal Metrology" in data["issuing_authority"]

    def test_public_qr_zero_pii_leakage_guarantee(self, client: TestClient, issued_cert: dict):
        """Zero PII guarantee: No owner name, email, phone, trade name, fee or payment in response."""
        token = issued_cert["public_verification_token"]
        res = client.get(f"/api/v1/public/certificates/verify/{token}")
        assert res.status_code == 200
        raw_text = res.text

        # Strict checks against PII fields
        assert "Kishore" not in raw_text
        assert "trader" not in raw_text
        assert "9811000000" not in raw_text
        assert "Shop 4" not in raw_text
        assert "REC-PUB-T1" not in raw_text
        assert "500.00" not in raw_text

    def test_public_qr_serial_masking(self, client: TestClient, issued_cert: dict):
        """Serial number is masked in public projection to prevent harvest/enumeration."""
        token = issued_cert["public_verification_token"]
        res = client.get(f"/api/v1/public/certificates/verify/{token}")
        assert res.status_code == 200
        summary = res.json()["instrument_summary"]
        assert summary["serial_number_masked"] == "SN-****-5912"

    def test_public_qr_revoked_status_display(
        self, client: TestClient, seed_data: dict, auth_headers, issued_cert: dict
    ):
        """Revoked certificate public status displays REVOKED and revocation reason."""
        supervisor_hdr = auth_headers(
            user_id=seed_data["supervisor_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.SUPERVISOR,
        )
        cert_id = issued_cert["certificate_id"]
        token = issued_cert["public_verification_token"]

        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={
                "action": "REVOKE",
                "reason": "Calibration fraud identified during spot vigilance raid.",
                "statutory_authority_reference": "RAID-ORD-2026-881",
            },
            headers=supervisor_hdr,
        )

        res = client.get(f"/api/v1/public/certificates/verify/{token}")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "REVOKED"
        assert "Calibration fraud identified" in data["revocation_reason"]

    def test_public_qr_tampered_canonical_hash_detection(
        self, client: TestClient, db_session: Session, issued_cert: dict
    ):
        """Tampering with certificate canonical hash invalidates signature verification."""
        cert_id = issued_cert["certificate_id"]
        token = issued_cert["public_verification_token"]

        db_cert = db_session.execute(
            select(Certificate).where(Certificate.certificate_id == cert_id)
        ).scalar_one()
        # Alter character in hash (flip first char)
        first_char = "0" if db_cert.certificate_bytes_sha256[0] != "0" else "1"
        db_cert.certificate_bytes_sha256 = first_char + db_cert.certificate_bytes_sha256[1:]
        db_session.commit()

        res = client.get(f"/api/v1/public/certificates/verify/{token}")
        assert res.status_code == 200
        data = res.json()
        assert data["cryptographic_validity"] == "INVALID_SIGNATURE"

    def test_public_qr_non_existent_token_returns_404(self, client: TestClient):
        """Non-existent token returns 404 CERTIFICATE_NOT_FOUND."""
        res = client.get("/api/v1/public/certificates/verify/cert_tok_non_existent_random_token_999")
        assert res.status_code == 404
        assert res.json()["error_code"] == "CERTIFICATE_NOT_FOUND"
