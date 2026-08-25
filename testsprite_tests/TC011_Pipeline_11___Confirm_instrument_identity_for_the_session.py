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
    "Content-Type": "application/json",
}
HEADERS_LMO = {
    "X-Actor-Role": "LMO",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json",
}


def test_pipeline_11_confirm_instrument_identity_for_session():
    """Pipeline 11 - Confirm instrument identity for the session"""
    instrument_id = None
    application_id = None
    session_id = None
    try:
        # Step 1: GET models and find MOD-NAWI-03
        r = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models",
            headers=HEADERS_OWNER,
            timeout=30,
        )
        assert r.status_code == 200, f"Failed to get models: {r.text}"
        models = r.json()
        model = next((m for m in models if m.get("model_id") == MODEL_ID), None)
        assert model is not None, f"Model {MODEL_ID} not found in models list"

        # Step 2: POST register instrument
        serial_number = f"SN-{uuid.uuid4().hex[:12]}"
        instrument_payload = {"model_id": MODEL_ID, "serial_number": serial_number}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments",
            headers=HEADERS_OWNER,
            json=instrument_payload,
            timeout=30,
        )
        assert r.status_code == 201, f"Failed to create instrument: {r.text}"
        instrument = r.json()
        instrument_id = instrument.get("instrument_id")
        assert instrument_id, "instrument_id missing in instrument creation response"
        assert instrument.get("model_id") == MODEL_ID, "Model ID mismatch on instrument"
        assert instrument.get("serial_number") == serial_number, "Serial number mismatch"
        assert instrument.get("current_status") == "UNVERIFIED", "Unexpected instrument status"
        assert "public_instrument_token" in instrument, "Missing public_instrument_token"

        # Step 3: POST create application draft
        application_payload = {"instrument_id": instrument_id}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications",
            headers=HEADERS_OWNER,
            json=application_payload,
            timeout=30,
        )
        assert r.status_code == 201, f"Failed to create application: {r.text}"
        application = r.json()
        application_id = application.get("application_id")
        assert application_id, "application_id missing in application creation response"
        assert application.get("current_status") == "DRAFT", "Application status not DRAFT"
        assert application.get("instrument_id") == instrument_id, "Application instrument_id mismatch"

        # Step 4: POST submit application (move DRAFT->SUBMITTED)
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit",
            headers=HEADERS_OWNER,
            json={},
            timeout=30,
        )
        assert r.status_code == 200, f"Failed to submit application: {r.text}"
        application_submitted = r.json()
        assert application_submitted.get("current_status") == "SUBMITTED", "Status not SUBMITTED after submit"

        # Step 5: POST scrutiny accept as LMO
        scrutiny_payload = {"action": "ACCEPT", "notes": "ok"}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny",
            headers=HEADERS_LMO,
            json=scrutiny_payload,
            timeout=30,
        )
        assert r.status_code == 200, f"Failed scrutiny accept: {r.text}"
        scrutiny_resp = r.json()
        current_status = scrutiny_resp.get("current_status", "").upper()
        assert current_status != "SUBMITTED", "Status not advanced after scrutiny accept"

        # Step 6: POST fee assessment as LMO
        fee_payload = {"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee",
            headers=HEADERS_LMO,
            json=fee_payload,
            timeout=30,
        )
        assert r.status_code == 200, f"Failed fee assessment: {r.text}"
        fee_resp = r.json()
        assert "current_status" in fee_resp, "Missing status in fee response"

        # Step 7: POST pay as OWNER
        receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
        pay_payload = {"receipt_number": receipt_number}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay",
            headers=HEADERS_OWNER,
            json=pay_payload,
            timeout=30,
        )
        assert r.status_code == 200, f"Failed payment reconciliation: {r.text}"
        pay_resp = r.json()
        assert "current_status" in pay_resp, "Missing status in pay response"

        # Step 8: POST schedule as LMO
        schedule_payload = {
            "slot_start": "2026-08-26T09:00:00Z",
            "slot_end": "2026-08-26T11:00:00Z",
            "assigned_lmo_id": "lmo-officer-01",
        }
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule",
            headers=HEADERS_LMO,
            json=schedule_payload,
            timeout=30,
        )
        assert r.status_code == 200, f"Failed scheduling: {r.text}"
        schedule_resp = r.json()
        assert schedule_resp.get("current_status") == "SCHEDULED", "Status not SCHEDULED after scheduling"
        assert schedule_resp.get("assigned_lmo_id") == "lmo-officer-01", "LMO assignment mismatch in schedule"

        # Step 9: POST create session as LMO
        session_payload = {
            "application_id": application_id,
            "instrument_id": instrument_id,
            "scheduled_date": "2026-08-26T09:00:00Z",
        }
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions",
            headers=HEADERS_LMO,
            json=session_payload,
            timeout=30,
        )
        assert r.status_code == 201, f"Failed to create session: {r.text}"
        session = r.json()
        session_id = session.get("session_id")
        assert session_id, "session_id missing in session creation response"
        assert session.get("application_id") == application_id, "Session application_id mismatch"
        assert session.get("instrument_id") == instrument_id, "Session instrument_id mismatch"

        # Step 10: POST confirm instrument identity for session as LMO with query param serial_verified=true
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity?serial_verified=true",
            headers=HEADERS_LMO,
            json={},
            timeout=30,
        )
        assert r.status_code == 200, f"Failed to confirm instrument identity: {r.text}"
        identity_resp = r.json()
        # Validate session reflects identity confirmed state
        # The exact field name indicating identity confirmed not explicitly given; common candidates:
        # Check if identity_confirmed or serial_verified flag True or state advanced accordingly
        # We verify by presence and sensible values
        identity_confirmed = False
        # Try common keys
        for key in ["identity_confirmed", "serial_verified", "instrument_identity_confirmed"]:
            if key in identity_resp and identity_resp[key] is True:
                identity_confirmed = True
                break
        # If none keys found, fallback to check session status or logs
        if not identity_confirmed:
            status_fields = ["current_status", "session_status", "status"]
            for sf in status_fields:
                state_str = identity_resp.get(sf, "")
                if isinstance(state_str, str) and any(
                    s in state_str.upper() for s in ["IDENTITY_CONFIRMED", "IDENTITY VERIFIED", "SERIAL VERIFIED"]
                ):
                    identity_confirmed = True
                    break
        assert identity_confirmed, "Session identity confirmation not reflected in response"

    finally:
        # Cleanup: delete instrument, application and session if needed by API (not specified in PRD, so skip)
        # Since no DELETE endpoints described, just leave the test data as is.
        pass


test_pipeline_11_confirm_instrument_identity_for_session()