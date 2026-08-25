"""Tier 4 Real-World Scenario 1: Complete Commercial Retail Counter Scale Lifecycle Flow.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestCommercialRetailScaleFlow:
    """End-to-End multi-actor test: Commercial Retail Counter Machine (Class III, Max=15kg, e=5g)."""

    def test_complete_retail_counter_scale_lifecycle(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Execute full lifecycle: Trader registration -> Application -> Scrutiny -> Fee -> Schedule -> Testing -> Stamping -> Certificate -> Public QR."""
        tenant_id = seed_data["tenant_id"]
        jur_id = seed_data["jurisdiction_id"]

        trader_headers = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.OWNER,
        )
        lmo_headers = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.LMO,
            jurisdiction_id=jur_id,
        )

        # -------------------------------------------------------------
        # STEP 1: Trader registers new electronic counter scale unit
        # -------------------------------------------------------------
        inst_res = client.post(
            f"/api/v1/tenants/{tenant_id}/instruments",
            json={
                "jurisdiction_id": jur_id,
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-RETAIL-2026-0042",
                "year_of_manufacture": 2026,
                "intended_use": "Retail billing counter weighment of groceries and produce",
                "installation_location_notes": "Billing Counter #3",
            },
            headers=trader_headers,
        )
        assert inst_res.status_code == 201, inst_res.text
        inst_data = inst_res.json()
        inst_id = inst_data["instrument_id"]
        assert inst_data["serial_number"] == "SN-RETAIL-2026-0042"
        assert inst_data["current_status"] == "DRAFT"

        # -------------------------------------------------------------
        # STEP 2: Trader submits statutory Initial Verification application
        # -------------------------------------------------------------
        app_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "preferred_verification_date": "2026-09-01",
                "applicant_declaration_accepted": True,
            },
            headers=trader_headers,
        )
        assert app_res.status_code == 201, app_res.text
        app_data = app_res.json()
        app_id = app_data["application_id"]
        assert app_data["current_status"] == "SUBMITTED"

        # -------------------------------------------------------------
        # STEP 3: LMO scrutinizes & accepts application
        # -------------------------------------------------------------
        scrutiny_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications/{app_id}/scrutiny",
            json={
                "action": "ACCEPT",
                "notes": "Model approval certificate and trader trade license verified.",
            },
            headers=lmo_headers,
        )
        assert scrutiny_res.status_code == 200
        assert scrutiny_res.json()["current_status"] == "ACCEPTED"

        # -------------------------------------------------------------
        # STEP 4: Fee Assessment & Payment Reconciliation
        # -------------------------------------------------------------
        fee_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications/{app_id}/fee",
            json={
                "base_verification_fee": "500.00",
                "user_charge": "50.00",
                "late_fee": "0.00",
                "policy_version": "POL-DELHI-2026.1",
            },
            headers=lmo_headers,
        )
        assert fee_res.status_code == 200
        assert fee_res.json()["current_status"] == "FEE_PENDING"

        pay_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications/{app_id}/pay",
            json={
                "receipt_number": "TREASURY-CHALLAN-RETAIL-01",
                "payment_gateway_ref": "PG_RETAIL_9901",
            },
            headers=trader_headers,
        )
        assert pay_res.status_code == 200
        assert pay_res.json()["current_status"] == "FEE_PAID"

        # -------------------------------------------------------------
        # STEP 5: Verification Appointment Scheduling
        # -------------------------------------------------------------
        now = datetime.now(timezone.utc)
        sched_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications/{app_id}/schedule",
            json={
                "slot_start": (now + timedelta(days=1)).isoformat(),
                "slot_end": (now + timedelta(days=1, hours=2)).isoformat(),
                "assigned_lmo_id": seed_data["lmo_user_id"],
            },
            headers=lmo_headers,
        )
        assert sched_res.status_code == 200
        assert sched_res.json()["current_status"] == "SCHEDULED"

        # -------------------------------------------------------------
        # STEP 6: Verification Session Execution & Metrological Tests
        # -------------------------------------------------------------
        sess_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={
                "application_id": app_id,
                "instrument_id": inst_id,
                "procedure_pack_id": "IND-LM-NAWI-CLASS-III-IIII-2026.1",
                "scheduled_date": "2026-08-23",
                "environmental_temp_celsius": "24.00",
                "environmental_humidity_percent": "55.00",
            },
            headers=lmo_headers,
        )
        assert sess_res.status_code == 201
        sess_id = sess_res.json()["session_id"]

        # Confirm identity
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/identity?serial_verified=true",
            headers=lmo_headers,
        )

        # Submit full Class III observations (Zero, 500e = 2.5kg, 1000e = 5kg, 2000e = 10kg, Max = 15kg)
        obs_payload = {
            "reference_standard_ids": seed_data["standard_ids"],
            "environmental_temp_celsius": "24.00",
            "environmental_humidity_percent": "55.00",
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": "0.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "0.000000",
                    "reading_unit": "kg",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 2,
                    "nominal_load": "2.500000",
                    "load_unit": "kg",
                    "raw_indication_reading": "2.500000",
                    "reading_unit": "kg",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 3,
                    "nominal_load": "5.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "5.000000",
                    "reading_unit": "kg",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 4,
                    "nominal_load": "10.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "10.000000",
                    "reading_unit": "kg",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 5,
                    "nominal_load": "15.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "15.000000",
                    "reading_unit": "kg",
                },
            ],
        }
        submit_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/observations",
            json=obs_payload,
            headers=lmo_headers,
        )
        assert submit_res.status_code == 200
        assert submit_res.json()["automated_evaluation_flag"] is True

        # Officer disposition
        disp_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/disposition",
            json={
                "outcome": "Verification passed — pending authorization",
                "disposition_notes": "Counter machine complies with NAWI Class III MPE requirements across entire span.",
            },
            headers=lmo_headers,
        )
        assert disp_res.status_code == 200
        assert disp_res.json()["status"] == "FINALIZED"

        # -------------------------------------------------------------
        # STEP 7: Physical Stamping & Lead Seal Application
        # -------------------------------------------------------------
        stamp_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/stamps",
            json={
                "action_type": "SEAL_APPLIED",
                "seal_type": "LEAD_WIRE_SEAL",
                "seal_identification_number": "DEL-SEAL-2026-R4-001",
                "seal_position": "CALIBRATION_ACCESS_PORT",
                "notes": "Lead wire seal passed through calibration jumper cavity screw.",
            },
            headers=lmo_headers,
        )
        assert stamp_res.status_code == 201

        # -------------------------------------------------------------
        # STEP 8: Digital Certificate Issuance & Cryptographic Signature
        # -------------------------------------------------------------
        cert_res = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/issue",
            json={"session_id": sess_id, "validity_months": 12},
            headers=lmo_headers,
        )
        assert cert_res.status_code == 201
        cert_data = cert_res.json()
        assert cert_data["certificate_status"] == "ISSUED"
        assert len(cert_data["certificate_bytes_sha256"]) == 64
        assert cert_data["digital_signature_reference"] is not None
        qr_token = cert_data["public_verification_token"]

        # -------------------------------------------------------------
        # STEP 9: Unauthenticated Public QR Verification
        # -------------------------------------------------------------
        public_res = client.get(f"/api/v1/public/certificates/verify/{qr_token}")
        assert public_res.status_code == 200
        public_data = public_res.json()
        assert public_data["status"] == "ISSUED"
        assert public_data["cryptographic_validity"] == "VALID_SIGNATURE"
        assert public_data["instrument_summary"]["serial_number_masked"] == "SN-****-0042"
        assert "Kishore" not in public_res.text
