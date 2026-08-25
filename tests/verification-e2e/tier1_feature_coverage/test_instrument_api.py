"""Tier 1 Feature Coverage: Instrument Model Approval & Physical Unit Registration Endpoints.
"""

from __future__ import annotations

from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestInstrumentFeatureAPI:
    """E2E Test Suite: Comprehensive Feature Coverage for Instrument Management."""

    def test_create_instrument_model_with_metrological_parameters(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Officer registers a new approved instrument model with exact metrology specs."""
        headers = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
        )
        payload = {
            "category": "NAWI",
            "subtype": "ELECTRONIC_PLATFORM_SCALE",
            "manufacturer_name": "Precision Weighing Systems India Pvt Ltd",
            "model_name": "PWS-300-HD",
            "model_approval_number": "IND/09/2026/771",
            "accuracy_class": "CLASS_III",
            "verification_scale_interval_e": "0.100000",
            "scale_interval_unit": "kg",
            "min_capacity": "2.000000",
            "max_capacity": "300.000000",
            "capacity_unit": "kg",
            "number_of_intervals_n": 3000,
            "specifications": {
                "platform_size": "800x800mm",
                "load_cell_type": "IP67 Stainless Steel",
                "display": "7-segment LED",
            },
        }
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/models",
            json=payload,
            headers=headers,
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["model_approval_number"] == "IND/09/2026/771"
        assert data["model_id"] is not None
        assert Decimal(str(data["max_capacity"])) == Decimal("300.000000")
        assert Decimal(str(data["min_capacity"])) == Decimal("2.000000")
        assert Decimal(str(data["verification_scale_interval_e"])) == Decimal("0.100000")
        assert data["number_of_intervals_n"] == 3000
        assert data["specifications"]["load_cell_type"] == "IP67 Stainless Steel"

    def test_create_instrument_model_duplicate_approval_rejected(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Duplicate model approval numbers must be rejected with 409 DUPLICATE_MODEL_APPROVAL."""
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
            "model_approval_number": "IND/09/2024/491",  # Seeded model
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

    def test_register_instrument_unit_happy_path(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Owner registers a new physical instrument unit with full provenance."""
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
            "serial_number": "SN-T1-INST-001",
            "year_of_manufacture": 2026,
            "intended_use": "Commercial grocery weighment",
            "installation_location_notes": "Main Billing Counter #2",
        }
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json=payload,
            headers=headers,
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["instrument_id"] is not None
        assert data["serial_number"] == "SN-T1-INST-001"
        assert data["current_status"] == "DRAFT"
        assert data["public_instrument_token"].startswith("inst_")
        assert data["year_of_manufacture"] == 2026

    def test_register_instrument_duplicate_serial_rejected(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Registering identical serial number for same model in same tenant returns 409 Conflict."""
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
            "serial_number": "SN-DUP-CHECK-999",
            "year_of_manufacture": 2026,
        }
        # First registration
        res1 = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json=payload,
            headers=headers,
        )
        assert res1.status_code == 201

        # Duplicate registration
        res2 = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json=payload,
            headers=headers,
        )
        assert res2.status_code == 409
        assert res2.json()["error_code"] == "DUPLICATE_INSTRUMENT_SERIAL"

    def test_get_and_list_instruments_with_pagination(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Fetch instrument details by ID and list all instruments with pagination."""
        headers = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
        )
        # Register an instrument
        reg_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-PAGE-TEST-881",
                "year_of_manufacture": 2025,
            },
            headers=headers,
        )
        inst_id = reg_res.json()["instrument_id"]

        # Fetch by ID
        get_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/{inst_id}",
            headers=headers,
        )
        assert get_res.status_code == 200
        inst_data = get_res.json()
        assert inst_data["instrument_id"] == inst_id
        assert inst_data["serial_number"] == "SN-PAGE-TEST-881"
        assert inst_data["model"]["model_name"] == "NS-15-DIGITAL"

        # List instruments with pagination
        list_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments?page=1&page_size=20",
            headers=headers,
        )
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert list_data["total"] >= 1
        assert any(i["instrument_id"] == inst_id for i in list_data["items"])

    def test_cross_tenant_instrument_access_blocked(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """User from IN-DL cannot access instrument records in IN-MH."""
        dl_headers = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        res = client.get(
            f"/api/v1/tenants/IN-MH/instruments",
            headers=dl_headers,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "TENANT_ACCESS_DENIED"
