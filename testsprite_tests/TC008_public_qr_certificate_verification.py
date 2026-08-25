import requests
import uuid
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"
TENANT = "tenant-delhi-central"
JURISDICTION = "jur-dl-01"
HEADERS_OWNER_APPLICANT = {
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT,
    "X-Jurisdiction-Id": JURISDICTION,
    "Content-Type": "application/json"
}
HEADERS_LMO = {
    "X-Actor-Role": "LMO",
    "X-Tenant-Id": TENANT,
    "X-Jurisdiction-Id": JURISDICTION,
    "Content-Type": "application/json"
}

def public_qr_certificate_verification():
    session_id = None
    instrument_id = None
    application_id = None
    session = requests.Session()
    unique_serial = f"SN-{uuid.uuid4().hex[:12]}"
    try:
        # Step 1: Get instrument models as OWNER
        models_resp = session.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/instruments/models",
            headers=HEADERS_OWNER_APPLICANT,
            timeout=30
        )
        models_resp.raise_for_status()
        models = models_resp.json()
        assert isinstance(models, list) and len(models) > 0, "No models found"
        # Use a known model_id from models (e.g. first)
        model_id = models[0]["model_id"]

        # Step 2: Register instrument with unique serial as OWNER
        instrument_payload = {
            "model_id": model_id,
            "serial_number": unique_serial
        }
        instr_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/instruments",
            headers=HEADERS_OWNER_APPLICANT,
            json=instrument_payload,
            timeout=30
        )
        instr_resp.raise_for_status()
        instr_data = instr_resp.json()
        instrument_id = instr_data["instrument_id"]
        assert instr_data["model_id"] == model_id
        assert instr_data["serial_number"] == unique_serial

        # Step 3: Create application WITHOUT applicant_declaration_accepted -> DRAFT
        app_create_payload = {
            "instrument_id": instrument_id
        }
        app_cre_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/applications",
            headers=HEADERS_OWNER_APPLICANT,
            json=app_create_payload,
            timeout=30
        )
        app_cre_resp.raise_for_status()
        app_cre_data = app_cre_resp.json()
        application_id = app_cre_data["application_id"]
        assert app_cre_data.get("current_status", "").upper() == "DRAFT" or "DRAFT" in app_cre_data.get("current_status", "").upper()

        # Step 4: Submit application -> SUBMITTED
        app_submit_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/applications/{application_id}/submit",
            headers=HEADERS_OWNER_APPLICANT,
            json={},  # must be non-empty JSON body, {} is accepted
            timeout=30
        )
        app_submit_resp.raise_for_status()
        app_submit_data = app_submit_resp.json()
        assert app_submit_data.get("current_status", "").upper() == "SUBMITTED"

        # Step 5: Scrutiny ACCEPT as LMO
        scrutiny_payload = {"action": "ACCEPT"}
        scrutiny_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/applications/{application_id}/scrutiny",
            headers=HEADERS_LMO,
            json=scrutiny_payload,
            timeout=30
        )
        scrutiny_resp.raise_for_status()
        scrutiny_data = scrutiny_resp.json()
        # Accept returns updated application; ensure no error

        # Step 6: Fee assessment with base_verification_fee=500 as LMO
        fee_payload = {"base_verification_fee": 500}
        fee_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/applications/{application_id}/fee",
            headers=HEADERS_LMO,
            json=fee_payload,
            timeout=30
        )
        fee_resp.raise_for_status()
        fee_data = fee_resp.json()

        # Step 7: Pay application as OWNER with receipt_number
        receipt_number = f"RCPT-{uuid.uuid4().hex[:12]}"
        pay_payload = {"receipt_number": receipt_number}
        pay_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/applications/{application_id}/pay",
            headers=HEADERS_OWNER_APPLICANT,
            json=pay_payload,
            timeout=30
        )
        pay_resp.raise_for_status()
        pay_data = pay_resp.json()

        # Step 8: Schedule verification slot as LMO with slot_start and slot_end (1 hour duration)
        slot_start_dt = datetime.utcnow() + timedelta(minutes=5)
        slot_end_dt = slot_start_dt + timedelta(hours=1)
        schedule_payload = {
            "slot_start": slot_start_dt.isoformat() + "Z",
            "slot_end": slot_end_dt.isoformat() + "Z"
        }
        sched_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/applications/{application_id}/schedule",
            headers=HEADERS_LMO,
            json=schedule_payload,
            timeout=30
        )
        sched_resp.raise_for_status()
        sched_data = sched_resp.json()

        # Step 9: Create session as LMO with application_id and instrument_id
        session_payload = {
            "application_id": application_id,
            "instrument_id": instrument_id
        }
        create_sess_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions",
            headers=HEADERS_LMO,
            json=session_payload,
            timeout=30
        )
        create_sess_resp.raise_for_status()
        session_data = create_sess_resp.json()
        session_id = session_data["session_id"]

        # Step 10: Confirm identity serial_verified true as LMO
        identity_payload = {"serial_verified": True}
        identity_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions/{session_id}/identity",
            headers=HEADERS_LMO,
            json=identity_payload,
            timeout=30
        )
        identity_resp.raise_for_status()
        identity_data = identity_resp.json()

        # Step 11: Start session as LMO
        start_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions/{session_id}/start",
            headers=HEADERS_LMO,
            json={},  # POST must send non-empty JSON body, but not specified; {} accepted
            timeout=30
        )
        start_resp.raise_for_status()
        start_data = start_resp.json()

        # Step 12: Submit observations with reference standard and observations as LMO
        # Observations: 1 ZERO_TEST at nominal_load=0, raw_indication_reading=0
        # plus 3 INCREASING_LOAD steps with matching nominal_load and raw readings
        observations = [
            {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": 0, "load_unit": "kg",
             "raw_indication_reading": 0, "reading_unit": "kg"},
            {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": 10, "load_unit": "kg",
             "raw_indication_reading": 10, "reading_unit": "kg"},
            {"step_type": "INCREASING_LOAD", "step_sequence": 3, "nominal_load": 20, "load_unit": "kg",
             "raw_indication_reading": 20, "reading_unit": "kg"},
            {"step_type": "INCREASING_LOAD", "step_sequence": 4, "nominal_load": 30, "load_unit": "kg",
             "raw_indication_reading": 30, "reading_unit": "kg"}
        ]
        observations_payload = {
            "reference_standard_ids": ["STD-MASS-CLASS-M1-002"],
            "observations": observations
        }
        observations_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions/{session_id}/observations",
            headers=HEADERS_LMO,
            json=observations_payload,
            timeout=30
        )
        observations_resp.raise_for_status()
        observations_data = observations_resp.json()

        # Step 13: Disposition with outcome VERIFICATION_PASSED_PENDING_AUTHORIZATION as LMO
        disposition_payload = {"outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION"}
        disposition_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions/{session_id}/disposition",
            headers=HEADERS_LMO,
            json=disposition_payload,
            timeout=30
        )
        disposition_resp.raise_for_status()
        disposition_data = disposition_resp.json()

        # Step 14: Stamp record for session: POST /sessions/:sessionId/stamps with seal_identification_number and seal_position as LMO
        seal_id = f"DL-SEAL-2026-{uuid.uuid4().hex[:6].upper()}"
        stamp_payload = {
            "seal_identification_number": seal_id,
            "seal_position": "TERMINAL_BLOCK"
        }
        stamp_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions/{session_id}/stamps",
            headers=HEADERS_LMO,
            json=stamp_payload,
            timeout=30
        )
        stamp_resp.raise_for_status()
        stamp_data = stamp_resp.json()
        assert "stamp_action_id" in stamp_data or "stamp_id" in stamp_data, "No stamp_action_id in stamp response"

        # Step 15: Issue certificate from session with validity_months=12 as LMO
        issue_payload = {
            "session_id": session_id,
            "validity_months": 12
        }
        issue_resp = session.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT}/certificates/issue",
            headers=HEADERS_LMO,
            json=issue_payload,
            timeout=30
        )
        issue_resp.raise_for_status()
        issue_data = issue_resp.json()
        assert "certificate_id" in issue_data and "public_verification_token" in issue_data
        public_verification_token = issue_data["public_verification_token"]

    finally:
        # Cleanup: attempt to delete created instrument, application and session if delete endpoints exist
        # API docs do not specify DELETE endpoints, so skipping actual deletion here.
        pass

    # Step 16: GET public verification WITHOUT auth headers: expect 200 with JSON certificate status
    public_verify_resp = requests.get(
        f"{BASE_URL}/api/v1/public/certificates/verify/{public_verification_token}",
        timeout=30
    )
    assert public_verify_resp.status_code == 200
    public_verify_json = public_verify_resp.json()
    assert isinstance(public_verify_json, dict), "Public verification response is not a dict"

    # Step 17: GET public verification with a random invalid token expecting 404 without auth headers
    invalid_token = f"invalid-{uuid.uuid4().hex[:16]}"
    public_verify_invalid_resp = requests.get(
        f"{BASE_URL}/api/v1/public/certificates/verify/{invalid_token}",
        timeout=30
    )
    assert public_verify_invalid_resp.status_code == 404

public_qr_certificate_verification()