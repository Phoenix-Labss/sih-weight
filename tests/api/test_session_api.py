"""API Integration Tests: Verification Session Execution, Deterministic Calculation, and Legal Disposition.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestSessionAPI:
    """Test suite covering test session management, observations, NAWI evaluation, and disposition."""

    @pytest.fixture
    def scheduled_application(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
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
        # Register instrument
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": f"SN-SESS-TEST-{datetime.now().microsecond}",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        # Create, accept, assess fee, and pay application
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
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-991"}, headers=owner_hdr)

        # Schedule
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

    def test_verification_session_passing_lifecycle(
        self, client: TestClient, seed_data: dict, auth_headers, scheduled_application: dict
    ):
        """Complete verification session: create -> test within MPE -> disposition PASSED."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = scheduled_application["application_id"]
        inst_id = scheduled_application["instrument_id"]

        # 1. Initialize session
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={
                "application_id": app_id,
                "instrument_id": inst_id,
                "procedure_pack_id": "IND-LM-NAWI-CLASS-III-IIII-2026.1",
                "scheduled_date": "2026-08-23",
                "environmental_temp_celsius": "24.50",
                "environmental_humidity_percent": "55.00",
            },
            headers=lmo_hdr,
        )
        assert create_res.status_code == 201, create_res.text
        sess_id = create_res.json()["session_id"]
        assert create_res.json()["status"] == "PLANNED"

        # 2. Confirm Identity
        ident_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/identity?serial_verified=true",
            headers=lmo_hdr,
        )
        assert ident_res.status_code == 200
        assert ident_res.json()["status"] == "IDENTITY_CONFIRMED"

        # 3. Start Session
        start_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/start",
            headers=lmo_hdr,
        )
        assert start_res.status_code == 200
        assert start_res.json()["status"] == "IN_PROGRESS"

        # 4. Submit Observations (Zero, 5 kg, 10 kg, 15 kg within MPE)
        obs_payload = {
            "reference_standard_ids": seed_data["standard_ids"],
            "environmental_temp_celsius": "24.50",
            "environmental_humidity_percent": "55.00",
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

        # 5. Record Officer Disposition (PASSED)
        disp_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={
                "outcome": "Verification passed — pending authorization",
                "disposition_notes": "All NAWI Class III performance checks within MPE tolerance. Ready for certification.",
            },
            headers=lmo_hdr,
        )
        assert disp_res.status_code == 200, disp_res.text
        final_sess = disp_res.json()
        assert final_sess["status"] == "FINALIZED"
        assert final_sess["outcome"] == "Verification passed — pending authorization"

    def test_verification_session_failing_disposition(
        self, client: TestClient, seed_data: dict, auth_headers, scheduled_application: dict
    ):
        """Observations exceed MPE -> Evaluation fails -> Officer records VERIFICATION_FAILED."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        app_id = scheduled_application["application_id"]
        inst_id = scheduled_application["instrument_id"]

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

        # Submit Observations with huge error (nominal 10 kg, indicated 10.5 kg, MPE is 0.005 kg)
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
                    "nominal_load": "10.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "10.500000",  # Error 0.500 kg >> MPE
                    "reading_unit": "kg",
                },
            ],
        }
        submit_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations",
            json=obs_payload,
            headers=lmo_hdr,
        )
        assert submit_res.status_code == 200
        sess_data = submit_res.json()
        assert sess_data["status"] == "SUBMITTED"
        assert sess_data["automated_evaluation_flag"] is False

        # Guard: Attempting to record "PASSED" must fail with 422
        bad_disp_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={
                "outcome": "Verification passed — pending authorization",
                "disposition_notes": "Attempting illegal pass override",
            },
            headers=lmo_hdr,
        )
        assert bad_disp_res.status_code == 422
        assert bad_disp_res.json()["error_code"] == "GUARD_CONDITION_FAILED"

        # Legally correct: Record VERIFICATION_FAILED
        correct_disp_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={
                "outcome": "Verification failed",
                "disposition_notes": "Metrological error exceeds maximum permissible error limit.",
            },
            headers=lmo_hdr,
        )
        assert correct_disp_res.status_code == 200
        assert correct_disp_res.json()["status"] == "FINALIZED"
        assert correct_disp_res.json()["outcome"] == "Verification failed"
