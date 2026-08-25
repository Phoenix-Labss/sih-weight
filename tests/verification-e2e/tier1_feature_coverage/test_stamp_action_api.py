"""Tier 1 Feature Coverage: Physical Stamp and Security Seal Decoupled Ledger Endpoints.
"""

from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestStampActionFeatureAPI:
    """E2E Test Suite: Comprehensive Feature Coverage for Physical Stamping and Sealing."""

    @pytest.fixture
    def test_session(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture creating registered instrument, application, and session."""
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
                "serial_number": f"SN-STAMP-T1-{datetime.now().microsecond}",
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

        # Session
        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]
        return {"instrument_id": inst_id, "session_id": sess_id}

    def test_record_lead_wire_seal_with_photo_hash(
        self, client: TestClient, seed_data: dict, auth_headers, test_session: dict
    ):
        """Officer records lead wire seal applied to calibration port with photo hash."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        sess_id = test_session["session_id"]
        inst_id = test_session["instrument_id"]

        payload = {
            "action_type": "SEAL_APPLIED",
            "seal_type": "LEAD_WIRE_SEAL",
            "seal_identification_number": "DEL-SEAL-2026-99011",
            "seal_position": "CALIBRATION_ACCESS_PORT",
            "photo_evidence_hash": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
            "notes": "Lead wire seal threaded through calibration screw hole and crimped.",
        }
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
            json=payload,
            headers=lmo_hdr,
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["stamp_action_id"] is not None
        assert data["seal_identification_number"] == "DEL-SEAL-2026-99011"
        assert data["seal_type"] == "LEAD_WIRE_SEAL"
        assert data["instrument_id"] == inst_id
        assert data["photo_evidence_hash"] == "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e"

    def test_record_metallic_punch_mark(
        self, client: TestClient, seed_data: dict, auth_headers, test_session: dict
    ):
        """Officer records metallic punch mark stamp on instrument nameplate."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        sess_id = test_session["session_id"]

        payload = {
            "action_type": "SEAL_APPLIED",
            "seal_type": "METALLIC_PUNCH_MARK",
            "seal_identification_number": "STAMP-Q3-2026-DL-NORTH",
            "seal_position": "NAMEPLATE_LEGAL_METROLOGY_EMBOSS",
            "notes": "Quarterly stamp Q3/2026 punched on lead rivet.",
        }
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
            json=payload,
            headers=lmo_hdr,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["seal_type"] == "METALLIC_PUNCH_MARK"
        assert data["seal_identification_number"] == "STAMP-Q3-2026-DL-NORTH"

    def test_list_session_stamps(
        self, client: TestClient, seed_data: dict, auth_headers, test_session: dict
    ):
        """Retrieve all stamp actions performed within a specific verification session."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        sess_id = test_session["session_id"]

        # Record two stamps
        for i in range(1, 3):
            client.post(
                f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
                json={
                    "action_type": "SEAL_APPLIED",
                    "seal_type": "LEAD_WIRE_SEAL",
                    "seal_identification_number": f"DEL-SEAL-LIST-{i}",
                    "seal_position": f"PORT_{i}",
                },
                headers=lmo_hdr,
            )

        res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
            headers=lmo_hdr,
        )
        assert res.status_code == 200
        stamps = res.json()
        assert len(stamps) == 2
        assert any(s["seal_identification_number"] == "DEL-SEAL-LIST-1" for s in stamps)
        assert any(s["seal_identification_number"] == "DEL-SEAL-LIST-2" for s in stamps)

    def test_list_instrument_lifetime_stamps(
        self, client: TestClient, seed_data: dict, auth_headers, test_session: dict
    ):
        """Retrieve lifetime physical stamp history for a given instrument."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        sess_id = test_session["session_id"]
        inst_id = test_session["instrument_id"]

        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
            json={
                "action_type": "SEAL_APPLIED",
                "seal_type": "SECURITY_STICKER_HOLOGRAM",
                "seal_identification_number": "HOLO-2026-004",
                "seal_position": "HOUSING_SEAM",
            },
            headers=lmo_hdr,
        )

        res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/{inst_id}/stamps",
            headers=lmo_hdr,
        )
        assert res.status_code == 200
        history = res.json()
        assert len(history) >= 1
        assert any(s["seal_identification_number"] == "HOLO-2026-004" for s in history)

    def test_unauthorized_role_stamp_recording_blocked(
        self, client: TestClient, seed_data: dict, auth_headers, test_session: dict
    ):
        """Trader/Owner is forbidden from recording official physical stamps/seals."""
        owner_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        sess_id = test_session["session_id"]

        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
            json={
                "action_type": "SEAL_APPLIED",
                "seal_type": "LEAD_WIRE_SEAL",
                "seal_identification_number": "UNAUTH-SEAL-01",
                "seal_position": "CALIBRATION_PORT",
            },
            headers=owner_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "INSUFFICIENT_PERMISSIONS"
