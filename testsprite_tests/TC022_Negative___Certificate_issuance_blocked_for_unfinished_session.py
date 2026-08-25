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


def test_negative_certificate_issuance_blocked_for_unfinished_session():
    instrument_id = None
    application_id = None
    session_id = None
    try:
        # Step 1: GET models and find model_id MOD-NAWI-03
        url_models = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
        resp_models = requests.get(url_models, headers=HEADERS_OWNER, timeout=TIMEOUT)
        assert resp_models.status_code == 200
        models = resp_models.json()
        found_model = any(m.get("model_id") == MODEL_ID for m in models)
        assert found_model, f"Model {MODEL_ID} not found in models list"

        # Step 2: POST instrument with model_id and unique serial_number
        serial_number = f"SN-{uuid.uuid4().hex[:12]}"
        url_instruments = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
        instrument_payload = {
            "model_id": MODEL_ID,
            "serial_number": serial_number,
        }
        resp_instrument = requests.post(url_instruments, headers=HEADERS_OWNER, json=instrument_payload, timeout=TIMEOUT)
        assert resp_instrument.status_code == 201
        instrument_data = resp_instrument.json()
        instrument_id = instrument_data.get("instrument_id")
        assert instrument_id, "instrument_id missing in response"

        # Step 3: POST application with instrument_id as OWNER (without applicant_declaration_accepted)
        url_applications = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
        application_payload = {
            "instrument_id": instrument_id,
        }
        resp_app_create = requests.post(url_applications, headers=HEADERS_OWNER, json=application_payload, timeout=TIMEOUT)
        assert resp_app_create.status_code == 201
        application_data = resp_app_create.json()
        application_id = application_data.get("application_id")
        assert application_id, "application_id missing in response"
        assert application_data.get("current_status") == "DRAFT"

        # Step 4: POST submit application with empty body {} as OWNER (moves to SUBMITTED)
        url_app_submit = f"{url_applications}/{application_id}/submit"
        resp_submit = requests.post(url_app_submit, headers=HEADERS_OWNER, json={}, timeout=TIMEOUT)
        assert resp_submit.status_code == 200
        submit_data = resp_submit.json()
        assert submit_data.get("current_status") == "SUBMITTED"

        # Step 5: POST scrutiny with {"action":"ACCEPT","notes":"ok"} as LMO
        url_app_scrutiny = f"{url_applications}/{application_id}/scrutiny"
        scrutiny_payload = {"action": "ACCEPT", "notes": "ok"}
        resp_scrutiny = requests.post(url_app_scrutiny, headers=HEADERS_LMO, json=scrutiny_payload, timeout=TIMEOUT)
        assert resp_scrutiny.status_code == 200

        # Step 6: POST fee with {"base_verification_fee":500,"user_charge":50,"policy_version":"fee-v1"} as LMO
        url_app_fee = f"{url_applications}/{application_id}/fee"
        fee_payload = {"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"}
        resp_fee = requests.post(url_app_fee, headers=HEADERS_LMO, json=fee_payload, timeout=TIMEOUT)
        assert resp_fee.status_code == 200

        # Step 7: POST pay with {"receipt_number":"RCPT-<uuid8>"} as OWNER
        url_app_pay = f"{url_applications}/{application_id}/pay"
        receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
        pay_payload = {"receipt_number": receipt_number}
        resp_pay = requests.post(url_app_pay, headers=HEADERS_OWNER, json=pay_payload, timeout=TIMEOUT)
        assert resp_pay.status_code == 200

        # Step 8: POST schedule with slot times and assigned_lmo_id as LMO
        url_app_schedule = f"{url_applications}/{application_id}/schedule"
        schedule_payload = {
            "slot_start": "2026-08-26T09:00:00Z",
            "slot_end": "2026-08-26T11:00:00Z",
            "assigned_lmo_id": "lmo-officer-01",
        }
        resp_schedule = requests.post(url_app_schedule, headers=HEADERS_LMO, json=schedule_payload, timeout=TIMEOUT)
        assert resp_schedule.status_code == 200

        # Step 9: POST create session as LMO
        url_sessions = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions"
        session_payload = {
            "application_id": application_id,
            "instrument_id": instrument_id,
            "scheduled_date": "2026-08-26T09:00:00Z",
        }
        resp_session = requests.post(url_sessions, headers=HEADERS_LMO, json=session_payload, timeout=TIMEOUT)
        assert resp_session.status_code == 201
        session_data = resp_session.json()
        session_id = session_data.get("session_id")
        assert session_id, "session_id missing from session creation"

        # Step 10: POST identity with serial_verified=true as LMO
        url_identity = f"{url_sessions}/{session_id}/identity?serial_verified=true"
        resp_identity = requests.post(url_identity, headers=HEADERS_LMO, json={}, timeout=TIMEOUT)
        assert resp_identity.status_code == 200

        # Step 11: POST start session with empty body {} as LMO
        url_start = f"{url_sessions}/{session_id}/start"
        resp_start = requests.post(url_start, headers=HEADERS_LMO, json={}, timeout=TIMEOUT)
        assert resp_start.status_code == 200

        # Step 12: Attempt POST certificate issue with unfinished session as LMO (should fail)
        url_cert_issue = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates/issue"
        cert_issue_payload = {"session_id": session_id, "validity_months": 12}
        resp_cert_issue = requests.post(url_cert_issue, headers=HEADERS_LMO, json=cert_issue_payload, timeout=TIMEOUT)

        # The response must be 4xx (not 201 created)
        assert resp_cert_issue.status_code >= 400 and resp_cert_issue.status_code < 500, \
            f"Expected 4xx error for certificate issue but got {resp_cert_issue.status_code}"

        # Assert no certificate_id in response
        try:
            cert_resp_json = resp_cert_issue.json()
        except Exception:
            cert_resp_json = {}

        assert "certificate_id" not in cert_resp_json, "certificate_id unexpectedly present in error response"

    finally:
        # Cleanup: Delete created session if exists
        if session_id:
            try:
                requests.delete(f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}",
                                headers=HEADERS_LMO, timeout=TIMEOUT)
            except Exception:
                pass

        # Cleanup: Delete application (if API supports, not specified here, so we skip)

        # Cleanup: Delete instrument if exists
        if instrument_id:
            try:
                requests.delete(f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/{instrument_id}",
                                headers=HEADERS_OWNER, timeout=TIMEOUT)
            except Exception:
                pass


test_negative_certificate_issuance_blocked_for_unfinished_session()