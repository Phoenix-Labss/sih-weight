import requests

def test_get_health_check_status():
    url = "http://127.0.0.1:8000/health"
    headers = {
        # No authentication headers needed as per requirements
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        json_data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(json_data, dict), "Response JSON is not an object (dict)"
    # Check expected keys indicative of service health and engine metadata. Since schema is generic object, check key presence heuristically
    expected_keys = ["status", "engine", "version", "uptime"]
    # It is common that health endpoints include "status" or "engine" fields - check at least some keys exist
    keys_present = any(key in json_data for key in expected_keys)
    assert keys_present, f"Response JSON does not contain expected keys {expected_keys}"

test_get_health_check_status()