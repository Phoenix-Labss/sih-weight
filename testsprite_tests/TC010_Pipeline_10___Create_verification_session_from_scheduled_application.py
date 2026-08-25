import requests
import uuid
from datetime import datetime
from dateutil import parser

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"
HEADERS_OWNER = {
    "X-Actor-Role": "OWNER",
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


def test_pipeline_10_create_verification_session_from_scheduled_application():
    created_instrument_id = None
    created_application_id = None
    created_session_id = None

    unique_serial = f"SN-{uuid.uuid4().hex[:12]}"
    receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
    slot_start_input = "2026-08-26T09:00:00Z"
    slot_end_input = "2026-08-26T11:00:00Z"

    try:
        # Step 1: GET instrument models as OWNER, find MOD-NAWI-03
        url_models = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
        resp = requests.get(url_models, headers=HEADERS_OWNER, timeout=TIMEOUT)
        resp.raise_for_status()
        models = resp.json()
        model_ids = [m["model_id"] for m in models]
        assert "MOD-NAWI-03" in model_ids, "Model MOD-NAWI-03 not found in models list"

        # Step 2: POST instruments with model_id and unique serial_number as OWNER
        url_instruments = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
        instrument_payload = {"model_id": "MOD-NAWI-03", "serial_number": unique_serial}
        resp = requests.post(url_instruments, headers=HEADERS_OWNER, json=instrument_payload, timeout=TIMEOUT)
        resp.raise_for_status()
        instrument = resp.json()
        created_instrument_id = instrument.get("instrument_id")
        assert created_instrument_id, "instrument_id not returned in instrument creation"

        # Step 3: POST applications with instrument_id as OWNER (create DRAFT)
        url_applications = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
        application_payload = {"instrument_id": created_instrument_id}
        resp = requests.post(url_applications, headers=HEADERS_OWNER, json=application_payload, timeout=TIMEOUT)
        resp.raise_for_status()
        application = resp.json()
        created_application_id = application.get("application_id")
        assert created_application_id, "application_id not returned in application creation"

        # Step 4: POST submit application with empty JSON as OWNER (SUBMITTED)
        url_submit = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{created_application_id}/submit"
        resp = requests.post(url_submit, headers=HEADERS_OWNER, json={}, timeout=TIMEOUT)
        resp.raise_for_status()
        submitted_application = resp.json()
        # No explicit state assertion here (not provided), we assume success means submitted

        # Step 5: POST scrutiny with action ACCEPT as LMO
        url_scrutiny = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{created_application_id}/scrutiny"
        scrutiny_payload = {"action": "ACCEPT"}
        resp = requests.post(url_scrutiny, headers=HEADERS_LMO, json=scrutiny_payload, timeout=TIMEOUT)
        resp.raise_for_status()
        scrutinized_application = resp.json()
        # No assert on response fields specified, assume success means accepted

        # Step 6: POST fee assessment as LMO
        url_fee = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{created_application_id}/fee"
        fee_payload = {"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"}
        resp = requests.post(url_fee, headers=HEADERS_LMO, json=fee_payload, timeout=TIMEOUT)
        resp.raise_for_status()
        fee_response = resp.json()
        assert fee_response.get("current_status") == "FEE_PENDING"
        fee_assessment = fee_response.get("fee_assessment", {})
        assert fee_assessment.get("total_assessed_amount") == 550

        # Step 7: POST pay as OWNER with receipt_number
        url_pay = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{created_application_id}/pay"
        pay_payload = {"receipt_number": receipt_number}
        resp = requests.post(url_pay, headers=HEADERS_OWNER, json=pay_payload, timeout=TIMEOUT)
        resp.raise_for_status()

        # Step 8: POST schedule as LMO with slot and assigned LMO ID
        url_schedule = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{created_application_id}/schedule"
        schedule_payload = {
            "slot_start": slot_start_input,
            "slot_end": slot_end_input,
            "assigned_lmo_id": "lmo-officer-01"
        }
        resp = requests.post(url_schedule, headers=HEADERS_LMO, json=schedule_payload, timeout=TIMEOUT)
        resp.raise_for_status()
        scheduled_app = resp.json()
        assert scheduled_app.get("current_status") == "SCHEDULED"
        assert scheduled_app.get("assigned_lmo_id") == "lmo-officer-01"
        # Compare normalized datetime values for scheduled_slot_start and scheduled_slot_end
        scheduled_slot_start = scheduled_app.get("scheduled_slot_start")
        scheduled_slot_end = scheduled_app.get("scheduled_slot_end")
        assert scheduled_slot_start is not None
        assert scheduled_slot_end is not None
        dt_input_start = parser.isoparse(slot_start_input)
        dt_input_end = parser.isoparse(slot_end_input)
        dt_scheduled_start = parser.isoparse(scheduled_slot_start)
        dt_scheduled_end = parser.isoparse(scheduled_slot_end)
        assert dt_scheduled_start == dt_input_start
        assert dt_scheduled_end == dt_input_end

        # Step 9: POST /sessions as LMO with application_id, instrument_id, scheduled_date
        url_sessions = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions"
        session_payload = {
            "application_id": created_application_id,
            "instrument_id": created_instrument_id,
            "scheduled_date": slot_start_input
        }
        resp = requests.post(url_sessions, headers=HEADERS_LMO, json=session_payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Expected 201 Created, got {resp.status_code}"
        session = resp.json()
        created_session_id = session.get("session_id")
        assert created_session_id, "session_id not returned in session creation"
        assert session.get("application_id") == created_application_id
        assert session.get("instrument_id") == created_instrument_id

        # Step 10: Attempt session creation as OWNER - expect 403
        resp = requests.post(url_sessions, headers=HEADERS_OWNER, json=session_payload, timeout=TIMEOUT)
        assert resp.status_code == 403, f"Expected 403 Forbidden for OWNER role, got {resp.status_code}"

    finally:
        # Clean up created session if any
        if created_session_id:
            url_delete_session = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{created_session_id}"
            try:
                requests.delete(url_delete_session, headers=HEADERS_LMO, timeout=TIMEOUT)
            except Exception:
                pass

        # Clean up created application if any
        if created_application_id:
            url_delete_application = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{created_application_id}"
            try:
                requests.delete(url_delete_application, headers=HEADERS_OWNER, timeout=TIMEOUT)
            except Exception:
                pass

        # Clean up created instrument if any
        if created_instrument_id:
            url_delete_instrument = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/{created_instrument_id}"
            try:
                requests.delete(url_delete_instrument, headers=HEADERS_OWNER, timeout=TIMEOUT)
            except Exception:
                pass


test_pipeline_10_create_verification_session_from_scheduled_application()