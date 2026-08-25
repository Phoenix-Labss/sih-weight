"""API Integration Tests: Physical Stamp and Security Seal Decoupled Ledger.
"""

from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestStampAPI:
    """Test suite covering decoupled physical stamp and seal actions under Section 24."""

    @pytest.fixture
    def active_session(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture setting up instrument, application, and started session."""
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
                "serial_number": f"SN-STAMP-TEST-{datetime.now().microsecond}",
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
            json={
                "application_id": app_id,
                "instrument_id": inst_id,
                "scheduled_date": "2026-08-23",
            },
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]
        return {"instrument_id": inst_id, "session_id": sess_id}

    def test_record_and_retrieve_physical_stamps(
        self, client: TestClient, seed_data: dict, auth_headers, active_session: dict
    ):
        """Record physical lead wire seal and metallic stamping actions."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        sess_id = active_session["session_id"]
        inst_id = active_session["instrument_id"]

        # 1. Record Lead Wire Seal on Calibration Port
        stamp_payload_1 = {
            "action_type": "SEAL_APPLIED",
            "seal_type": "LEAD_WIRE_SEAL",
            "seal_identification_number": "DEL-SEAL-2026-88019",
            "seal_position": "CALIBRATION_ACCESS_PORT",
            "photo_evidence_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "notes": "Lead wire seal threaded through calibration housing screw.",
        }
        res1 = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
            json=stamp_payload_1,
            headers=lmo_hdr,
        )
        assert res1.status_code == 201, res1.text
        data1 = res1.json()
        assert data1["stamp_action_id"] is not None
        assert data1["seal_identification_number"] == "DEL-SEAL-2026-88019"
        assert data1["instrument_id"] == inst_id

        # 2. Record Metallic Stamping on Identification Plate
        stamp_payload_2 = {
            "action_type": "SEAL_APPLIED",
            "seal_type": "METALLIC_PUNCH_MARK",
            "seal_identification_number": "STAMP-Q3-2026-DL01",
            "seal_position": "NAMEPLATE_LEGAL_METROLOGY_EMBOSS",
            "notes": "Quarterly government stamp C/2026 punched on lead plug.",
        }
        res2 = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
            json=stamp_payload_2,
            headers=lmo_hdr,
        )
        assert res2.status_code == 201

        # 3. Retrieve Session Stamps
        sess_stamps_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
            headers=lmo_hdr,
        )
        assert sess_stamps_res.status_code == 200
        sess_stamps = sess_stamps_res.json()
        assert len(sess_stamps) == 2

        # 4. Retrieve Instrument Lifetime Stamp History
        inst_stamps_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/{inst_id}/stamps",
            headers=lmo_hdr,
        )
        assert inst_stamps_res.status_code == 200
        inst_stamps = inst_stamps_res.json()
        assert len(inst_stamps) == 2
