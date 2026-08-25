import requests
import uuid

def test_pipeline_03_register_new_instrument():
    base_url = "http://127.0.0.1:8000"
    tenant_id = "tenant-delhi-central"
    jurisdiction_id = "jur-dl-01"
    model_id_target = "MOD-NAWI-03"
    timeout = 30

    headers_owner = {
        "X-Actor-Role": "OWNER",
        "X-Tenant-Id": tenant_id,
        "X-Jurisdiction-Id": jurisdiction_id,
        "Content-Type": "application/json"
    }

    # Step 1: GET models catalog to find model_id MOD-NAWI-03
    models_url = f"{base_url}/api/v1/tenants/{tenant_id}/instruments/models"
    try:
        resp_models = requests.get(models_url, headers=headers_owner, timeout=timeout)
        resp_models.raise_for_status()
        models = resp_models.json()
    except Exception as e:
        raise AssertionError(f"Failed to GET instrument models catalog: {e}")
    # Check model MOD-NAWI-03 present
    model_found = None
    for m in models:
        if m.get("model_id") == model_id_target:
            model_found = m
            break
    assert model_found is not None, f"Model {model_id_target} not found in models catalog"

    # Step 2: POST instrument registration with model_id MOD-NAWI-03 and unique serial_number
    serial_number = f"SN-{uuid.uuid4().hex[:12]}"
    instruments_url = f"{base_url}/api/v1/tenants/{tenant_id}/instruments"
    instrument_payload = {
        "model_id": model_id_target,
        "serial_number": serial_number
    }
    try:
        resp_create = requests.post(instruments_url, headers=headers_owner, json=instrument_payload, timeout=timeout)
    except Exception as e:
        raise AssertionError(f"Failed to POST instrument registration: {e}")

    assert resp_create.status_code == 201, f"Instrument creation returned {resp_create.status_code}, expected 201"
    instrument_data = resp_create.json()

    # Validate response fields
    instrument_id = instrument_data.get("instrument_id")
    assert instrument_id, "instrument_id missing in creation response"
    assert instrument_data.get("model_id") == model_id_target, f"model_id in response expected {model_id_target}, got {instrument_data.get('model_id')}"
    assert instrument_data.get("serial_number") == serial_number, f"serial_number echoed does not match"
    assert instrument_data.get("current_status") == "UNVERIFIED", f"current_status expected 'UNVERIFIED', got {instrument_data.get('current_status')}"
    assert instrument_data.get("public_instrument_token"), "public_instrument_token missing in creation response"

    # Step 3: GET the registered instrument by instrument_id and verify serial_number matches
    instrument_get_url = f"{base_url}/api/v1/tenants/{tenant_id}/instruments/{instrument_id}"
    try:
        resp_get = requests.get(instrument_get_url, headers=headers_owner, timeout=timeout)
        resp_get.raise_for_status()
        instrument_get = resp_get.json()
    except Exception as e:
        raise AssertionError(f"Failed to GET instrument by id: {e}")

    assert instrument_get.get("serial_number") == serial_number, f"GET instrument serial_number {instrument_get.get('serial_number')} does not match created {serial_number}"

test_pipeline_03_register_new_instrument()