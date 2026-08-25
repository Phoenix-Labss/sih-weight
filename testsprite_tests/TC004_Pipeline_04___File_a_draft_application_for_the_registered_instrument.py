import requests
import uuid
import re

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"
HEADERS_OWNER = {
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json"
}

def test_tc004_file_draft_application_for_registered_instrument():
    try:
        # Step 1: GET instrument models, find MOD-NAWI-03
        models_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
        resp = requests.get(models_url, headers=HEADERS_OWNER, timeout=30)
        resp.raise_for_status()
        models = resp.json()
        assert isinstance(models, list) and len(models) > 0, "Model list empty or invalid"
        mod_nawi_03 = None
        for model in models:
            if model.get("model_id") == "MOD-NAWI-03":
                mod_nawi_03 = model
                break
        assert mod_nawi_03 is not None, "MOD-NAWI-03 model not found in model catalog"

        # Step 2: POST to register new instrument with MOD-NAWI-03 and unique serial_number
        instruments_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
        serial_number = f"SN-{uuid.uuid4().hex[:12]}"
        instrument_payload = {
            "model_id": "MOD-NAWI-03",
            "serial_number": serial_number
        }
        resp = requests.post(instruments_url, headers=HEADERS_OWNER, json=instrument_payload, timeout=30)
        resp.raise_for_status()
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}"
        instrument = resp.json()
        instrument_id = instrument.get("instrument_id")
        assert instrument_id, "instrument_id missing in response"
        assert instrument.get("model_id") == "MOD-NAWI-03", "model_id mismatch in instrument creation"
        assert instrument.get("serial_number") == serial_number, "serial_number mismatch in instrument creation"
        assert instrument.get("current_status") == "UNVERIFIED", "instrument current_status is not UNVERIFIED"
        assert "public_instrument_token" in instrument and instrument["public_instrument_token"], "public_instrument_token missing or empty"

        # Optional: GET the created instrument to confirm serial number match
        instrument_detail_url = f"{instruments_url}/{instrument_id}"
        resp = requests.get(instrument_detail_url, headers=HEADERS_OWNER, timeout=30)
        resp.raise_for_status()
        instrument_detail = resp.json()
        assert instrument_detail.get("instrument_id") == instrument_id, "Instrument ID mismatch on detail fetch"
        assert instrument_detail.get("serial_number") == serial_number, "Serial number mismatch on detail fetch"

        # Step 3: POST to create draft application linked to the instrument (WITHOUT applicant_declaration_accepted)
        applications_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
        application_payload = {
            "instrument_id": instrument_id
        }
        resp = requests.post(applications_url, headers=HEADERS_OWNER, json=application_payload, timeout=30)
        resp.raise_for_status()
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}"
        application = resp.json()
        application_id = application.get("application_id")
        assert application_id, "application_id missing in response"
        application_number = application.get("application_number")
        assert application_number and re.match(r"APP-2026-DL-[\w\d\-]+", application_number), "application_number format invalid"
        assert application.get("current_status") == "DRAFT", "application current_status is not DRAFT"
        linked_instrument_id = application.get("instrument_id")
        assert linked_instrument_id == instrument_id, "application instrument_id linkage incorrect"

    finally:
        # Cleanup: delete the created instrument and application if possible to keep environment clean
        # No deletion endpoints provided explicitly, but if they exist, could call them here
        pass

test_tc004_file_draft_application_for_registered_instrument()