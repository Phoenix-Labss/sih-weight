import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"

def test_negative_unknown_qr_reference_yields_structured_not_found():
    timeout = 30

    unknown_ref = "TOTALLY-UNKNOWN-REF"
    verify_url = f"{BASE_URL}/api/v1/public/certificates/verify/{unknown_ref}"
    alias_url = f"{BASE_URL}/v/{unknown_ref}"

    # Call 1: GET /api/v1/public/certificates/verify/TOTALLY-UNKNOWN-REF without auth headers
    resp1 = requests.get(verify_url, timeout=timeout)
    assert resp1.status_code == 404, f"Expected 404 for unknown QR reference verify URL, got {resp1.status_code}"
    try:
        body1 = resp1.json()
        assert "detail" in body1 and body1["detail"], "Response JSON must contain non-empty 'detail' key"
    except Exception as e:
        raise AssertionError(f"Response body not valid JSON or missing 'detail': {e}")

    # Call 2: GET /v/TOTALLY-UNKNOWN-REF without auth headers (alias route)
    resp2 = requests.get(alias_url, timeout=timeout)
    assert resp2.status_code == 404, f"Expected 404 for unknown QR reference alias URL, got {resp2.status_code}"
    try:
        body2 = resp2.json()
        assert "detail" in body2 and body2["detail"], "Alias response JSON must contain non-empty 'detail' key"
    except Exception as e:
        raise AssertionError(f"Alias response body not valid JSON or missing 'detail': {e}")

test_negative_unknown_qr_reference_yields_structured_not_found()