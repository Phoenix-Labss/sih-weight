import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"
MODEL_ID = "MOD-NAWI-03"
HEADERS_OWNER = {
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json",
}
HEADERS_OWNER_WRONG_TENANT = {
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": "tenant-mumbai-central",
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json",
}

import json


def test_negative_cross_tenant_access_application_denied():
    instrument_id = None
    application_id = None
    instrument_created = False
    application_created = False

    try:
        # Step 1: GET instrument models to find model_id MOD-NAWI-03
        url_models = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
        response = requests.get(url_models, headers=HEADERS_OWNER, timeout=30)
        assert response.status_code == 200, f"Failed to get instrument models: {response.text}"
        models = response.json()
        model_ids = [model.get("model_id") for model in models if "model_id" in model]
        assert MODEL_ID in model_ids, f"Model {MODEL_ID} not found in models list"

        # Step 2: POST instruments with {"model_id": "MOD-NAWI-03", "serial_number": "<unique>"}
        unique_serial_number = f"SN-{uuid.uuid4().hex[:12]}"
        url_instruments = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
        instrument_payload = {"model_id": MODEL_ID, "serial_number": unique_serial_number}
        response = requests.post(url_instruments, headers=HEADERS_OWNER, json=instrument_payload, timeout=30)
        assert response.status_code == 201, f"Failed to create instrument: {response.text}"
        instrument = response.json()
        assert "instrument_id" in instrument
        instrument_id = instrument["instrument_id"]
        instrument_created = True

        # Step 3: POST applications with {"instrument_id": instrument_id}
        url_applications = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
        application_payload = {"instrument_id": instrument_id}
        response = requests.post(url_applications, headers=HEADERS_OWNER, json=application_payload, timeout=30)
        assert response.status_code == 201, f"Failed to create application: {response.text}"
        application = response.json()
        assert "application_id" in application
        application_id = application["application_id"]
        application_created = True
        assert application.get("current_status", "").upper() == "DRAFT"

        # Step 4: GET application with header X-Tenant-Id replaced by 'tenant-mumbai-central' expecting 403 or 404
        url_app_single = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}"
        headers_wrong_tenant = HEADERS_OWNER_WRONG_TENANT.copy()
        # Remove Content-Type because GET should not set that or if set server should ignore
        headers_wrong_tenant.pop("Content-Type", None)
        response_wrong_tenant = requests.get(url_app_single, headers=headers_wrong_tenant, timeout=30)
        assert response_wrong_tenant.status_code in {403, 404}, (
            f"Cross-tenant access not denied as expected, got status {response_wrong_tenant.status_code}"
        )
        # The response must not leak application data
        body_wrong = response_wrong_tenant.json() if response_wrong_tenant.headers.get("Content-Type", "").startswith("application/json") else {}
        assert not ("application_id" in body_wrong and body_wrong.get("application_id") == application_id), "Application data leaked in cross-tenant access"

        # Step 5: GET application with correct tenant expecting 200
        headers_correct = HEADERS_OWNER.copy()
        headers_correct.pop("Content-Type", None)
        response_correct = requests.get(url_app_single, headers=headers_correct, timeout=30)
        assert response_correct.status_code == 200, f"Failed to get application with correct tenant: {response_correct.text}"
        app_data = response_correct.json()
        assert app_data.get("application_id") == application_id, "Returned application_id mismatch"
        # Application data not None and contains expected keys
        assert "current_status" in app_data

    finally:
        # Cleanup: delete created application and instrument if possible
        # No DELETE endpoints described in PRD, so no cleanup steps because no API for delete mentioned.
        # Hence, cleanup will be omitted as per specs because no DELETE described.
        pass


test_negative_cross_tenant_access_application_denied()