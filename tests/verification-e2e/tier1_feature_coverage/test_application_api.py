"""Tier 1 Feature Coverage: Verification Application Scrutiny, Query/Correction, Fee & Scheduling Endpoints.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestApplicationFeatureAPI:
    """E2E Test Suite: Comprehensive Feature Coverage for Application Lifecycle."""

    @pytest.fixture
    def test_instrument(self, client: TestClient, seed_data: dict, auth_headers) -> str:
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
                "serial_number": f"SN-APP-T1-{datetime.now().microsecond}",
                "year_of_manufacture": 2026,
            },
            headers=headers,
        )
        assert res.status_code == 201
        return res.json()["instrument_id"]

    def test_application_draft_and_submission(
        self, client: TestClient, seed_data: dict, auth_headers, test_instrument: str
    ):
        """Trader submits initial verification application with declaration."""
        headers = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        payload = {
            "instrument_id": test_instrument,
            "applicant_id": seed_data["stakeholder_id"],
            "application_type": "INITIAL_VERIFICATION",
            "service_mode": "ON_SITE",
            "preferred_verification_date": "2026-09-15",
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
        self, client: TestClient, seed_data: dict, auth_headers, test_instrument: str
    ):
        """LMO scrutinizes and formally accepts valid verification application."""
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
        # Create
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": test_instrument,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = create_res.json()["application_id"]

        # Scrutinize -> Accept
        scrutiny_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "ACCEPT", "notes": "Model approval certificate and trader GSTIN verified."},
            headers=lmo_hdr,
        )
        assert scrutiny_res.status_code == 200
        app_data = scrutiny_res.json()
        assert app_data["current_status"] == "ACCEPTED"
        assert "trader GSTIN verified" in app_data["scrutiny_notes"]

    def test_application_scrutiny_query_and_correction_cycle(
        self, client: TestClient, seed_data: dict, auth_headers, test_instrument: str
    ):
        """LMO raises query -> Trader submits correction (v2) -> LMO accepts."""
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
        # Create
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": test_instrument,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = create_res.json()["application_id"]

        # 1. Raise Query
        query_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "QUERY", "query_text": "Please provide clearer image of serial number plate."},
            headers=lmo_hdr,
        )
        assert query_res.status_code == 200
        assert query_res.json()["current_status"] == "QUERY_RAISED"
        assert query_res.json()["active_query"] == "Please provide clearer image of serial number plate."

        # 2. Submit Correction
        corr_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/correction",
            json={"correction_notes": "Uploaded high-resolution image of serial plate."},
            headers=owner_hdr,
        )
        assert corr_res.status_code == 200
        assert corr_res.json()["current_status"] == "CORRECTION_SUBMITTED"
        assert corr_res.json()["version"] == 2

        # 3. Accept after correction
        accept_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "ACCEPT", "notes": "Serial plate image is clear and matches model IND/09/2024/491."},
            headers=lmo_hdr,
        )
        assert accept_res.status_code == 200
        assert accept_res.json()["current_status"] == "ACCEPTED"

    def test_application_scrutiny_reject(
        self, client: TestClient, seed_data: dict, auth_headers, test_instrument: str
    ):
        """LMO rejects invalid or fraudulent application."""
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
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": test_instrument,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = create_res.json()["application_id"]

        rej_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny",
            json={"action": "REJECT", "rejection_reason": "Model approval certificate has expired or revoked."},
            headers=lmo_hdr,
        )
        assert rej_res.status_code == 200
        assert rej_res.json()["current_status"] == "REJECTED"
        assert rej_res.json()["rejection_reason"] == "Model approval certificate has expired or revoked."

    def test_fee_assessment_and_payment_reconciliation(
        self, client: TestClient, seed_data: dict, auth_headers, test_instrument: str
    ):
        """LMO assesses statutory fee and trader reconciles payment receipt."""
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
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": test_instrument,
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

        # 1. Fee Assessment
        fee_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee",
            json={
                "base_verification_fee": "750.00",
                "user_charge": "50.00",
                "late_fee": "100.00",
                "policy_version": "POL-DELHI-2026.1",
            },
            headers=lmo_hdr,
        )
        assert fee_res.status_code == 200
        fee_data = fee_res.json()
        assert fee_data["current_status"] == "FEE_PENDING"
        assert Decimal(str(fee_data["fee_assessment"]["total_assessed_amount"])) == Decimal("900.00")

        # 2. Payment Reconciliation
        pay_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay",
            json={"receipt_number": "TREASURY-CHALLAN-88992", "payment_gateway_ref": "TXN_77189"},
            headers=owner_hdr,
        )
        assert pay_res.status_code == 200
        pay_data = pay_res.json()
        assert pay_data["current_status"] == "FEE_PAID"
        assert pay_data["fee_assessment"]["payment_status"] == "SUCCESS"

    def test_application_scheduling_slot(
        self, client: TestClient, seed_data: dict, auth_headers, test_instrument: str
    ):
        """LMO schedules appointment slot and assigns verifying officer."""
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
        create_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": test_instrument,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = create_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-SCHED-01"}, headers=owner_hdr)

        # Schedule
        now = datetime.now(timezone.utc)
        start_time = now + timedelta(days=3)
        end_time = start_time + timedelta(hours=3)
        sched_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/schedule",
            json={
                "slot_start": start_time.isoformat(),
                "slot_end": end_time.isoformat(),
                "assigned_lmo_id": seed_data["lmo_user_id"],
            },
            headers=lmo_hdr,
        )
        assert sched_res.status_code == 200
        data = sched_res.json()
        assert data["current_status"] == "SCHEDULED"
        assert data["assigned_lmo_id"] == seed_data["lmo_user_id"]
