import requests
import uuid
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"

HEADERS_OWNER = {
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json"
}
HEADERS_APPLICANT = {
    "X-Actor-Role": "APPLICANT",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json"
}
HEADERS_LMO = {
    "X-Actor-Role": "LMO",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json"
}

TIMEOUT = 30


def test_record_physical_stamp_seal():
    instrument_id = None
    application_id = None
    session_id = None
    try:
        # Step 1: Get approved instrument models (as OWNER)
        resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models",
            headers={k: v for k, v in HEADERS_OWNER.items() if k != "Content-Type"},
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200
        models = resp.json()
        assert isinstance(models, list) and len(models) > 0
        model_id = None
        # Choose model_id as per description MOD-NAWI-01 or MOD-NAWI-03 if present, else first
        for m in models:
            if "model_id" in m and m["model_id"] in ("MOD-NAWI-01", "MOD-NAWI-03"):
                model_id = m["model_id"]
                break
        if not model_id:
            model_id = models[0].get("model_id")
        assert model_id is not None and model_id != ""

        # Step 2: Register instrument (POST instruments) as OWNER
        serial_number = f"SN-{uuid.uuid4().hex[:12]}"
        instrument_payload = {
            "model_id": model_id,
            "serial_number": serial_number
        }
        resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments",
            headers=HEADERS_OWNER,
            json=instrument_payload,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 201
        instrument_resp = resp.json()
        instrument_id = instrument_resp.get("instrument_id")
        assert instrument_id is not None and instrument_id != ""
        assert instrument_resp.get("model_id") == model_id
        assert instrument_resp.get("serial_number") == serial_number

        # Step 3: Create application WITHOUT applicant_declaration_accepted (POST applications) as OWNER
        application_payload = {
            "instrument_id": instrument_id
            # no applicant_declaration_accepted key means starts DRAFT
        }
        resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications",
            headers=HEADERS_OWNER,
            json=application_payload,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 201
        app_resp = resp.json()
        application_id = app_resp.get("application_id")
        assert application_id is not None and application_id != ""
        assert app_resp.get("current_status") == "DRAFT"

        # Step 4: Submit application (POST applications/:id/submit) with empty JSON body as OWNER
        resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit",
            headers=HEADERS_OWNER,
            json={},
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200
        app_submit_resp = resp.json()
        assert app_submit_resp.get("current_status") == "SUBMITTED"

        # Step 5: Scrutiny ACCEPT as LMO
        scrutiny_payload = {"action": "ACCEPT"}
        resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny",
            headers=HEADERS_LMO,
            json=scrutiny_payload,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200
        scrutiny_resp = resp.json()

        # Step 6: Post fee 500 as LMO
        fee_payload = {"base_verification_fee": 500}
        resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee",
            headers=HEADERS_LMO,
            json=fee_payload,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200
        fee_resp = resp.json()

        # Step 7: Pay as OWNER (receipt_number unique)
        receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
        pay_payload = {"receipt_number": receipt_number}
        resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay",
            headers=HEADERS_OWNER,
            json=pay_payload,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200
        pay_resp = resp.json()

        # Step 8: Schedule as LMO, slot_start and slot_end - now + 1 hour window ISO8601
        slot_start_dt = datetime.utcnow() + timedelta(minutes=10)
        slot_end_dt = slot_start_dt + timedelta(minutes=50)
        schedule_payload = {
            "slot_start": slot_start_dt.isoformat(timespec='seconds') + "Z",
            "slot_end": slot_end_dt.isoformat(timespec='seconds') + "Z"
        }
        resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule",
            headers=HEADERS_LMO,
            json=schedule_payload,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200
        schedule_resp = resp.json()

        # Step 9: Create session as LMO with application_id and instrument_id
        session_payload = {
            "application_id": application_id,
            "instrument_id": instrument_id
        }
        resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions",
            headers=HEADERS_LMO,
            json=session_payload,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 201
        session_resp = resp.json()
        session_id = session_resp.get("session_id")
        assert session_id is not None and session_id != ""

        # Step 10: Record physical stamp/seal
        seal_id_number = f"DL-SEAL-2026-{uuid.uuid4().hex[:6].upper()}"
        stamp_payload = {
            "seal_identification_number": seal_id_number,
            "seal_position": "TERMINAL_BLOCK"
        }
        resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/stamps",
            headers=HEADERS_LMO,
            json=stamp_payload,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 201
        stamp_resp = resp.json()
        stamp_action_id = stamp_resp.get("stamp_action_id")
        assert stamp_action_id is not None and stamp_action_id != ""

        # Step 11: GET the same endpoint to check recorded stamps
        resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/stamps",
            headers=HEADERS_LMO,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200
        stamps = resp.json()
        assert isinstance(stamps, list)
        # Ensure the recorded stamp is present in the list
        found = False
        for s in stamps:
            if s.get("stamp_action_id") == stamp_action_id and s.get("seal_identification_number") == seal_id_number and s.get("seal_position") == "TERMINAL_BLOCK":
                found = True
                break
        assert found, "Recorded stamp is not listed in the session stamps"

    finally:
        # Cleanup: delete session if possible
        # No explicit DELETE session endpoint described in PRD, so skipping session deletion

        # Similarly no explicit delete for application or instrument, so no cleanup API calls
        pass

test_record_physical_stamp_seal()