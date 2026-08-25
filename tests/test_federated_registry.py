"""Phase 5/6 Test Suite: Federated National Registry & Cross-State Interoperability.
"""

from datetime import datetime, timezone
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.stakeholder import RoleEnum


class TestFederatedNationalRegistry:
    """Multi-State Cross-Jurisdiction & National Registry Tests."""

    def test_national_aggregates_endpoint(self, client: TestClient):
        """Verify pan-India aggregated statistics."""
        resp = client.get("/api/v1/national/aggregates")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "national_registry" in data
        assert "participating_states_count" in data
        assert "total_registered_instruments" in data
        assert "total_certificates_issued" in data
        assert "national_compliance_percentage" in data

    def test_national_lookup_by_serial_number(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        """Cross-state lookup resolving instrument across state boundaries."""
        tenant_mh = seed_data["tenant_mh_id"]
        headers_owner = auth_headers(user_id="trader_mumbai_01", tenant_id=tenant_mh, role=RoleEnum.OWNER)

        # Register instrument in Maharashtra
        unique_sn = f"SN-FED-{uuid.uuid4().hex[:8].upper()}"
        resp_inst = client.post(
            f"/api/v1/tenants/{tenant_mh}/instruments",
            json={
                "jurisdiction_id": "MH-MUMBAI",
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": unique_sn,
                "year_of_manufacture": 2026,
                "intended_use": "Interstate commercial freight scale",
            },
            headers=headers_owner,
        )
        assert resp_inst.status_code == 201

        # Query national lookup from any terminal without tenant prefix
        resp_nat = client.get(f"/api/v1/national/lookup?q={unique_sn}")
        assert resp_nat.status_code == 200, resp_nat.text
        match_data = resp_nat.json()
        assert match_data["matched_by"] == "INSTRUMENT_SERIAL_NUMBER"
        assert match_data["tenant_id"] == "IN-MH"
        assert match_data["serial_number"] == unique_sn
