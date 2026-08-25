import requests

def test_list_approved_instrument_models():
    base_url = "http://127.0.0.1:8000"
    tenant_id = "tenant-delhi-central"
    url = f"{base_url}/api/v1/tenants/{tenant_id}/instruments/models"
    headers = {
        "X-Actor-Role": "OWNER",
        "X-Tenant-Id": tenant_id,
        "X-Jurisdiction-Id": "jur-dl-01"
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        models = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(models, list), "Response JSON is not a list"
    # Further validations of model dicts if present
    for model in models:
        assert isinstance(model, dict), "Model entry is not a JSON object"
        assert "id" in model or "model_id" in model, "Model lacks id or model_id"
        # Could further check model fields if needed

test_list_approved_instrument_models()