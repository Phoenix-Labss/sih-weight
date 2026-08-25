import requests
import uuid
from dateutil.parser import isoparse

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
HEADERS_LMO = {
    "X-Actor-Role": "LMO",
    "X-Tenant-Id": TENANT_ID,
    "X-Jurisdiction-Id": JURISDICTION_ID,
    "Content-Type": "application/json",
}


def test_pipeline_09_schedule_verification_slot():
    timeout = 30
    # Step 1: GET /api/v1/tenants/tenant-delhi-central/instruments/models as OWNER, find MOD-NAWI-03
    models_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
    r = requests.get(models_url, headers=HEADERS_OWNER, timeout=timeout)
    r.raise_for_status()
    models = r.json()
    assert any(m.get("model_id") == MODEL_ID for m in models), f"Model {MODEL_ID} not found"

    # Step 2: POST /instruments {"model_id":"MOD-NAWI-03","serial_number":"<unique>"} -> instrument_id
    serial_number = f"SN-{uuid.uuid4().hex[:12]}"
    instrument_payload = {"model_id": MODEL_ID, "serial_number": serial_number}
    instruments_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
    r = requests.post(instruments_url, headers=HEADERS_OWNER, json=instrument_payload, timeout=timeout)
    r.raise_for_status()
    instrument = r.json()
    instrument_id = instrument.get("instrument_id")
    assert instrument_id, "instrument_id missing in instrument creation response"

    # Step 3: POST /applications {"instrument_id"} as OWNER -> application_id (DRAFT)
    application_payload = {"instrument_id": instrument_id}
    applications_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
    r = requests.post(applications_url, headers=HEADERS_OWNER, json=application_payload, timeout=timeout)
    r.raise_for_status()
    application = r.json()
    application_id = application.get("application_id")
    assert application_id, "application_id missing in application creation response"

    try:
        # Step 4: POST /applications/:application_id/submit with json={} as OWNER (SUBMITTED)
        submit_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit"
        r = requests.post(submit_url, headers=HEADERS_OWNER, json={}, timeout=timeout)
        r.raise_for_status()
        submitted_app = r.json()
        # No detailed asserts here - assume success is sufficient

        # Step 5: POST /applications/:application_id/scrutiny with {"action":"ACCEPT"} as LMO
        scrutiny_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny"
        scrutiny_payload = {"action": "ACCEPT"}
        r = requests.post(scrutiny_url, headers=HEADERS_LMO, json=scrutiny_payload, timeout=timeout)
        r.raise_for_status()
        scrutinized_app = r.json()
        # No detailed asserts here - accept success is sufficient

        # Step 6: POST .../fee as LMO {"base_verification_fee":500,"user_charge":50,"policy_version":"fee-v1"}
        fee_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee"
        fee_payload = {"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"}
        r = requests.post(fee_url, headers=HEADERS_LMO, json=fee_payload, timeout=timeout)
        r.raise_for_status()
        fee_response = r.json()
        assert r.status_code == 200, "Fee assessment did not return 200"
        assert fee_response.get("current_status") == "FEE_PENDING", "Fee current_status not FEE_PENDING"
        fee_assessment = fee_response.get("fee_assessment")
        assert fee_assessment, "fee_assessment missing in fee response"
        assert fee_assessment.get("base_verification_fee") == 500, "base_verification_fee mismatch"
        assert fee_assessment.get("user_charge") == 50, "user_charge mismatch"
        assert fee_assessment.get("total_assessed_amount") == 550, "total_assessed_amount mismatch"
        assert fee_assessment.get("currency") == "INR", "currency mismatch"
        assert fee_assessment.get("payment_status") == "PAYMENT_PENDING", "payment_status mismatch"

        # Step 7: POST .../pay as OWNER {"receipt_number":"RCPT-<uuid8>"}
        receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
        pay_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay"
        pay_payload = {"receipt_number": receipt_number}
        r = requests.post(pay_url, headers=HEADERS_OWNER, json=pay_payload, timeout=timeout)
        r.raise_for_status()
        pay_response = r.json()
        # No detailed asserts here - success status is sufficient

        # Step 8: POST .../schedule as LMO {"slot_start":"2026-08-26T09:00:00Z","slot_end":"2026-08-26T11:00:00Z","assigned_lmo_id":"lmo-officer-01"}
        schedule_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule"
        slot_start_input = "2026-08-26T09:00:00Z"
        slot_end_input = "2026-08-26T11:00:00Z"
        schedule_payload = {
            "slot_start": slot_start_input,
            "slot_end": slot_end_input,
            "assigned_lmo_id": "lmo-officer-01",
        }
        r = requests.post(schedule_url, headers=HEADERS_LMO, json=schedule_payload, timeout=timeout)
        r.raise_for_status()
        schedule_response = r.json()
        assert r.status_code == 200, "Schedule did not return 200"
        # Validate current_status is SCHEDULED
        assert schedule_response.get("current_status") == "SCHEDULED", "current_status not SCHEDULED after scheduling"
        # Validate assigned_lmo_id recorded
        assert schedule_response.get("assigned_lmo_id") == "lmo-officer-01", "assigned_lmo_id mismatch"
        # Validate scheduled_slot_start and scheduled_slot_end present and parsed equal to input times (with milliseconds appended .000Z)
        scheduled_start = schedule_response.get("scheduled_slot_start")
        scheduled_end = schedule_response.get("scheduled_slot_end")
        assert scheduled_start, "scheduled_slot_start missing"
        assert scheduled_end, "scheduled_slot_end missing"
        # Parse input and response datetimes for comparison
        dt_input_start = isoparse(slot_start_input)
        dt_input_end = isoparse(slot_end_input)
        dt_resp_start = isoparse(scheduled_start)
        dt_resp_end = isoparse(scheduled_end)
        assert dt_resp_start == dt_input_start, f"scheduled_slot_start mismatch: {scheduled_start} != {slot_start_input}"
        assert dt_resp_end == dt_input_end, f"scheduled_slot_end mismatch: {scheduled_end} != {slot_end_input}"

    finally:
        # Clean up: Delete the instrument and application if possible (if API supports delete, otherwise skip)
        # As no delete APIs described, skipping cleanup
        pass


test_pipeline_09_schedule_verification_slot()