import requests
import uuid
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"
TENANT = "tenant-delhi-central"
JURISDICTION = "jur-dl-01"
TIMEOUT = 30

HEADERS_OWNER_APPLICANT = {
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT,
    "X-Jurisdiction-Id": JURISDICTION,
    "Content-Type": "application/json",
}

HEADERS_LMO = {
    "X-Actor-Role": "LMO",
    "X-Tenant-Id": TENANT,
    "X-Jurisdiction-Id": JURISDICTION,
    "Content-Type": "application/json",
}

def test_download_public_certificate_pdf_by_qr_reference():
    instrument_id = None
    application_id = None
    session_id = None
    certificate_id = None
    public_verification_token = None

    # Helper function to create instrument
    def create_instrument():
        headers = HEADERS_OWNER_APPLICANT.copy()
        # Step 1: GET models to pick one model_id
        models_url = f"{BASE_URL}/api/v1/tenants/{TENANT}/instruments/models"
        resp = requests.get(models_url, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Failed to get instrument models: {resp.text}"
        models = resp.json()
        assert isinstance(models, list) and len(models) > 0, "No instrument models returned"
        model_id = None
        for m in models:
            if "model_id" in m and m["model_id"] in ["MOD-NAWI-01", "MOD-NAWI-03"]:
                model_id = m["model_id"]
                break
        assert model_id is not None, "No suitable model_id found"
        # Step 2: POST create instrument with unique serial
        serial_number = f"SN-{uuid.uuid4().hex[:12]}"
        create_url = f"{BASE_URL}/api/v1/tenants/{TENANT}/instruments"
        payload = {
            "model_id": model_id,
            "serial_number": serial_number
        }
        resp = requests.post(create_url, headers=headers, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Instrument creation failed: {resp.text}"
        inst_obj = resp.json()
        assert "instrument_id" in inst_obj and inst_obj.get("model_id") == model_id and inst_obj.get("serial_number") == serial_number
        return inst_obj["instrument_id"]

    # Helper function to create application without declaration (starts draft)
    def create_application(instrument_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/applications"
        payload = {
            "instrument_id": instrument_id
        }
        resp = requests.post(url, headers=HEADERS_OWNER_APPLICANT, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Create application failed: {resp.text}"
        app_obj = resp.json()
        assert "application_id" in app_obj and app_obj.get("current_status") == "DRAFT"
        return app_obj["application_id"]

    # Helper function to submit application (Draft->Submitted)
    def submit_application(app_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/applications/{app_id}/submit"
        resp = requests.post(url, headers=HEADERS_OWNER_APPLICANT, json={}, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Submit application failed: {resp.text}"
        app_obj = resp.json()
        assert app_obj.get("current_status") == "SUBMITTED"
        return app_obj["application_id"]

    # Helper function to do scrutiny ACCEPT as LMO
    def scrutiny_accept(app_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/applications/{app_id}/scrutiny"
        payload = {"action": "ACCEPT"}
        resp = requests.post(url, headers=HEADERS_LMO, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Scrutiny ACCEPT failed: {resp.text}"

    # Helper function to assess fee as LMO
    def assess_fee(app_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/applications/{app_id}/fee"
        payload = {"base_verification_fee": 500}
        resp = requests.post(url, headers=HEADERS_LMO, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Fee assessment failed: {resp.text}"

    # Helper function to pay as OWNER
    def pay_application(app_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/applications/{app_id}/pay"
        payload = {"receipt_number": f"RCPT-{uuid.uuid4().hex[:8]}"}
        resp = requests.post(url, headers=HEADERS_OWNER_APPLICANT, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Payment failed: {resp.text}"

    # Helper function to schedule as LMO
    def schedule_application(app_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/applications/{app_id}/schedule"
        slot_start = datetime.utcnow() + timedelta(days=1)
        slot_end = slot_start + timedelta(hours=1)
        payload = {
            "slot_start": slot_start.isoformat() + "Z",
            "slot_end": slot_end.isoformat() + "Z"
        }
        resp = requests.post(url, headers=HEADERS_LMO, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Scheduling failed: {resp.text}"

    # Helper function to create verification session as LMO
    def create_session(app_id, instrument_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions"
        payload = {
            "application_id": app_id,
            "instrument_id": instrument_id
        }
        resp = requests.post(url, headers=HEADERS_LMO, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Session create failed: {resp.text}"
        session_obj = resp.json()
        assert "session_id" in session_obj
        return session_obj["session_id"]

    # Helper function to confirm identity (serial_verified true)
    def confirm_identity(session_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions/{session_id}/identity"
        payload = {"serial_verified": True}
        resp = requests.post(url, headers=HEADERS_LMO, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Identity confirm failed: {resp.text}"

    # Helper function to start verification session
    def start_session(session_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions/{session_id}/start"
        resp = requests.post(url, headers=HEADERS_LMO, json={}, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Session start failed: {resp.text}"

    # Helper function to post observations expecting readings equal nominal_load
    def post_observations(session_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions/{session_id}/observations"
        # Build observations:
        # At least one ZERO_TEST with nominal_load=0, raw_indication_reading=0
        # At least one INCREASING_LOAD with nominal_load=x, raw_indication_reading=x
        observations = [
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
                "nominal_load": 10,
                "load_unit": "kg",
                "raw_indication_reading": 10,
                "reading_unit": "kg"
            },
            {
                "step_type": "INCREASING_LOAD",
                "step_sequence": 3,
                "nominal_load": 20,
                "load_unit": "kg",
                "raw_indication_reading": 20,
                "reading_unit": "kg"
            }
        ]
        payload = {
            "reference_standard_ids": ["STD-MASS-CLASS-M1-002"],
            "observations": observations
        }
        resp = requests.post(url, headers=HEADERS_LMO, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Posting observations failed: {resp.text}"

    # Helper function to post disposition outcome
    def post_disposition(session_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions/{session_id}/disposition"
        payload = {"outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION"}
        resp = requests.post(url, headers=HEADERS_LMO, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Disposition post failed: {resp.text}"

    # Helper function to record physical stamp/seal
    def record_stamp(session_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/sessions/{session_id}/stamps"
        seal_id = f"DL-SEAL-2026-{uuid.uuid4().hex[:6].upper()}"
        payload = {
            "seal_identification_number": seal_id,
            "seal_position": "TERMINAL_BLOCK"
        }
        resp = requests.post(url, headers=HEADERS_LMO, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Stamp record failed: {resp.text}"
        stamp_obj = resp.json()
        assert "stamp_action_id" in stamp_obj, "stamp_action_id missing in stamp response"

    # Helper function to issue certificate from session
    def issue_certificate(session_id):
        url = f"{BASE_URL}/api/v1/tenants/{TENANT}/certificates/issue"
        payload = {
            "session_id": session_id,
            "validity_months": 12
        }
        resp = requests.post(url, headers=HEADERS_LMO, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Certificate issue failed: {resp.text}"
        cert_obj = resp.json()
        assert "certificate_id" in cert_obj and "public_verification_token" in cert_obj
        return cert_obj["certificate_id"], cert_obj["public_verification_token"]

    # Begin test workflow
    try:
        instrument_id = create_instrument()
        application_id = create_application(instrument_id)
        application_id = submit_application(application_id)
        scrutiny_accept(application_id)
        assess_fee(application_id)
        pay_application(application_id)
        schedule_application(application_id)
        session_id = create_session(application_id, instrument_id)
        confirm_identity(session_id)
        start_session(session_id)
        post_observations(session_id)
        post_disposition(session_id)
        record_stamp(session_id)
        certificate_id, public_verification_token = issue_certificate(session_id)

        # Now perform public PDF download by QR reference without auth headers
        pdf_url = f"{BASE_URL}/api/v1/public/certificates/{public_verification_token}/pdf"
        resp = requests.get(pdf_url, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Public PDF download failed: {resp.status_code}"
        assert resp.headers.get("Content-Type") == "application/pdf", f"Unexpected Content-Type: {resp.headers.get('Content-Type')}"
        assert resp.content and len(resp.content) > 0, "Empty PDF content"

        # Try invalid random token, expect 404
        invalid_token = f"INVALID-{uuid.uuid4().hex[:12]}"
        invalid_url = f"{BASE_URL}/api/v1/public/certificates/{invalid_token}/pdf"
        resp = requests.get(invalid_url, timeout=TIMEOUT)
        assert resp.status_code == 404, f"Expected 404 for invalid token but got {resp.status_code}"

    finally:
        # Cleanup: no explicit delete endpoints given in PRD, skip cleanup or implement if API supports
        pass

test_download_public_certificate_pdf_by_qr_reference()