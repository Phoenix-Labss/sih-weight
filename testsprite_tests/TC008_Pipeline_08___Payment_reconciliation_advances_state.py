import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"
TENANT_ID = "tenant-delhi-central"
JURISDICTION_ID = "jur-dl-01"

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

def test_TC008_payment_reconciliation_advances_state():
    timeout = 30
    model_id = "MOD-NAWI-03"
    instrument_id = None
    application_id = None
    
    # Helper function to delete instrument - best effort cleanup
    def delete_instrument(instrument_id_to_delete):
        try:
            url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/{instrument_id_to_delete}"
            # Assume DELETE supported; if not, ignore
            requests.delete(url, headers=HEADERS_OWNER, timeout=timeout)
        except Exception:
            pass

    # Helper function to delete application - best effort cleanup
    def delete_application(application_id_to_delete):
        # No explicit deletion endpoint documented, so skip
        pass

    try:
        # Step 1: GET /api/v1/tenants/:tenantId/instruments/models with OWNER headers; find model_id MOD-NAWI-03
        models_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments/models"
        resp = requests.get(models_url, headers=HEADERS_OWNER, timeout=timeout)
        assert resp.status_code == 200, f"Failed to get instrument models: {resp.status_code}"
        models = resp.json()
        assert any(m.get("model_id") == model_id for m in models), f"Model {model_id} not found in models list"

        # Step 2: POST /api/v1/tenants/:tenantId/instruments with {"model_id":"MOD-NAWI-03","serial_number":"<unique>"}
        instrument_serial = f"SN-{uuid.uuid4().hex[:12]}"
        instrument_create_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/instruments"
        instrument_payload = {"model_id": model_id, "serial_number": instrument_serial}
        resp = requests.post(instrument_create_url, headers=HEADERS_OWNER, json=instrument_payload, timeout=timeout)
        assert resp.status_code == 201, f"Instrument creation failed: {resp.status_code} {resp.text}"
        instrument = resp.json()
        instrument_id = instrument.get("instrument_id")
        assert instrument_id, "instrument_id missing in creation response"
        assert instrument.get("model_id") == model_id, "Returned model_id mismatch"
        assert instrument.get("serial_number") == instrument_serial, "Returned serial_number mismatch"
        # current_status and public_instrument_token check if present
        assert instrument.get("current_status"), "instrument current_status missing"
        assert instrument.get("public_instrument_token"), "instrument public_instrument_token missing"

        # Step 3: POST /api/v1/tenants/:tenantId/applications with OWNER headers and {"instrument_id":instrument_id}
        application_create_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications"
        application_payload = {"instrument_id": instrument_id}
        resp = requests.post(application_create_url, headers=HEADERS_OWNER, json=application_payload, timeout=timeout)
        assert resp.status_code == 201, f"Application creation failed: {resp.status_code} {resp.text}"
        application = resp.json()
        application_id = application.get("application_id")
        assert application_id, "application_id missing in creation response"
        assert application.get("instrument_id") == instrument_id, "Application's instrument_id mismatch"
        # current_status should be DRAFT
        assert application.get("current_status") == "DRAFT", f"Expected current_status 'DRAFT' but got {application.get('current_status')}"
        
        # Step 4: POST .../applications/:application_id/submit with body {} as OWNER (status SUBMITTED)
        submit_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/submit"
        resp = requests.post(submit_url, headers=HEADERS_OWNER, json={}, timeout=timeout)
        assert resp.status_code == 200, f"Application submit failed: {resp.status_code} {resp.text}"
        submitted_app = resp.json()
        submitted_status = submitted_app.get("current_status")
        assert submitted_status == "SUBMITTED", f"Expected status 'SUBMITTED' but got {submitted_status}"

        # Step 5: POST .../applications/:application_id/scrutiny as LMO with {"action":"ACCEPT","notes":"ok"}
        scrutiny_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/scrutiny"
        scrutiny_payload = {"action": "ACCEPT", "notes": "ok"}
        resp = requests.post(scrutiny_url, headers=HEADERS_LMO, json=scrutiny_payload, timeout=timeout)
        assert resp.status_code == 200, f"Scrutiny accept failed: {resp.status_code} {resp.text}"
        scrutiny_app = resp.json()
        accepted_status = scrutiny_app.get("current_status")
        # current_status advanced beyond SUBMITTED (example check)
        assert accepted_status != "SUBMITTED" and accepted_status is not None, f"Expected status beyond SUBMITTED but got {accepted_status}"

        # Step 6: POST .../applications/:application_id/fee as LMO with {"base_verification_fee":500,"user_charge":50,"policy_version":"fee-v1"}
        fee_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/fee"
        fee_payload = {"base_verification_fee": 500, "user_charge": 50, "policy_version": "fee-v1"}
        resp = requests.post(fee_url, headers=HEADERS_LMO, json=fee_payload, timeout=timeout)
        assert resp.status_code == 200, f"Fee assessment failed: {resp.status_code} {resp.text}"
        fee_app = resp.json()
        fee_status = fee_app.get("current_status")
        # It should reflect an assessed fee state (e.g. FEE_PENDING) - just check status not SUBMITTED or DRAFT
        assert fee_status not in ("DRAFT", "SUBMITTED"), f"Unexpected status after fee assessment: {fee_status}"
        # Optionally confirm fees present
        # fees may be in the response; check keys if present
        # Not explicitly required here, so skipped

        # Step 7: POST .../applications/:application_id/pay as OWNER with {"receipt_number":"RCPT-<uuid8>"}
        pay_url = f"{BASE_URL}/api/v1/tenants/{TENANT_ID}/applications/{application_id}/pay"
        receipt_number = f"RCPT-{uuid.uuid4().hex[:8].upper()}"
        pay_payload = {"receipt_number": receipt_number}
        resp = requests.post(pay_url, headers=HEADERS_OWNER, json=pay_payload, timeout=timeout)
        assert resp.status_code == 200, f"Payment reconciliation failed: {resp.status_code} {resp.text}"
        paid_app = resp.json()
        paid_status = paid_app.get("current_status")
        # Must be PAYMENT_RECONCILED or equivalent paid state
        assert paid_status in ("PAYMENT_RECONCILED", "PAID"), f"Expected payment reconciled state but got {paid_status}"
        # Receipt reference accepted - assume included in response somewhere: check presence maybe
        # Not always guaranteed; so just ensure receipt number is present or matched
        # Many APIs do not echo receipt_number on app; so just check overall status.

    finally:
        # Cleanup: best effort delete instrument and application if possible
        if instrument_id:
            delete_instrument(instrument_id)
        if application_id:
            delete_application(application_id)

test_TC008_payment_reconciliation_advances_state()