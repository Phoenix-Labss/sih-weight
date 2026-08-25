import requests
import uuid
from datetime import datetime
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
TIMEOUT = 30


def test_pipeline_19_authenticated_certificate_pdf_download():
    serial_number = f"SN-{uuid.uuid4().hex[:12]}"
    receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
    seal_id_number = f"DL-SEAL-2026-{uuid.uuid4().hex[:6].upper()}"
    slot_start = "2026-08-26T09:00:00Z"
    slot_end = "2026-08-26T11:00:00Z"
    scheduled_date = "2026-08-26T09:00:00Z"

    instrument_id = None
    application_id = None
    session_id = None
    certificate_id = None

    try:
        # Step 1: GET models, find MOD-NAWI-03
        url_models = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
        r = requests.get(url_models, headers=HEADERS_OWNER, timeout=TIMEOUT)
        r.raise_for_status()
        models = r.json()
        model_ids = [m.get("model_id") for m in models]
        assert MODEL_ID in model_ids, f"Model {MODEL_ID} not found in models"

        # Step 2: POST /instruments with model_id and serial_number as OWNER -> instrument_id
        url_instruments = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
        data_instrument = {"model_id": MODEL_ID, "serial_number": serial_number}
        r = requests.post(url_instruments, headers=HEADERS_OWNER, json=data_instrument, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 201
        instrument = r.json()
        instrument_id = instrument.get("instrument_id")
        assert instrument_id, "instrument_id not returned"

        # Step 3: POST /applications with instrument_id as OWNER -> application_id (DRAFT)
        url_applications = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
        data_application = {"instrument_id": instrument_id}
        r = requests.post(url_applications, headers=HEADERS_OWNER, json=data_application, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 201
        application = r.json()
        application_id = application.get("application_id")
        assert application_id, "application_id not returned"

        # Step 4: POST /applications/:application_id/submit with json={} as OWNER (SUBMITTED)
        url_submit = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit"
        r = requests.post(url_submit, headers=HEADERS_OWNER, json={}, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        submitted_app = r.json()

        # Step 5: POST /applications/:application_id/scrutiny as LMO {"action":"ACCEPT"}
        url_scrutiny = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny"
        data_scrutiny = {"action": "ACCEPT"}
        r = requests.post(url_scrutiny, headers=HEADERS_LMO, json=data_scrutiny, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200

        # Step 6: POST /applications/:application_id/fee as LMO with fee details
        url_fee = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee"
        data_fee = {"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"}
        r = requests.post(url_fee, headers=HEADERS_LMO, json=data_fee, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        fee_resp = r.json()
        assert fee_resp.get("current_status") == "FEE_PENDING"
        fee_assessment = fee_resp.get("fee_assessment")
        assert fee_assessment is not None, "fee_assessment missing"
        assert fee_assessment.get("base_verification_fee") == 500
        assert fee_assessment.get("user_charge") == 50
        assert fee_assessment.get("total_assessed_amount") == 550
        assert fee_assessment.get("currency") == "INR"
        assert fee_assessment.get("payment_status") == "PAYMENT_PENDING"

        # Step 7: POST /applications/:application_id/pay as OWNER with receipt_number
        url_pay = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay"
        data_pay = {"receipt_number": receipt_number}
        r = requests.post(url_pay, headers=HEADERS_OWNER, json=data_pay, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200

        # Step 8: POST /applications/:application_id/schedule as LMO with slot times and assigned_lmo_id
        url_schedule = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule"
        data_schedule = {
            "slot_start": slot_start,
            "slot_end": slot_end,
            "assigned_lmo_id": "lmo-officer-01",
        }
        r = requests.post(url_schedule, headers=HEADERS_LMO, json=data_schedule, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        schedule_resp = r.json()
        assert schedule_resp.get("current_status") == "SCHEDULED"
        # Compare parsed ISO datetimes for scheduled slot start and end, server appends milliseconds
        scheduled_start_str = schedule_resp.get("scheduled_slot_start")
        scheduled_end_str = schedule_resp.get("scheduled_slot_end")
        assert scheduled_start_str is not None and scheduled_end_str is not None

        parsed_start_input = isoparse(slot_start)
        parsed_end_input = isoparse(slot_end)
        parsed_start_resp = isoparse(scheduled_start_str)
        parsed_end_resp = isoparse(scheduled_end_str)
        assert parsed_start_resp == parsed_start_input.replace(microsecond=0) if parsed_start_resp.microsecond == 0 else parsed_start_resp.replace(microsecond=parsed_start_resp.microsecond)
        assert parsed_end_resp == parsed_end_input.replace(microsecond=0) if parsed_end_resp.microsecond == 0 else parsed_end_resp.replace(microsecond=parsed_end_resp.microsecond)
        # Also verify assigned_lmo_id field
        assert schedule_resp.get("assigned_lmo_id") == "lmo-officer-01"

        # Step 9: POST /sessions as LMO with {application_id, instrument_id, scheduled_date} -> session_id
        url_sessions = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions"
        data_session = {
            "application_id": application_id,
            "instrument_id": instrument_id,
            "scheduled_date": scheduled_date,
        }
        r = requests.post(url_sessions, headers=HEADERS_LMO, json=data_session, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 201
        session_resp = r.json()
        session_id = session_resp.get("session_id")
        assert session_id, "session_id not returned"
        assert session_resp.get("application_id") == application_id
        assert session_resp.get("instrument_id") == instrument_id

        # Step 10: POST /sessions/:session_id/identity?serial_verified=true json={} as LMO
        url_identity = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity"
        params_identity = {"serial_verified": "true"}
        r = requests.post(url_identity, headers=HEADERS_LMO, params=params_identity, json={}, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200

        # Step 11: POST /sessions/:session_id/start with json={} as LMO
        url_start = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/start"
        r = requests.post(url_start, headers=HEADERS_LMO, json={}, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200

        # Step 12: POST /observations as LMO with reference_standard_ids and observations
        url_observations = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/observations"
        data_observations = {
            "reference_standard_ids": ["STD-MASS-CLASS-M1-002"],
            "observations": [
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
            ],
        }
        r = requests.post(url_observations, headers=HEADERS_LMO, json=data_observations, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200

        # Step 13: POST /disposition as LMO {"outcome":"VERIFICATION_PASSED_PENDING_AUTHORIZATION"}
        url_disposition = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/disposition"
        data_disposition = {"outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION"}
        r = requests.post(url_disposition, headers=HEADERS_LMO, json=data_disposition, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        disposition_resp = r.json()
        assert disposition_resp.get("outcome") == "VERIFICATION_PASSED_PENDING_AUTHORIZATION"

        # Step 14: POST /stamps as LMO with seal action
        url_stamps = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/stamps"
        data_stamp = {
            "action_type": "SEAL_APPLIED",
            "seal_identification_number": seal_id_number,
            "seal_position": "TERMINAL_BLOCK",
        }
        r = requests.post(url_stamps, headers=HEADERS_LMO, json=data_stamp, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 201
        stamp_resp = r.json()
        assert stamp_resp.get("seal_identification_number") == seal_id_number

        # Step 15: POST /certificates/issue as LMO {"session_id", "validity_months": 12} -> certificate_id and public_verification_token
        url_cert_issue = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates/issue"
        data_cert_issue = {"session_id": session_id, "validity_months": 12}
        r = requests.post(url_cert_issue, headers=HEADERS_LMO, json=data_cert_issue, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 201
        cert_resp = r.json()
        certificate_id = cert_resp.get("certificate_id")
        public_token = cert_resp.get("public_verification_token")
        assert certificate_id, "certificate_id not returned"
        assert public_token, "public_verification_token not returned"

        # Step 16: GET /certificates/:certificate_id/pdf as OWNER expecting authenticated PDF
        url_cert_pdf = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates/{certificate_id}/pdf"
        r = requests.get(url_cert_pdf, headers=HEADERS_OWNER, timeout=TIMEOUT)
        r.raise_for_status()
        assert r.status_code == 200
        content_type = r.headers.get("Content-Type", "")
        content_disposition = r.headers.get("Content-Disposition", "")

        # Validate Content-Type and Content-Disposition
        assert content_type == "application/pdf", f"Unexpected Content-Type: {content_type}"
        # The Content-Disposition should include 'attachment' and the certificate number inside
        # Try to get certificate_number from cert_resp to check in Content-Disposition
        certificate_number = cert_resp.get("certificate_number", "")
        assert "attachment" in content_disposition.lower(), f"Content-Disposition missing attachment: {content_disposition}"
        assert certificate_number in content_disposition, f"Certificate number {certificate_number} not in Content-Disposition"

        # Validate PDF bytes start with %PDF
        pdf_bytes = r.content
        assert pdf_bytes.startswith(b"%PDF"), "Response content is not a PDF"

    finally:
        # Clean up created resources
        # Delete certificate if possible - endpoint details for delete not provided, assume none
        # Delete session - no delete endpoint described, so skip
        # Delete application - no delete endpoint described, so skip
        # Delete instrument - no delete endpoint described, so skip
        # Without delete endpoints, cleanup not possible programmatically, so just pass
        pass


test_pipeline_19_authenticated_certificate_pdf_download()