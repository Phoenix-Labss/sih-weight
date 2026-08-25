import requests
import uuid
from datetime import datetime, timedelta

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


def test_pipeline_16_issue_digital_certificate():
    session_id = None
    instrument_id = None
    application_id = None
    stamp_action_id = None
    certificate_id = None
    certificate_number = None
    public_verification_token = None

    try:
        # Step 1: GET models, find MOD-NAWI-03
        url_models = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
        r = requests.get(url_models, headers=HEADERS_OWNER, timeout=TIMEOUT)
        r.raise_for_status()
        models = r.json()
        model_ids = [m.get("model_id") for m in models if "model_id" in m]
        assert MODEL_ID in model_ids, f"Model {MODEL_ID} not found in models"

        # Step 2: POST instrument with MOD-NAWI-03 and unique serial_number
        url_instruments = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
        serial_number = f"SN-{uuid.uuid4().hex[:12]}"
        payload_instrument = {
            "model_id": MODEL_ID,
            "serial_number": serial_number,
        }
        r = requests.post(url_instruments, headers=HEADERS_OWNER, json=payload_instrument, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 201
        instrument = r.json()
        instrument_id = instrument.get("instrument_id")
        assert instrument_id, "instrument_id not returned"

        # Step 3: POST application with instrument_id as OWNER (applicant_declaration_accepted omitted => DRAFT)
        url_applications = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
        payload_application = {
            "instrument_id": instrument_id
        }
        r = requests.post(url_applications, headers=HEADERS_OWNER, json=payload_application, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 201
        application = r.json()
        application_id = application.get("application_id")
        assert application_id, "application_id not returned"
        assert application.get("current_status") == "DRAFT"

        # Step 4: POST submit application as OWNER with empty JSON body to move to SUBMITTED
        url_submit = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit"
        r = requests.post(url_submit, headers=HEADERS_OWNER, json={}, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        submitted_app = r.json()
        assert submitted_app.get("current_status") == "SUBMITTED"

        # Step 5: POST scrutiny as LMO with {"action":"ACCEPT","notes":"ok"}
        url_scrutiny = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny"
        payload_scrutiny = {"action": "ACCEPT", "notes": "ok"}
        r = requests.post(url_scrutiny, headers=HEADERS_LMO, json=payload_scrutiny, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        scrutiny_app = r.json()

        # Step 6: POST fee as LMO with {"base_verification_fee":500,"user_charge":50,"policy_version":"fee-v1"}
        url_fee = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee"
        payload_fee = {"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"}
        r = requests.post(url_fee, headers=HEADERS_LMO, json=payload_fee, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        fee_app = r.json()
        # Optionally verify current_status change related to fee, if present
        assert "base_verification_fee" in r.text or "fee" in r.text  # rough check for fee presence

        # Step 7: POST pay as OWNER with unique receipt_number
        url_pay = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay"
        receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
        payload_pay = {"receipt_number": receipt_number}
        r = requests.post(url_pay, headers=HEADERS_OWNER, json=payload_pay, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        pay_app = r.json()

        # Step 8: POST schedule as LMO with slot and assigned_lmo_id
        url_schedule = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule"
        schedule_payload = {
            "slot_start": "2026-08-26T09:00:00Z",
            "slot_end": "2026-08-26T11:00:00Z",
            "assigned_lmo_id": "lmo-officer-01",
        }
        r = requests.post(url_schedule, headers=HEADERS_LMO, json=schedule_payload, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        scheduled_app = r.json()
        assert scheduled_app.get("current_status") == "SCHEDULED"

        # Step 9: POST sessions creation as LMO with application_id, instrument_id and scheduled_date
        url_sessions = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions"
        session_payload = {
            "application_id": application_id,
            "instrument_id": instrument_id,
            "scheduled_date": "2026-08-26T09:00:00Z"
        }
        r = requests.post(url_sessions, headers=HEADERS_LMO, json=session_payload, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 201
        session = r.json()
        session_id = session.get("session_id")
        assert session_id, "session_id not returned"
        assert session.get("application_id") == application_id
        assert session.get("instrument_id") == instrument_id

        # Step 10: POST sessions/:session_id/identity?serial_verified=true as LMO with body {}
        url_identity = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity?serial_verified=true"
        r = requests.post(url_identity, headers=HEADERS_LMO, json={}, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        session_identity = r.json()

        # Step 11: POST sessions/:session_id/start as LMO with empty body {}
        url_start = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/start"
        r = requests.post(url_start, headers=HEADERS_LMO, json={}, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        session_started = r.json()

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
        r = requests.post(url_observations, headers=HEADERS_LMO, json=observations_payload, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        session_obs = r.json()
        obs_returned = session_obs.get("observations") or []
        # Verify ordering and values
        assert len(obs_returned) >= 3
        for orig_obs, ret_obs in zip(observations_payload["observations"], obs_returned):
            assert ret_obs.get("step_sequence") == orig_obs["step_sequence"]
            assert ret_obs.get("raw_indication_reading") == orig_obs["raw_indication_reading"]

        # Step 13: POST sessions/:session_id/disposition as LMO with outcome VERIFICATION_PASSED_PENDING_AUTHORIZATION
        url_disposition = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/disposition"
        disposition_payload = {
            "outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION",
            "disposition_notes": "All errors within MPE"
        }
        r = requests.post(url_disposition, headers=HEADERS_LMO, json=disposition_payload, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        disposition_resp = r.json()
        assert disposition_resp.get("outcome") == "VERIFICATION_PASSED_PENDING_AUTHORIZATION"

        # Step 14: POST sessions/:session_id/stamps as LMO with seal details
        url_stamps = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/stamps"
        seal_identification_number = f"DL-SEAL-2026-{uuid.uuid4().hex[:6].upper()}"
        stamp_payload = {
            "instrument_id": instrument_id,
            "action_type": "SEAL_APPLIED",
            "seal_identification_number": seal_identification_number,
            "seal_position": "TERMINAL_BLOCK"
        }
        r = requests.post(url_stamps, headers=HEADERS_LMO, json=stamp_payload, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 201
        stamp_record = r.json()
        stamp_action_id = stamp_record.get("stamp_action_id")
        assert stamp_action_id, "stamp_action_id not returned"

        # Step 15: POST certificates/issue as LMO with session_id and validity_months=12
        url_issue_cert = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates/issue"
        cert_payload = {
            "session_id": session_id,
            "validity_months": 12
        }
        r = requests.post(url_issue_cert, headers=HEADERS_LMO, json=cert_payload, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 201
        cert_resp = r.json()
        certificate_id = cert_resp.get("certificate_id")
        certificate_number = cert_resp.get("certificate_number")
        public_verification_token = cert_resp.get("public_verification_token")
        issue_date_str = cert_resp.get("issue_date")
        valid_until_str = cert_resp.get("valid_until")
        certificate_status = cert_resp.get("certificate_status")
        certificate_bytes_sha256 = cert_resp.get("certificate_bytes_sha256")
        digital_signature_reference = cert_resp.get("digital_signature_reference")

        assert certificate_id, "certificate_id missing"
        assert certificate_number and certificate_number.startswith("CERT-2026-DL-"), f"certificate_number unexpected: {certificate_number}"
        assert public_verification_token, "public_verification_token missing"
        assert isinstance(issue_date_str, str), "issue_date missing or not string"
        assert isinstance(valid_until_str, str), "valid_until missing or not string"
        assert certificate_status == "ISSUED", f"certificate_status expected 'ISSUED' got '{certificate_status}'"
        assert certificate_bytes_sha256 and all(c in '0123456789abcdef' for c in certificate_bytes_sha256.lower()) and len(certificate_bytes_sha256) == 64, "certificate_bytes_sha256 invalid"
        assert digital_signature_reference, "digital_signature_reference missing"

        # Verify valid_until approximately 12 months after issue_date (allow some margin)
        issue_date = datetime.fromisoformat(issue_date_str.rstrip("Z"))
        valid_until = datetime.fromisoformat(valid_until_str.rstrip("Z"))
        delta_months = (valid_until.year - issue_date.year) * 12 + (valid_until.month - issue_date.month)
        assert 11 <= delta_months <= 13, f"valid_until not ~12 months after issue_date: delta {delta_months} months"

    finally:
        # Cleanup: delete created certificate, stamp, session, application, instrument if applicable
        # DELETE certificate (if API supports) - no deletion mentioned in PRD, so omit or handle if needed
        # DELETE stamp - no delete API described, omit
        # DELETE session - no delete API described, omit
        # DELETE application and instrument - no delete described, omit
        pass


test_pipeline_16_issue_digital_certificate()