import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"
HEADERS = {
    "Content-Type": "application/json",
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
}

def test_register_new_instrument():
    # Step 1: GET models from /api/v1/tenants/tenant-delhi-central/instruments/models
    models_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
    try:
        resp = requests.get(models_url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        models = resp.json()
        assert isinstance(models, list), "Models response is not a list"
        assert len(models) > 0, "No models found in response"
        # select first model_id
        model_id = models[0].get("model_id")
        assert model_id is not None and model_id != "", "model_id missing or empty"
    except Exception as e:
        raise AssertionError(f"Failed to get instrument models: {e}")

    # Step 2: POST to register new instrument with model_id and unique serial_number
    instruments_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
    serial_number = f"SN-{uuid.uuid4().hex[:12]}"
    payload = {
        "model_id": model_id,
        "serial_number": serial_number,
    }
    try:
        resp = requests.post(instruments_url, json=payload, headers=HEADERS, timeout=30)
        if resp.status_code != 201:
            raise AssertionError(f"Expected status 201, got {resp.status_code}: {resp.text}")
        instrument = resp.json()
        # Validate response includes instrument_id and echoes model_id and serial_number
        assert "instrument_id" in instrument and instrument["instrument_id"], "instrument_id missing or empty"
        assert instrument.get("model_id") == model_id, "Returned model_id does not match"
        assert instrument.get("serial_number") == serial_number, "Returned serial_number does not match"
    except Exception as e:
        raise AssertionError(f"Failed to register new instrument: {e}")

test_register_new_instrument()