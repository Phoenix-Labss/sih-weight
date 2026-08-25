"""Phase 3 Test Suite: Reference Standards Lifecycle, Calibration, and Impact Review.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.reference_standard import CustodianTypeEnum, ReferenceStandardStatusEnum
from app.models.stakeholder import RoleEnum


class TestReferenceStandardsLifecycle:
    """Reference standard tests."""

    def test_standard_registration_and_recalibration(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        tenant_id = seed_data["tenant_id"]
        lmo_user_id = seed_data["lmo_user_id"]
        headers_lmo = auth_headers(user_id=lmo_user_id, tenant_id=tenant_id, role=RoleEnum.LMO)

        now_utc = datetime.now(timezone.utc)
        cal_at = now_utc - timedelta(days=30)
        val_until = now_utc + timedelta(days=335)

        asset_tag = f"TAG-M1-{uuid.uuid4().hex[:6].upper()}"
        payload = {
            "custodian_type": "DEPARTMENTAL_LAB",
            "custodian_id": seed_data["jurisdiction_id"],
            "asset_tag": asset_tag,
            "denomination_mass": "20.000",
            "mass_unit": "kg",
            "accuracy_class": "M1",
            "serial_number": f"SN-MASS-{uuid.uuid4().hex[:6].upper()}",
            "calibration_certificate_number": f"CAL-NPL-2026-{uuid.uuid4().hex[:4].upper()}",
            "calibrating_laboratory": "National Physical Laboratory (NPL India)",
            "calibrated_at": cal_at.isoformat(),
            "valid_until": val_until.isoformat(),
            "expanded_uncertainty": "0.00010000",
        }

        resp = client.post(
            f"/api/v1/tenants/{tenant_id}/reference-standards",
            json=payload,
            headers=headers_lmo,
        )
        assert resp.status_code == 201, resp.text
        std_data = resp.json()
        standard_id = std_data["standard_id"]
        assert std_data["calibration_status"] == "ACTIVE"
        assert std_data["asset_tag"] == asset_tag

        # Recalibrate
        new_cal_at = now_utc
        new_val_until = now_utc + timedelta(days=365)
        recal_payload = {
            "certificate_number": f"CAL-NPL-2027-{uuid.uuid4().hex[:4].upper()}",
            "calibrated_at": new_cal_at.isoformat(),
            "valid_until": new_val_until.isoformat(),
            "calibrating_lab": "NPL Regional Laboratory Mumbai",
            "expanded_uncertainty": "0.00009500",
        }
        resp_recal = client.post(
            f"/api/v1/tenants/{tenant_id}/reference-standards/{standard_id}/recalibrate",
            json=recal_payload,
            headers=headers_lmo,
        )
        assert resp_recal.status_code == 200, resp_recal.text
        assert resp_recal.json()["calibration_certificate_number"] == recal_payload["certificate_number"]

    def test_standard_quarantine_with_impact_review(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        tenant_id = seed_data["tenant_id"]
        lmo_user_id = seed_data["lmo_user_id"]
        headers_lmo = auth_headers(user_id=lmo_user_id, tenant_id=tenant_id, role=RoleEnum.LMO)

        now_utc = datetime.now(timezone.utc)
        cal_at = now_utc - timedelta(days=60)
        val_until = now_utc + timedelta(days=300)

        # Create standard first
        asset_tag = f"TAG-M1-Q-{uuid.uuid4().hex[:6].upper()}"
        resp_std = client.post(
            f"/api/v1/tenants/{tenant_id}/reference-standards",
            json={
                "custodian_type": "DEPARTMENTAL_LAB",
                "custodian_id": seed_data["jurisdiction_id"],
                "asset_tag": asset_tag,
                "denomination_mass": "10.000",
                "mass_unit": "kg",
                "accuracy_class": "M1",
                "serial_number": f"SN-MASS-Q-{uuid.uuid4().hex[:6].upper()}",
                "calibration_certificate_number": f"CAL-NPL-Q-{uuid.uuid4().hex[:4].upper()}",
                "calibrating_laboratory": "National Physical Laboratory",
                "calibrated_at": cal_at.isoformat(),
                "valid_until": val_until.isoformat(),
                "expanded_uncertainty": "0.00010000",
            },
            headers=headers_lmo,
        )
        assert resp_std.status_code == 201, resp_std.text
        standard_id = resp_std.json()["standard_id"]

        quarantine_payload = {
            "reason": "Mass deviation beyond M1 tolerance detected during periodic inter-comparison.",
            "initiate_impact_review": True,
        }

        resp = client.post(
            f"/api/v1/tenants/{tenant_id}/reference-standards/{standard_id}/quarantine",
            json=quarantine_payload,
            headers=headers_lmo,
        )
        assert resp.status_code == 200, resp.text
        q_data = resp.json()
        assert q_data["status"] == "QUARANTINED"
        assert q_data["impact_review_initiated"] is True
        assert "affected_sessions_count" in q_data
