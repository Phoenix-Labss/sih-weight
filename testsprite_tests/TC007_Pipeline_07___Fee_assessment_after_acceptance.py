import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"
MODEL_ID = "MOD-NAWI-03"
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

def test_pipeline_07_fee_assessment_after_acceptance():
    # Step 1: GET /instruments/models as OWNER and find MOD-NAWI-03
    url_models = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
    resp = requests.get(url_models, headers=HEADERS_OWNER, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Expected 200 for models, got {resp.status_code}"
    models = resp.json()
    model_ids = [m["model_id"] for m in models if "model_id" in m]
    assert MODEL_ID in model_ids, f"Model {MODEL_ID} not found in models"

    # Step 2: POST /instruments as OWNER to create instrument with unique serial_number
    serial_number = f"SN-{uuid.uuid4().hex[:12]}"
    url_instruments = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
    instrument_payload = {"model_id": MODEL_ID, "serial_number": serial_number}
    resp = requests.post(url_instruments, headers=HEADERS_OWNER, json=instrument_payload, timeout=TIMEOUT)
    assert resp.status_code == 201, f"Expected 201 on instrument creation, got {resp.status_code}"
    instrument = resp.json()
    instrument_id = instrument.get("instrument_id")
    assert instrument_id, "instrument_id missing in instrument creation response"

    # Step 3: POST /applications with instrument_id as OWNER -> application_id (DRAFT)
    url_applications = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
    application_payload = {"instrument_id": instrument_id}
    resp = requests.post(url_applications, headers=HEADERS_OWNER, json=application_payload, timeout=TIMEOUT)
    assert resp.status_code == 201, f"Expected 201 on application creation, got {resp.status_code}"
    application = resp.json()
    application_id = application.get("application_id")
    assert application_id, "application_id missing in application creation response"

    try:
        # Step 4: POST /applications/:application_id/submit with json={} as OWNER (SUBMITTED)
        url_submit = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit"
        resp = requests.post(url_submit, headers=HEADERS_OWNER, json={}, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Expected 200 on application submit, got {resp.status_code}"
        application_submitted = resp.json()

        # Step 5: POST /applications/:application_id/scrutiny as LMO {"action":"ACCEPT"}
        url_scrutiny = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny"
        scrutiny_payload = {"action": "ACCEPT"}
        resp = requests.post(url_scrutiny, headers=HEADERS_LMO, json=scrutiny_payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Expected 200 on scrutiny accept, got {resp.status_code}"
        scrutiny_response = resp.json()

        # Step 6: POST /applications/:application_id/fee as LMO with fee amounts
        url_fee = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee"
        fee_payload = {"base_verification_fee": 500, "user_charge": 50}
        resp = requests.post(url_fee, headers=HEADERS_LMO, json=fee_payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Expected 200 on fee assessment, got {resp.status_code}"
        fee_response = resp.json()

        # Validate top-level current_status equals FEE_PENDING
        current_status = fee_response.get("current_status")
        assert current_status == "FEE_PENDING", f"Expected current_status='FEE_PENDING', got {current_status}"

        # Validate nested fee_assessment object with correct fee amounts and payment status
        fee_assessment = fee_response.get("fee_assessment")
        assert fee_assessment is not None, "fee_assessment missing from response"
        # Validate base_verification_fee==500
        bvf = fee_assessment.get("base_verification_fee")
        assert bvf == 500, f"Expected base_verification_fee=500, got {bvf}"
        # user_charge==50
        uc = fee_assessment.get("user_charge")
        assert uc == 50, f"Expected user_charge=50, got {uc}"
        # late_fee may be absent (optional), total_assessed_amount==550
        total = fee_assessment.get("total_assessed_amount")
        assert total == 550, f"Expected total_assessed_amount=550, got {total}"
        # currency INR
        currency = fee_assessment.get("currency")
        assert currency == "INR", f"Expected currency='INR', got {currency}"
        # payment_status PAYMENT_PENDING
        payment_status = fee_assessment.get("payment_status")
        assert payment_status == "PAYMENT_PENDING", f"Expected payment_status='PAYMENT_PENDING', got {payment_status}"

        # Confirm base_verification_fee NOT at top-level (should be inside fee_assessment only)
        top_level_keys = set(fee_response.keys())
        assert "base_verification_fee" not in top_level_keys, "base_verification_fee should NOT be at top level"

    finally:
        # Cleanup: DELETE the instrument and application if possible (no delete endpoints described so skipping)
        # Generally, test environment would handle cleanup, or those endpoints not exposed.
        pass

test_pipeline_07_fee_assessment_after_acceptance()