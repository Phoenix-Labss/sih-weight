"""Tier 4 Real-World Scenario 2: Complete Heavy Industrial Weighbridge Lifecycle Flow.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.instrument import AccuracyClassEnum, InstrumentModel
from app.models.reference_standard import CustodianTypeEnum, ReferenceStandard, ReferenceStandardStatusEnum
from app.models.stakeholder import RoleEnum


class TestIndustrialWeighbridgeFlow:
    """End-to-End multi-actor test: Heavy Industrial Weighbridge (Class III, Max=50t, e=10kg)."""

    @pytest.fixture
    def weighbridge_setup(self, db_session: Session, seed_data: dict) -> dict:
        """Seed 50-tonne weighbridge model and heavy M1 standard blocks."""
        now_utc = datetime.now(timezone.utc)
        wb_model = InstrumentModel(
            model_id="mod_weighbridge_50t",
            category="NAWI",
            subtype="ELECTRONIC_WEIGHBRIDGE",
            manufacturer_name="Bharat Heavy Scales Ltd",
            model_name="BHS-50T-PITLESS",
            model_approval_number="IND/09/2025/1102",
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_scale_interval_e=Decimal("10.000000"),
            scale_interval_unit="kg",
            min_capacity=Decimal("200.000000"),
            max_capacity=Decimal("50000.000000"),
            capacity_unit="kg",
            number_of_intervals_n=5000,
            specifications={"platform_size": "16x3m", "load_cells": 6},
            is_active=True,
        )
        db_session.add(wb_model)

        # 5000kg Standard Block
        std_5t = ReferenceStandard(
            standard_id="std_m1_5000kg_01",
            tenant_id=seed_data["tenant_id"],
            custodian_type=CustodianTypeEnum.LMO_OFFICE,
            custodian_id=seed_data["jurisdiction_id"],
            asset_tag="STD-M1-5T-01",
            denomination_mass=Decimal("5000.000000"),
            mass_unit="kg",
            accuracy_class="M1",
            serial_number="M1-5T-BLOCK-01",
            calibration_certificate_number="CAL/NPL/2026/5001",
            calibrating_laboratory="National Physical Laboratory (NPL India)",
            calibrated_at=now_utc - timedelta(days=30),
            valid_until=now_utc + timedelta(days=335),
            expanded_uncertainty=Decimal("0.025000"),
            calibration_status=ReferenceStandardStatusEnum.ACTIVE,
        )
        # 10000kg Standard Block
        std_10t = ReferenceStandard(
            standard_id="std_m1_10000kg_01",
            tenant_id=seed_data["tenant_id"],
            custodian_type=CustodianTypeEnum.LMO_OFFICE,
            custodian_id=seed_data["jurisdiction_id"],
            asset_tag="STD-M1-10T-01",
            denomination_mass=Decimal("10000.000000"),
            mass_unit="kg",
            accuracy_class="M1",
            serial_number="M1-10T-BLOCK-01",
            calibration_certificate_number="CAL/NPL/2026/10001",
            calibrating_laboratory="National Physical Laboratory (NPL India)",
            calibrated_at=now_utc - timedelta(days=30),
            valid_until=now_utc + timedelta(days=335),
            expanded_uncertainty=Decimal("0.050000"),
            calibration_status=ReferenceStandardStatusEnum.ACTIVE,
        )
        db_session.add_all([std_5t, std_10t])
        db_session.commit()

        return {
            "model_id": "mod_weighbridge_50t",
            "standard_ids": ["std_m1_5000kg_01", "std_m1_10000kg_01"],
        }

    def test_complete_industrial_weighbridge_verification_flow(
        self, client: TestClient, seed_data: dict, auth_headers, weighbridge_setup: dict
    ):
        """Complete weighbridge workflow: Register -> Application -> Scrutiny -> Fee -> Multi-point test -> Stamping -> Cert."""
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

        # 1. Register Weighbridge
        inst_res = client.post(
            f"/api/v1/tenants/{tenant_id}/instruments",
            json={
                "jurisdiction_id": jur_id,
                "model_id": weighbridge_setup["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-WB-50T-2026-991",
                "year_of_manufacture": 2026,
                "intended_use": "Heavy transport commercial lorry weighment",
                "installation_location_notes": "Logistics Yard Gate 1",
            },
            headers=trader_hdr,
        )
        assert inst_res.status_code == 201
        inst_id = inst_res.json()["instrument_id"]

        # 2. Application Submission
        app_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "preferred_verification_date": "2026-09-10",
                "applicant_declaration_accepted": True,
            },
            headers=trader_hdr,
        )
        assert app_res.status_code == 201
        app_id = app_res.json()["application_id"]

        # 3. Scrutiny, Fee & Pay
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/fee", json={"base_verification_fee": "5000.00", "user_charge": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/pay", json={"receipt_number": "REC-WB-50T-01"}, headers=trader_hdr)

        # 4. Schedule
        now = datetime.now(timezone.utc)
        client.post(
            f"/api/v1/tenants/{tenant_id}/applications/{app_id}/schedule",
            json={
                "slot_start": (now + timedelta(days=2)).isoformat(),
                "slot_end": (now + timedelta(days=2, hours=4)).isoformat(),
                "assigned_lmo_id": seed_data["lmo_user_id"],
            },
            headers=lmo_hdr,
        )

        # 5. Session & Observations
        sess_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]
        client.post(f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/identity?serial_verified=true", headers=lmo_hdr)

        # Submit weighbridge observations (Zero, 5t, 10t, 20t, 50t within MPE)
        obs_payload = {
            "reference_standard_ids": weighbridge_setup["standard_ids"],
            "environmental_temp_celsius": "28.00",
            "environmental_humidity_percent": "60.00",
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
                    "nominal_load": "5000.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "5000.000000",
                    "reading_unit": "kg",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 3,
                    "nominal_load": "10000.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "10000.000000",
                    "reading_unit": "kg",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 4,
                    "nominal_load": "20000.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "20000.000000",
                    "reading_unit": "kg",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 5,
                    "nominal_load": "50000.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "50000.000000",
                    "reading_unit": "kg",
                },
            ],
        }
        submit_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/observations",
            json=obs_payload,
            headers=lmo_hdr,
        )
        assert submit_res.status_code == 200
        assert submit_res.json()["automated_evaluation_flag"] is True

        # 6. Officer Disposition
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/disposition",
            json={
                "outcome": "Verification passed — pending authorization",
                "disposition_notes": "Weighbridge passed full span verification up to 50 tonnes.",
            },
            headers=lmo_hdr,
        )

        # 7. Decoupled Stamping
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/stamps",
            json={
                "action_type": "SEAL_APPLIED",
                "seal_type": "LEAD_WIRE_SEAL",
                "seal_identification_number": "WB-SEAL-JB-01",
                "seal_position": "JUNCTION_BOX_ACCESS",
            },
            headers=lmo_hdr,
        )

        # 8. Certificate Issuance & Public Verification
        cert_res = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/issue",
            json={"session_id": sess_id, "validity_months": 12},
            headers=lmo_hdr,
        )
        assert cert_res.status_code == 201
        token = cert_res.json()["public_verification_token"]

        pub_res = client.get(f"/api/v1/public/certificates/verify/{token}")
        assert pub_res.status_code == 200
        assert pub_res.json()["status"] == "ISSUED"
        assert pub_res.json()["instrument_summary"]["model_name"] == "BHS-50T-PITLESS"
