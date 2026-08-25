"""Tier 4 Real-World Scenario 5: Expired Standard Blocking & Valid Standard Recovery Flow.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.reference_standard import CustodianTypeEnum, ReferenceStandard, ReferenceStandardStatusEnum
from app.models.stakeholder import RoleEnum


class TestExpiredStandardBlockingAndRecoveryFlow:
    """End-to-End multi-actor test: Expired standard fail-closed blocking -> Standard replacement -> Verification recovery."""

    @pytest.fixture
    def standards_setup(self, db_session: Session, seed_data: dict) -> dict:
        """Seed expired standard weight and valid newly calibrated standard weight."""
        now_utc = datetime.now(timezone.utc)
        # Expired standard (expired 15 days ago)
        std_expired = ReferenceStandard(
            standard_id="std_m1_expired_5kg",
            tenant_id=seed_data["tenant_id"],
            custodian_type=CustodianTypeEnum.LMO_OFFICE,
            custodian_id=seed_data["jurisdiction_id"],
            asset_tag="STD-M1-EXP-5KG",
            denomination_mass=Decimal("5.000000"),
            mass_unit="kg",
            accuracy_class="M1",
            serial_number="EXP-5K-001",
            calibration_certificate_number="CAL/OLD/2025/001",
            calibrating_laboratory="National Physical Laboratory (NPL India)",
            calibrated_at=now_utc - timedelta(days=380),
            valid_until=now_utc - timedelta(days=15),
            expanded_uncertainty=Decimal("0.000025"),
            calibration_status=ReferenceStandardStatusEnum.EXPIRED,
        )
        # Fresh valid standard
        std_fresh = ReferenceStandard(
            standard_id="std_m1_fresh_5kg",
            tenant_id=seed_data["tenant_id"],
            custodian_type=CustodianTypeEnum.LMO_OFFICE,
            custodian_id=seed_data["jurisdiction_id"],
            asset_tag="STD-M1-FRESH-5KG",
            denomination_mass=Decimal("5.000000"),
            mass_unit="kg",
            accuracy_class="M1",
            serial_number="FRESH-5K-001",
            calibration_certificate_number="CAL/NPL/2026/8901",
            calibrating_laboratory="National Physical Laboratory (NPL India)",
            calibrated_at=now_utc - timedelta(days=10),
            valid_until=now_utc + timedelta(days=355),
            expanded_uncertainty=Decimal("0.000025"),
            calibration_status=ReferenceStandardStatusEnum.ACTIVE,
        )
        db_session.add_all([std_expired, std_fresh])
        db_session.commit()

        return {
            "expired_id": "std_m1_expired_5kg",
            "fresh_id": "std_m1_fresh_5kg",
        }

    def test_expired_standard_fail_closed_blocking_and_recovery(
        self, client: TestClient, seed_data: dict, auth_headers, standards_setup: dict
    ):
        """Verifier attempts test with expired standard -> fails closed -> opens fresh session with valid standard -> passes."""
        tenant_id = seed_data["tenant_id"]
        jur_id = seed_data["jurisdiction_id"]

        trader_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.LMO,
            jurisdiction_id=jur_id,
        )

        # 1. Register instrument
        inst_res = client.post(
            f"/api/v1/tenants/{tenant_id}/instruments",
            json={
                "jurisdiction_id": jur_id,
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": f"SN-EXP-REC-{datetime.now().microsecond}",
                "year_of_manufacture": 2026,
            },
            headers=trader_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        # 2. Application & Schedule
        app_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=trader_hdr,
        )
        app_id = app_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/pay", json={"receipt_number": "REC-EXP-01"}, headers=trader_hdr)

        # 3. Session 1 initialization
        sess1_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess1_id = sess1_res.json()["session_id"]
        client.post(f"/api/v1/tenants/{tenant_id}/sessions/{sess1_id}/identity?serial_verified=true", headers=lmo_hdr)

        # -------------------------------------------------------------
        # STEP A: Verifier tests using EXPIRED standard weight
        # -------------------------------------------------------------
        obs_payload_expired = {
            "reference_standard_ids": [standards_setup["expired_id"]],
            "observations": [
                {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "5.000000", "load_unit": "kg", "raw_indication_reading": "5.000000", "reading_unit": "kg"},
            ],
        }
        res_exp = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess1_id}/observations",
            json=obs_payload_expired,
            headers=lmo_hdr,
        )
        assert res_exp.status_code == 200
        assert res_exp.json()["automated_evaluation_flag"] is False

        # Attempt to record passing disposition must be blocked
        disp_block_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess1_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )
        assert disp_block_res.status_code == 422
        assert disp_block_res.json()["error_code"] == "GUARD_CONDITION_FAILED"

        # Record incomplete / failed disposition for Session 1
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess1_id}/disposition",
            json={"outcome": "Incomplete verification", "disposition_notes": "Reference standard expired. Testing halted."},
            headers=lmo_hdr,
        )

        # -------------------------------------------------------------
        # STEP B: Verifier recovers by conducting Session 2 with VALID standard
        # -------------------------------------------------------------
        sess2_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess2_id = sess2_res.json()["session_id"]
        client.post(f"/api/v1/tenants/{tenant_id}/sessions/{sess2_id}/identity?serial_verified=true", headers=lmo_hdr)

        obs_payload_fresh = {
            "reference_standard_ids": [standards_setup["fresh_id"]],
            "observations": [
                {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "5.000000", "load_unit": "kg", "raw_indication_reading": "5.000000", "reading_unit": "kg"},
            ],
        }
        res_fresh = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess2_id}/observations",
            json=obs_payload_fresh,
            headers=lmo_hdr,
        )
        assert res_fresh.status_code == 200
        assert res_fresh.json()["automated_evaluation_flag"] is True

        # Pass disposition now succeeds
        disp_pass_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess2_id}/disposition",
            json={"outcome": "Verification passed — pending authorization", "disposition_notes": "Retested with calibrated standard NPL/2026/8901."},
            headers=lmo_hdr,
        )
        assert disp_pass_res.status_code == 200
        assert disp_pass_res.json()["status"] == "FINALIZED"

        # Certificate issued successfully
        cert_res = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/issue",
            json={"session_id": sess2_id},
            headers=lmo_hdr,
        )
        assert cert_res.status_code == 201
        assert cert_res.json()["certificate_status"] == "ISSUED"
