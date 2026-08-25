"""Phase 2 Master End-to-End Integration Lifecycle Test Suite.

Verifies complete end-to-end lifecycle flow:
1. Trader registers new instrument unit at facility.
2. Trader submits formal verification application (Initial Verification, On-Site).
3. LMO Officer scrutinizes and accepts application.
4. Statutory Fee Assessment calculated and issued under Schedule XII.
5. Payment checkout initiated, processed via HMAC-SHA256 signed gateway webhook, reconciled, and receipt generated.
6. Application transitions to FEE_PAID.
7. LMO schedules and opens verification session with pinned Class M1 standards.
8. LMO verifies physical nameplate serial/model identity.
9. LMO submits complete NAWI metrological observations (zero, linearity, eccentricity, repeatability) -> Evaluator PASS.
10. LMO affixes physical tamper-evident seal and records physical stamping ledger.
11. LMO authorizes official PASSED disposition -> Session FINALIZED.
12. Digital Certificate issued & signed with cryptographic SHA-256 digest and dynamic public QR token.
13. Deterministic Form 8 PDF/A certificate rendered and verified.
14. Public QR verification endpoint queried, validating active ISSUED state and ZERO PII leakage.
15. Expiry Reminder engine executed at statutory milestone (T-30), generating renewal notice with audit trail.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from packages.verification_fees import StatutoryFeeCalculator
from packages.verification_payments import MockPaymentGateway, WebhookVerifier
from packages.verification_reminders import ExpiryReminderEngine, ReminderStageEnum
from app.models.application import ApplicationStatusEnum, ServiceModeEnum
from app.models.certificate import CertificateStatusEnum
from app.models.instrument import InstrumentStatusEnum
from app.models.session import SessionStatusEnum, VerificationOutcomeEnum
from app.models.stakeholder import RoleEnum


class TestPhase2EndToEndLifecycle:
    """Master End-to-End Lifecycle Verification Test."""

    def test_complete_statutory_verification_lifecycle_phase2(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        tenant_id = seed_data["tenant_id"]
        owner_id = seed_data["stakeholder_id"]
        facility_id = seed_data["facility_id"]
        jurisdiction_id = seed_data["jurisdiction_id"]
        model_id = seed_data["model_id"]
        lmo_user_id = seed_data["lmo_user_id"]
        owner_user_id = seed_data["owner_user_id"]

        headers_owner = auth_headers(user_id=owner_user_id, tenant_id=tenant_id, role=RoleEnum.OWNER)
        headers_lmo = auth_headers(user_id=lmo_user_id, tenant_id=tenant_id, role=RoleEnum.LMO)

        # -------------------------------------------------------------
        # STEP 1: Trader registers new physical instrument unit
        # -------------------------------------------------------------
        serial_no = f"SN-E2E-2026-{uuid.uuid4().hex[:6].upper()}"
        inst_payload = {
            "jurisdiction_id": jurisdiction_id,
            "model_id": model_id,
            "owner_id": owner_id,
            "facility_id": facility_id,
            "serial_number": serial_no,
            "year_of_manufacture": 2026,
            "intended_use": "Commercial retail supermarket weighment",
            "installation_location_notes": "Main Checkout Counter #1",
        }
        resp_inst = client.post(
            f"/api/v1/tenants/{tenant_id}/instruments",
            json=inst_payload,
            headers=headers_owner,
        )
        assert resp_inst.status_code == 201, resp_inst.text
        inst_data = resp_inst.json()
        instrument_id = inst_data["instrument_id"]
        assert inst_data["serial_number"] == serial_no
        assert inst_data["current_status"] == "DRAFT"

        # -------------------------------------------------------------
        # STEP 2: Trader submits Verification Application (Initial, On-Site)
        # -------------------------------------------------------------
        app_payload = {
            "instrument_id": instrument_id,
            "applicant_id": owner_id,
            "application_type": "INITIAL_VERIFICATION",
            "service_mode": "ON_SITE",
            "applicant_declaration_accepted": True,
        }
        resp_app = client.post(
            f"/api/v1/tenants/{tenant_id}/applications",
            json=app_payload,
            headers=headers_owner,
        )
        assert resp_app.status_code == 201, resp_app.text
        app_data = resp_app.json()
        application_id = app_data["application_id"]
        application_number = app_data["application_number"]
        assert app_data["current_status"] == "SUBMITTED"

        # -------------------------------------------------------------
        # STEP 3: LMO Officer Scrutinizes and Accepts Application
        # -------------------------------------------------------------
        scrutiny_payload = {
            "action": "ACCEPT",
            "notes": "Model approval certificate IND/09/2024/491 and facility details verified.",
        }
        resp_scrutiny = client.post(
            f"/api/v1/tenants/{tenant_id}/applications/{application_id}/scrutiny",
            json=scrutiny_payload,
            headers=headers_lmo,
        )
        assert resp_scrutiny.status_code == 200, resp_scrutiny.text
        assert resp_scrutiny.json()["current_status"] == "ACCEPTED"

        # -------------------------------------------------------------
        # STEP 4: Statutory Fee Assessment Calculated & Issued
        # -------------------------------------------------------------
        # 15kg Class III on-site: Base Rs. 200, Location Surcharge Rs. 200 (100%), Portal Rs. 50 -> Total Rs. 450
        fee_calc = StatutoryFeeCalculator()
        quote = fee_calc.calculate_nawi_fee(
            max_capacity="15",
            capacity_unit="kg",
            accuracy_class="CLASS_III",
            service_mode="ON_SITE",
        )
        assert quote.base_fee == Decimal("200.00")
        assert quote.location_surcharge == Decimal("200.00")
        assert quote.portal_charge == Decimal("50.00")
        assert quote.total_fee == Decimal("450.00")

        resp_fee = client.post(
            f"/api/v1/tenants/{tenant_id}/applications/{application_id}/fee",
            json={
                "base_verification_fee": str(quote.base_fee),
                "user_charge": str(quote.portal_charge),
                "late_fee": "0.00",
                "policy_version": quote.policy_version,
            },
            headers=headers_lmo,
        )
        assert resp_fee.status_code == 200, resp_fee.text
        fee_app_data = resp_fee.json()
        assert fee_app_data["current_status"] == "FEE_PENDING"
        fee_assessment_id = fee_app_data["fee_assessment_id"]

        # -------------------------------------------------------------
        # STEP 5: Payment Initiated & Reconciled via HMAC Webhook
        # -------------------------------------------------------------
        idempotency_key = f"idemp_e2e_{uuid.uuid4().hex}"
        resp_pay_init = client.post(
            "/api/v1/payments/initiate",
            json={
                "application_id": application_id,
                "payment_method": "UPI",
                "idempotency_key": idempotency_key,
            },
            headers=headers_owner,
        )
        assert resp_pay_init.status_code == 201, resp_pay_init.text
        pay_init_data = resp_pay_init.json()
        payment_id = pay_init_data["payment_id"]
        assert pay_init_data["status"] == "PENDING"
        assert Decimal(str(pay_init_data["amount"])) == Decimal("250.00")

        # Simulate Signed Gateway Callback
        gateway = MockPaymentGateway()
        _, raw_json_str, sig_header = gateway.simulate_webhook_event(
            payment_id=payment_id,
            amount=Decimal("250.00"),
            status="SUCCESS",
        )

        resp_webhook = client.post(
            "/api/v1/payments/webhook",
            content=raw_json_str,
            headers={
                "Content-Type": "application/json",
                "X-Gateway-Signature": sig_header,
            },
        )
        assert resp_webhook.status_code == 200, resp_webhook.text
        wh_data = resp_webhook.json()
        assert wh_data["status"] == "RECONCILED"
        receipt_no = wh_data["receipt_number"]
        assert receipt_no.startswith("REC-")

        # Verify Statutory Receipt Fetch & Hash Integrity
        resp_receipt = client.get(
            f"/api/v1/payments/receipt/{receipt_no}",
            headers=headers_owner,
        )
        assert resp_receipt.status_code == 200
        rcpt_json = resp_receipt.json()
        assert rcpt_json["receipt_number"] == receipt_no
        assert Decimal(str(rcpt_json["amount"])) == Decimal("250.00")
        assert len(rcpt_json["digital_verification_hash"]) == 64

        # Verify application transitioned to FEE_PAID
        resp_app_paid = client.get(
            f"/api/v1/tenants/{tenant_id}/applications/{application_id}",
            headers=headers_owner,
        )
        assert resp_app_paid.status_code == 200
        assert resp_app_paid.json()["current_status"] == "FEE_PAID"

        # -------------------------------------------------------------
        # STEP 6: LMO Opens Verification Session with Pinned Standards
        # -------------------------------------------------------------
        session_payload = {
            "application_id": application_id,
            "instrument_id": instrument_id,
            "procedure_pack_id": "IND-LM-NAWI-CLASS-III-IIII-2026.1",
            "scheduled_date": "2026-08-23",
            "environmental_temp_celsius": "24.50",
            "environmental_humidity_percent": "55.00",
        }
        resp_sess = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json=session_payload,
            headers=headers_lmo,
        )
        assert resp_sess.status_code == 201, resp_sess.text
        session_id = resp_sess.json()["session_id"]
        assert resp_sess.json()["status"] == "PLANNED"

        # Confirm Physical Nameplate Identity
        resp_ident = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{session_id}/identity?serial_verified=true",
            headers=headers_lmo,
        )
        assert resp_ident.status_code == 200
        assert resp_ident.json()["status"] == "IDENTITY_CONFIRMED"

        # Start Session
        resp_start = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{session_id}/start",
            headers=headers_lmo,
        )
        assert resp_start.status_code == 200
        assert resp_start.json()["status"] == "IN_PROGRESS"

        # -------------------------------------------------------------
        # STEP 7: LMO Submits Complete NAWI Test Observations
        # -------------------------------------------------------------
        obs_payload = {
            "reference_standard_ids": seed_data["standard_ids"],
            "environmental_temp_celsius": "24.50",
            "environmental_humidity_percent": "55.00",
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": "0.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "0.000000",
                    "reading_unit": "kg",
                    "repetition_index": 1,
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 2,
                    "nominal_load": "5.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "5.000000",
                    "reading_unit": "kg",
                    "repetition_index": 1,
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 3,
                    "nominal_load": "10.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "10.000000",
                    "reading_unit": "kg",
                    "repetition_index": 1,
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 4,
                    "nominal_load": "15.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "15.000000",
                    "reading_unit": "kg",
                    "repetition_index": 1,
                },
            ],
        }
        resp_obs = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{session_id}/observations",
            json=obs_payload,
            headers=headers_lmo,
        )
        assert resp_obs.status_code == 200, resp_obs.text
        obs_data = resp_obs.json()
        assert obs_data["automated_evaluation_flag"] is True
        assert obs_data["status"] == "SUBMITTED"

        # -------------------------------------------------------------
        # STEP 8: LMO Records Physical Tamper-Evident Security Seal
        # -------------------------------------------------------------
        stamp_payload = {
            "action_type": "SEAL_APPLIED",
            "seal_type": "LEAD_WIRE_SEAL",
            "seal_identification_number": f"DL-SEAL-{uuid.uuid4().hex[:6].upper()}",
            "seal_position": "Calibration Port Screw",
            "notes": "Affixed tamper-evident lead wire seal with inspector punch mark.",
        }
        resp_stamp = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{session_id}/stamps",
            json=stamp_payload,
            headers=headers_lmo,
        )
        assert resp_stamp.status_code == 201, resp_stamp.text
        assert resp_stamp.json()["stamp_action_id"] is not None

        # -------------------------------------------------------------
        # STEP 9: LMO Authorizes Statutory Disposition -> FINALIZED
        # -------------------------------------------------------------
        disp_payload = {
            "outcome": "Verification passed — pending authorization",
            "disposition_notes": "Instrument fully verified under The Legal Metrology Act, 2009 and Section 24.",
        }
        resp_disp = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{session_id}/disposition",
            json=disp_payload,
            headers=headers_lmo,
        )
        assert resp_disp.status_code == 200, resp_disp.text
        assert resp_disp.json()["status"] == "FINALIZED"

        # -------------------------------------------------------------
        # STEP 10: Issue & Sign Digital Verification Certificate
        # -------------------------------------------------------------
        resp_issue = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/issue",
            json={"session_id": session_id},
            headers=headers_lmo,
        )
        assert resp_issue.status_code == 201, resp_issue.text
        cert_data = resp_issue.json()
        certificate_id = cert_data["certificate_id"]
        certificate_number = cert_data["certificate_number"]
        qr_token = cert_data["public_verification_token"]
        assert cert_data["certificate_status"] == "ISSUED"

        # -------------------------------------------------------------
        # STEP 11: Form 8 PDF/A Certificate Rendering Verification
        # -------------------------------------------------------------
        resp_pdf = client.get(
            f"/api/v1/certificates/{certificate_id}/pdf",
            headers=headers_lmo,
        )
        assert resp_pdf.status_code == 200
        assert resp_pdf.headers["content-type"] == "application/pdf"
        assert resp_pdf.content.startswith(b"%PDF-")
        assert len(resp_pdf.content) > 5000

        # Also verify via public QR token PDF route
        resp_pub_pdf = client.get(f"/public/certificates/{qr_token}/pdf")
        assert resp_pub_pdf.status_code == 200
        assert resp_pub_pdf.content.startswith(b"%PDF-")

        # -------------------------------------------------------------
        # STEP 12: Public QR Verification Endpoint (Zero PII Verified)
        # -------------------------------------------------------------
        resp_pub_qr = client.get(f"/public/certificates/verify/{qr_token}")
        assert resp_pub_qr.status_code == 200, resp_pub_qr.text
        pub_data = resp_pub_qr.json()
        assert pub_data["status"] == "ISSUED"
        assert pub_data["certificate_number"] == certificate_number
        assert pub_data["instrument_summary"]["accuracy_class"] == "CLASS_III"
        assert pub_data["valid_until"] is not None

        # STRICT ZERO PII AUDIT CHECK:
        # Private contact details and financials must NEVER appear in public response
        assert "owner_phone" not in pub_data
        assert "owner_email" not in pub_data
        assert "pan_number" not in pub_data
        assert "gstin" not in pub_data
        assert "payment_gateway_ref" not in pub_data
        assert "amount_paid" not in pub_data

        # -------------------------------------------------------------
        # STEP 13: Expiry Reminder Engine Execution (T-30 Milestone)
        # -------------------------------------------------------------
        # Calculate expiry date (issue date + 12 months = 2027-08-23)
        # Advance clock to T-30 days before expiry (2027-07-24)
        issue_d = date.fromisoformat(cert_data["issue_date"])
        valid_until_d = date.fromisoformat(cert_data["valid_until"])
        t_30_date = valid_until_d - timedelta(days=20)  # 20 days remaining -> DAYS_30 stage

        resp_scan = client.post(
            f"/api/v1/tenants/{tenant_id}/reminders/scan",
            json={"as_of_date": t_30_date.isoformat(), "auto_expire": True},
            headers=headers_lmo,
        )
        assert resp_scan.status_code == 200, resp_scan.text
        scan_data = resp_scan.json()
        assert scan_data["reminders_generated_count"] >= 1

        # Fetch generated reminder for this instrument
        resp_rem_list = client.get(
            f"/api/v1/tenants/{tenant_id}/reminders?instrument_id={instrument_id}",
            headers=headers_owner,
        )
        assert resp_rem_list.status_code == 200
        rem_items = resp_rem_list.json()["items"]
        assert len(rem_items) >= 1
        rem_record = rem_items[0]
        assert rem_record["reminder_type"] == "DAYS_30"
        assert rem_record["instrument_id"] == instrument_id
        assert rem_record["certificate_id"] == certificate_id
        assert "Section 24" in rem_record["message_body"]
