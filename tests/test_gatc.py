"""Phase 3 Test Suite: GATC Center Authorization, Capacity & Scope Checks.
"""

from datetime import datetime, timedelta, timezone
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.stakeholder import RoleEnum


class TestGATCAuthorizationLifecycle:
    """GATC scope enforcement tests."""

    def test_gatc_profile_registration_and_scope_verification(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        tenant_id = seed_data["tenant_id"]
        controller_user_id = seed_data["lmo_user_id"]
        facility_id = seed_data["facility_id"]
        headers_controller = auth_headers(user_id=controller_user_id, tenant_id=tenant_id, role=RoleEnum.CONTROLLER)

        now_utc = datetime.now(timezone.utc)
        payload = {
            "facility_id": facility_id,
            "approval_order_number": f"GATC/DL/2026/{uuid.uuid4().hex[:4].upper()}",
            "approved_scope": {
                "instrument_categories": ["NAWI"],
                "accuracy_classes": ["Class III", "Class IIII"],
                "max_capacity_kg": 30000,
            },
            "valid_from": (now_utc - timedelta(days=10)).isoformat(),
            "valid_to": (now_utc + timedelta(days=720)).isoformat(),
        }

        resp = client.post(
            f"/api/v1/tenants/{tenant_id}/gatc",
            json=payload,
            headers=headers_controller,
        )
        assert resp.status_code == 201, resp.text
        gatc_data = resp.json()
        gatc_id = gatc_data["gatc_id"]

        # Scope Check 1: Valid (Class III, 15000kg <= 30000kg)
        resp_check_pass = client.post(
            f"/api/v1/tenants/{tenant_id}/gatc/{gatc_id}/check-scope",
            json={
                "instrument_category": "NAWI",
                "accuracy_class": "Class III",
                "capacity_kg": 15000.0,
            },
            headers=headers_controller,
        )
        assert resp_check_pass.status_code == 200
        assert resp_check_pass.json()["is_authorized"] is True

        # Scope Check 2: Exceeded capacity (40000kg > 30000kg)
        resp_check_fail = client.post(
            f"/api/v1/tenants/{tenant_id}/gatc/{gatc_id}/check-scope",
            json={
                "instrument_category": "NAWI",
                "accuracy_class": "Class III",
                "capacity_kg": 40000.0,
            },
            headers=headers_controller,
        )
        assert resp_check_fail.status_code == 200
        assert resp_check_fail.json()["is_authorized"] is False
        assert "exceeds" in resp_check_fail.json()["reason"]
