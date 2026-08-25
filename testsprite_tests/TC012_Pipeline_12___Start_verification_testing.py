import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"
MODEL_ID = "MOD-NAWI-03"
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


def test_pipeline_12_start_verification_testing():
    # Step 1: GET instrument models as OWNER, find model_id = MOD-NAWI-03
    url_models = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
    resp = requests.get(url_models, headers=HEADERS_OWNER, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Failed to get instrument models: {resp.text}"
    models = resp.json()
    assert any(m.get("model_id") == MODEL_ID for m in models), f"Model {MODEL_ID} not found"
    
    # Step 2: POST instruments to create instrument with unique serial_number
    url_instruments = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
    serial_number = f"SN-{uuid.uuid4().hex[:12]}"
    instrument_payload = {
        "model_id": MODEL_ID,
        "serial_number": serial_number
    }
    resp = requests.post(url_instruments, headers=HEADERS_OWNER, json=instrument_payload, timeout=TIMEOUT)
    assert resp.status_code == 201, f"Failed to create instrument: {resp.text}"
    instrument = resp.json()
    instrument_id = instrument.get("instrument_id")
    assert instrument_id, "instrument_id missing in response"
    
    # Step 3: POST applications to create application with instrument_id, no applicant_declaration_accepted (start in DRAFT)
    url_applications = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
    application_payload = {
        "instrument_id": instrument_id
    }
    resp = requests.post(url_applications, headers=HEADERS_OWNER, json=application_payload, timeout=TIMEOUT)
    assert resp.status_code == 201, f"Failed to create application: {resp.text}"
    application = resp.json()
    application_id = application.get("application_id")
    current_status = application.get("current_status")
    assert application_id, "application_id missing in response"
    assert current_status == "DRAFT", f"Expected status DRAFT, got {current_status}"
    
    # Step 4: POST submit application as OWNER with empty json {} moves to SUBMITTED
    url_submit = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit"
    resp = requests.post(url_submit, headers=HEADERS_OWNER, json={}, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Failed to submit application: {resp.text}"
    application_submitted = resp.json()
    assert application_submitted.get("application_id") == application_id, "Application ID mismatch on submit"
    assert application_submitted.get("current_status") == "SUBMITTED", f"Expected status SUBMITTED, got {application_submitted.get('current_status')}"
    
    # Step 5: POST scrutiny as LMO with action ACCEPT and notes "ok"
    url_scrutiny = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny"
    scrutiny_payload = {
        "action": "ACCEPT",
        "notes": "ok"
    }
    resp = requests.post(url_scrutiny, headers=HEADERS_LMO, json=scrutiny_payload, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Failed scrutiny: {resp.text}"
    scrutiny_resp = resp.json()
    assert scrutiny_resp.get("application_id") == application_id, "Application ID mismatch on scrutiny"
    
    # Step 6: POST fee as LMO with base_verification_fee=500, user_charge=50, policy_version="fee-v1"
    url_fee = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee"
    fee_payload = {
        "base_verification_fee": 500,
        "user_charge": 50,
        "policy_version": "fee-v1"
    }
    resp = requests.post(url_fee, headers=HEADERS_LMO, json=fee_payload, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Failed to assess fee: {resp.text}"
    fee_resp = resp.json()
    assert fee_resp.get("application_id") == application_id, "Application ID mismatch on fee"
    
    # Step 7: POST pay as OWNER with receipt_number "RCPT-<uuid8>"
    url_pay = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay"
    receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
    pay_payload = {
        "receipt_number": receipt_number
    }
    resp = requests.post(url_pay, headers=HEADERS_OWNER, json=pay_payload, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Failed to pay: {resp.text}"
    pay_resp = resp.json()
    assert pay_resp.get("application_id") == application_id, "Application ID mismatch on pay"
    
    # Step 8: POST schedule as LMO with slot_start, slot_end, assigned_lmo_id
    url_schedule = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule"
    schedule_payload = {
        "slot_start": "2026-08-26T09:00:00Z",
        "slot_end": "2026-08-26T11:00:00Z",
        "assigned_lmo_id": "lmo-officer-01"
    }
    resp = requests.post(url_schedule, headers=HEADERS_LMO, json=schedule_payload, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Failed to schedule: {resp.text}"
    schedule_resp = resp.json()
    assert schedule_resp.get("application_id") == application_id, "Application ID mismatch on schedule"
    
    # Step 9: POST create session as LMO with application_id, instrument_id, scheduled_date
    url_sessions = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions"
    session_payload = {
        "application_id": application_id,
        "instrument_id": instrument_id,
        "scheduled_date": "2026-08-26T09:00:00Z"
    }
    resp = requests.post(url_sessions, headers=HEADERS_LMO, json=session_payload, timeout=TIMEOUT)
    assert resp.status_code == 201, f"Failed to create session: {resp.text}"
    session_resp = resp.json()
    session_id = session_resp.get("session_id")
    assert session_id, "session_id missing in response"
    assert session_resp.get("application_id") == application_id, "Session application_id mismatch"
    assert session_resp.get("instrument_id") == instrument_id, "Session instrument_id mismatch"
    
    # Step 10: POST confirm identity: POST sessions/:session_id/identity?serial_verified=true with body {}
    url_identity = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity?serial_verified=true"
    resp = requests.post(url_identity, headers=HEADERS_LMO, json={}, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Failed to confirm identity: {resp.text}"
    identity_resp = resp.json()
    assert identity_resp.get("session_id") == session_id, "Session ID mismatch on identity confirm"
    
    # Step 11: POST start session: POST sessions/:session_id/start with {}
    url_start = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/start"
    resp = requests.post(url_start, headers=HEADERS_LMO, json={}, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Failed to start session: {resp.text}"
    start_resp = resp.json()
    assert start_resp.get("session_id") == session_id, "Session ID mismatch on start"
    # Assert session status shows testing in progress (field name approx current_status or status)
    status_field = start_resp.get("current_status") or start_resp.get("status")
    assert status_field, "No status field in start response"
    assert status_field.lower().find("progress") != -1 or status_field.lower().find("testing") != -1, f"Session status does not indicate testing in progress: {status_field}"


test_pipeline_12_start_verification_testing()