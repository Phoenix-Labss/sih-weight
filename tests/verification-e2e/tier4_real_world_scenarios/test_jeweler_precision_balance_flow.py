"""Tier 4 Real-World Scenario 3: Complete Jeweler High-Precision Balance Lifecycle Flow.
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


class TestJewelerPrecisionBalanceFlow:
    """End-to-End multi-actor test: Jeweler High-Precision Balance (Class II, Max=600g, e=10mg)."""

    @pytest.fixture
    def precision_setup(self, db_session: Session, seed_data: dict) -> dict:
        """Seed precision balance model and Class F1 standard weights."""
        now_utc = datetime.now(timezone.utc)
        prec_model = InstrumentModel(
            model_id="mod_jeweler_balance_600g",
            category="NAWI",
            subtype="PRECISION_JEWELRY_BALANCE",
            manufacturer_name="Swarna Metrology Systems",
            model_name="SMS-GOLD-600",
            model_approval_number="IND/09/2026/884",
            accuracy_class=AccuracyClassEnum.CLASS_II,
            verification_scale_interval_e=Decimal("0.010000"),  # 10 mg = 0.010 g
            scale_interval_unit="g",
            min_capacity=Decimal("0.500000"),  # 500 mg = 0.5 g
            max_capacity=Decimal("600.000000"),  # 600 g
            capacity_unit="g",
            number_of_intervals_n=60000,
            specifications={"draft_shield": True, "magnetic_force_restoration": True},
            is_active=True,
        )
        db_session.add(prec_model)

        # Class F1 precision standard weights (100g, 500g)
        std_f1_100g = ReferenceStandard(
            standard_id="std_f1_100g_01",
            tenant_id=seed_data["tenant_id"],
            custodian_type=CustodianTypeEnum.LMO_OFFICE,
            custodian_id=seed_data["jurisdiction_id"],
            asset_tag="STD-F1-100G-01",
            denomination_mass=Decimal("100.000000"),
            mass_unit="g",
            accuracy_class="F1",
            serial_number="F1-100G-SN1",
            calibration_certificate_number="CAL/NPL/2026/F1-100",
            calibrating_laboratory="National Physical Laboratory (NPL India)",
            calibrated_at=now_utc - timedelta(days=20),
            valid_until=now_utc + timedelta(days=345),
            expanded_uncertainty=Decimal("0.000150"),
            calibration_status=ReferenceStandardStatusEnum.ACTIVE,
        )
        std_f1_500g = ReferenceStandard(
            standard_id="std_f1_500g_01",
            tenant_id=seed_data["tenant_id"],
            custodian_type=CustodianTypeEnum.LMO_OFFICE,
            custodian_id=seed_data["jurisdiction_id"],
            asset_tag="STD-F1-500G-01",
            denomination_mass=Decimal("500.000000"),
            mass_unit="g",
            accuracy_class="F1",
            serial_number="F1-500G-SN1",
            calibration_certificate_number="CAL/NPL/2026/F1-500",
            calibrating_laboratory="National Physical Laboratory (NPL India)",
            calibrated_at=now_utc - timedelta(days=20),
            valid_until=now_utc + timedelta(days=345),
            expanded_uncertainty=Decimal("0.000750"),
            calibration_status=ReferenceStandardStatusEnum.ACTIVE,
        )
        db_session.add_all([std_f1_100g, std_f1_500g])
        db_session.commit()

        return {
            "model_id": "mod_jeweler_balance_600g",
            "standard_ids": ["std_f1_100g_01", "std_f1_500g_01"],
        }

    def test_complete_jeweler_precision_balance_flow(
        self, client: TestClient, seed_data: dict, auth_headers, precision_setup: dict
    ):
        """Full lifecycle of jeweler high-precision balance under strict Class II standards."""
        tenant_id = seed_data["tenant_id"]
        jur_id = seed_data["jurisdiction_id"]

        jeweler_hdr = auth_headers(
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

        # 1. Register Precision Instrument
        inst_res = client.post(
            f"/api/v1/tenants/{tenant_id}/instruments",
            json={
                "jurisdiction_id": jur_id,
                "model_id": precision_setup["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SN-JEWEL-GOLD-8819",
                "year_of_manufacture": 2026,
                "intended_use": "Gold bullion and 22kt jewelry weighment",
                "installation_location_notes": "Main Showroom Vault Weighing Chamber",
            },
            headers=jeweler_hdr,
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
                "preferred_verification_date": "2026-09-05",
                "applicant_declaration_accepted": True,
            },
            headers=jeweler_hdr,
        )
        assert app_res.status_code == 201
        app_id = app_res.json()["application_id"]

        # 3. Scrutiny, Fee & Payment
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/fee", json={"base_verification_fee": "1200.00", "user_charge": "100.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/pay", json={"receipt_number": "REC-GOLD-01"}, headers=jeweler_hdr)

        # 4. Schedule
        now = datetime.now(timezone.utc)
        client.post(
            f"/api/v1/tenants/{tenant_id}/applications/{app_id}/schedule",
            json={
                "slot_start": (now + timedelta(days=1)).isoformat(),
                "slot_end": (now + timedelta(days=1, hours=2)).isoformat(),
                "assigned_lmo_id": seed_data["lmo_user_id"],
            },
            headers=lmo_hdr,
        )

        # 5. Session Execution with precision fractional gram observations
        sess_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={
                "application_id": app_id,
                "instrument_id": inst_id,
                "scheduled_date": "2026-08-23",
                "environmental_temp_celsius": "21.50",
                "environmental_humidity_percent": "45.00",
            },
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]
        client.post(f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/identity?serial_verified=true", headers=lmo_hdr)

        # Submit precision observations (Zero, 100g, 500g in grams)
        obs_payload = {
            "reference_standard_ids": precision_setup["standard_ids"],
            "environmental_temp_celsius": "21.50",
            "environmental_humidity_percent": "45.00",
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": "0.000000",
                    "load_unit": "g",
                    "raw_indication_reading": "0.000000",
                    "reading_unit": "g",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 2,
                    "nominal_load": "100.000000",
                    "load_unit": "g",
                    "raw_indication_reading": "100.000000",
                    "reading_unit": "g",
                },
                {
                    "step_type": "INCREASING_LOAD",
                    "step_sequence": 3,
                    "nominal_load": "500.000000",
                    "load_unit": "g",
                    "raw_indication_reading": "500.000000",
                    "reading_unit": "g",
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

        # 6. Disposition & Stamping (Hologram security sticker + Lead seal)
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/stamps",
            json={
                "action_type": "SEAL_APPLIED",
                "seal_type": "SECURITY_STICKER_HOLOGRAM",
                "seal_identification_number": "GOLD-HOLO-2026-091",
                "seal_position": "CHASSIS_OPENING_SEAM",
            },
            headers=lmo_hdr,
        )

        # 7. Certificate Issuance & QR Verification
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
        assert pub_res.json()["instrument_summary"]["accuracy_class"] == "CLASS_II"
