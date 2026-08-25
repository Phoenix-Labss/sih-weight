"""API Integration Tests: Verification Application Scrutiny, Fee Assessment, and Scheduling.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestApplicationAPI:
    """Test suite covering the full statutory application scrutiny and fee lifecycle."""

    @pytest.fixture
    def registered_instrument(self, client: TestClient, seed_data: dict, auth_headers) -> str:
        """Helper fixture creating a registered instrument."""
        headers = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": f"SN-APP-TEST-{datetime.now().microsecond}",
                "year_of_manufacture": 2026,
            },
            headers=headers,
        )
        assert res.status_code == 201
        return res.json()["instrument_id"]

    def test_application_create_and_submit_happy_path(
        self, client: TestClient, seed_data: dict, auth_headers, registered_instrument: str
    ):
        """Trader submits verification application for registered instrument."""
        headers = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        payload = {
            "instrument_id": registered_instrument,
            "applicant_id": seed_data["stakeholder_id"],
            "application_type": "INITIAL_VERIFICATION",
            "service_mode": "ON_SITE",
            "preferred_verification_date": "2026-09-01",
            "applicant_declaration_accepted": True,
        }
        res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json=payload,
            headers=headers,
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["application_id"] is not None
        assert data["application_number"].startswith(f"APP/{seed_data['tenant_id']}/")
        assert data["current_status"] == "SUBMITTED"
        assert data["version"] == 1

    def test_application_scrutiny_accept_flow(
        self, client: TestClient, seed_data: dict, auth_headers, registered_instrument: str
    ):
        """Officer scrutinizes and accepts an application."""
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
        # 1. Create application
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": registered_instrument,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = create_res.json()["application_id"]

        # 2. Scrutinize -> Accept
        scrutiny_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "ACCEPT", "notes": "All required documents verified against model approval."},
            headers=lmo_hdr,
        )
        assert scrutiny_res.status_code == 200
        app_data = scrutiny_res.json()
        assert app_data["current_status"] == "ACCEPTED"
        assert "All required documents verified" in app_data["scrutiny_notes"]

    def test_application_scrutiny_query_and_correction_flow(
        self, client: TestClient, seed_data: dict, auth_headers, registered_instrument: str
    ):
        """Officer raises query -> Trader submits correction -> Officer accepts."""
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
        # 1. Create application
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": registered_instrument,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = create_res.json()["application_id"]

        # 2. Officer raises query
        query_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "QUERY", "query_text": "Please upload clear image of model approval plate."},
            headers=lmo_hdr,
        )
        assert query_res.status_code == 200
        assert query_res.json()["current_status"] == "QUERY_RAISED"
        assert query_res.json()["active_query"] == "Please upload clear image of model approval plate."

        # 3. Applicant responds with correction
        corr_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/correction",
            json={"correction_notes": "Attached high-res photo of manufacturer serial plate IND/09/2024/491."},
            headers=owner_hdr,
        )
        assert corr_res.status_code == 200
        assert corr_res.json()["current_status"] == "CORRECTION_SUBMITTED"
        assert corr_res.json()["version"] == 2

        # 4. Officer accepts after correction
        accept_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "ACCEPT", "notes": "Correction verified, plate legible."},
            headers=lmo_hdr,
        )
        assert accept_res.status_code == 200
        assert accept_res.json()["current_status"] == "ACCEPTED"

    def test_fee_assessment_and_payment_reconciliation(
        self, client: TestClient, seed_data: dict, auth_headers, registered_instrument: str
    ):
        """Fee assessment notice is issued and payment is reconciled."""
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
        # Create and accept application
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": registered_instrument,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = create_res.json()["application_id"]
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "ACCEPT"},
            headers=lmo_hdr,
        )

        # 1. Issue fee assessment
        fee_payload = {
            "base_verification_fee": "500.00",
            "user_charge": "50.00",
            "late_fee": "0.00",
            "policy_version": "POL-DELHI-2026.1",
        }
        fee_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee",
            json=fee_payload,
            headers=lmo_hdr,
        )
        assert fee_res.status_code == 200
        fee_app_data = fee_res.json()
        assert fee_app_data["current_status"] == "FEE_PENDING"
        assert Decimal(str(fee_app_data["fee_assessment"]["total_assessed_amount"])) == Decimal("550.00")

        # 2. Reconcile Payment
        pay_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay",
            json={"receipt_number": "TREASURY-CHALLAN-99201", "payment_gateway_ref": "PG_TXN_8812"},
            headers=owner_hdr,
        )
        assert pay_res.status_code == 200
        pay_app_data = pay_res.json()
        assert pay_app_data["current_status"] == "FEE_PAID"
        assert pay_app_data["fee_assessment"]["payment_status"] == "SUCCESS"

    def test_application_scheduling(
        self, client: TestClient, seed_data: dict, auth_headers, registered_instrument: str
    ):
        """Schedule verification slot and assign officer."""
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
        # Create, accept, assess fee, and pay
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": registered_instrument,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = create_res.json()["application_id"]
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "ACCEPT"},
            headers=lmo_hdr,
        )
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee",
            json={"base_verification_fee": "500.00"},
            headers=lmo_hdr,
        )
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay",
            json={"receipt_number": "REC-12345"},
            headers=owner_hdr,
        )

        # Schedule slot
        now = datetime.now(timezone.utc)
        slot_start = now + timedelta(days=2)
        slot_end = slot_start + timedelta(hours=2)
        sched_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/schedule",
            json={
                "slot_start": slot_start.isoformat(),
                "slot_end": slot_end.isoformat(),
                "assigned_lmo_id": seed_data["lmo_user_id"],
            },
            headers=lmo_hdr,
        )
        assert sched_res.status_code == 200
        sched_data = sched_res.json()
        assert sched_data["current_status"] == "SCHEDULED"
        assert sched_data["assigned_lmo_id"] == seed_data["lmo_user_id"]
