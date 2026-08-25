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


def test_pipeline_18_public_qr_verification_without_authentication():
    instrument_id = None
    application_id = None
    session_id = None
    certificate_id = None
    public_verification_token = None
    serial_number = f"SN-{uuid.uuid4().hex[:12]}"
    receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
    seal_identification_number = f"DL-SEAL-2026-{uuid.uuid4().hex[:6].upper()}"

    try:
        # Step 1: GET models, find MOD-NAWI-03 as OWNER
        r = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models",
            headers=HEADERS_OWNER,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        models = r.json()
        model_found = any(m.get("model_id") == MODEL_ID for m in models)
        assert model_found, f"Model {MODEL_ID} not found in models list"

        # Step 2: POST /instruments with model_id and unique serial_number as OWNER -> instrument_id
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments",
            headers=HEADERS_OWNER,
            json={"model_id": MODEL_ID, "serial_number": serial_number},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        instrument = r.json()
        assert "instrument_id" in instrument
        instrument_id = instrument["instrument_id"]

        # Step 3: POST /applications with instrument_id as OWNER -> application_id (DRAFT)
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications",
            headers=HEADERS_OWNER,
            json={"instrument_id": instrument_id},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        application = r.json()
        assert "application_id" in application
        application_id = application["application_id"]

        # Step 4: POST /applications/:application_id/submit with json={} as OWNER (SUBMITTED)
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit",
            headers=HEADERS_OWNER,
            json={},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        application = r.json()
        assert application.get("application_id") == application_id

        # Step 5: POST .../scrutiny as LMO {"action":"ACCEPT"}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny",
            headers=HEADERS_LMO,
            json={"action": "ACCEPT"},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        application = r.json()
        assert application.get("application_id") == application_id

        # Step 6: POST .../fee as LMO {"base_verification_fee":500,"user_charge":50,"policy_version":"fee-v1"}
        fee_payload = {"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee",
            headers=HEADERS_LMO,
            json=fee_payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        fee_response = r.json()
        assert fee_response.get("current_status") == "FEE_PENDING"
        fee_assessment = fee_response.get("fee_assessment")
        assert fee_assessment is not None
        assert fee_assessment.get("base_verification_fee") == 500
        assert fee_assessment.get("user_charge") == 50
        assert fee_assessment.get("total_assessed_amount") == 550
        assert fee_assessment.get("currency") == "INR"
        assert fee_assessment.get("payment_status") == "PAYMENT_PENDING"

        # Step 7: POST .../pay as OWNER {"receipt_number":"RCPT-<uuid8>"}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay",
            headers=HEADERS_OWNER,
            json={"receipt_number": receipt_number},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        application = r.json()
        assert application.get("application_id") == application_id

        # Step 8: POST .../schedule as LMO with assigned_lmo_id and slot times
        schedule_payload = {
            "slot_start": "2026-08-26T09:00:00Z",
            "slot_end": "2026-08-26T11:00:00Z",
            "assigned_lmo_id": "lmo-officer-01",
        }
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule",
            headers=HEADERS_LMO,
            json=schedule_payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        schedule_resp = r.json()
        assert schedule_resp.get("current_status") == "SCHEDULED"
        # Parse and compare date-times with .000Z normalization
        scheduled_start = isoparse(schedule_resp.get("scheduled_slot_start"))
        scheduled_end = isoparse(schedule_resp.get("scheduled_slot_end"))
        input_start = isoparse(schedule_payload["slot_start"])
        input_end = isoparse(schedule_payload["slot_end"])
        assert scheduled_start == input_start.replace(microsecond=0)
        assert scheduled_end == input_end.replace(microsecond=0)
        assert schedule_resp.get("assigned_lmo_id") == schedule_payload["assigned_lmo_id"]

        # Step 9: POST /sessions as LMO with application_id, instrument_id, scheduled_date
        session_payload = {
            "application_id": application_id,
            "instrument_id": instrument_id,
            "scheduled_date": "2026-08-26T09:00:00Z",
        }
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions",
            headers=HEADERS_LMO,
            json=session_payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        session = r.json()
        assert "session_id" in session
        assert session.get("application_id") == application_id
        assert session.get("instrument_id") == instrument_id
        session_id = session["session_id"]

        # Step 10: POST /sessions/:session_id/identity?serial_verified=true json={} as LMO
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity?serial_verified=true",
            headers=HEADERS_LMO,
            json={},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        identity_resp = r.json()
        assert identity_resp.get("session_id") == session_id

        # Step 11: POST /sessions/:session_id/start with json={} as LMO
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/start",
            headers=HEADERS_LMO,
            json={},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        start_resp = r.json()
        assert start_resp.get("session_id") == session_id

        # Step 12: POST /observations as LMO with reference_standard_ids and observations
        observations_payload = {
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
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/observations",
            headers=HEADERS_LMO,
            json=observations_payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        observations_resp = r.json()
        assert observations_resp.get("session_id") == session_id

        # Step 13: POST .../disposition as LMO {"outcome":"VERIFICATION_PASSED_PENDING_AUTHORIZATION"}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/disposition",
            headers=HEADERS_LMO,
            json={"outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION"},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        disposition_resp = r.json()
        assert disposition_resp.get("session_id") == session_id

        # Step 14: POST .../stamps as LMO with seal application data
        stamps_payload = {
            "action_type": "SEAL_APPLIED",
            "seal_identification_number": seal_identification_number,
            "seal_position": "TERMINAL_BLOCK",
        }
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/stamps",
            headers=HEADERS_LMO,
            json=stamps_payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        stamp_resp = r.json()
        assert "stamp_action_id" in stamp_resp

        # Step 15: POST /certificates/issue as LMO {"session_id","validity_months":12}
        issue_payload = {"session_id": session_id, "validity_months": 12}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates/issue",
            headers=HEADERS_LMO,
            json=issue_payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        cert_resp = r.json()
        assert "certificate_id" in cert_resp
        assert "public_verification_token" in cert_resp
        certificate_id = cert_resp["certificate_id"]
        public_verification_token = cert_resp["public_verification_token"]
        issued_certificate_number = cert_resp.get("certificate_number")

        # Step 16: WITHOUT any auth headers GET /api/v1/public/certificates/verify/<public_verification_token> expecting 200
        public_verify_url = f"{BASE_URL}/api/v1/public/certificates/verify/{public_verification_token}"
        r = requests.get(public_verify_url, timeout=TIMEOUT)
        assert r.status_code == 200
        public_cert = r.json()

        # Response deliberately contains NO id field (zero-PII design)
        assert "id" not in public_cert
        assert public_cert.get("certificate_number") == issued_certificate_number
        assert public_cert.get("status") == "ISSUED"
        assert public_cert.get("cryptographic_validity") == "VALID_SIGNATURE"

        # instrument_summary.masked_serial_number masks the serial (starts SN-****)
        instrument_summary = public_cert.get("instrument_summary")
        assert instrument_summary is not None
        masked_sn = instrument_summary.get("masked_serial_number")
        assert masked_sn is not None
        assert masked_sn.startswith("SN-****")

        # valid_until present
        assert "valid_until" in public_cert

        # No owner/personal identifier fields exist
        sensitive_fields = [
            "owner_id",
            "applicant_name",
            "applicant_address",
            "applicant_contact",
            "owner_name",
            "owner_address",
            "personal_identifier",
            "user_info",
            "user_data",
        ]
        for field in sensitive_fields:
            assert field not in public_cert

        # Step 17: GET with token TOK-CERT-NONEXISTENT-000 expecting 404
        r = requests.get(f"{BASE_URL}/api/v1/public/certificates/verify/TOK-CERT-NONEXISTENT-000", timeout=TIMEOUT)
        assert r.status_code == 404

    finally:
        # Cleanup - delete certificate not needed (immutable), but remove instrument and application if possible
        # No delete endpoints specified in PRD, so no action.
        pass


test_pipeline_18_public_qr_verification_without_authentication()