"""API Integration Tests: Instrument Pattern Approval and Physical Unit Registration.
"""

from __future__ import annotations

from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestInstrumentAPI:
    """Test suite covering instrument model and unit registration endpoints."""

    def test_create_instrument_model_happy_path(self, client: TestClient, seed_data: dict, auth_headers):
        """Officer registers a new approved instrument model."""
        headers = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
        )
        payload = {
            "category": "NAWI",
            "subtype": "ELECTRONIC_PLATFORM_SCALE",
            "manufacturer_name": "Bharat Instruments Ltd",
            "model_name": "BI-100-PLATFORM",
            "model_approval_number": "IND/09/2026/901",
            "accuracy_class": "CLASS_III",
            "verification_scale_interval_e": "0.020000",
            "scale_interval_unit": "kg",
            "min_capacity": "0.400000",
            "max_capacity": "100.000000",
            "capacity_unit": "kg",
            "number_of_intervals_n": 5000,
            "specifications": {"platform_size": "600x600mm"},
        }
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/models",
            json=payload,
            headers=headers,
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["model_approval_number"] == "IND/09/2026/901"
        assert data["model_id"] is not None
        assert Decimal(str(data["max_capacity"])) == Decimal("100.000000")

    def test_create_instrument_model_duplicate_rejected(self, client: TestClient, seed_data: dict, auth_headers):
        """Duplicate model approval numbers must be rejected with 409 Conflict."""
        headers = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
        )
        payload = {
            "category": "NAWI",
            "subtype": "COUNTER_MACHINE_ELECTRONIC",
            "manufacturer_name": "National Scales Ltd",
            "model_name": "NS-15-DIGITAL",
            "model_approval_number": "IND/09/2024/491",  # Already in seed_data
            "accuracy_class": "CLASS_III",
            "verification_scale_interval_e": "0.005000",
            "scale_interval_unit": "kg",
            "min_capacity": "0.100000",
            "max_capacity": "15.000000",
            "capacity_unit": "kg",
        }
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/models",
            json=payload,
            headers=headers,
        )
        assert res.status_code == 409
        data = res.json()
        assert data["error_code"] == "DUPLICATE_MODEL_APPROVAL"

    def test_register_instrument_unit_happy_path(self, client: TestClient, seed_data: dict, auth_headers):
        """Owner registers a new physical instrument unit at their facility."""
        headers = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        payload = {
            "jurisdiction_id": seed_data["jurisdiction_id"],
            "model_id": seed_data["model_id"],
            "owner_id": seed_data["stakeholder_id"],
            "facility_id": seed_data["facility_id"],
            "serial_number": "SN-2026-DEL-0091",
            "year_of_manufacture": 2026,
            "intended_use": "Commercial grocery weighment",
            "installation_location_notes": "Billing Counter #1",
        }
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json=payload,
            headers=headers,
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["instrument_id"] is not None
        assert data["serial_number"] == "SN-2026-DEL-0091"
        assert data["current_status"] == "DRAFT"
        assert data["public_instrument_token"].startswith("inst_")

    def test_register_instrument_duplicate_serial_rejected(self, client: TestClient, seed_data: dict, auth_headers):
        """Same model and serial number cannot be registered twice in the same tenant."""
        headers = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        payload = {
            "jurisdiction_id": seed_data["jurisdiction_id"],
            "model_id": seed_data["model_id"],
            "owner_id": seed_data["stakeholder_id"],
            "facility_id": seed_data["facility_id"],
            "serial_number": "SN-DUPLICATE-TEST-001",
            "year_of_manufacture": 2026,
        }
        res1 = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json=payload,
            headers=headers,
        )
        assert res1.status_code == 201

        # Second registration attempt
        res2 = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json=payload,
            headers=headers,
        )
        assert res2.status_code == 409
        assert res2.json()["error_code"] == "DUPLICATE_INSTRUMENT_SERIAL"

    def test_get_and_list_instruments(self, client: TestClient, seed_data: dict, auth_headers):
        """Fetch instrument details and list with pagination."""
        headers = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
        )
        # 1. Register instrument
        reg_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-LIST-TEST-101",
                "year_of_manufacture": 2025,
            },
            headers=headers,
        )
        inst_id = reg_res.json()["instrument_id"]

        # 2. Get instrument by ID
        get_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/{inst_id}",
            headers=headers,
        )
        assert get_res.status_code == 200
        inst_data = get_res.json()
        assert inst_data["serial_number"] == "SN-LIST-TEST-101"
        assert inst_data["model"]["model_name"] == "NS-15-DIGITAL"

        # 3. List instruments
        list_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments?page=1&page_size=10",
            headers=headers,
        )
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert list_data["total"] >= 1
        assert any(i["instrument_id"] == inst_id for i in list_data["items"])
