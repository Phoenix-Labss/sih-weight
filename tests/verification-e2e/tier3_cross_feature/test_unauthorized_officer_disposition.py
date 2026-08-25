"""Tier 3 Cross-Feature & Security Invariants: Unauthorized Officer Disposition & Jurisdiction Enforcement.
"""

from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestUnauthorizedOfficerDisposition:
    """Security Invariant test suite verifying strict jurisdiction-scoping and RBAC on statutory dispositions."""

    @pytest.fixture
    def south_district_session(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture creating application and session strictly in DL-SOUTH jurisdiction."""
        south_owner_hdr = auth_headers(
            user_id="south_trader_99",
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
            jurisdiction_id=seed_data["jurisdiction_south_id"],
        )
        south_lmo_hdr = auth_headers(
            user_id="south_officer_88",
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_south_id"],
        )
        # Instrument in DL-SOUTH
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_south_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": f"SN-SOUTH-{datetime.now().microsecond}",
                "year_of_manufacture": 2026,
            },
            headers=south_owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        # Application in DL-SOUTH
        app_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=south_owner_hdr,
        )
        app_id = app_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=south_lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=south_lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-SOUTH-01"}, headers=south_owner_hdr)

        # Session in DL-SOUTH
        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=south_lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]
        return {"session_id": sess_id, "application_id": app_id, "instrument_id": inst_id}

    def test_cross_district_officer_disposition_blocked(
        self, client: TestClient, seed_data: dict, auth_headers, south_district_session: dict
    ):
        """LMO posted to DL-NORTH cannot submit observations or record disposition on DL-SOUTH session."""
        north_lmo_hdr = auth_headers(
            user_id="north_officer_01",
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        sess_id = south_district_session["session_id"]

        # Attempt observation submit
        obs_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations",
            json={
                "reference_standard_ids": seed_data["standard_ids"],
                "observations": [
                    {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                    {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "15.000000", "load_unit": "kg", "raw_indication_reading": "15.000000", "reading_unit": "kg"},
                ],
            },
            headers=north_lmo_hdr,
        )
        assert obs_res.status_code == 403
        assert obs_res.json()["error_code"] == "OUTSIDE_JURISDICTION"

        # Attempt disposition
        disp_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=north_lmo_hdr,
        )
        assert disp_res.status_code == 403
        assert disp_res.json()["error_code"] == "OUTSIDE_JURISDICTION"

    def test_owner_role_cannot_record_disposition(
        self, client: TestClient, seed_data: dict, auth_headers, south_district_session: dict
    ):
        """Trader/Owner cannot record disposition on any session."""
        owner_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        sess_id = south_district_session["session_id"]
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=owner_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "INSUFFICIENT_PERMISSIONS"

    def test_public_verifier_cannot_record_disposition(
        self, client: TestClient, seed_data: dict, auth_headers, south_district_session: dict
    ):
        """Public verifier / consumer role cannot record disposition."""
        pub_hdr = auth_headers(
            user_id="public_user_99",
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.PUBLIC_VERIFIER,
        )
        sess_id = south_district_session["session_id"]
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=pub_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "INSUFFICIENT_PERMISSIONS"

    def test_cross_district_scrutiny_blocked(
        self, client: TestClient, seed_data: dict, auth_headers, south_district_session: dict
    ):
        """DL-NORTH officer cannot accept or query application in DL-SOUTH."""
        north_lmo_hdr = auth_headers(
            user_id="north_officer_01",
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        app_id = south_district_session["application_id"]
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "ACCEPT"},
            headers=north_lmo_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "OUTSIDE_JURISDICTION"
