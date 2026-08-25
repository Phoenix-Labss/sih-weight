import requests
import uuid
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"
TIMEOUT = 30
TENANT_ID = "tenant-delhi-central"
HEADERS_OWNER = {
    "Content-Type": "application/json",
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT_ID,
}
HEADERS_LMO = {
    "Content-Type": "application/json",
    "X-Actor-Role": "LMO",
    "X-Tenant-Id": TENANT_ID,
}


def test_issue_and_retrieve_certificate():
    instrument_id = None
    application_id = None
    session_id = None
    certificate_id = None
    try:
        # Step 1: Fetch models to get a valid model_id
        models_resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models",
            headers=HEADERS_OWNER,
            timeout=TIMEOUT,
        )
        assert models_resp.status_code == 200, "Failed to get models"
        models = models_resp.json()
        assert isinstance(models, list) and len(models) > 0, "Models list empty"
        # Use a known model_id from seed per instructions (MOD-NAWI-01 or MOD-NAWI-03)
        valid_model = next(
            (m for m in models if m.get("model_id") in ["MOD-NAWI-01", "MOD-NAWI-03"]),
            None,
        )
        assert valid_model is not None, "Valid model not found in list"
        model_id = valid_model["model_id"]

        # Step 2: Create instrument with model_id and unique serial_number
        serial_number = f"SN-{uuid.uuid4()}"
        instrument_payload = {
            "model_id": model_id,
            "serial_number": serial_number,
        }
        inst_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments",
            headers=HEADERS_OWNER,
            json=instrument_payload,
            timeout=TIMEOUT,
        )
        assert inst_resp.status_code == 201, "Instrument creation failed"
        instrument = inst_resp.json()
        assert "instrument_id" in instrument, "instrument_id missing in response"
        instrument_id = instrument["instrument_id"]

        # Step 3: Create application draft (without applicant_declaration_accepted) for instrument
        application_payload = {
            "instrument_id": instrument_id,
        }
        app_create_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications",
            headers=HEADERS_OWNER,
            json=application_payload,
            timeout=TIMEOUT,
        )
        assert app_create_resp.status_code == 201, "Application draft creation failed"
        application = app_create_resp.json()
        assert "application_id" in application, "application_id missing in response"
        application_id = application["application_id"]

        # Step 4: Submit application to transition from DRAFT -> SUBMITTED
        submit_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit",
            headers=HEADERS_OWNER,
            json={},
            timeout=TIMEOUT,
        )
        assert submit_resp.status_code == 200, "Application submission failed"
        submitted_app = submit_resp.json()
        assert submitted_app["application_id"] == application_id
        # Application status is assumed to be SUBMITTED here

        # Step 5: Create session for the submitted application and instrument with role LMO
        session_payload = {
            "application_id": application_id,
            "instrument_id": instrument_id,
        }
        session_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions",
            headers=HEADERS_LMO,
            json=session_payload,
            timeout=TIMEOUT,
        )
        assert session_resp.status_code == 201, "Session creation failed"
        session = session_resp.json()
        assert "session_id" in session, "session_id missing in response"
        session_id = session["session_id"]

        # Step 6: Confirm instrument identity for the session
        identity_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity",
            headers=HEADERS_LMO,
            json={"serial_verified": True},
            timeout=TIMEOUT,
        )
        assert identity_resp.status_code == 200, "Identity confirmation failed"

        # Step 7: Start the verification testing
        start_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/start",
            headers=HEADERS_LMO,
            json={},
            timeout=TIMEOUT,
        )
        assert start_resp.status_code == 200, "Session start failed"

        # Step 8: Submit observations with reference standard and observation items
        # Use known reference_standard_id and observation per instruction #7 and #8
        observations_payload = {
            "reference_standard_ids": ["STD-MASS-CLASS-M1-002"],
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": 0,
                    "raw_indication_reading": 0,
                    "load_unit": "kg",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 2,
                    "nominal_load": 5,
                    "raw_indication_reading": 5,
                    "load_unit": "kg",
                },
            ],
        }
        observations_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/observations",
            headers=HEADERS_LMO,
            json=observations_payload,
            timeout=TIMEOUT,
        )
        assert observations_resp.status_code == 200, "Observations submission failed"

        # Step 9: Submit disposition with outcome VERIFICATION_PASSED_PENDING_AUTHORIZATION
        disposition_payload = {
            "outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION",
        }
        disposition_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/disposition",
            headers=HEADERS_LMO,
            json=disposition_payload,
            timeout=TIMEOUT,
        )
        assert disposition_resp.status_code == 200, "Disposition submission failed"

        # Step 10: Issue certificate from eligible session
        issue_payload = {
            "session_id": session_id,
            "validity_months": 12,
            "signer_notes": "Automated test issuance",
        }
        issue_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates/issue",
            headers=HEADERS_LMO,
            json=issue_payload,
            timeout=TIMEOUT,
        )
        assert issue_resp.status_code == 201, "Certificate issuance failed"
        certificate = issue_resp.json()
        assert "certificate_id" in certificate, "certificate_id missing in response"
        assert "public_verification_token" in certificate, "public_verification_token missing"
        assert "qr_code_payload" in certificate, "qr_code_payload missing"
        certificate_id = certificate["certificate_id"]
        public_verification_token = certificate["public_verification_token"]

        # Step 11: Retrieve issued certificate details
        get_cert_resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates/{certificate_id}",
            headers=HEADERS_LMO,
            timeout=TIMEOUT,
        )
        assert get_cert_resp.status_code == 200, "Certificate retrieval failed"
        cert_details = get_cert_resp.json()
        assert cert_details["certificate_id"] == certificate_id
        # Optional checks on cert fields can be added here

    finally:
        # Cleanup: Delete certificate if possible (no delete endpoint described)
        # No delete endpoint provided for certificates.

        # Delete session if possible (no delete endpoint described)
        # No delete endpoint provided for sessions.

        # Delete application if possible (not described)
        # No delete endpoint described.

        # Delete instrument if possible (not described)
        # No delete endpoint described.

        pass


test_issue_and_retrieve_certificate()