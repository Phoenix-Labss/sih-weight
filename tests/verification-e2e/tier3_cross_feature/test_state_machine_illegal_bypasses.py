"""Tier 3 Cross-Feature & Security Invariants: State Machine Illegal Bypasses & Guard Rejections.
"""

from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestStateMachineIllegalBypasses:
    """Security Invariant test suite asserting that illegal state jumps and bypasses are strictly rejected."""

    @pytest.fixture
    def test_inst_and_app(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture setting up registered instrument and newly submitted application."""
        owner_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": f"SN-BYPASS-{datetime.now().microsecond}",
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
        return {"instrument_id": inst_id, "application_id": app_id}

    def test_application_cannot_skip_scrutiny_to_scheduled(
        self, client: TestClient, seed_data: dict, auth_headers, test_inst_and_app: dict
    ):
        """Attempting to schedule an application directly from SUBMITTED state must fail with 409/422."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = test_inst_and_app["application_id"]

        # Attempt to schedule immediately
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/schedule",
            json={
                "slot_start": "2026-09-01T10:00:00Z",
                "slot_end": "2026-09-01T12:00:00Z",
                "assigned_lmo_id": seed_data["lmo_user_id"],
            },
            headers=lmo_hdr,
        )
        assert res.status_code in (409, 422)

    def test_application_cannot_skip_fee_payment_to_scheduled(
        self, client: TestClient, seed_data: dict, auth_headers, test_inst_and_app: dict
    ):
        """Attempting to schedule an ACCEPTED / FEE_PENDING application before payment is rejected with 409/422."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = test_inst_and_app["application_id"]

        # Accept
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        # Assess fee
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)

        # Attempt schedule while FEE_PENDING
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/schedule",
            json={
                "slot_start": "2026-09-01T10:00:00Z",
                "slot_end": "2026-09-01T12:00:00Z",
                "assigned_lmo_id": seed_data["lmo_user_id"],
            },
            headers=lmo_hdr,
        )
        assert res.status_code in (409, 422)

    def test_session_cannot_finalize_without_observations(
        self, client: TestClient, seed_data: dict, auth_headers, test_inst_and_app: dict
    ):
        """Officer cannot record disposition on PLANNED session without submitting observations."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = test_inst_and_app["application_id"]
        inst_id = test_inst_and_app["instrument_id"]

        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # Attempt disposition directly
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )
        assert res.status_code in (409, 422)

    def test_disposition_pass_override_on_failed_evaluation_rejected(
        self, client: TestClient, seed_data: dict, auth_headers, test_inst_and_app: dict
    ):
        """Officer cannot force pass disposition when automated evaluation failed."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = test_inst_and_app["application_id"]
        inst_id = test_inst_and_app["instrument_id"]

        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # Failing observations
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations",
            json={
                "reference_standard_ids": seed_data["standard_ids"],
                "observations": [
                    {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                    {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "10.000000", "load_unit": "kg", "raw_indication_reading": "11.500000", "reading_unit": "kg"},
                ],
            },
            headers=lmo_hdr,
        )

        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )
        assert res.status_code == 422
        assert res.json()["error_code"] == "GUARD_CONDITION_FAILED"

    def test_premature_certificate_issuance_rejected(
        self, client: TestClient, seed_data: dict, auth_headers, test_inst_and_app: dict
    ):
        """Certificate generation request for unfinalized or in-progress session fails with 422."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = test_inst_and_app["application_id"]
        inst_id = test_inst_and_app["instrument_id"]

        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id},
            headers=lmo_hdr,
        )
        assert res.status_code == 422
        assert res.json()["error_code"] == "GUARD_CONDITION_FAILED"
