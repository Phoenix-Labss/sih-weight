import requests
import uuid

def test_TC021_negative_duplicate_application_submit_rejected_by_state_machine():
    base_url = "http://127.0.0.1:8000"
    tenant_id = "tenant-delhi-central"
    jurisdiction_id = "jur-dl-01"
    model_id_to_use = "MOD-NAWI-03"

    headers_owner = {
        "X-Actor-Role": "OWNER",
        "X-Tenant-Id": tenant_id,
        "X-Jurisdiction-Id": jurisdiction_id,
        "Content-Type": "application/json",
    }

    # Step 1: GET models catalog and find the required model_id MOD-NAWI-03
    url_models = f"{base_url}/api/v1/tenants/{tenant_id}/instruments/models"
    try:
        resp = requests.get(url_models, headers=headers_owner, timeout=30)
        resp.raise_for_status()
        models = resp.json()
        model_found = any(m.get("model_id") == model_id_to_use for m in models)
        assert model_found, f"Model {model_id_to_use} not found in catalog"
    except Exception as e:
        raise AssertionError(f"Failed to get models or find {model_id_to_use}: {e}")

    # Step 2: POST new instrument with model_id and unique serial_number
    sn = f"SN-{uuid.uuid4().hex[:12]}"
    url_instruments = f"{base_url}/api/v1/tenants/{tenant_id}/instruments"
    instrument_payload = {
        "model_id": model_id_to_use,
        "serial_number": sn
    }
    try:
        resp = requests.post(url_instruments, headers=headers_owner, json=instrument_payload, timeout=30)
        if resp.status_code != 201:
            raise AssertionError(f"Instrument creation failed with status {resp.status_code}: {resp.text}")
        instrument = resp.json()
        instrument_id = instrument.get("instrument_id")
        assert instrument_id, "instrument_id missing in response"
    except Exception as e:
        raise AssertionError(f"Failed to create instrument: {e}")

    # Step 3: POST create application draft with instrument_id (no applicant_declaration_accepted)
    url_applications = f"{base_url}/api/v1/tenants/{tenant_id}/applications"
    application_payload = {
        "instrument_id": instrument_id
    }
    try:
        resp = requests.post(url_applications, headers=headers_owner, json=application_payload, timeout=30)
        if resp.status_code != 201:
            raise AssertionError(f"Application creation failed with status {resp.status_code}: {resp.text}")
        application = resp.json()
        application_id = application.get("application_id")
        assert application_id, "application_id missing in response"
        assert application.get("current_status") == "DRAFT", "New application initial status is not DRAFT"
    except Exception as e:
        raise AssertionError(f"Failed to create application: {e}")

    # Step 4: POST submit application first time - body must be non-empty JSON '{}'
    url_submit = f"{base_url}/api/v1/tenants/{tenant_id}/applications/{application_id}/submit"
    submit_payload = {}

    try:
        resp = requests.post(url_submit, headers=headers_owner, json=submit_payload, timeout=30)
        if resp.status_code != 200:
            raise AssertionError(f"First submit failed with status {resp.status_code}: {resp.text}")
        submitted_app = resp.json()
        assert submitted_app.get("current_status") == "SUBMITTED", "Application status after submit is not SUBMITTED"
    except Exception as e:
        raise AssertionError(f"Failed first submit of application: {e}")

    # Step 5: POST submit application a SECOND time - should fail 400 with InvalidStateTransitionError
    try:
        resp = requests.post(url_submit, headers=headers_owner, json=submit_payload, timeout=30)
        # This must reject with 400; if not, error
        assert resp.status_code == 400, f"Duplicate submit did not return 400, returned {resp.status_code}"
        err_body = resp.json()
        # Validate error code or detail mentioning invalid state transition
        error_message = err_body.get("detail", "") or err_body.get("error", "") or str(err_body)
        assert ("invalid" in error_message.lower() and "state" in error_message.lower()) or "InvalidStateTransitionError" in error_message, \
            "Error message does not indicate InvalidStateTransitionError or invalid transition"
    except requests.exceptions.JSONDecodeError:
        raise AssertionError("Error response is not valid JSON")
    except Exception as e:
        raise AssertionError(f"Second submit did not fail properly: {e}")

    # Step 6: Confirm current_status remains SUBMITTED after failed second submit
    try:
        url_get_app = f"{base_url}/api/v1/tenants/{tenant_id}/applications/{application_id}"
        resp = requests.get(url_get_app, headers=headers_owner, timeout=30)
        resp.raise_for_status()
        app_status_check = resp.json()
        assert app_status_check.get("current_status") == "SUBMITTED", \
            "Application status changed after duplicate submit attempt"
    except Exception as e:
        raise AssertionError(f"Failed to confirm application status after duplicate submit: {e}")

    # Cleanup: DELETE the created instrument and application if API supported (No explicit DELETE documented)
    # Since no DELETE endpoints defined in PRD, skipping cleanup.

# Call the test function
test_TC021_negative_duplicate_application_submit_rejected_by_state_machine()
