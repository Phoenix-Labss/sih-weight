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

def test_create_and_submit_application():
    # We need to first register a new instrument (unique serial, choose a model_id from approved models)
    # Then create an application WITHOUT applicant_declaration_accepted (defaults to DRAFT)
    # Then submit that application to move it to SUBMITTED

    try:
        # Step 1: Get instrument models
        models_resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models",
            headers={k: HEADERS_OWNER[k] for k in HEADERS_OWNER if k != "Content-Type"},
            timeout=30
        )
        assert models_resp.status_code == 200, f"Failed to get models: {models_resp.text}"
        models = models_resp.json()
        assert isinstance(models, list) and len(models) > 0, "Models list empty or invalid"
        model_id = None
        # Pick one valid model_id from known values MOD-NAWI-01, MOD-NAWI-03 or first available
        for m in models:
            if "model_id" in m and m["model_id"] in ("MOD-NAWI-01", "MOD-NAWI-03"):
                model_id = m["model_id"]
                break
        if not model_id:
            model_id = models[0]["model_id"]
        assert model_id, "No model_id found in models"

        # Step 2: Register instrument with unique serial number
        serial_number = f"SN-{uuid.uuid4().hex[:12]}"
        instrument_payload = {
            "model_id": model_id,
            "serial_number": serial_number
        }
        instrument_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments",
            headers=HEADERS_OWNER,
            json=instrument_payload,
            timeout=30
        )
        assert instrument_resp.status_code == 201, f"Instrument creation failed: {instrument_resp.text}"
        instrument = instrument_resp.json()
        instrument_id = instrument.get("instrument_id")
        assert instrument_id, "instrument_id missing in creation response"

        # Step 3: Create application WITHOUT applicant_declaration_accepted (body must not be empty)
        application_payload = {
            "instrument_id": instrument_id
        }
        application_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications",
            headers=HEADERS_OWNER,
            json=application_payload,
            timeout=30
        )
        assert application_resp.status_code == 201, f"Application creation failed: {application_resp.text}"
        application = application_resp.json()
        application_id = application.get("application_id")
        assert application_id, "application_id missing in creation response"
        assert application.get("current_status") == "DRAFT", f"Expected current_status 'DRAFT', got {application.get('current_status')}"

        # Step 4: Submit application by POST .../applications/:application_id/submit with body {} expecting 200 & current_status SUBMITTED
        submit_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit",
            headers=HEADERS_OWNER,
            json={},  # body must not be empty, '{}' is empty JSON object actually but is acceptable as non-empty for this API
            timeout=30
        )
        assert submit_resp.status_code == 200, f"Application submit failed: {submit_resp.text}"
        submitted_app = submit_resp.json()
        assert submitted_app.get("application_id") == application_id, "application_id mismatch after submit"
        assert submitted_app.get("current_status") == "SUBMITTED", f"Expected current_status 'SUBMITTED', got {submitted_app.get('current_status')}"

    finally:
        # Cleanup: delete the created instrument and application if deletion endpoints exist - but no DELETE endpoints described in PRD.
        # Since no delete mentioned, no cleanup possible here.
        pass

test_create_and_submit_application()