import requests
from uuid import uuid4

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
HEADERS_OWNER = {
    "X-Actor-Role": "OWNER",
    "X-Tenant-Id": TENANT_ID,
    "Content-Type": "application/json"
}
HEADERS_LMO = {
    "X-Actor-Role": "LMO",
    "X-Tenant-Id": TENANT_ID,
    "Content-Type": "application/json"
}

OBSERVATIONS_PAYLOAD = {
    "reference_standard_ids": ["STD-MASS-CLASS-M1-002"],
    "observations": [
        {
            "step_type": "ZERO_TEST",
            "step_sequence": 1,
            "nominal_load": 0,
            "load_unit": "kg",
            "raw_indication_reading": 0,
            "reading_unit": "kg"
        },
        {
            "step_type": "INCREASING_LOAD",
            "step_sequence": 2,
            "nominal_load": 10000,
            "load_unit": "kg",
            "raw_indication_reading": 10000,
            "reading_unit": "kg"
        }
    ]
}

def get_id_key(resp_json):
    for key in resp_json:
        if key.endswith('_id'):
            return key
    raise KeyError("No key ending with '_id' found in response.")

def test_TC017_pipeline_17_retrieve_issued_certificate_details():
    created_resources = {}

    try:
        # 1. GET models as OWNER
        models_resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models",
            headers=HEADERS_OWNER,
            timeout=30
        )
        assert models_resp.status_code == 200, f"Expected 200 for models GET, got {models_resp.status_code}"
        models = models_resp.json()
        model_nawi_03 = next((m for m in models if m.get('model_id') == 'MOD-NAWI-03'), None)
        assert model_nawi_03 is not None, "Model 'MOD-NAWI-03' not found in models list"
        model_id = model_nawi_03['model_id']

        # 2. POST instruments as OWNER
        serial_number = f"SN-{uuid4().hex[:12]}"
        instrument_payload = {
            "model_id": model_id,
            "serial_number": serial_number
        }
        instrument_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments",
            headers=HEADERS_OWNER,
            json=instrument_payload,
            timeout=30
        )
        assert instrument_resp.status_code == 201, f"Expected 201 for instrument creation, got {instrument_resp.status_code}"
        instrument_json = instrument_resp.json()
        instrument_id_key = get_id_key(instrument_json)
        instrument_id = instrument_json[instrument_id_key]
        created_resources['instrument_id'] = instrument_id

        # 3. POST applications as OWNER
        application_payload = {"instrument_id": instrument_id}
        application_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications",
            headers=HEADERS_OWNER,
            json=application_payload,
            timeout=30
        )
        assert application_resp.status_code == 201, f"Expected 201 for application creation, got {application_resp.status_code}"
        application_json = application_resp.json()
        application_id_key = get_id_key(application_json)
        application_id = application_json[application_id_key]
        created_resources['application_id'] = application_id

        # 4. POST submit application as OWNER with empty {}
        submit_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit",
            headers=HEADERS_OWNER,
            json={},
            timeout=30
        )
        assert submit_resp.status_code == 200, f"Expected 200 for application submit, got {submit_resp.status_code}"

        # 5. POST scrutiny as LMO with action ACCEPT
        scrutiny_payload = {"action": "ACCEPT"}
        scrutiny_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny",
            headers=HEADERS_LMO,
            json=scrutiny_payload,
            timeout=30
        )
        assert scrutiny_resp.status_code == 200, f"Expected 200 for application scrutiny, got {scrutiny_resp.status_code}"

        # 6. POST fee as LMO with base_verification_fee=500, expect current_status=FEE_PENDING
        fee_payload = {"base_verification_fee": 500}
        fee_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee",
            headers=HEADERS_LMO,
            json=fee_payload,
            timeout=30
        )
        assert fee_resp.status_code == 200, f"Expected 200 for application fee, got {fee_resp.status_code}"
        fee_json = fee_resp.json()
        assert fee_json.get("current_status") == "FEE_PENDING", f"Expected current_status='FEE_PENDING', got '{fee_json.get('current_status')}'"

        # 7. POST pay as OWNER with receipt_number
        receipt_number = "RCPT-" + hex(uuid4().int >> 64)[2:].upper()
        pay_payload = {"receipt_number": receipt_number}
        pay_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay",
            headers=HEADERS_OWNER,
            json=pay_payload,
            timeout=30
        )
        assert pay_resp.status_code == 200, f"Expected 200 for application pay, got {pay_resp.status_code}"

        # 8. POST schedule as LMO with slot_start/end
        schedule_payload = {
            "slot_start": "2026-08-26T09:00:00Z",
            "slot_end": "2026-08-26T11:00:00Z"
        }
        schedule_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/schedule",
            headers=HEADERS_LMO,
            json=schedule_payload,
            timeout=30
        )
        assert schedule_resp.status_code == 200, f"Expected 200 for application schedule, got {schedule_resp.status_code}"

        # 9. POST sessions as LMO with application_id and instrument_id
        session_payload = {
            "application_id": application_id,
            "instrument_id": instrument_id
        }
        session_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions",
            headers=HEADERS_LMO,
            json=session_payload,
            timeout=30
        )
        assert session_resp.status_code == 201, f"Expected 201 for session creation, got {session_resp.status_code}"
        session_json = session_resp.json()
        session_id_key = get_id_key(session_json)
        session_id = session_json[session_id_key]
        created_resources['session_id'] = session_id

        # 10. POST identity as LMO with empty json (serial_verified defaults true)
        identity_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/identity",
            headers=HEADERS_LMO,
            json={},
            timeout=30
        )
        assert identity_resp.status_code == 200, f"Expected 200 for session identity, got {identity_resp.status_code}"

        # 11. POST start as LMO with empty json body
        start_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/start",
            headers=HEADERS_LMO,
            json={},
            timeout=30
        )
        assert start_resp.status_code == 200, f"Expected 200 for session start, got {start_resp.status_code}"

        # 12. POST observations as LMO with exact payload, verbatim
        observations_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/observations",
            headers=HEADERS_LMO,
            json=OBSERVATIONS_PAYLOAD,
            timeout=30
        )
        assert observations_resp.status_code == 200, f"Expected 200 for session observations, got {observations_resp.status_code}"

        # 13. POST disposition as LMO with outcome VERIFICATION_PASSED_PENDING_AUTHORIZATION
        disposition_payload = {"outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION"}
        disposition_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/disposition",
            headers=HEADERS_LMO,
            json=disposition_payload,
            timeout=30
        )
        assert disposition_resp.status_code == 200, f"Expected 200 for session disposition, got {disposition_resp.status_code}"

        # 14. POST stamps as LMO with seal_identification_number and seal_position
        stamp_payload = {
            "seal_identification_number": "DL-SEAL-2026-XXXXXX",
            "seal_position": "TERMINAL_BLOCK"
        }
        stamp_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/sessions/{session_id}/stamps",
            headers=HEADERS_LMO,
            json=stamp_payload,
            timeout=30
        )
        assert stamp_resp.status_code == 201, f"Expected 201 for session stamp, got {stamp_resp.status_code}"

        # 15. POST certificates/issue as LMO with session_id, validity_months=12
        cert_issue_payload = {
            "session_id": session_id,
            "validity_months": 12
        }
        cert_issue_resp = requests.post(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates/issue",
            headers=HEADERS_LMO,
            json=cert_issue_payload,
            timeout=30
        )
        assert cert_issue_resp.status_code == 201, f"Expected 201 for certificate issuance, got {cert_issue_resp.status_code}"
        cert_json = cert_issue_resp.json()
        cert_id_key = get_id_key(cert_json)
        certificate_id = cert_json[cert_id_key]
        created_resources['certificate_id'] = certificate_id
        assert "public_verification_token" in cert_json, "Missing public_verification_token in certificate issuance response"
        assert "certificate_number" in cert_json, "Missing certificate_number in certificate issuance response"
        certificate_number = cert_json["certificate_number"]

        # 16. GET single certificate as OWNER, verify certificate_number and certificate_status == ISSUED
        cert_get_resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates/{certificate_id}",
            headers=HEADERS_OWNER,
            timeout=30
        )
        assert cert_get_resp.status_code == 200, f"Expected 200 for certificate GET, got {cert_get_resp.status_code}"
        cert_get_json = cert_get_resp.json()
        assert cert_get_json.get("certificate_number") == certificate_number, "Certificate number mismatch"
        assert cert_get_json.get("certificate_status") == "ISSUED", f"Expected certificate_status ISSUED, got {cert_get_json.get('certificate_status')}"

        # 17. GET certificates list as OWNER, verify issued certificate present
        params = {"page": 1, "page_size": 50}
        cert_list_resp = requests.get(
            f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/certificates",
            headers=HEADERS_OWNER,
            params=params,
            timeout=30
        )
        assert cert_list_resp.status_code == 200, f"Expected 200 for certificates list, got {cert_list_resp.status_code}"
        cert_list_json = cert_list_resp.json()
        found = False
        if isinstance(cert_list_json, dict):
            certs_list = cert_list_json.get("items") or cert_list_json.get("data") or cert_list_json.get("certificates") or []
        else:
            certs_list = []
        for c in certs_list:
            for key, val in c.items():
                if key.endswith("_id") and val == certificate_id:
                    found = True
                    break
            if found:
                break
        assert found, "Issued certificate not found in certificates list"

    finally:
        # Cleanup: delete the created resources if possible
        # DELETE certificates (if API supports) - no delete documented, so skip here
        # DELETE sessions (no delete documented)
        # DELETE applications (no delete documented)
        # DELETE instruments (no delete documented)
        pass

test_TC017_pipeline_17_retrieve_issued_certificate_details()