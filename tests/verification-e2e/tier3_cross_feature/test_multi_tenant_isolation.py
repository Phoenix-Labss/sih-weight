"""Tier 3 Cross-Feature & Security Invariants: Multi-Tenant Boundary Isolation & RBAC Protection.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestMultiTenantIsolation:
    """Security Invariant test suite verifying complete multi-tenant boundaries."""

    def test_cross_tenant_instrument_isolation(self, client: TestClient, seed_data: dict, auth_headers):
        """Tenant A (IN-DL) officer cannot list or register instruments under Tenant B (IN-MH)."""
        dl_headers = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
        )
        # Attempt to list instruments in IN-MH
        res_list = client.get("/api/v1/tenants/IN-MH/instruments", headers=dl_headers)
        assert res_list.status_code == 403
        assert res_list.json()["error_code"] == "TENANT_ACCESS_DENIED"

        # Attempt to create instrument in IN-MH
        res_create = client.post(
            "/api/v1/tenants/IN-MH/instruments",
            json={
                "jurisdiction_id": "MH-MUMBAI",
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-CROSS-TENANT-001",
                "year_of_manufacture": 2026,
            },
            headers=dl_headers,
        )
        assert res_create.status_code == 403
        assert res_create.json()["error_code"] == "TENANT_ACCESS_DENIED"

    def test_cross_tenant_application_isolation(self, client: TestClient, seed_data: dict, auth_headers):
        """Tenant A officer/trader cannot list or submit applications under Tenant B."""
        dl_headers = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        res_list = client.get("/api/v1/tenants/IN-MH/applications", headers=dl_headers)
        assert res_list.status_code == 403
        assert res_list.json()["error_code"] == "TENANT_ACCESS_DENIED"

        res_create = client.post(
            "/api/v1/tenants/IN-MH/applications",
            json={
                "instrument_id": "inst_dummy_123",
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=dl_headers,
        )
        assert res_create.status_code == 403
        assert res_create.json()["error_code"] == "TENANT_ACCESS_DENIED"

    def test_cross_tenant_session_isolation(self, client: TestClient, seed_data: dict, auth_headers):
        """Tenant A officer cannot view or start verification sessions under Tenant B."""
        dl_headers = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
        )
        res_list = client.get("/api/v1/tenants/IN-MH/sessions", headers=dl_headers)
        assert res_list.status_code == 403
        assert res_list.json()["error_code"] == "TENANT_ACCESS_DENIED"

        res_create = client.post(
            "/api/v1/tenants/IN-MH/sessions",
            json={
                "application_id": "app_dummy_123",
                "instrument_id": "inst_dummy_123",
                "scheduled_date": "2026-08-23",
            },
            headers=dl_headers,
        )
        assert res_create.status_code == 403
        assert res_create.json()["error_code"] == "TENANT_ACCESS_DENIED"

    def test_cross_tenant_certificate_isolation(self, client: TestClient, seed_data: dict, auth_headers):
        """Tenant A officer cannot issue or access certificates under Tenant B."""
        dl_headers = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
        )
        res = client.post(
            "/api/v1/tenants/IN-MH/certificates/issue",
            json={"session_id": "sess_dummy_123"},
            headers=dl_headers,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "TENANT_ACCESS_DENIED"

    def test_cross_tenant_stamp_isolation(self, client: TestClient, seed_data: dict, auth_headers):
        """Tenant A officer cannot record or list stamps under Tenant B."""
        dl_headers = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
        )
        res = client.post(
            "/api/v1/tenants/IN-MH/sessions/sess_dummy_123/stamps",
            json={
                "action_type": "SEAL_APPLIED",
                "seal_type": "LEAD_WIRE_SEAL",
                "seal_identification_number": "MH-SEAL-01",
                "seal_position": "PORT_1",
            },
            headers=dl_headers,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "TENANT_ACCESS_DENIED"
