"""Tier 4 Real-World Scenario 4: Re-Verification Failure, Repair, Re-Test & Supersession Lifecycle Flow.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.stakeholder import RoleEnum


class TestReverificationAndSupersessionFlow:
    """End-to-End multi-actor test: Out-of-Tolerance Failure -> Repair -> Re-Verification -> Certificate Supersession."""

    def test_complete_reverification_failure_repair_and_supersession_flow(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Execute complete cycle: Initial Cert-1 -> In-service Failure -> Repair -> Re-Verification -> Cert-2 Superseding Cert-1."""
        tenant_id = seed_data["tenant_id"]
        jur_id = seed_data["jurisdiction_id"]

        trader_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.LMO,
            jurisdiction_id=jur_id,
        )

        # -------------------------------------------------------------
        # PHASE 1: Initial Verification & Issuance of Certificate 1
        # -------------------------------------------------------------
        # 1. Register instrument
        inst_res = client.post(
            f"/api/v1/tenants/{tenant_id}/instruments",
            json={
                "jurisdiction_id": jur_id,
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-SUPERSEDE-2026-01",
                "year_of_manufacture": 2026,
            },
            headers=trader_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        # 2. Initial Application
        app1_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=trader_hdr,
        )
        app1_id = app1_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app1_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app1_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app1_id}/pay", json={"receipt_number": "REC-INIT-01"}, headers=trader_hdr)

        # 3. Session 1 (Pass)
        sess1_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={"application_id": app1_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess1_id = sess1_res.json()["session_id"]
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess1_id}/observations",
            json={
                "reference_standard_ids": seed_data["standard_ids"],
                "observations": [
                    {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                    {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "15.000000", "load_unit": "kg", "raw_indication_reading": "15.000000", "reading_unit": "kg"},
                ],
            },
            headers=lmo_hdr,
        )
        client.post(f"/api/v1/tenants/{tenant_id}/sessions/{sess1_id}/disposition", json={"outcome": "Verification passed — pending authorization"}, headers=lmo_hdr)

        # 4. Issue Certificate 1
        cert1_res = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/issue",
            json={"session_id": sess1_id, "validity_months": 12},
            headers=lmo_hdr,
        )
        assert cert1_res.status_code == 201
        cert1_data = cert1_res.json()
        cert1_id = cert1_data["certificate_id"]
        cert1_token = cert1_data["public_verification_token"]
        assert cert1_data["certificate_status"] == "ISSUED"

        # -------------------------------------------------------------
        # PHASE 2: Periodic Re-Verification with Metrological Failure
        # -------------------------------------------------------------
        # 1. Re-verification application
        app2_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "RE_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=trader_hdr,
        )
        app2_id = app2_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app2_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app2_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app2_id}/pay", json={"receipt_number": "REC-REVERIF-01"}, headers=trader_hdr)

        # 2. Session 2 (Fails: error 0.500 kg on 10 kg nominal load)
        sess2_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={"application_id": app2_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess2_id = sess2_res.json()["session_id"]
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess2_id}/observations",
            json={
                "reference_standard_ids": seed_data["standard_ids"],
                "observations": [
                    {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                    {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "10.000000", "load_unit": "kg", "raw_indication_reading": "10.500000", "reading_unit": "kg"},
                ],
            },
            headers=lmo_hdr,
        )

        # 3. LMO records failure disposition
        fail_disp_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess2_id}/disposition",
            json={
                "outcome": "Verification failed",
                "disposition_notes": "Instrument failed in-service MPE tolerance. Rejection memo issued for repair.",
            },
            headers=lmo_hdr,
        )
        assert fail_disp_res.status_code == 200
        assert fail_disp_res.json()["status"] == "FINALIZED"
        assert fail_disp_res.json()["outcome"] == "Verification failed"

        # -------------------------------------------------------------
        # PHASE 3: Repair & Successful Re-Verification Cycle
        # -------------------------------------------------------------
        # 1. New application after repair
        app3_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "RE_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=trader_hdr,
        )
        app3_id = app3_res.json()["application_id"]
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app3_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app3_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app3_id}/pay", json={"receipt_number": "REC-REPAIR-01"}, headers=trader_hdr)

        # 2. Session 3 (Passes after load cell replacement)
        sess3_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={"application_id": app3_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess3_id = sess3_res.json()["session_id"]
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess3_id}/observations",
            json={
                "reference_standard_ids": seed_data["standard_ids"],
                "observations": [
                    {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                    {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "10.000000", "load_unit": "kg", "raw_indication_reading": "10.000000", "reading_unit": "kg"},
                    {"step_type": "INCREASING_LOAD", "step_sequence": 3, "nominal_load": "15.000000", "load_unit": "kg", "raw_indication_reading": "15.000000", "reading_unit": "kg"},
                ],
            },
            headers=lmo_hdr,
        )
        client.post(f"/api/v1/tenants/{tenant_id}/sessions/{sess3_id}/disposition", json={"outcome": "Verification passed — pending authorization"}, headers=lmo_hdr)

        # 3. Issue Certificate 2 (Supersedes Certificate 1)
        cert2_res = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/issue",
            json={"session_id": sess3_id, "validity_months": 12},
            headers=lmo_hdr,
        )
        assert cert2_res.status_code == 201
        cert2_data = cert2_res.json()
        cert2_id = cert2_data["certificate_id"]
        cert2_token = cert2_data["public_verification_token"]
        assert cert2_data["certificate_status"] == "ISSUED"

        # -------------------------------------------------------------
        # PHASE 4: Verification of Supersession State & Public QR
        # -------------------------------------------------------------
        # 1. Certificate 1 must now be SUPERSEDED
        get_cert1_res = client.get(
            f"/api/v1/tenants/{tenant_id}/certificates/{cert1_id}",
            headers=lmo_hdr,
        )
        assert get_cert1_res.status_code == 200
        assert get_cert1_res.json()["certificate_status"] == "SUPERSEDED"
        assert get_cert1_res.json()["superseding_certificate_id"] == cert2_id

        # 2. Public verification for Certificate 1 shows SUPERSEDED
        pub_cert1_res = client.get(f"/api/v1/public/certificates/verify/{cert1_token}")
        assert pub_cert1_res.status_code == 200
        assert pub_cert1_res.json()["status"] == "SUPERSEDED"

        # 3. Public verification for Certificate 2 shows ISSUED and VALID_SIGNATURE
        pub_cert2_res = client.get(f"/api/v1/public/certificates/verify/{cert2_token}")
        assert pub_cert2_res.status_code == 200
        assert pub_cert2_res.json()["status"] == "ISSUED"
        assert pub_cert2_res.json()["cryptographic_validity"] == "VALID_SIGNATURE"
