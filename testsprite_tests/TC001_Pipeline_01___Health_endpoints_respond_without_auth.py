import requests

def test_TC001_pipeline_01_health_endpoints_respond_without_auth():
    base_url = "http://127.0.0.1:8000"

    # Test GET /health without auth headers
    health_url = f"{base_url}/health"
    try:
        resp_health = requests.get(health_url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request to {health_url} failed: {e}"
    assert resp_health.status_code == 200, f"Expected status 200 for {health_url}, got {resp_health.status_code}"
    try:
        json_health = resp_health.json()
    except Exception as e:
        assert False, f"Response from {health_url} was not valid JSON: {e}"
    # Validate JSON contains "status":"HEALTHY" (case-sensitive) and service metadata keys presence
    assert "status" in json_health, f"'status' key not in response JSON from {health_url}"
    assert json_health["status"] == "HEALTHY", f"Expected status 'HEALTHY' at {health_url}, got {json_health['status']}"
    # Service metadata presence check - at least one other key besides status ideally present
    assert len(json_health) > 1, f"No service metadata found in response from {health_url}"

    # Test GET /api/v1/health without auth headers
    api_health_url = f"{base_url}/api/v1/health"
    try:
        resp_api_health = requests.get(api_health_url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request to {api_health_url} failed: {e}"
    assert resp_api_health.status_code == 200, f"Expected status 200 for {api_health_url}, got {resp_api_health.status_code}"
    try:
        json_api_health = resp_api_health.json()
    except Exception as e:
        assert False, f"Response from {api_health_url} was not valid JSON: {e}"
    # Validate JSON contains "status":"HEALTHY" and "version" key
    assert "status" in json_api_health, f"'status' key not in response JSON from {api_health_url}"
    assert json_api_health["status"] == "HEALTHY", f"Expected status 'HEALTHY' at {api_health_url}, got {json_api_health['status']}"
    assert "version" in json_api_health, f"'version' key not in response JSON from {api_health_url}"

test_TC001_pipeline_01_health_endpoints_respond_without_auth()