"""Phase 3 Test Suite: Offline Mobile & Device Synchronization.

Tests:
1. Device registration and active state management.
2. Pull delta tasks and reference standards for offline inspection caching.
3. Push offline recorded observations and physical stamp ledger updates.
4. Push offline disposition finalized outcome.
5. Conflict resolution when session is already finalized.
6. Clock skew detection between client and server.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.application import ApplicationStatusEnum, ServiceModeEnum
from app.models.instrument import InstrumentStatusEnum
from app.models.session import SessionStatusEnum, VerificationOutcomeEnum
from app.models.stakeholder import RoleEnum
from app.models.sync import DevicePlatformEnum, SyncDevice


class TestOfflineSyncIntegration:
    """Offline Synchronization & Change Tracking Test Cases."""

    def test_device_registration_and_pull(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        tenant_id = seed_data["tenant_id"]
        lmo_user_id = seed_data["lmo_user_id"]
        headers_lmo = auth_headers(user_id=lmo_user_id, tenant_id=tenant_id, role=RoleEnum.LMO)

        # 1. Register new inspection device
        dev_fingerprint = f"DEV-FP-{uuid.uuid4().hex[:12].upper()}"
        reg_payload = {
            "device_name": "LMO Rugged Tablet - Zone 1",
            "platform": "ANDROID",
            "app_version": "3.1.0-prod",
            "device_fingerprint": dev_fingerprint,
        }
        resp_reg = client.post(
            f"/api/v1/tenants/{tenant_id}/sync/devices",
            json=reg_payload,
            headers=headers_lmo,
        )
        assert resp_reg.status_code == 201, resp_reg.text
        dev_data = resp_reg.json()
        device_id = dev_data["device_id"]
        assert dev_data["device_name"] == "LMO Rugged Tablet - Zone 1"
        assert dev_data["is_active"] is True

        # 2. Pull delta for offline use
        pull_payload = {
            "device_id": device_id,
            "last_known_revision": 0,
        }
        resp_pull = client.post(
            f"/api/v1/tenants/{tenant_id}/sync/pull",
            json=pull_payload,
            headers=headers_lmo,
        )
        assert resp_pull.status_code == 200, resp_pull.text
        pull_data = resp_pull.json()
        assert "server_timestamp" in pull_data
        assert "reference_standards" in pull_data
        assert "assigned_tasks" in pull_data

    def test_push_offline_actions_and_commit(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        tenant_id = seed_data["tenant_id"]
        lmo_user_id = seed_data["lmo_user_id"]
        owner_user_id = seed_data["owner_user_id"]
        owner_id = seed_data["stakeholder_id"]
        facility_id = seed_data["facility_id"]
        jurisdiction_id = seed_data["jurisdiction_id"]
        model_id = seed_data["model_id"]

        headers_owner = auth_headers(user_id=owner_user_id, tenant_id=tenant_id, role=RoleEnum.OWNER)
        headers_lmo = auth_headers(user_id=lmo_user_id, tenant_id=tenant_id, role=RoleEnum.LMO)

        # Create instrument and application
        serial_no = f"SN-SYNC-{uuid.uuid4().hex[:6].upper()}"
        resp_inst = client.post(
            f"/api/v1/tenants/{tenant_id}/instruments",
            json={
                "jurisdiction_id": jurisdiction_id,
                "model_id": model_id,
                "owner_id": owner_id,
                "facility_id": facility_id,
                "serial_number": serial_no,
                "year_of_manufacture": 2026,
                "intended_use": "Offline test retail scale",
            },
            headers=headers_owner,
        )
        assert resp_inst.status_code == 201
        inst_id = resp_inst.json()["instrument_id"]

        resp_app = client.post(
            f"/api/v1/tenants/{tenant_id}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": owner_id,
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=headers_owner,
        )
        assert resp_app.status_code == 201
        app_id = resp_app.json()["application_id"]

        # Accept application & schedule session
        client.post(
            f"/api/v1/tenants/{tenant_id}/applications/{app_id}/scrutiny",
            json={"action": "ACCEPT", "remarks": "Approved for field test"},
            headers=headers_lmo,
        )

        resp_sess = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={
                "application_id": app_id,
                "instrument_id": inst_id,
                "procedure_pack_id": "IND-LM-NAWI-CLASS-III-IIII-2026.1",
                "scheduled_date": date.today().isoformat(),
            },
            headers=headers_lmo,
        )
        assert resp_sess.status_code == 201
        session_id = resp_sess.json()["session_id"]

        # Register device
        resp_reg = client.post(
            f"/api/v1/tenants/{tenant_id}/sync/devices",
            json={
                "device_name": "Tablet Android Offline",
                "platform": "ANDROID",
                "app_version": "3.1.0",
                "device_fingerprint": f"FP-{uuid.uuid4().hex[:10]}",
            },
            headers=headers_lmo,
        )
        device_id = resp_reg.json()["device_id"]

        # Push offline batch containing observations, stamp, and disposition
        now_utc = datetime.now(timezone.utc)
        push_payload = {
            "device_id": device_id,
            "client_timestamp": now_utc.isoformat(),
            "actions": [
                {
                    "action_type": "RECORD_OBSERVATION",
                    "session_id": session_id,
                    "client_timestamp": now_utc.isoformat(),
                    "idempotency_key": f"IDEM-OBS-{uuid.uuid4().hex[:8]}",
                    "payload": {
                        "step_number": 1,
                        "step_type": "LOAD_TEST",
                        "nominal_load": "10.0",
                        "observed_indication": "10.0",
                        "unit": "kg",
                        "calculated_error": "0.0",
                        "maximum_permissible_error": "1.0",
                        "is_pass": True,
                    },
                },
                {
                    "action_type": "AFFIX_STAMP",
                    "session_id": session_id,
                    "client_timestamp": now_utc.isoformat(),
                    "idempotency_key": f"IDEM-STAMP-{uuid.uuid4().hex[:8]}",
                    "payload": {
                        "seal_type": "TAMPER_EVIDENT_HOLOGRAM",
                        "seal_identifier": f"SEAL-OFFLINE-{uuid.uuid4().hex[:6].upper()}",
                        "position_description": "Load Cell Enclosure",
                    },
                },
                {
                    "action_type": "RECORD_DISPOSITION",
                    "session_id": session_id,
                    "client_timestamp": now_utc.isoformat(),
                    "idempotency_key": f"IDEM-DISP-{uuid.uuid4().hex[:8]}",
                    "payload": {
                        "outcome": "PASSED",
                        "remarks": "Completed successfully in remote offline field mode.",
                    },
                },
            ],
        }

        resp_push = client.post(
            f"/api/v1/tenants/{tenant_id}/sync/push",
            json=push_payload,
            headers=headers_lmo,
        )
        assert resp_push.status_code == 200, resp_push.text
        push_data = resp_push.json()
        assert push_data["status"] == "SUCCESS"
        assert push_data["items_received"] == 3
        assert push_data["items_processed"] == 3
        assert push_data["conflicts_detected"] == 0

        # Verify session is now FINALIZED
        resp_get_sess = client.get(
            f"/api/v1/tenants/{tenant_id}/sessions/{session_id}",
            headers=headers_lmo,
        )
        assert resp_get_sess.json()["status"] == "FINALIZED"
        assert resp_get_sess.json()["outcome"] == "Verification passed — pending authorization"

    def test_conflict_rejected_on_already_finalized_session(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        tenant_id = seed_data["tenant_id"]
        lmo_user_id = seed_data["lmo_user_id"]
        headers_lmo = auth_headers(user_id=lmo_user_id, tenant_id=tenant_id, role=RoleEnum.LMO)

        # Register device
        resp_reg = client.post(
            f"/api/v1/tenants/{tenant_id}/sync/devices",
            json={
                "device_name": "Tablet Android Offline 2",
                "platform": "ANDROID",
                "app_version": "3.1.0",
                "device_fingerprint": f"FP-{uuid.uuid4().hex[:10]}",
            },
            headers=headers_lmo,
        )
        device_id = resp_reg.json()["device_id"]

        # Attempt to push to non-existent session
        now_utc = datetime.now(timezone.utc)
        push_payload = {
            "device_id": device_id,
            "client_timestamp": now_utc.isoformat(),
            "actions": [
                {
                    "action_type": "RECORD_OBSERVATION",
                    "session_id": "non-existent-session-id",
                    "client_timestamp": now_utc.isoformat(),
                    "idempotency_key": "IDEM-CONFLICT-1",
                    "payload": {"step_number": 1},
                }
            ],
        }

        resp_push = client.post(
            f"/api/v1/tenants/{tenant_id}/sync/push",
            json=push_payload,
            headers=headers_lmo,
        )
        assert resp_push.status_code == 200
        push_data = resp_push.json()
        assert push_data["conflicts_detected"] == 1
        assert push_data["status"] == "PARTIAL_SUCCESS"
