import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"
MODEL_ID_EXPECTED = "MOD-NAWI-03"
TIMEOUT = 30

HEADERS_OWNER = {
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json"
}
HEADERS_LMO = {
    "X-Actor-Role": "LMO",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json"
}

def test_pipeline_02_approved_instrument_model_catalog_readable():
    url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
    try:
        response = requests.get(url, headers=HEADERS_OWNER, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed to GET instrument models catalog: {e}"

    assert response.status_code == 200, f"Expected 200 OK but got {response.status_code}"

    try:
        models = response.json()
    except Exception as e:
        assert False, f"Response is not valid JSON: {e}"

    assert isinstance(models, list), f"Expected a list of models but got {type(models)}"
    assert len(models) > 0, "Expected non-empty list of instrument models"

    found_mod_nawi_03 = False
    for model in models:
        assert isinstance(model, dict), "Each model should be a dict"
        for key in ("model_id", "accuracy_class", "verification_scale_interval_e"):
            assert key in model, f"Model missing required field '{key}'"
        if model.get("model_id") == MODEL_ID_EXPECTED:
            found_mod_nawi_03 = True

    assert found_mod_nawi_03, f"Instrument model catalog does not contain the expected model_id '{MODEL_ID_EXPECTED}'"

test_pipeline_02_approved_instrument_model_catalog_readable()