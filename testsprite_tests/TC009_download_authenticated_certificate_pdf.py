import requests

BASE_URL = "http://127.0.0.1:8000"
TIMEOUT = 30
HEADERS = {
    "Content-Type": "application/json",
    # Authentication headers as per known demonstration mode
    "X-Actor-Role": "ADMIN",
    # Tenant ID to be set per test tenant created/used
}

def test_download_authenticated_certificate_pdf():
    tenant_id = "tenant-delhi-central"
    HEADERS["X-Tenant-Id"] = tenant_id

    created_instrument_id = None
    created_application_id = None
    created_session_id = None
    created_certificate_id = None

    try:
        # 1. Get instrument models to pick a valid model_id
        models_resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/instruments/models",
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert models_resp.status_code == 200, f"Failed to get models: {models_resp.text}"
        models = models_resp.json()
        assert isinstance(models, list) and len(models) > 0, "Models list empty"
        model_id = None
        for m in models:
            if "model_id" in m:
                model_id = m["model_id"]
                break
        assert model_id is not None, "No model_id found in models"

        # 2. Register new instrument with model_id and serial_number
        instrument_payload = {
            "model_id": model_id,
            "serial_number": "SN-DOWNLOAD-PDF-001"
        }
        inst_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/instruments",
            json=instrument_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert inst_resp.status_code == 201, f"Instrument creation failed: {inst_resp.text}"
        instrument = inst_resp.json()
        assert "instrument_id" in instrument, "Created instrument missing instrument_id"
        created_instrument_id = instrument["instrument_id"]

        # 3. Create draft application (no applicant_declaration_accepted to remain draft)
        application_payload = {
            "instrument_id": created_instrument_id
        }
        app_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/applications",
            json=application_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert app_resp.status_code == 201, f"Application creation failed: {app_resp.text}"
        application = app_resp.json()
        assert "application_id" in application, "Created application missing application_id"
        created_application_id = application["application_id"]

        # 4. Submit application to transition to SUBMITTED
        submit_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/applications/{created_application_id}/submit",
            json={},
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert submit_resp.status_code == 200, f"Submit application failed: {submit_resp.text}"

        # 5. Issue verification session from application and instrument
        session_payload = {
            "application_id": created_application_id,
            "instrument_id": created_instrument_id
        }
        session_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/sessions",
            json=session_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert session_resp.status_code == 201, f"Session creation failed: {session_resp.text}"
        session = session_resp.json()
        assert "session_id" in session, "Created session missing session_id"
        created_session_id = session["session_id"]

        # 6. Identity confirm session with serial_verified=true
        identity_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/sessions/{created_session_id}/identity",
            json={"serial_verified": True},
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert identity_resp.status_code == 200, f"Identity confirmation failed: {identity_resp.text}"

        # 7. Start verification session
        start_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/sessions/{created_session_id}/start",
            json={},
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert start_resp.status_code == 200, f"Session start failed: {start_resp.text}"

        # 8. Submit observations (at least one observation matching PRD)
        observations_payload = {
            "reference_standard_ids": ["STD-MASS-CLASS-M1-002"],
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": 0,
                    "raw_indication_reading": 0,
                    "load_unit": "kg"
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 2,
                    "nominal_load": 10,
                    "raw_indication_reading": 10,
                    "load_unit": "kg"
                }
            ]
        }
        obs_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/sessions/{created_session_id}/observations",
            json=observations_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert obs_resp.status_code == 200, f"Submitting observations failed: {obs_resp.text}"

        # 9. Record disposition outcome VERIFICATION_PASSED_PENDING_AUTHORIZATION
        disposition_payload = {
            "outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION"
        }
        disposition_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/sessions/{created_session_id}/disposition",
            json=disposition_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert disposition_resp.status_code == 200, f"Disposition recording failed: {disposition_resp.text}"

        # 10. Issue certificate from eligible session
        cert_issue_payload = {
            "session_id": created_session_id
        }
        cert_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/certificates/issue",
            json=cert_issue_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert cert_resp.status_code == 201, f"Certificate issuing failed: {cert_resp.text}"
        certificate = cert_resp.json()
        assert "certificate_id" in certificate, "Issued certificate missing certificate_id"
        created_certificate_id = certificate["certificate_id"]

        # 11. Finally, GET the certificate PDF bytes authenticated
        pdf_resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{tenant_id}/certificates/{created_certificate_id}/pdf",
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert pdf_resp.status_code == 200, f"Fetching certificate PDF failed: {pdf_resp.text}"
        content_type = pdf_resp.headers.get("Content-Type", "")
        assert content_type == "application/pdf", f"Invalid content type for PDF: {content_type}"
        assert len(pdf_resp.content) > 1000, "PDF content seems too small, possibly invalid"

    finally:
        # Cleanup: Attempt to delete created certificate, session, application, instrument if API supports
        # No deletion endpoints described in PRD, so skipping explicit deletion.
        # Leaving this block for extension if supported in future.
        pass

test_download_authenticated_certificate_pdf()