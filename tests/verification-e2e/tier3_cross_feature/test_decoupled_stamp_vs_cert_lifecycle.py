"""Tier 3 Cross-Feature & Security Invariants: Decoupled Physical Stamping vs Digital Certificate Lifecycle.
"""

from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestDecoupledStampVsCertLifecycle:
    """Security Invariant test suite verifying that physical stamping is strictly decoupled from digital certificates."""

    @pytest.fixture
    def test_setup(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture creating instrument, application, and session."""
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
                "serial_number": f"SN-DECOUPLE-{datetime.now().microsecond}",
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
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": "REC-DEC-01"}, headers=owner_hdr)

        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]
        return {"instrument_id": inst_id, "session_id": sess_id}

    def test_physical_stamping_without_certificate_issuance(
        self, client: TestClient, seed_data: dict, auth_headers, test_setup: dict
    ):
        """Physical stamping can be completed and recorded even if digital certificate is not yet issued."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        sess_id = test_setup["session_id"]
        inst_id = test_setup["instrument_id"]

        # Record physical stamp
        stamp_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
            json={
                "action_type": "SEAL_APPLIED",
                "seal_type": "LEAD_WIRE_SEAL",
                "seal_identification_number": "DEL-PHYSICAL-ONLY-01",
                "seal_position": "JUNCTION_BOX",
                "notes": "Physical seal crimped at site prior to certification generation.",
            },
            headers=lmo_hdr,
        )
        assert stamp_res.status_code == 201

        # Check instrument stamp history contains stamp
        inst_stamps_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/{inst_id}/stamps",
            headers=lmo_hdr,
        )
        assert inst_stamps_res.status_code == 200
        stamps = inst_stamps_res.json()
        assert len(stamps) == 1
        assert stamps[0]["seal_identification_number"] == "DEL-PHYSICAL-ONLY-01"

        # Check instrument has NO active certificate yet
        inst_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/{inst_id}",
            headers=lmo_hdr,
        )
        assert inst_res.status_code == 200
        assert inst_res.json()["latest_certificate_id"] is None

    def test_certificate_revocation_preserves_physical_stamp_history(
        self, client: TestClient, seed_data: dict, auth_headers, test_setup: dict
    ):
        """Revoking a digital certificate does NOT delete or alter physical stamp records in the ledger."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        supervisor_hdr = auth_headers(
            user_id=seed_data["supervisor_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.SUPERVISOR,
        )
        sess_id = test_setup["session_id"]
        inst_id = test_setup["instrument_id"]

        # 1. Record physical stamp
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
            json={
                "action_type": "SEAL_APPLIED",
                "seal_type": "LEAD_WIRE_SEAL",
                "seal_identification_number": "DEL-SEAL-REV-PRESERVE",
                "seal_position": "PORT_A",
            },
            headers=lmo_hdr,
        )

        # 2. Observations and passing disposition
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations",
            json={
                "reference_standard_ids": seed_data["standard_ids"],
                "observations": [
                    {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                    {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "15.000000", "load_unit": "kg", "raw_indication_reading": "15.000000", "reading_unit": "kg"},
                ],
            },
            headers=lmo_hdr,
        )
        client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition", json={"outcome": "Verification passed — pending authorization"}, headers=lmo_hdr)

        # 3. Issue certificate
        cert_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/issue",
            json={"session_id": sess_id},
            headers=lmo_hdr,
        )
        cert_id = cert_res.json()["certificate_id"]

        # 4. Revoke certificate
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/certificates/{cert_id}/status",
            json={"action": "REVOKE", "reason": "Administrative revocation"},
            headers=supervisor_hdr,
        )

        # 5. Check physical stamps still exist and intact
        stamps_res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/{inst_id}/stamps",
            headers=lmo_hdr,
        )
        assert stamps_res.status_code == 200
        stamps = stamps_res.json()
        assert len(stamps) == 1
        assert stamps[0]["seal_identification_number"] == "DEL-SEAL-REV-PRESERVE"

    def test_multiple_stamp_actions_append_only(
        self, client: TestClient, seed_data: dict, auth_headers, test_setup: dict
    ):
        """Sequential physical stamp applications create distinct immutable entries in stamp ledger."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        sess_id = test_setup["session_id"]
        inst_id = test_setup["instrument_id"]

        for i in range(1, 4):
            client.post(
                f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/stamps",
                json={
                    "action_type": "SEAL_APPLIED",
                    "seal_type": "LEAD_WIRE_SEAL",
                    "seal_identification_number": f"DEL-MULTI-SEAL-{i}",
                    "seal_position": f"LOCATION_{i}",
                },
                headers=lmo_hdr,
            )

        res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments/{inst_id}/stamps",
            headers=lmo_hdr,
        )
        assert res.status_code == 200
        assert len(res.json()) == 3
