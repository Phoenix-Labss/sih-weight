import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"
HEADERS_OWNER = {
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json",
}
TIMEOUT = 30


def test_TC005_pipeline_05_submit_draft_application():
    instrument_id = None
    application_id = None

    try:
        # Step 1: GET /api/v1/tenants/tenant-delhi-central/instruments/models with OWNER headers
        url_models = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
        response = requests.get(url_models, headers=HEADERS_OWNER, timeout=TIMEOUT)
        response.raise_for_status()
        models = response.json()
        # Find model_id MOD-NAWI-03
        model = next((m for m in models if m.get("model_id") == "MOD-NAWI-03"), None)
        assert model is not None, "Model MOD-NAWI-03 not found in instrument models"

        # Step 2: POST /api/v1/tenants/tenant-delhi-central/instruments with {"model_id":"MOD-NAWI-03","serial_number":"<unique>"}
        url_instruments = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
        serial_number = f"SN-{uuid.uuid4().hex[:12]}"
        instrument_payload = {
            "model_id": "MOD-NAWI-03",
            "serial_number": serial_number
        }
        response = requests.post(url_instruments, headers=HEADERS_OWNER, json=instrument_payload, timeout=TIMEOUT)
        response.raise_for_status()
        instrument = response.json()
        instrument_id = instrument.get("instrument_id")
        assert response.status_code == 201, "Instrument creation did not return 201"
        assert instrument_id, "instrument_id missing in create instrument response"
        assert instrument.get("model_id") == "MOD-NAWI-03", "Returned model_id mismatch"
        assert instrument.get("serial_number") == serial_number, "Returned serial_number mismatch"
        # current_status and public_instrument_token presence checked loosely due to uncertainty of exact field name
        assert "current_status" in instrument, "current_status missing in create instrument response"
        assert instrument["current_status"] == "UNVERIFIED", "Expected current_status UNVERIFIED on new instrument"
        assert "public_instrument_token" in instrument, "public_instrument_token missing in create instrument response"

        # Step 3: POST /api/v1/tenants/tenant-delhi-central/applications with OWNER headers and {"instrument_id":instrument_id}
        url_applications = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
        application_payload = {
            "instrument_id": instrument_id
        }
        response = requests.post(url_applications, headers=HEADERS_OWNER, json=application_payload, timeout=TIMEOUT)
        response.raise_for_status()
        application = response.json()
        application_id = application.get("application_id")
        assert response.status_code == 201, "Application creation did not return 201"
        assert application_id, "application_id missing in create application response"
        assert application.get("instrument_id") == instrument_id, "Application's instrument_id mismatch"
        assert "current_status" in application, "current_status missing in application response"
        assert application["current_status"] == "DRAFT", "Expected current_status DRAFT on new application"
        assert "application_number" in application and application["application_number"].startswith("APP-2026-DL-"), \
            "application_number missing or has wrong format"

        # Step 4: POST .../applications/:application_id/submit with body {} as OWNER
        url_submit = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit"
        submit_payload = {}  # Required non-empty JSON body
        response = requests.post(url_submit, headers=HEADERS_OWNER, json=submit_payload, timeout=TIMEOUT)
        response.raise_for_status()
        submitted_application = response.json()
        assert response.status_code == 200, "Submit application did not return 200"
        assert "current_status" in submitted_application, "current_status missing in submit response"
        # Confirm status changed from DRAFT to SUBMITTED
        assert submitted_application["current_status"] == "SUBMITTED", \
            f"Expected current_status SUBMITTED after submit, got {submitted_application['current_status']}"

    finally:
        # Cleanup: delete application and instrument if created (try-finally to avoid pollution)
        if application_id is not None:
            try:
                url_delete_application = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}"
                requests.delete(url_delete_application, headers=HEADERS_OWNER, timeout=TIMEOUT)
            except Exception:
                pass
        if instrument_id is not None:
            try:
                url_delete_instrument = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/{instrument_id}"
                requests.delete(url_delete_instrument, headers=HEADERS_OWNER, timeout=TIMEOUT)
            except Exception:
                pass


test_TC005_pipeline_05_submit_draft_application()