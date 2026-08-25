"""Tier 1 Feature Coverage: Verification Session Execution, Deterministic Evaluation & Disposition Endpoints.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestVerificationSessionFeatureAPI:
    """E2E Test Suite: Comprehensive Feature Coverage for Verification Sessions."""

    @pytest.fixture
    def scheduled_app(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture setting up registered instrument and scheduled application."""
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
                "serial_number": f"SN-SESS-T1-{datetime.now().microsecond}",
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
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-SESS-01"}, headers=owner_hdr)
        now = datetime.now(timezone.utc)
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/schedule",
            json={
                "slot_start": now.isoformat(),
                "slot_end": (now + timedelta(hours=2)).isoformat(),
                "assigned_lmo_id": seed_data["lmo_user_id"],
            },
            headers=lmo_hdr,
        )
        return {"instrument_id": inst_id, "application_id": app_id}

    def test_session_initialization_and_identity_confirmation(
        self, client: TestClient, seed_data: dict, auth_headers, scheduled_app: dict
    ):
        """LMO initializes verification session and confirms physical serial match."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = scheduled_app["application_id"]
        inst_id = scheduled_app["instrument_id"]

        # 1. Initialize
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={
                "application_id": app_id,
                "instrument_id": inst_id,
                "procedure_pack_id": "IND-LM-NAWI-CLASS-III-IIII-2026.1",
                "scheduled_date": "2026-08-23",
                "environmental_temp_celsius": "23.00",
                "environmental_humidity_percent": "50.00",
            },
            headers=lmo_hdr,
        )
        assert create_res.status_code == 201, create_res.text
        sess_data = create_res.json()
        assert sess_data["status"] == "PLANNED"
        sess_id = sess_data["session_id"]

        # 2. Confirm physical serial
        ident_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/identity?serial_verified=true",
            headers=lmo_hdr,
        )
        assert ident_res.status_code == 200
        assert ident_res.json()["status"] == "IDENTITY_CONFIRMED"

    def test_session_observation_submission_and_trace(
        self, client: TestClient, seed_data: dict, auth_headers, scheduled_app: dict
    ):
        """Submit raw test observations and verify deterministic calculation trace."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = scheduled_app["application_id"]
        inst_id = scheduled_app["instrument_id"]

        # Create session
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={
                "application_id": app_id,
                "instrument_id": inst_id,
                "scheduled_date": "2026-08-23",
            },
            headers=lmo_hdr,
        )
        sess_id = create_res.json()["session_id"]

        # Submit observations
        obs_payload = {
            "reference_standard_ids": seed_data["standard_ids"],
            "environmental_temp_celsius": "25.00",
            "environmental_humidity_percent": "52.00",
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": "0.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "0.000000",
                    "reading_unit": "kg",
                    "repetition_index": 1,
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 2,
                    "nominal_load": "5.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "5.000000",
                    "reading_unit": "kg",
                    "repetition_index": 1,
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 3,
                    "nominal_load": "10.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "10.000000",
                    "reading_unit": "kg",
                    "repetition_index": 1,
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 4,
                    "nominal_load": "15.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "15.000000",
                    "reading_unit": "kg",
                    "repetition_index": 1,
                },
            ],
        }
        submit_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations",
            json=obs_payload,
            headers=lmo_hdr,
        )
        assert submit_res.status_code == 200, submit_res.text
        sess_data = submit_res.json()
        assert sess_data["status"] == "SUBMITTED"
        assert sess_data["automated_evaluation_flag"] is True
        assert len(sess_data["observations"]) == 4

        # Verify observation records populated
        for obs in sess_data["observations"]:
            assert obs["is_within_mpe"] is True
            assert obs["nominal_load"] is not None
            assert obs["raw_indication_reading"] is not None

    def test_session_officer_pass_disposition_finalization(
        self, client: TestClient, seed_data: dict, auth_headers, scheduled_app: dict
    ):
        """Officer records formal pass disposition and session moves to FINALIZED."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = scheduled_app["application_id"]
        inst_id = scheduled_app["instrument_id"]

        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = create_res.json()["session_id"]

        # Submit passing observations
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

        # Record disposition
        disp_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={
                "outcome": "Verification passed — pending authorization",
                "disposition_notes": "All statutory metrological criteria met.",
            },
            headers=lmo_hdr,
        )
        assert disp_res.status_code == 200
        data = disp_res.json()
        assert data["status"] == "FINALIZED"
        assert data["outcome"] == "Verification passed — pending authorization"

    def test_session_failing_observation_and_disposition(
        self, client: TestClient, seed_data: dict, auth_headers, scheduled_app: dict
    ):
        """Failing observation prevents pass disposition and enforces Verification failed disposition."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = scheduled_app["application_id"]
        inst_id = scheduled_app["instrument_id"]

        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = create_res.json()["session_id"]

        # Submit observation with massive error (reading 11 kg on 10 kg nominal)
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
                        "nominal_load": "10.000000",
                        "load_unit": "kg",
                        "raw_indication_reading": "11.000000",
                        "reading_unit": "kg",
                    },
                ],
            },
            headers=lmo_hdr,
        )

        # Illegal pass disposition blocked
        bad_disp = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )
        assert bad_disp.status_code == 422
        assert bad_disp.json()["error_code"] == "GUARD_CONDITION_FAILED"

        # Correct fail disposition
        fail_disp = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification failed", "disposition_notes": "Error exceeds permissible MPE."},
            headers=lmo_hdr,
        )
        assert fail_disp.status_code == 200
        assert fail_disp.json()["status"] == "FINALIZED"
        assert fail_disp.json()["outcome"] == "Verification failed"

    def test_session_get_and_list_with_pagination(
        self, client: TestClient, seed_data: dict, auth_headers, scheduled_app: dict
    ):
        """Fetch session by ID with relationships and list sessions with pagination."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = scheduled_app["application_id"]
        inst_id = scheduled_app["instrument_id"]

        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = create_res.json()["session_id"]

        # Fetch by ID
        get_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}",
            headers=lmo_hdr,
        )
        assert get_res.status_code == 200
        assert get_res.json()["session_id"] == sess_id

        # List
        list_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions?page=1&page_size=10",
            headers=lmo_hdr,
        )
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert list_data["total"] >= 1
        assert any(s["session_id"] == sess_id for s in list_data["items"])
