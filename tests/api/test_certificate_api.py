"""API Integration Tests: Digital Certificate Issuance, Signing, and Lifecycle Management.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestCertificateAPI:
    """Test suite covering cryptographic certificate generation, signing, and lifecycle events."""

    @pytest.fixture
    def finalized_passing_session(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture creating a finalized passing verification session."""
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
        # 1. Instrument
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": f"SN-CERT-TEST-{datetime.now().microsecond}",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        # 2. Application
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
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-CERT-01"}, headers=owner_hdr)

        # 3. Session
        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # 4. Observations within MPE
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

        # 5. Disposition PASSED
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization", "disposition_notes": "Passed all tests"},
            headers=lmo_hdr,
        )
        return {"instrument_id": inst_id, "session_id": sess_id, "application_id": app_id}

    def test_certificate_issuance_happy_path(
        self, client: TestClient, seed_data: dict, auth_headers, finalized_passing_session: dict
    ):
        """Officer issues digitally signed certificate from eligible session."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        sess_id = finalized_passing_session["session_id"]
        inst_id = finalized_passing_session["instrument_id"]

        # Issue Certificate
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id, "validity_months": 12},
            headers=lmo_hdr,
        )
        assert res.status_code == 201, res.text
        cert_data = res.json()
        assert cert_data["certificate_id"] is not None
        assert cert_data["certificate_status"] == "ISSUED"
        assert len(cert_data["certificate_bytes_sha256"]) == 64
        assert cert_data["digital_signature_reference"] is not None
        assert cert_data["public_verification_token"].startswith("cert_tok_")
        assert len(cert_data["status_events"]) == 1

        # Check Instrument updated
        inst_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/{inst_id}",
            headers=lmo_hdr,
        )
        assert inst_res.status_code == 200
        inst_data = inst_res.json()
        assert inst_data["latest_certificate_id"] == cert_data["certificate_id"]
        assert inst_data["current_status"] == "ACTIVE_VERIFIED"
        assert inst_data["verification_due_date"] == cert_data["valid_until"]

    def test_certificate_status_lifecycle_transitions(
        self, client: TestClient, seed_data: dict, auth_headers, finalized_passing_session: dict
    ):
        """Suspend -> Reinstate -> Revoke lifecycle progression."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        supervisor_hdr = auth_headers(
            user_id=seed_data["supervisor_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.SUPERVISOR,
        )
        sess_id = finalized_passing_session["session_id"]

        # Issue
        issue_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id},
            headers=lmo_hdr,
        )
        cert_id = issue_res.json()["certificate_id"]

        # 1. Suspend Certificate
        sus_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={
                "action": "SUSPEND",
                "reason": "Enforcement inquiry initiated following consumer underweight complaint.",
                "statutory_authority_reference": "SEC-18-INQUIRY-009",
            },
            headers=lmo_hdr,
        )
        assert sus_res.status_code == 200
        assert sus_res.json()["certificate_status"] == "SUSPENDED"

        # 2. Reinstate Certificate
        rein_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={
                "action": "REINSTATE",
                "reason": "Laboratory inspection confirmed seal intact and calibration unaltered.",
                "statutory_authority_reference": "INQ-CLEARED-8821",
            },
            headers=supervisor_hdr,
        )
        assert rein_res.status_code == 200
        assert rein_res.json()["certificate_status"] == "ISSUED"

        # 3. Revoke Certificate
        rev_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={
                "action": "REVOKE",
                "reason": "Tampering detected: lead seal broken and load cell recalibrated without authorization.",
                "statutory_authority_reference": "ORD-REVOCATION-2026-004",
            },
            headers=supervisor_hdr,
        )
        assert rev_res.status_code == 200
        assert rev_res.json()["certificate_status"] == "REVOKED"
        assert len(rev_res.json()["status_events"]) == 4  # ISSUED -> SUSPENDED -> ISSUED -> REVOKED
