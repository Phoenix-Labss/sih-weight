"""API Integration Tests: Opaque High-Entropy QR Public Verification & Privacy Guarantees.
"""

from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.certificate import Certificate
from app.models.stakeholder import RoleEnum


class TestPublicAPI:
    """Test suite covering the unauthenticated public verification projection (Zero PII)."""

    @pytest.fixture
    def issued_certificate(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
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
                "serial_number": "SN-PUBLIC-4821",
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
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-PUB-01"}, headers=owner_hdr)

        # Session
        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # Observations
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
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )

        # Issue Certificate
        cert_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id},
            headers=lmo_hdr,
        )
        return cert_res.json()

    def test_public_qr_verification_happy_path(self, client: TestClient, issued_certificate: dict):
        """Public user or consumer verifies certificate using opaque QR reference."""
        qr_token = issued_certificate["public_verification_token"]
        cert_number = issued_certificate["certificate_number"]

        # 1. Query via opaque token without authentication
        res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert res.status_code == 200, res.text
        data = res.json()

        assert data["certificate_number"] == cert_number
        assert data["status"] == "ISSUED"
        assert data["cryptographic_validity"] == "VALID_SIGNATURE"
        assert "Department of Legal Metrology" in data["issuing_authority"]
        assert len(data["certificate_hash"]) == 64

        # 2. Verify Safe Technical Summary
        summary = data["instrument_summary"]
        assert summary["model_name"] == "NS-15-DIGITAL"
        assert summary["accuracy_class"] == "CLASS_III"
        assert summary["serial_number_masked"] == "SN-****-4821"  # Masked!

        # 3. Strict Zero PII Verification
        full_json_str = res.text
        assert "Kishore" not in full_json_str
        assert "trader" not in full_json_str
        assert "9811000000" not in full_json_str
        assert "Shop 4" not in full_json_str
        assert "REC-PUB-01" not in full_json_str
        assert "500.00" not in full_json_str

    def test_public_qr_verification_revoked_status_display(
        self, client: TestClient, seed_data: dict, auth_headers, issued_certificate: dict
    ):
        """Revoked certificate public projection displays status REVOKED and statutory reason."""
        supervisor_hdr = auth_headers(
            user_id=seed_data["supervisor_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.SUPERVISOR,
        )
        cert_id = issued_certificate["certificate_id"]
        qr_token = issued_certificate["public_verification_token"]

        # Revoke certificate
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={
                "action": "REVOKE",
                "reason": "Instrument seized under Section 15 for fraudulent calibration tampering.",
                "statutory_authority_reference": "SEIZURE-MEMO-2026-91",
            },
            headers=supervisor_hdr,
        )

        # Public verification
        res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "REVOKED"
        assert "fraudulent calibration tampering" in data["revocation_reason"]

    def test_public_qr_verification_tampering_detection(
        self, client: TestClient, db_session: Session, issued_certificate: dict
    ):
        """Tampered canonical hash causes public verification to report INVALID_SIGNATURE."""
        cert_id = issued_certificate["certificate_id"]
        qr_token = issued_certificate["public_verification_token"]

        # Modify canonical hash in database directly
        db_cert = db_session.execute(
            select(Certificate).where(Certificate.certificate_id == cert_id)
        ).scalar_one()
        # Alter 1 character
        db_cert.certificate_bytes_sha256 = ("1" if db_cert.certificate_bytes_sha256[0] == "0" else "0") + db_cert.certificate_bytes_sha256[1:]
        db_session.commit()

        # Public verification
        res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert res.status_code == 200
        data = res.json()
        assert data["cryptographic_validity"] == "INVALID_SIGNATURE"

    def test_public_qr_verification_non_existent_token_returns_404(self, client: TestClient):
        """Unknown or invalid QR tokens return 404 RECORD_NOT_FOUND."""
        res = client.get("/api/v1/public/certificates/verify/cert_tok_unknown_nonexistent_12345")
        assert res.status_code == 404
        assert res.json()["error_code"] == "CERTIFICATE_NOT_FOUND"
