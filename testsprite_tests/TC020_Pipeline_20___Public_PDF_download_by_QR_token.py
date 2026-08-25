import requests
import uuid

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


def test_pipeline_20_public_pdf_download_by_qr_token():
    model_id = "MOD-NAWI-03"
    instrument_id = None
    application_id = None
    session_id = None
    stamp_action_id = None
    certificate_id = None
    public_verification_token = None

    serial_number = f"SN-{uuid.uuid4().hex[:12]}"
    receipt_number = f"RCPT-{uuid.uuid4().hex[:8]}"
    seal_identification_number = f"DL-SEAL-2026-{uuid.uuid4().hex[:6].upper()}"

    try:
        # GET /api/v1/tenants/:tenantId/instruments/models as OWNER
        r = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models",
            headers=HEADERS_OWNER,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        models = r.json()
        found_model = next((m for m in models if m.get("model_id") == model_id), None)
        assert found_model is not None, "Model MOD-NAWI-03 not found"

        # POST /api/v1/tenants/:tenantId/instruments with model_id and serial_number as OWNER
        payload = {"model_id": model_id, "serial_number": serial_number}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments",
            headers=HEADERS_OWNER,
            json=payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        instrument = r.json()
        instrument_id = instrument.get("instrument_id")
        assert instrument_id, "instrument_id missing in response"

        # POST /api/v1/tenants/:tenantId/applications with instrument_id as OWNER (create draft)
        payload = {"instrument_id": instrument_id}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications",
            headers=HEADERS_OWNER,
            json=payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        application = r.json()
        application_id = application.get("application_id")
        assert application_id, "application_id missing in response"
        assert application.get("current_status") == "DRAFT"

        # POST /applications/:application_id/submit with {} as OWNER (moves to SUBMITTED)
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit",
            headers=HEADERS_OWNER,
            json={},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        application = r.json()
        assert application.get("current_status") == "SUBMITTED"

        # POST /applications/:application_id/scrutiny as LMO with {"action":"ACCEPT","notes":"ok"}
        payload = {"action": "ACCEPT", "notes": "ok"}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny",
            headers=HEADERS_LMO,
            json=payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        application = r.json()

        # POST /applications/:application_id/fee as LMO with fees
        payload = {"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee",
            headers=HEADERS_LMO,
            json=payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        application = r.json()

        # POST /applications/:application_id/pay as OWNER with receipt_number
        payload = {"receipt_number": receipt_number}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay",
            headers=HEADERS_OWNER,
            json=payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        application = r.json()

        # POST /applications/:application_id/schedule as LMO
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
        application = r.json()
        assert application.get("current_status") == "SCHEDULED"

        # POST /sessions as LMO
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
        if r.status_code == 403:
            raise Exception("LMO role not permitted to create session")
        r.raise_for_status()
        session = r.json()
        session_id = session.get("session_id")
        assert session_id, "session_id missing in response"
        assert session.get("application_id") == application_id
        assert session.get("instrument_id") == instrument_id

        # POST /sessions/:session_id/identity?serial_verified=true as LMO
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity",
            headers=HEADERS_LMO,
            json={},
            params={"serial_verified": "true"},
            timeout=TIMEOUT,
        )
        r.raise_for_status()

        # POST /sessions/:session_id/start as LMO
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/start",
            headers=HEADERS_LMO,
            json={},
            timeout=TIMEOUT,
        )
        r.raise_for_status()

        # POST /sessions/:session_id/observations as LMO
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
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 3,
                    "nominal_load": 25000,
                    "load_unit": "kg",
                    "raw_indication_reading": 25000,
                    "reading_unit": "kg",
                },
            ],
            "environmental_temp_celsius": 25,
        }
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/observations",
            headers=HEADERS_LMO,
            json=observations_payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        session = r.json()
        persisted_observations = session.get("observations") or session.get("observation_results") or None
        # Defensive: The exact response structure is not fully described, just check the observations presence
        assert persisted_observations is not None, "Observations not found in response"
        # Validate raw_indication_reading == nominal_load for each observation returned in any session field that matches
        obs_list = None
        if isinstance(persisted_observations, list) and len(persisted_observations) == 3:
            obs_list = persisted_observations
        else:
            # Try to find observations array on session object
            if "observations" in session:
                obs_list = session["observations"]
        if obs_list:
            for o in obs_list:
                assert o.get("raw_indication_reading") == o.get("nominal_load"), "raw_indication_reading differs from nominal_load"
        # else skip deep validation since response format not explicit

        # POST /sessions/:session_id/disposition as LMO
        disposition_payload = {
            "outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION",
            "disposition_notes": "All errors within MPE",
        }
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/disposition",
            headers=HEADERS_LMO,
            json=disposition_payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()

        # POST /sessions/:session_id/stamps as LMO
        stamp_payload = {
            "instrument_id": instrument_id,
            "action_type": "SEAL_APPLIED",
            "seal_identification_number": seal_identification_number,
            "seal_position": "TERMINAL_BLOCK",
        }
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/stamps",
            headers=HEADERS_LMO,
            json=stamp_payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        stamp = r.json()
        stamp_action_id = stamp.get("stamp_action_id")
        assert stamp_action_id, "stamp_action_id missing in response"

        # POST /certificates/issue as LMO
        cert_issue_payload = {"session_id": session_id, "validity_months": 12}
        r = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates/issue",
            headers=HEADERS_LMO,
            json=cert_issue_payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        cert = r.json()
        certificate_id = cert.get("certificate_id")
        assert certificate_id, "certificate_id missing in certificate issue response"
        public_verification_token = cert.get("public_verification_token")
        assert public_verification_token, "public_verification_token missing in certificate issue response"

        # WITHOUT auth headers GET public PDF by QR token - valid token expecting 200 and pdf bytes
        r = requests.get(
            f"{BASE_URL}/api/v1/public/certificates/{public_verification_token}/pdf",
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"Expected 200 OK for public PDF download, got {r.status_code}"
        content_type = r.headers.get("Content-Type", "")
        assert "application/pdf" in content_type.lower(), f"Expected Content-Type application/pdf, got {content_type}"
        content = r.content
        assert content and len(content) > 100, "PDF content too small or empty, probable error"
        assert content.startswith(b"%PDF"), "PDF content does not start with %PDF header"

        # WITHOUT auth headers GET public PDF by invalid QR token expecting 404
        invalid_token = "INVALID-TOKEN-NONEXISTENT-123456"
        r = requests.get(
            f"{BASE_URL}/api/v1/public/certificates/{invalid_token}/pdf",
            timeout=TIMEOUT,
        )
        assert r.status_code == 404, f"Expected 404 for invalid token PDF download, got {r.status_code}"

    finally:
        # Cleanup: delete created certificate, session, application, instrument if possible
        headers_admin = {
            "X-Actor-Role": "ADMIN",
            "X-Tenant-Id": TENANT_ID,
            "X-Jurisdiction-Id": JURISDICTION_ID,
            "Content-Type": "application/json",
        }

        # Delete certificate (if endpoint existed, not described so skipped)
        # Delete session (if endpoint existed, not described so skipped)

        # Delete application (no DELETE endpoint described)
        # Delete instrument (no DELETE endpoint described)
        pass


test_pipeline_20_public_pdf_download_by_qr_token()