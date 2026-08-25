"""Comprehensive Unit & Integration Test Suite for Statutory Fee Assessment Engine.

Tests:
1. Legal Metrology (General) Rules, 2011 Schedule XII base fee brackets across NAWI Class I, II, III, IIII.
2. Capacity unit conversions (mg, g, kg, t, q) and zero/negative error handling.
3. Service location multiplier (2.0x on-site vs 1.0x lab).
4. Portal administrative user charge (Rs. 50.00).
5. Statutory late submission penalties (days overdue, months overdue, default late).
6. Exact Decimal arithmetic without floating-point precision drift.
7. REST API endpoints for fee estimation and application fee assessment.
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from packages.verification_fees import (
    StatutoryFeeCalculator,
    default_fee_calculator,
    FeeAssessmentRequest,
    FeeAssessmentResult,
    FeeServiceMode,
    FeeVerificationType,
    InvalidCapacityError,
    UnsupportedAccuracyClassError,
    InvalidFeePolicyError,
)
from app.models.application import (
    ApplicationStatusEnum,
    ApplicationTypeEnum,
    ServiceModeEnum,
    VerificationApplication,
)
from app.models.instrument import Instrument, InstrumentModel, AccuracyClassEnum
from app.models.stakeholder import RoleEnum


class TestStatutoryFeeAssessmentUnit:
    """Pure domain unit tests for Statutory Fee Calculator & Policies."""

    def test_class_1_special_accuracy_brackets(self):
        """Verify Class I precision balance statutory fee schedule."""
        calc = default_fee_calculator

        # <= 100g: Rs. 100.00
        res = calc.calculate_nawi_fee(max_capacity="50", capacity_unit="g", accuracy_class="CLASS_I", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("100.00")
        assert res.location_surcharge == Decimal("0.00")
        assert res.portal_charge == Decimal("50.00")
        assert res.total_fee == Decimal("150.00")

        # > 100g and <= 1kg: Rs. 200.00
        res = calc.calculate_nawi_fee(max_capacity="500", capacity_unit="g", accuracy_class="CLASS_I", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("200.00")

        # > 1kg and <= 5kg: Rs. 500.00
        res = calc.calculate_nawi_fee(max_capacity="3", capacity_unit="kg", accuracy_class="CLASS_I", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("500.00")

        # > 5kg and <= 50kg: Rs. 1,000.00
        res = calc.calculate_nawi_fee(max_capacity="20", capacity_unit="kg", accuracy_class="CLASS_I", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("1000.00")

        # > 50kg: Rs. 2,000.00
        res = calc.calculate_nawi_fee(max_capacity="60", capacity_unit="kg", accuracy_class="CLASS_I", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("2000.00")

    def test_class_2_high_accuracy_brackets(self):
        """Verify Class II high-accuracy scale statutory fee schedule."""
        calc = default_fee_calculator

        # <= 100g: Rs. 100.00
        res = calc.calculate_nawi_fee(max_capacity="100", capacity_unit="g", accuracy_class="CLASS_II", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("100.00")

        # > 100g and <= 1kg: Rs. 150.00
        res = calc.calculate_nawi_fee(max_capacity="1000", capacity_unit="g", accuracy_class="CLASS_II", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("150.00")

        # > 1kg and <= 5kg: Rs. 300.00
        res = calc.calculate_nawi_fee(max_capacity="4.5", capacity_unit="kg", accuracy_class="CLASS_II", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("300.00")

        # > 5kg and <= 50kg: Rs. 500.00
        res = calc.calculate_nawi_fee(max_capacity="50", capacity_unit="kg", accuracy_class="CLASS_II", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("500.00")

        # > 50kg: Rs. 1,000.00
        res = calc.calculate_nawi_fee(max_capacity="100", capacity_unit="kg", accuracy_class="CLASS_II", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("1000.00")

    def test_class_3_and_4_commercial_scale_brackets(self):
        """Verify Class III & IIII commercial scale statutory fee schedule across all capacity tiers."""
        calc = default_fee_calculator

        # <= 10kg: Rs. 100.00
        res = calc.calculate_nawi_fee(max_capacity="10", capacity_unit="kg", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("100.00")

        # > 10kg <= 50kg: Rs. 200.00
        res = calc.calculate_nawi_fee(max_capacity="30", capacity_unit="kg", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("200.00")

        # > 50kg <= 100kg: Rs. 300.00
        res = calc.calculate_nawi_fee(max_capacity="100", capacity_unit="kg", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("300.00")

        # > 100kg <= 300kg: Rs. 400.00
        res = calc.calculate_nawi_fee(max_capacity="250", capacity_unit="kg", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("400.00")

        # > 300kg <= 500kg: Rs. 500.00
        res = calc.calculate_nawi_fee(max_capacity="500", capacity_unit="kg", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("500.00")

        # > 500kg <= 1t (1000kg): Rs. 1,000.00
        res = calc.calculate_nawi_fee(max_capacity="1", capacity_unit="t", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("1000.00")

        # > 1t <= 2t: Rs. 1,500.00
        res = calc.calculate_nawi_fee(max_capacity="2", capacity_unit="t", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("1500.00")

        # > 2t <= 3t: Rs. 2,000.00
        res = calc.calculate_nawi_fee(max_capacity="3000", capacity_unit="kg", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("2000.00")

        # > 3t <= 5t: Rs. 3,000.00
        res = calc.calculate_nawi_fee(max_capacity="5", capacity_unit="tonne", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("3000.00")

        # > 5t <= 10t: Rs. 4,000.00
        res = calc.calculate_nawi_fee(max_capacity="10", capacity_unit="t", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("4000.00")

        # > 10t <= 20t: Rs. 5,000.00
        res = calc.calculate_nawi_fee(max_capacity="20", capacity_unit="t", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("5000.00")

        # > 20t <= 30t: Rs. 6,000.00
        res = calc.calculate_nawi_fee(max_capacity="30", capacity_unit="t", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("6000.00")

        # > 30t <= 50t: Rs. 7,000.00
        res = calc.calculate_nawi_fee(max_capacity="50", capacity_unit="t", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res.base_fee == Decimal("7000.00")

    def test_high_capacity_weighbridge_stepping(self):
        """Verify weighbridge capacity > 50 tonnes applies Rs. 1,000 per additional 10 tonnes tier."""
        calc = default_fee_calculator

        # 60 tonnes: 7000 + 1x1000 = 8000
        res_60 = calc.calculate_nawi_fee(max_capacity="60", capacity_unit="t", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res_60.base_fee == Decimal("8000.00")

        # 55 tonnes: 5t extra triggers 1x10t bracket = 8000
        res_55 = calc.calculate_nawi_fee(max_capacity="55", capacity_unit="t", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res_55.base_fee == Decimal("8000.00")

        # 80 tonnes: 7000 + 3x1000 = 10,000
        res_80 = calc.calculate_nawi_fee(max_capacity="80", capacity_unit="t", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res_80.base_fee == Decimal("10000.00")

        # 100 tonnes: 7000 + 5x1000 = 12,000
        res_100 = calc.calculate_nawi_fee(max_capacity="100", capacity_unit="t", accuracy_class="CLASS_III", service_mode="DEPARTMENTAL_LAB")
        assert res_100.base_fee == Decimal("12000.00")

    def test_on_site_verification_multiplier(self):
        """Verify statutory 2.0x multiplier (100% surcharge) for on-site user premises verification."""
        calc = default_fee_calculator

        # Class III 30kg on-site: base = 200, location surcharge = 200, portal = 50, total = 450
        res_onsite = calc.calculate_nawi_fee(
            max_capacity="30",
            capacity_unit="kg",
            accuracy_class="CLASS_III",
            service_mode="ON_SITE",
        )
        assert res_onsite.base_fee == Decimal("200.00")
        assert res_onsite.location_multiplier == Decimal("2.00")
        assert res_onsite.location_surcharge == Decimal("200.00")
        assert res_onsite.portal_charge == Decimal("50.00")
        assert res_onsite.late_fee == Decimal("0.00")
        assert res_onsite.total_fee == Decimal("450.00")

        # 60t weighbridge on-site: base = 8000, location surcharge = 8000, portal = 50, total = 16050
        res_wb = calc.calculate_nawi_fee(
            max_capacity="60",
            capacity_unit="t",
            accuracy_class="CLASS_III",
            service_mode="ON_SITE",
        )
        assert res_wb.base_fee == Decimal("8000.00")
        assert res_wb.location_surcharge == Decimal("8000.00")
        assert res_wb.total_fee == Decimal("16050.00")

    def test_late_submission_penalty_calculations(self):
        """Verify statutory late submission fee rules."""
        calc = default_fee_calculator

        # 1. Default late submission (1 month = 100% base fee)
        res_late1 = calc.calculate_nawi_fee(
            max_capacity="30",
            capacity_unit="kg",
            accuracy_class="CLASS_III",
            service_mode="ON_SITE",
            is_late_submission=True,
        )
        assert res_late1.base_fee == Decimal("200.00")
        assert res_late1.late_fee == Decimal("200.00")
        assert res_late1.total_fee == Decimal("650.00")  # 200 + 200 + 50 + 200

        # 2. Explicit months overdue (3 months overdue)
        res_late3m = calc.calculate_nawi_fee(
            max_capacity="30",
            capacity_unit="kg",
            accuracy_class="CLASS_III",
            service_mode="DEPARTMENTAL_LAB",
            months_overdue=3,
        )
        assert res_late3m.base_fee == Decimal("200.00")
        assert res_late3m.late_fee == Decimal("600.00")  # 3 * 200
        assert res_late3m.total_fee == Decimal("850.00")  # 200 + 0 + 50 + 600

        # 3. Days overdue (45 days overdue -> 2 month cycle penalty)
        res_late45d = calc.calculate_nawi_fee(
            max_capacity="30",
            capacity_unit="kg",
            accuracy_class="CLASS_III",
            service_mode="DEPARTMENTAL_LAB",
            days_overdue=45,
        )
        assert res_late45d.base_fee == Decimal("200.00")
        assert res_late45d.late_fee == Decimal("400.00")  # ceil(45/30) = 2 * 200

    def test_capacity_unit_conversions_and_errors(self):
        """Verify capacity metric conversions and error checks."""
        calc = default_fee_calculator

        # 15000 grams = 15 kg -> Class III tier 10kg < Max <= 50kg -> Rs. 200
        res_g = calc.calculate_nawi_fee(max_capacity="15000", capacity_unit="g", accuracy_class="CLASS_III")
        assert res_g.base_fee == Decimal("200.00")

        # 50,000 milligrams = 0.05 kg (50g) -> Class I tier <= 100g -> Rs. 100
        res_mg = calc.calculate_nawi_fee(max_capacity="50000", capacity_unit="mg", accuracy_class="CLASS_I")
        assert res_mg.base_fee == Decimal("100.00")

        # 2 quintals = 200 kg -> Class III tier 100kg < Max <= 300kg -> Rs. 400
        res_q = calc.calculate_nawi_fee(max_capacity="2", capacity_unit="q", accuracy_class="CLASS_III")
        assert res_q.base_fee == Decimal("400.00")

        # Invalid capacity zero or negative
        with pytest.raises(InvalidCapacityError):
            calc.calculate_nawi_fee(max_capacity="0", capacity_unit="kg")

        with pytest.raises(InvalidCapacityError):
            calc.calculate_nawi_fee(max_capacity="-5", capacity_unit="kg")

        # Unsupported unit
        with pytest.raises(InvalidCapacityError):
            calc.calculate_nawi_fee(max_capacity="10", capacity_unit="pounds")

        # Unsupported accuracy class
        with pytest.raises(UnsupportedAccuracyClassError):
            calc.calculate_nawi_fee(max_capacity="10", capacity_unit="kg", accuracy_class="CLASS_V_SUPER")

        # Invalid policy version
        with pytest.raises(InvalidFeePolicyError):
            calc.calculate_nawi_fee(max_capacity="10", capacity_unit="kg", policy_version="NONEXISTENT_POLICY_99")


class TestStatutoryFeeApiIntegration:
    """FastAPI integration tests for Fee Assessment Endpoints."""

    def test_post_fees_calculate_endpoint(self, client: TestClient):
        """Test stateless POST /api/v1/fees/calculate endpoint."""
        payload = {
            "category": "NAWI",
            "accuracy_class": "CLASS_III",
            "max_capacity": "15.000",
            "capacity_unit": "kg",
            "service_mode": "ON_SITE",
            "verification_type": "INITIAL_VERIFICATION",
            "is_late_submission": False,
        }
        resp = client.post("/api/v1/fees/calculate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert Decimal(str(data["base_verification_fee"])) == Decimal("200.00")
        assert Decimal(str(data["location_surcharge"])) == Decimal("200.00")
        assert Decimal(str(data["portal_charge"])) == Decimal("50.00")
        assert Decimal(str(data["total_assessed_amount"])) == Decimal("450.00")
        assert len(data["itemized_breakdown"]) >= 3

    def test_post_tenant_applications_calculate_fee(self, client: TestClient):
        """Test tenant-scoped POST /api/v1/tenants/{tenant_id}/applications/calculate-fee."""
        payload = {
            "category": "NAWI",
            "accuracy_class": "CLASS_I",
            "max_capacity": "200.0",
            "capacity_unit": "g",
            "service_mode": "DEPARTMENTAL_LAB",
            "verification_type": "RE_VERIFICATION",
            "is_late_submission": True,
        }
        resp = client.post("/api/v1/tenants/IN-DL/applications/calculate-fee", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert Decimal(str(data["base_verification_fee"])) == Decimal("200.00")
        assert Decimal(str(data["location_surcharge"])) == Decimal("0.00")
        assert Decimal(str(data["late_fee"])) == Decimal("200.00")
        assert Decimal(str(data["total_assessed_amount"])) == Decimal("450.00")  # 200 + 0 + 50 + 200

    def test_get_application_fee_assessment(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        """Test GET /api/v1/applications/{id}/fee-assessment generates formal assessment."""
        # 1. Register an instrument
        inst_resp = client.post(
            "/api/v1/tenants/IN-DL/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": "SCALE-FEES-TEST-001",
                "year_of_manufacture": 2026,
                "intended_use": "Commercial grocery weighment",
                "installation_location_notes": "Shop 10, Chandni Chowk, Delhi",
            },
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert inst_resp.status_code == 201
        inst_id = inst_resp.json()["instrument_id"]

        # 2. Submit application
        app_resp = client.post(
            "/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "DEPARTMENTAL_LAB",
                "applicant_declaration_accepted": True,
            },
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert app_resp.status_code == 201
        app_id = app_resp.json()["application_id"]

        # 3. Fetch fee assessment for application
        fee_resp = client.get(
            f"/api/v1/applications/{app_id}/fee-assessment",
            headers=auth_headers(seed_data["owner_user_id"], role=RoleEnum.OWNER),
        )
        assert fee_resp.status_code == 200
        fee_data = fee_resp.json()
        assert fee_data["tenant_id"] == "IN-DL"
        assert Decimal(str(fee_data["base_verification_fee"])) == Decimal("200.00")
        assert Decimal(str(fee_data["user_charge"])) == Decimal("50.00")
        assert Decimal(str(fee_data["total_assessed_amount"])) == Decimal("250.00")
        assert fee_data["payment_status"] == "PENDING"
