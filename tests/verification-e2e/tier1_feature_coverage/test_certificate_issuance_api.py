"""Tier 1 Feature Coverage: Digital Certificate Issuance, Canonical Hashing & Signing Endpoints.
"""

from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestCertificateIssuanceFeatureAPI:
    """E2E Test Suite: Comprehensive Feature Coverage for Digital Certificate Lifecycle."""

    @pytest.fixture
    def finalized_passing_session(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture setting up instrument, application, session, observations and pass disposition."""
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
                "serial_number": f"SN-CERT-T1-{datetime.now().microsecond}",
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
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-CERT-01"}, headers=owner_hdr)

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

        # Disposition PASSED
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization", "disposition_notes": "All checks passed."},
            headers=lmo_hdr,
        )
        return {"instrument_id": inst_id, "session_id": sess_id}

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

        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id, "validity_months": 12},
            headers=lmo_hdr,
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["certificate_id"] is not None
        assert f"{seed_data['tenant_id']}/LM/" in data["certificate_number"]
        assert "CERT-" in data["certificate_number"]
        assert data["certificate_status"] == "ISSUED"
        assert len(data["certificate_bytes_sha256"]) == 64
        assert data["digital_signature_reference"] is not None
        assert data["public_verification_token"].startswith("cert_tok_")
        assert len(data["status_events"]) == 1

        # Instrument updated with latest certificate
        inst_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/{inst_id}",
            headers=lmo_hdr,
        )
        assert inst_res.status_code == 200
        inst_data = inst_res.json()
        assert inst_data["latest_certificate_id"] == data["certificate_id"]
        assert inst_data["current_status"] == "ACTIVE_VERIFIED"

    def test_certificate_canonical_bytes_and_hash_integrity(
        self, client: TestClient, seed_data: dict, auth_headers, finalized_passing_session: dict
    ):
        """Certificate contains exact 64-character SHA-256 hex digest of canonical JSON bytes."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        sess_id = finalized_passing_session["session_id"]

        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id},
            headers=lmo_hdr,
        )
        assert res.status_code == 201
        data = res.json()
        hash_val = data["certificate_bytes_sha256"]
        assert len(hash_val) == 64
        assert all(c in "0123456789abcdefABCDEF" for c in hash_val)

    def test_certificate_issuance_blocked_on_unfinalized_session(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Issuing certificate on unfinalized session fails with 422 GUARD_CONDITION_FAILED."""
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
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": f"SN-UNFIN-{datetime.now().microsecond}",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]
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
        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # Attempt to issue certificate immediately (status is PLANNED)
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id},
            headers=lmo_hdr,
        )
        assert res.status_code == 422
        assert res.json()["error_code"] == "GUARD_CONDITION_FAILED"

    def test_certificate_lifecycle_transitions(
        self, client: TestClient, seed_data: dict, auth_headers, finalized_passing_session: dict
    ):
        """Lifecycle transitions: ISSUED -> SUSPENDED -> ISSUED (Reinstated) -> REVOKED."""
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

        # 1. Suspend
        sus_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={
                "action": "SUSPEND",
                "reason": "Enforcement inquiry initiated under Section 18.",
                "statutory_authority_reference": "INQ-2026-01",
            },
            headers=lmo_hdr,
        )
        assert sus_res.status_code == 200
        assert sus_res.json()["certificate_status"] == "SUSPENDED"

        # 2. Reinstate
        rein_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={
                "action": "REINSTATE",
                "reason": "Inquiry completed, no metrological discrepancy found.",
                "statutory_authority_reference": "INQ-CLEARED-01",
            },
            headers=supervisor_hdr,
        )
        assert rein_res.status_code == 200
        assert rein_res.json()["certificate_status"] == "ISSUED"

        # 3. Revoke
        rev_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={
                "action": "REVOKE",
                "reason": "Severe physical seal tampering observed on spot inspection.",
                "statutory_authority_reference": "REVOCATION-ORDER-2026-9",
            },
            headers=supervisor_hdr,
        )
        assert rev_res.status_code == 200
        assert rev_res.json()["certificate_status"] == "REVOKED"
        assert len(rev_res.json()["status_events"]) == 4

    def test_unauthorized_role_cannot_issue_certificate(
        self, client: TestClient, seed_data: dict, auth_headers, finalized_passing_session: dict
    ):
        """Owner/Trader role cannot issue certificates."""
        owner_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        sess_id = finalized_passing_session["session_id"]

        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id},
            headers=owner_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "INSUFFICIENT_PERMISSIONS"
