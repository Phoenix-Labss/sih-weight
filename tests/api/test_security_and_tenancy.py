"""API Integration Tests: Multi-Tenant Boundary Isolation, RBAC/ABAC Guards, and Security Invariants.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.auth import create_access_token
from app.models.stakeholder import RoleEnum


class TestSecurityAndTenancy:
    """Test suite verifying cross-tenant barriers, jurisdiction limits, and RBAC."""

    def test_cross_tenant_access_denied(self, client: TestClient, seed_data: dict, auth_headers):
        """User authenticated under IN-DL cannot access resources under IN-MH."""
        dl_headers = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        # Attempt to access Maharashtra tenant endpoint
        res = client.get(
            f"/api/v1/tenants/IN-MH/instruments",
            headers=dl_headers,
        )
        assert res.status_code == 403, res.text
        data = res.json()
        assert data["error_code"] == "TENANT_ACCESS_DENIED"
        assert "IN-DL" in data["detail"]
        assert "IN-MH" in data["detail"]

    def test_cross_district_officer_action_blocked(self, client: TestClient, seed_data: dict, auth_headers):
        """LMO posted to DL-NORTH cannot scrutinize application located in DL-SOUTH."""
        # 1. Register instrument in DL-SOUTH
        south_owner_hdr = auth_headers(
            user_id="south_trader_01",
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
            jurisdiction_id="DL-SOUTH",
        )
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_south_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-SOUTH-DISTRICT-001",
                "year_of_manufacture": 2026,
            },
            headers=south_owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        # 2. Submit application in DL-SOUTH
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

        # 3. LMO posted to DL-NORTH attempts scrutiny on DL-SOUTH application
        north_lmo_hdr = auth_headers(
            user_id="north_officer_99",
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "ACCEPT"},
            headers=north_lmo_hdr,
        )
        assert res.status_code == 403
        data = res.json()
        assert data["error_code"] == "OUTSIDE_JURISDICTION"

    def test_unauthorized_role_action_blocked(self, client: TestClient, seed_data: dict, auth_headers):
        """Trader/Owner cannot execute statutory officer endpoints (disposition, certificate issue)."""
        owner_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        # Attempt to issue certificate as OWNER
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": "sess_dummy_id_123"},
            headers=owner_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "INSUFFICIENT_PERMISSIONS"

    def test_unauthenticated_request_rejected(self, client: TestClient, seed_data: dict):
        """Protected endpoint rejected with 401 UNAUTHORIZED when no credentials provided."""
        res = client.get(f"/api/v1/tenants/{seed_data['tenant_id']}/instruments")
        assert res.status_code == 401
        assert res.json()["error_code"] == "UNAUTHORIZED"

    def test_invalid_or_tampered_jwt_token_rejected(self, client: TestClient, seed_data: dict):
        """Tampered JWT signature is rejected with 401 UNAUTHORIZED."""
        # Create token with wrong secret
        token = create_access_token(
            data={"sub": "fake_user", "tenant_id": "IN-DL", "role": "OWNER"},
            secret_key="malicious-counterfeit-secret-key",
        )
        res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 401
        assert res.json()["error_code"] == "INVALID_SIGNATURE"
