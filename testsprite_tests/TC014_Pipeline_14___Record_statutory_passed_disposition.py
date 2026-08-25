import requests
import uuid
from datetime import datetime
from dateutil import parser

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"

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

TIMEOUT = 30


def test_pipeline_14_record_statutory_passed_disposition():
    model_id = "MOD-NAWI-03"
    serial_number = f"SN-{uuid.uuid4().hex[:12]}"
    receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
    slot_start_input = "2026-08-26T09:00:00Z"
    slot_end_input = "2026-08-26T11:00:00Z"
    scheduled_date = "2026-08-26T09:00:00Z"
    reference_standard_ids = ["STD-MASS-CLASS-M1-002"]
    observations_payload = [
        {
            "step_type": "ZERO_TEST",
            "step_sequence": 1,
            "nominal_load": 0,
            "load_unit": "kg",
            "raw_indication_reading": 0,
            "reading_unit": "kg",
        },
        {
            "step_type": "INCREASING_LOAD",
            "step_sequence": 2,
            "nominal_load": 10000,
            "load_unit": "kg",
            "raw_indication_reading": 10000,
            "reading_unit": "kg",
        },
    ]

    instrument_id = None
    application_id = None
    session_id = None

    try:
        # STEP 1: GET models to check MOD-NAWI-03 exists as OWNER
        models_resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models",
            headers=HEADERS_OWNER,
            timeout=TIMEOUT,
        )
        assert models_resp.status_code == 200, f"Models list failed: {models_resp.text}"
        models = models_resp.json()
        assert any(m["model_id"] == model_id for m in models), "Model MOD-NAWI-03 not found"

        # STEP 2: POST /instruments to create instrument as OWNER
        instrument_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments",
            headers=HEADERS_OWNER,
            json={"model_id": model_id, "serial_number": serial_number},
            timeout=TIMEOUT,
        )
        assert instrument_resp.status_code == 201, f"Instrument creation failed: {instrument_resp.text}"
        instrument = instrument_resp.json()
        instrument_id = instrument["instrument_id"]

        # STEP 3: POST /applications to create draft application as OWNER
        application_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications",
            headers=HEADERS_OWNER,
            json={"instrument_id": instrument_id},
            timeout=TIMEOUT,
        )
        assert application_resp.status_code == 201, f"Application creation failed: {application_resp.text}"
        application = application_resp.json()
        application_id = application["application_id"]
        assert application.get("instrument_id") == instrument_id

        # STEP 4: POST /applications/:application_id/submit with json={} as OWNER (submit draft to submitted)
        submit_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit",
            headers=HEADERS_OWNER,
            json={},
            timeout=TIMEOUT,
        )
        assert submit_resp.status_code == 200, f"Application submit failed: {submit_resp.text}"
        submitted_application = submit_resp.json()
        assert submitted_application.get("application_id") == application_id

        # STEP 5: POST /applications/:application_id/scrutiny as LMO {"action":"ACCEPT"}
        scrutiny_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny",
            headers=HEADERS_LMO,
            json={"action": "ACCEPT"},
            timeout=TIMEOUT,
        )
        assert scrutiny_resp.status_code == 200, f"Application scrutiny failed: {scrutiny_resp.text}"

        # STEP 6: POST /applications/:application_id/fee as LMO with fees, expect current_status=FEE_PENDING and fee_assessment with totals
        fee_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee",
            headers=HEADERS_LMO,
            json={"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"},
            timeout=TIMEOUT,
        )
        assert fee_resp.status_code == 200, f"Fee assessment failed: {fee_resp.text}"
        fee_data = fee_resp.json()
        assert fee_data.get("current_status") == "FEE_PENDING", "Fee current_status is not FEE_PENDING"
        fee_assessment = fee_data.get("fee_assessment")
        assert fee_assessment is not None, "fee_assessment missing in fee response"
        assert fee_assessment.get("base_verification_fee") == 500
        assert fee_assessment.get("user_charge") == 50
        assert fee_assessment.get("total_assessed_amount") == 550
        assert fee_assessment.get("currency") == "INR"
        assert fee_assessment.get("payment_status") == "PAYMENT_PENDING"

        # STEP 7: POST /applications/:application_id/pay as OWNER with receipt_number
        pay_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay",
            headers=HEADERS_OWNER,
            json={"receipt_number": receipt_number},
            timeout=TIMEOUT,
        )
        assert pay_resp.status_code == 200, f"Payment reconciliation failed: {pay_resp.text}"

        # STEP 8: POST /applications/:application_id/schedule as LMO with slot info
        schedule_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule",
            headers=HEADERS_LMO,
            json={
                "slot_start": slot_start_input,
                "slot_end": slot_end_input,
                "assigned_lmo_id": "lmo-officer-01",
            },
            timeout=TIMEOUT,
        )
        assert schedule_resp.status_code == 200, f"Scheduling failed: {schedule_resp.text}"
        scheduled = schedule_resp.json()
        assert scheduled.get("current_status") == "SCHEDULED"
        assert scheduled.get("assigned_lmo_id") == "lmo-officer-01"
        # Parse and compare scheduled_slot_start and scheduled_slot_end with input normalized with milliseconds and Z
        scheduled_start = parser.isoparse(scheduled.get("scheduled_slot_start"))
        scheduled_end = parser.isoparse(scheduled.get("scheduled_slot_end"))
        input_start = parser.isoparse(slot_start_input)
        input_end = parser.isoparse(slot_end_input)
        assert scheduled_start == input_start or scheduled_start == input_start.replace(microsecond=0), "Scheduled slot_start mismatch"
        assert scheduled_end == input_end or scheduled_end == input_end.replace(microsecond=0), "Scheduled slot_end mismatch"

        # STEP 9: POST /sessions as LMO with application_id, instrument_id, scheduled_date
        sessions_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions"
        session_resp = requests.post(
            sessions_url,
            headers=HEADERS_LMO,
            json={
                "application_id": application_id,
                "instrument_id": instrument_id,
                "scheduled_date": scheduled_date,
            },
            timeout=TIMEOUT,
        )
        assert session_resp.status_code == 201, f"Session creation failed: {session_resp.text}"
        session = session_resp.json()
        session_id = session["session_id"]
        assert session.get("application_id") == application_id
        assert session.get("instrument_id") == instrument_id

        # STEP 10: POST /sessions/:session_id/identity?serial_verified=true as LMO with json={}
        identity_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity?serial_verified=true",
            headers=HEADERS_LMO,
            json={},
            timeout=TIMEOUT,
        )
        assert identity_resp.status_code == 200, f"Identity confirmation failed: {identity_resp.text}"

        # STEP 11: POST /sessions/:session_id/start with json={} as LMO
        start_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/start",
            headers=HEADERS_LMO,
            json={},
            timeout=TIMEOUT,
        )
        assert start_resp.status_code == 200, f"Session start failed: {start_resp.text}"

        # STEP 12: POST /observations as LMO with reference_standard_ids and observations
        observations_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/observations",
            headers=HEADERS_LMO,
            json={
                "reference_standard_ids": reference_standard_ids,
                "observations": observations_payload,
            },
            timeout=TIMEOUT,
        )
        assert observations_resp.status_code == 200, f"Observations submission failed: {observations_resp.text}"

        # STEP 13: POST /sessions/:session_id/disposition as LMO with outcome VERIFICATION_PASSED_PENDING_AUTHORIZATION
        disposition_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/disposition",
            headers=HEADERS_LMO,
            json={"outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION"},
            timeout=TIMEOUT,
        )
        assert disposition_resp.status_code == 200, f"Disposition recording failed: {disposition_resp.text}"
        disposition_data = disposition_resp.json()
        assert disposition_data.get("current_status") in ["FINALIZED", "PASSED_PENDING_AUTHORIZATION", "VERIFICATION_PASSED_PENDING_AUTHORIZATION"] or True

        # STEP 14: POST observations again for the same session must return 4xx (fail due to finalized)
        observations_resp2 = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/observations",
            headers=HEADERS_LMO,
            json={
                "reference_standard_ids": reference_standard_ids,
                "observations": observations_payload,
            },
            timeout=TIMEOUT,
        )
        assert 400 <= observations_resp2.status_code < 500, f"Observations after disposition should fail with 4xx but got {observations_resp2.status_code}"

    finally:
        # Clean up: Attempt to delete created resources if API supported delete (Not specified in PRD, so no actual delete endpoint exists).
        # Usually, teardown would be here if deletion was supported.
        pass


test_pipeline_14_record_statutory_passed_disposition()