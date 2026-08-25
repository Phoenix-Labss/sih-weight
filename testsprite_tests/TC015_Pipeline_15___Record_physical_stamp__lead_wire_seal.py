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

def test_pipeline_15_record_physical_stamp_lead_wire_seal():
    instrument_id = None
    application_id = None
    session_id = None
    stamp_action_id = None
    
    try:
        # Step 1: GET models and verify MOD-NAWI-03 present
        url_models = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
        resp = requests.get(url_models, headers=HEADERS_OWNER, timeout=TIMEOUT)
        resp.raise_for_status()
        models = resp.json()
        model_found = any(m.get("model_id") == MODEL_ID for m in models)
        assert model_found, f"Model {MODEL_ID} not found"

        # Step 2: POST instruments with unique serial_number
        serial_number = f"SN-{uuid.uuid4().hex[:12]}"
        url_instruments = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
        instrument_payload = {
            "model_id": MODEL_ID,
            "serial_number": serial_number
        }
        resp = requests.post(url_instruments, headers=HEADERS_OWNER, json=instrument_payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Instrument creation failed: {resp.status_code} {resp.text}"
        instrument = resp.json()
        instrument_id = instrument.get("instrument_id")
        assert instrument_id, "instrument_id missing in response"

        # Step 3: POST applications with instrument_id, no declaration accepted (DRAFT)
        url_applications = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
        app_payload = {
            "instrument_id": instrument_id
        }
        resp = requests.post(url_applications, headers=HEADERS_OWNER, json=app_payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Application creation failed: {resp.status_code} {resp.text}"
        application = resp.json()
        application_id = application.get("application_id")
        assert application_id, "application_id missing in response"
        assert application.get("current_status") == "DRAFT", "Application initial status not DRAFT"

        # Step 4: POST applications/:application_id/submit (EMPTY body) as OWNER to move to SUBMITTED
        url_submit = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit"
        resp = requests.post(url_submit, headers=HEADERS_OWNER, json={}, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Application submit failed: {resp.status_code} {resp.text}"
        application = resp.json()
        assert application.get("current_status") == "SUBMITTED", "Application status not SUBMITTED after submit"

        # Step 5: POST applications/:application_id/scrutiny as LMO with action ACCEPT
        url_scrutiny = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny"
        scrutiny_payload = {"action": "ACCEPT", "notes": "ok"}
        resp = requests.post(url_scrutiny, headers=HEADERS_LMO, json=scrutiny_payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Scrutiny ACCEPT failed: {resp.status_code} {resp.text}"

        # Step 6: POST applications/:application_id/fee as LMO
        url_fee = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee"
        fee_payload = {"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"}
        resp = requests.post(url_fee, headers=HEADERS_LMO, json=fee_payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Fee assessment failed: {resp.status_code} {resp.text}"

        # Step 7: POST applications/:application_id/pay as OWNER
        url_pay = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay"
        receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
        pay_payload = {"receipt_number": receipt_number}
        resp = requests.post(url_pay, headers=HEADERS_OWNER, json=pay_payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Payment reconciliation failed: {resp.status_code} {resp.text}"

        # Step 8: POST applications/:application_id/schedule as LMO
        url_schedule = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule"
        schedule_payload = {
            "slot_start": "2026-08-26T09:00:00Z",
            "slot_end": "2026-08-26T11:00:00Z",
            "assigned_lmo_id": "lmo-officer-01"
        }
        resp = requests.post(url_schedule, headers=HEADERS_LMO, json=schedule_payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Scheduling failed: {resp.status_code} {resp.text}"

        # Step 9: POST sessions create as LMO
        url_sessions = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions"
        session_payload = {
            "application_id": application_id,
            "instrument_id": instrument_id,
            "scheduled_date": "2026-08-26T09:00:00Z"
        }
        resp = requests.post(url_sessions, headers=HEADERS_LMO, json=session_payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Session creation failed: {resp.status_code} {resp.text}"
        session = resp.json()
        session_id = session.get("session_id")
        assert session_id, "session_id missing in session creation response"
        assert session.get("application_id") == application_id, "Session application_id mismatch"
        assert session.get("instrument_id") == instrument_id, "Session instrument_id mismatch"

        # Step 10: POST sessions/:session_id/identity?serial_verified=true as LMO
        url_identity = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity?serial_verified=true"
        resp = requests.post(url_identity, headers=HEADERS_LMO, json={}, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Identity confirmation failed: {resp.status_code} {resp.text}"

        # Step 11: POST sessions/:session_id/start as LMO
        url_start = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/start"
        resp = requests.post(url_start, headers=HEADERS_LMO, json={}, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Session start failed: {resp.status_code} {resp.text}"

        # Step 12: POST sessions/:session_id/observations as LMO
        url_observations = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/observations"
        observations_payload = {
            "reference_standard_ids": ["STD-MASS-CLASS-M1-002"],
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": 0,
                    "load_unit": "kg",
                    "raw_indication_reading": 0,
                    "reading_unit": "kg"
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 2,
                    "nominal_load": 10000,
                    "load_unit": "kg",
                    "raw_indication_reading": 10000,
                    "reading_unit": "kg"
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 3,
                    "nominal_load": 25000,
                    "load_unit": "kg",
                    "raw_indication_reading": 25000,
                    "reading_unit": "kg"
                }
            ],
            "environmental_temp_celsius": 25
        }
        resp = requests.post(url_observations, headers=HEADERS_LMO, json=observations_payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Observations submission failed: {resp.status_code} {resp.text}"
        session_obs = resp.json()
        obs_list = session_obs.get("observations") or []
        # Verify observations retain raw_indication_reading == nominal_load in order
        for obs in obs_list:
            seq = obs.get("step_sequence")
            nominal = obs.get("nominal_load")
            raw_ind = obs.get("raw_indication_reading")
            assert raw_ind == nominal, f"Observation seq {seq} raw_indication_reading != nominal_load"

        # Step 13: POST sessions/:session_id/disposition as LMO
        url_disposition = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/disposition"
        disposition_payload = {
            "outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION",
            "disposition_notes": "All errors within MPE"
        }
        resp = requests.post(url_disposition, headers=HEADERS_LMO, json=disposition_payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Disposition recording failed: {resp.status_code} {resp.text}"
        session_disp = resp.json()
        assert session_disp.get("outcome") == "VERIFICATION_PASSED_PENDING_AUTHORIZATION", "Disposition outcome mismatch"

        # Step 14: POST sessions/:session_id/stamps as LMO (Seal applied)
        url_stamps = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/stamps"
        seal_id_number = f"DL-SEAL-2026-{uuid.uuid4().hex[:6].upper()}"
        stamps_payload = {
            "instrument_id": instrument_id,
            "action_type": "SEAL_APPLIED",
            "seal_identification_number": seal_id_number,
            "seal_position": "TERMINAL_BLOCK"
        }
        resp = requests.post(url_stamps, headers=HEADERS_LMO, json=stamps_payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Stamp recording failed: {resp.status_code} {resp.text}"
        stamp_record = resp.json()
        stamp_action_id = stamp_record.get("stamp_action_id")
        assert stamp_action_id, "stamp_action_id missing in stamp record"

        # Step 15: GET sessions/:session_id/stamps as OWNER; verify the recorded seal present
        resp = requests.get(url_stamps, headers=HEADERS_OWNER, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Getting stamps list failed: {resp.status_code} {resp.text}"
        stamps_list = resp.json()
        # Search seal_identification_number in list
        seals_found = [s for s in stamps_list if s.get("seal_identification_number") == seal_id_number]
        assert len(seals_found) > 0, "Recorded seal not found in session stamps"

    finally:
        # Cleanup: Delete instrument and application if created (best-effort)
        if instrument_id:
            try:
                url_del_inst = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/{instrument_id}"
                requests.delete(url_del_inst, headers=HEADERS_OWNER, timeout=TIMEOUT)
            except Exception:
                pass
        if application_id:
            try:
                url_del_app = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}"
                requests.delete(url_del_app, headers=HEADERS_OWNER, timeout=TIMEOUT)
            except Exception:
                pass

test_pipeline_15_record_physical_stamp_lead_wire_seal()