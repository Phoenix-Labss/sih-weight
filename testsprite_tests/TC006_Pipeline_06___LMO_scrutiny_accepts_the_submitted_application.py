import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"
MODEL_ID = "MOD-NAWI-03"
TIMEOUT = 30

HEADERS_OWNER = {
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json",
}

HEADERS_LMO = {
    "X-Actor-Role": "LMO",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json",
}


def test_tc006_pipeline_06_lmo_scrutiny_accepts_submitted_application():
    # Step 1: GET models, verify MOD-NAWI-03 present
    models_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
    r = requests.get(models_url, headers=HEADERS_OWNER, timeout=TIMEOUT)
    assert r.status_code == 200, f"Failed to get models: {r.text}"
    models = r.json()
    mod_found = any(m.get("model_id") == MODEL_ID for m in models)
    assert mod_found, f"Model {MODEL_ID} not found in models list"

    # Step 2: POST instruments with model_id and unique serial_number, read instrument_id
    instrument_serial_number = f"SN-{uuid.uuid4().hex[:12]}"
    instruments_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
    instrument_payload = {"model_id": MODEL_ID, "serial_number": instrument_serial_number}
    r = requests.post(instruments_url, headers=HEADERS_OWNER, json=instrument_payload, timeout=TIMEOUT)
    assert r.status_code == 201, f"Failed to create instrument: {r.text}"
    instrument = r.json()
    instrument_id = instrument.get("instrument_id")
    assert instrument_id, "instrument_id missing in instrument creation response"
    assert instrument.get("model_id") == MODEL_ID, "instrument model_id mismatch"
    assert instrument.get("serial_number") == instrument_serial_number, "instrument serial_number mismatch"

    # Step 3: POST applications with instrument_id without applicant_declaration_accepted (DRAFT)
    applications_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
    app_create_payload = {"instrument_id": instrument_id}
    r = requests.post(applications_url, headers=HEADERS_OWNER, json=app_create_payload, timeout=TIMEOUT)
    assert r.status_code == 201, f"Failed to create application: {r.text}"
    application = r.json()
    application_id = application.get("application_id")
    assert application_id, "application_id missing in application creation"
    initial_status = application.get("current_status")
    assert initial_status == "DRAFT", f"Application initial status expected DRAFT but got {initial_status}"

    # Step 4: POST submit application with empty body {} as OWNER (status SUBMITTED)
    submit_url = f"{applications_url}/{application_id}/submit"
    r = requests.post(submit_url, headers=HEADERS_OWNER, json={}, timeout=TIMEOUT)
    assert r.status_code == 200, f"Failed to submit application: {r.text}"
    submitted_app = r.json()
    submitted_status = submitted_app.get("current_status")
    assert submitted_status == "SUBMITTED", f"Application status after submit expected SUBMITTED but got {submitted_status}"

    # Step 5: POST scrutiny as LMO with {"action":"ACCEPT","notes":"ok"}
    scrutiny_url = f"{applications_url}/{application_id}/scrutiny"
    scrutiny_payload = {"action": "ACCEPT", "notes": "ok"}
    r = requests.post(scrutiny_url, headers=HEADERS_LMO, json=scrutiny_payload, timeout=TIMEOUT)
    assert r.status_code == 200, f"Scrutiny ACCEPT request failed: {r.text}"
    scrutinized_app = r.json()
    scrutinized_status = scrutinized_app.get("current_status")
    assert scrutinized_status is not None, "No current_status in scrutiny response"
    assert scrutinized_status != "SUBMITTED", "Application status did not advance beyond SUBMITTED after scrutiny ACCEPT"

    # Step 6: Verify RBAC - scrutiny with X-Actor-Role OWNER on a second fresh submitted application returns 403 and status unchanged

    # Create second instrument for isolation
    instrument_serial_number2 = f"SN-{uuid.uuid4().hex[:12]}"
    instrument_payload2 = {"model_id": MODEL_ID, "serial_number": instrument_serial_number2}
    r_ins2 = requests.post(instruments_url, headers=HEADERS_OWNER, json=instrument_payload2, timeout=TIMEOUT)
    assert r_ins2.status_code == 201, f"Failed to create second instrument: {r_ins2.text}"
    instrument2 = r_ins2.json()
    instrument_id2 = instrument2.get("instrument_id")

    # Create second application
    app_create_payload2 = {"instrument_id": instrument_id2}
    r_app2 = requests.post(applications_url, headers=HEADERS_OWNER, json=app_create_payload2, timeout=TIMEOUT)
    assert r_app2.status_code == 201, f"Failed to create second application: {r_app2.text}"
    application2 = r_app2.json()
    application_id2 = application2.get("application_id")

    # Submit second application as OWNER
    submit_url2 = f"{applications_url}/{application_id2}/submit"
    r_sub2 = requests.post(submit_url2, headers=HEADERS_OWNER, json={}, timeout=TIMEOUT)
    assert r_sub2.status_code == 200, f"Failed to submit second application: {r_sub2.text}"
    submitted_app2 = r_sub2.json()
    assert submitted_app2.get("current_status") == "SUBMITTED", "Second application status is not SUBMITTED as expected"

    # Attempt scrutiny with OWNER role (should be forbidden)
    scrutiny_url2 = f"{applications_url}/{application_id2}/scrutiny"
    scrutiny_payload2 = {"action": "ACCEPT", "notes": "ok"}
    r_scrutiny_owner = requests.post(scrutiny_url2, headers=HEADERS_OWNER, json=scrutiny_payload2, timeout=TIMEOUT)
    assert r_scrutiny_owner.status_code == 403, f"Expected 403 forbidden for OWNER scrutiny, got {r_scrutiny_owner.status_code}"
    json_resp = r_scrutiny_owner.json()
    detail_msg = json_resp.get("detail", "").lower()
    assert "role" in detail_msg or "not permitted" in detail_msg or "forbidden" in detail_msg, "Expected role not permitted error detail"

    # Verify second application status unchanged (still SUBMITTED)
    r_verify_app2 = requests.get(f"{applications_url}/{application_id2}", headers=HEADERS_OWNER, timeout=TIMEOUT)
    assert r_verify_app2.status_code == 200, f"Failed to GET second application after forbidden scrutiny: {r_verify_app2.text}"
    app2_after = r_verify_app2.json()
    assert app2_after.get("current_status") == "SUBMITTED", "Second application status changed after forbidden scrutiny attempt"


test_tc006_pipeline_06_lmo_scrutiny_accepts_submitted_application()