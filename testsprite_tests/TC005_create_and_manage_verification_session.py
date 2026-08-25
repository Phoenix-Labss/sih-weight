import requests
import uuid
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"
HEADERS_TEMPLATE = {
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json",
}

def test_create_and_manage_verification_session():
    # Prepare unique serial number
    serial_number = f"SN-{uuid.uuid4().hex[:12]}"

    # Step 1: List approved instrument models as OWNER
    headers = HEADERS_TEMPLATE.copy()
    headers["X-Actor-Role"] = "OWNER"
    models_resp = requests.get(
        f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models",
        headers=headers,
        timeout=30,
    )
    assert models_resp.status_code == 200
    models = models_resp.json()
    assert isinstance(models, list) and len(models) > 0
    model_id = None
    # Choose model_id from list (MOD-NAWI-01 or MOD-NAWI-03 expected)
    for m in models:
        if "model_id" in m and m["model_id"] in ("MOD-NAWI-01", "MOD-NAWI-03"):
            model_id = m["model_id"]
            break
    assert model_id is not None, "No valid model_id found in models"

    # Step 2: Register instrument with OWNER
    instrument_data = {
        "model_id": model_id,
        "serial_number": serial_number,
    }
    instrument_resp = requests.post(
        f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments",
        headers=headers,
        json=instrument_data,
        timeout=30,
    )
    assert instrument_resp.status_code == 201
    instrument = instrument_resp.json()
    instrument_id = instrument.get("instrument_id")
    assert instrument_id is not None
    assert instrument.get("model_id") == model_id
    assert instrument.get("serial_number") == serial_number

    try:
        # Step 3: Create application without applicant_declaration_accepted (OWNER)
        app_data = {
            "instrument_id": instrument_id
        }
        application_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications",
            headers=headers,
            json=app_data,
            timeout=30,
        )
        assert application_resp.status_code == 201
        application = application_resp.json()
        application_id = application.get("application_id")
        assert application_id is not None
        assert application.get("current_status") == "DRAFT"

        # Step 4: Submit application with OWNER
        submit_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit",
            headers=headers,
            json={},  # Non-empty enforced as '{}'
            timeout=30,
        )
        assert submit_resp.status_code == 200
        submitted_app = submit_resp.json()
        assert submitted_app.get("current_status") == "SUBMITTED"

        # Step 5: Scrutiny with LMO role, action ACCEPT
        lmo_headers = HEADERS_TEMPLATE.copy()
        lmo_headers["X-Actor-Role"] = "LMO"
        scrutiny_data = {"action": "ACCEPT"}
        scrutiny_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny",
            headers=lmo_headers,
            json=scrutiny_data,
            timeout=30,
        )
        assert scrutiny_resp.status_code == 200
        scrutiny_app = scrutiny_resp.json()

        # Step 6: Fee assessment with LMO
        fee_data = {"base_verification_fee": 500}
        fee_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee",
            headers=lmo_headers,
            json=fee_data,
            timeout=30,
        )
        assert fee_resp.status_code == 200
        fee_app = fee_resp.json()

        # Step 7: Payment with OWNER role, unique receipt number
        receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
        pay_data = {
            "receipt_number": receipt_number
        }
        pay_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay",
            headers=headers,
            json=pay_data,
            timeout=30,
        )
        assert pay_resp.status_code == 200
        pay_app = pay_resp.json()

        # Step 8: Schedule with LMO role, ISO datetime slots
        slot_start = datetime.utcnow() + timedelta(days=1)
        slot_end = slot_start + timedelta(hours=1)
        schedule_data = {
            "slot_start": slot_start.isoformat() + "Z",
            "slot_end": slot_end.isoformat() + "Z"
        }
        schedule_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule",
            headers=lmo_headers,
            json=schedule_data,
            timeout=30,
        )
        assert schedule_resp.status_code == 200
        scheduled_app = schedule_resp.json()

        # Step 9: Create session with LMO role (application_id and instrument_id)
        session_data = {
            "application_id": application_id,
            "instrument_id": instrument_id
        }
        session_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions",
            headers=lmo_headers,
            json=session_data,
            timeout=30,
        )
        assert session_resp.status_code == 201
        session = session_resp.json()
        session_id = session.get("session_id")
        assert session_id is not None

        # Step 10: POST identity confirmation (serial_verified=true)
        identity_data = {}
        identity_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity?serial_verified=true",
            headers=lmo_headers,
            json=identity_data,
            timeout=30,
        )
        assert identity_resp.status_code == 200
        identity_session = identity_resp.json()

        # Step 11: POST start body {}
        start_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/start",
            headers=lmo_headers,
            json={},
            timeout=30,
        )
        assert start_resp.status_code == 200
        started_session = start_resp.json()

        # Step 12: POST observations with reference_standard_ids and observations
        # Prepare observations: one ZERO_TEST at nominal_load=0 and several INCREASING_LOAD with raw_indication_reading=nominal_load
        reference_standard_ids = ["STD-MASS-CLASS-M1-002"]
        # Sample nominal loads for increasing load: 5kg, 10kg, 15kg (arbitrary positive integers)
        observations = []
        # ZERO_TEST item at 0
        observations.append({
            "step_type": "ZERO_TEST",
            "step_sequence": 1,
            "nominal_load": 0,
            "load_unit": "kg",
            "raw_indication_reading": 0,
            "reading_unit": "kg"
        })
        # Several INCREASING_LOAD steps starting sequence 2
        nominal_values = [5, 10, 15]
        seq = 2
        for nv in nominal_values:
            observations.append({
                "step_type": "INCREASING_LOAD",
                "step_sequence": seq,
                "nominal_load": nv,
                "load_unit": "kg",
                "raw_indication_reading": nv,
                "reading_unit": "kg"
            })
            seq += 1

        observations_data = {
            "reference_standard_ids": reference_standard_ids,
            "observations": observations
        }
        observations_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/observations",
            headers=lmo_headers,
            json=observations_data,
            timeout=30,
        )
        assert observations_resp.status_code == 200
        observations_session = observations_resp.json()

        # Step 13: POST disposition with outcome VERIFICATION_PASSED_PENDING_AUTHORIZATION
        disposition_data = {
            "outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION"
        }
        disposition_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/disposition",
            headers=lmo_headers,
            json=disposition_data,
            timeout=30,
        )
        assert disposition_resp.status_code == 200
        disposition_session = disposition_resp.json()

    finally:
        # Cleanup: Delete the instrument if API supports delete (not specified in PRD)
        # No delete instrument endpoint specification, so skip resource deletion
        # In a real test environment, we might want to delete created resources if supported
        pass

test_create_and_manage_verification_session()