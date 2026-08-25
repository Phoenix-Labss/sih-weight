"""Adversarial Challenge Test Suite for Milestone 3 (Transactional Verification & Certification API).

Covers:
1. Multi-tenant penetration tests (cross-tenant data leakage, horizontal/vertical object manipulation).
2. Unauthorized jurisdiction attempts (cross-district LMO scoping, RBAC/ABAC role enforcement).
3. Cryptographic certificate tampering detection (canonical JSON, hash alteration, signature forgery, key spoofing, QR entropy, zero PII leak).
4. Metrological & Domain safety guards (stepped MPE failure rejection, expired/quarantined standard fail-closed, premature/invalid certificate issuance guards).
"""

from __future__ import annotations

import base64
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import hmac
import secrets
from typing import Dict
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import create_access_token
from app.core.crypto import (
    MockCryptoSignatureAdapter,
    SignerContext,
    calculate_sha256_hex,
    canonical_json_bytes,
    generate_high_entropy_token,
)
from app.models.certificate import Certificate, CertificateStatusEnum
from app.models.instrument import Instrument, InstrumentStatusEnum
from app.models.reference_standard import (
    CustodianTypeEnum,
    ReferenceStandard,
    ReferenceStandardStatusEnum,
)
from app.models.session import (
    SessionStatusEnum,
    VerificationOutcomeEnum,
    VerificationSession,
)
from app.models.stakeholder import (
    Facility,
    RoleEnum,
    Stakeholder,
    StakeholderTypeEnum,
    User,
)
from app.models.tenant import Jurisdiction, JurisdictionLevelEnum, Tenant, TenantStateEnum


# ============================================================================
# Helper Fixtures & Builders
# ============================================================================

@pytest.fixture
def multi_tenant_setup(db_session: Session, seed_data: dict) -> dict:
    """Fixture providing second tenant (IN-MH) and cross-district entities."""
    # 1. Ensure IN-MH has jurisdiction and users
    jur_mumbai = db_session.execute(
        select(Jurisdiction).where(Jurisdiction.jurisdiction_id == "MH-MUMBAI")
    ).scalar_one()

    mh_owner_user = User(
        user_id="owner_mh_01",
        tenant_id="IN-MH",
        email="trader.mumbai@example.com",
        full_name="Sachin Trader Mumbai",
        role=RoleEnum.OWNER,
        is_active=True,
    )
    mh_lmo_user = User(
        user_id="lmo_mh_01",
        tenant_id="IN-MH",
        email="lmo.mumbai@maharashtra.gov.in",
        full_name="Ganesh Patil, LMO",
        role=RoleEnum.LMO,
        is_active=True,
    )
    db_session.add_all([mh_owner_user, mh_lmo_user])
    db_session.flush()

    mh_stakeholder = Stakeholder(
        stakeholder_id="stk_mh_trader_01",
        tenant_id="IN-MH",
        jurisdiction_id="MH-MUMBAI",
        legal_name="Mumbai Weighing Logistics Ltd",
        trade_name="Mumbai Port Terminal Scales",
        stakeholder_type=StakeholderTypeEnum.OWNER_USER,
        email="sachin@mumbaiport.in",
        phone="+919822000000",
        address_line1="Dock 3, Mumbai Port",
        city="Mumbai",
        pincode="400001",
    )
    db_session.add(mh_stakeholder)
    db_session.flush()

    mh_facility = Facility(
        facility_id="fac_mumbai_01",
        tenant_id="IN-MH",
        stakeholder_id="stk_mh_trader_01",
        facility_name="Mumbai Port Warehouse",
        address_line="Dock 3, Port Area",
        district="Mumbai",
        pincode="400001",
    )
    db_session.add(mh_facility)
    db_session.flush()

    # 2. Add second trader in Delhi for horizontal privilege tests
    dl_owner_user_2 = User(
        user_id="owner_user_02",
        tenant_id="IN-DL",
        email="trader2.delhi@example.com",
        full_name="Vijay Trader Delhi",
        role=RoleEnum.OWNER,
        is_active=True,
    )
    db_session.add(dl_owner_user_2)
    db_session.flush()

    db_session.commit()

    return {
        **seed_data,
        "tenant_mh_id": "IN-MH",
        "jur_mumbai_id": "MH-MUMBAI",
        "mh_owner_user_id": "owner_mh_01",
        "mh_lmo_user_id": "lmo_mh_01",
        "mh_stakeholder_id": "stk_mh_trader_01",
        "mh_facility_id": "fac_mumbai_01",
        "dl_owner_user_2_id": "owner_user_02",
    }


def create_passing_session_flow(client: TestClient, seed_data: dict, auth_headers) -> dict:
    """Helper creating a full verified session ready for certification."""
    owner_hdr = auth_headers(
        user_id=seed_data["owner_user_id"],
        tenant_id=seed_data["tenant_id"],
        role=RoleEnum.OWNER,
    )
    lmo_hdr = auth_headers(
        user_id=seed_data["lmo_user_id"],
        tenant_id=seed_data["tenant_id"],
        role=RoleEnum.LMO,
        jurisdiction_id=seed_data["jurisdiction_id"],
    )
    # 1. Register Instrument
    inst_res = client.post(
        f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
        json={
            "jurisdiction_id": seed_data["jurisdiction_id"],
            "model_id": seed_data["model_id"],
            "owner_id": seed_data["stakeholder_id"],
            "facility_id": seed_data["facility_id"],
            "serial_number": f"SN-ADV-TEST-{secrets.token_hex(4)}",
            "year_of_manufacture": 2026,
        },
        headers=owner_hdr,
    )
    assert inst_res.status_code == 201
    inst_id = inst_res.json()["instrument_id"]

    # 2. Submit Application
    app_res = client.post(
        f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
        json={
            "instrument_id": inst_id,
            "applicant_id": seed_data["stakeholder_id"],
            "application_type": "INITIAL_VERIFICATION",
            "service_mode": "ON_SITE",
            "applicant_declaration_accepted": True,
        },
        headers=owner_hdr,
    )
    assert app_res.status_code == 201
    app_id = app_res.json()["application_id"]

    client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
    client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
    client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/applications/{app_id}/pay", json={"receipt_number": f"REC-{secrets.token_hex(3)}"}, headers=owner_hdr)

    # 3. Create Session
    sess_res = client.post(
        f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
        json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
        headers=lmo_hdr,
    )
    assert sess_res.status_code == 201
    sess_id = sess_res.json()["session_id"]

    # 4. Submit Observations within MPE
    obs_payload = {
        "reference_standard_ids": seed_data["standard_ids"],
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
                "nominal_load": "15.000000",
                "load_unit": "kg",
                "raw_indication_reading": "15.000000",
                "reading_unit": "kg",
            },
        ],
    }
    client.post(f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations", json=obs_payload, headers=lmo_hdr)

    # 5. Record Disposition
    client.post(
        f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/disposition",
        json={"outcome": "Verification passed — pending authorization", "disposition_notes": "Statutory inspection complete"},
        headers=lmo_hdr,
    )
    return {"instrument_id": inst_id, "application_id": app_id, "session_id": sess_id}


# ============================================================================
# 1. Multi-Tenant Penetration Tests
# ============================================================================

class TestMultiTenantPenetration:
    """Adversarial challenge tests for cross-tenant boundary isolation and data leakage."""

    def test_cross_tenant_instrument_creation_isolation(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """Attacker authenticated under IN-MH tries to create instrument in IN-DL URL."""
        mh_owner_hdr = auth_headers(
            user_id=multi_tenant_setup["mh_owner_user_id"],
            tenant_id="IN-MH",
            role=RoleEnum.OWNER,
        )
        res = client.post(
            f"/api/v1/tenants/IN-DL/instruments",
            json={
                "jurisdiction_id": multi_tenant_setup["jurisdiction_id"],
                "model_id": multi_tenant_setup["model_id"],
                "owner_id": multi_tenant_setup["mh_stakeholder_id"],
                "facility_id": multi_tenant_setup["mh_facility_id"],
                "serial_number": "SN-MALICIOUS-CROSS-01",
                "year_of_manufacture": 2026,
            },
            headers=mh_owner_hdr,
        )
        assert res.status_code == 403
        data = res.json()
        assert data["error_code"] == "TENANT_ACCESS_DENIED"
        assert "IN-MH" in data["detail"]
        assert "IN-DL" in data["detail"]

    def test_cross_tenant_application_injection_blocked(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """Attacker in IN-MH registers instrument in IN-MH, but tries to submit application in IN-DL."""
        mh_owner_hdr = auth_headers(
            user_id=multi_tenant_setup["mh_owner_user_id"],
            tenant_id="IN-MH",
            role=RoleEnum.OWNER,
        )
        # Register in IN-MH
        inst_res = client.post(
            f"/api/v1/tenants/IN-MH/instruments",
            json={
                "jurisdiction_id": multi_tenant_setup["jur_mumbai_id"],
                "model_id": multi_tenant_setup["model_id"],
                "owner_id": multi_tenant_setup["mh_stakeholder_id"],
                "facility_id": multi_tenant_setup["mh_facility_id"],
                "serial_number": "SN-MH-VALID-01",
                "year_of_manufacture": 2026,
            },
            headers=mh_owner_hdr,
        )
        assert inst_res.status_code == 201
        mh_inst_id = inst_res.json()["instrument_id"]

        # Attempt to create application in IN-DL with MH instrument
        dl_owner_hdr = auth_headers(
            user_id=multi_tenant_setup["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        res = client.post(
            f"/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": mh_inst_id,
                "applicant_id": multi_tenant_setup["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=dl_owner_hdr,
        )
        assert res.status_code == 404
        assert "not found in tenant [IN-DL]" in res.json()["detail"]

    def test_cross_tenant_session_observation_manipulation_blocked(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """LMO in IN-MH attempts to submit observations for an IN-DL verification session."""
        flow = create_passing_session_flow(client, multi_tenant_setup, auth_headers)
        dl_sess_id = flow["session_id"]

        mh_lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["mh_lmo_user_id"],
            tenant_id="IN-MH",
            role=RoleEnum.LMO,
            jurisdiction_id="MH-MUMBAI",
        )
        obs_payload = {
            "reference_standard_ids": multi_tenant_setup["standard_ids"],
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": "0.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "0.000000",
                    "reading_unit": "kg",
                }
            ],
        }
        res = client.post(
            f"/api/v1/tenants/IN-DL/sessions/{dl_sess_id}/observations",
            json=obs_payload,
            headers=mh_lmo_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "TENANT_ACCESS_DENIED"

    def test_cross_tenant_certificate_issuance_blocked(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """LMO in IN-MH attempts to issue a certificate for an IN-DL verification session."""
        flow = create_passing_session_flow(client, multi_tenant_setup, auth_headers)
        dl_sess_id = flow["session_id"]

        mh_lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["mh_lmo_user_id"],
            tenant_id="IN-MH",
            role=RoleEnum.LMO,
            jurisdiction_id="MH-MUMBAI",
        )
        res = client.post(
            f"/api/v1/tenants/IN-DL/certificates/issue",
            json={"session_id": dl_sess_id},
            headers=mh_lmo_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "TENANT_ACCESS_DENIED"

    def test_cross_tenant_physical_stamp_recording_blocked(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """LMO in IN-MH attempts to record physical seal/stamp action on an IN-DL session."""
        flow = create_passing_session_flow(client, multi_tenant_setup, auth_headers)
        dl_sess_id = flow["session_id"]

        mh_lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["mh_lmo_user_id"],
            tenant_id="IN-MH",
            role=RoleEnum.LMO,
            jurisdiction_id="MH-MUMBAI",
        )
        res = client.post(
            f"/api/v1/tenants/IN-DL/sessions/{dl_sess_id}/stamps",
            json={
                "action_type": "SEAL_APPLIED",
                "seal_type": "LEAD_WIRE_SEAL",
                "seal_identification_number": "SEAL-MH-ATTACK-01",
                "seal_position": "JUNCTION_BOX",
            },
            headers=mh_lmo_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "TENANT_ACCESS_DENIED"

    def test_cross_tenant_listing_queries_never_leak_foreign_tenant_records(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """Listing endpoints in IN-MH return only IN-MH records, zero IN-DL records."""
        # Create an instrument in IN-MH
        mh_owner_hdr = auth_headers(
            user_id=multi_tenant_setup["mh_owner_user_id"],
            tenant_id="IN-MH",
            role=RoleEnum.OWNER,
        )
        client.post(
            f"/api/v1/tenants/IN-MH/instruments",
            json={
                "jurisdiction_id": multi_tenant_setup["jur_mumbai_id"],
                "model_id": multi_tenant_setup["model_id"],
                "owner_id": multi_tenant_setup["mh_stakeholder_id"],
                "facility_id": multi_tenant_setup["mh_facility_id"],
                "serial_number": "SN-MH-LIST-CHECK-01",
                "year_of_manufacture": 2026,
            },
            headers=mh_owner_hdr,
        )

        mh_lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["mh_lmo_user_id"],
            tenant_id="IN-MH",
            role=RoleEnum.LMO,
            jurisdiction_id="MH-MUMBAI",
        )
        res = client.get(f"/api/v1/tenants/IN-MH/instruments", headers=mh_lmo_hdr)
        assert res.status_code == 200
        items = res.json()["items"]
        for item in items:
            assert item["tenant_id"] == "IN-MH"
            assert item["tenant_id"] != "IN-DL"


# ============================================================================
# 2. Unauthorized Jurisdiction & Role Attempts (ABAC/RBAC)
# ============================================================================

class TestUnauthorizedJurisdictionAndRoles:
    """Adversarial challenge tests for district boundaries and role permissions."""

    def test_cross_district_lmo_session_observation_blocked(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """LMO in DL-NORTH attempts to record observations for application in DL-SOUTH."""
        south_owner_hdr = auth_headers(
            user_id="south_trader_02",
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
            jurisdiction_id="DL-SOUTH",
        )
        # Register in DL-SOUTH
        inst_res = client.post(
            f"/api/v1/tenants/IN-DL/instruments",
            json={
                "jurisdiction_id": multi_tenant_setup["jurisdiction_south_id"],
                "model_id": multi_tenant_setup["model_id"],
                "owner_id": multi_tenant_setup["stakeholder_id"],
                "facility_id": multi_tenant_setup["facility_id"],
                "serial_number": "SN-SOUTH-OBS-01",
                "year_of_manufacture": 2026,
            },
            headers=south_owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        # Application in DL-SOUTH
        app_res = client.post(
            f"/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": multi_tenant_setup["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=south_owner_hdr,
        )
        app_id = app_res.json()["application_id"]

        # Session in DL-SOUTH
        lmo_south_hdr = auth_headers(
            user_id="lmo_south_01",
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-SOUTH",
        )
        sess_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_south_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # DL-NORTH officer attempts observation submission on DL-SOUTH session
        lmo_north_hdr = auth_headers(
            user_id="lmo_north_01",
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        obs_payload = {
            "reference_standard_ids": multi_tenant_setup["standard_ids"],
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": "0.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "0.000000",
                    "reading_unit": "kg",
                }
            ],
        }
        res = client.post(
            f"/api/v1/tenants/IN-DL/sessions/{sess_id}/observations",
            json=obs_payload,
            headers=lmo_north_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "OUTSIDE_JURISDICTION"

    def test_cross_district_lmo_disposition_recording_blocked(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """LMO in DL-NORTH attempts to record disposition for application in DL-SOUTH."""
        south_owner_hdr = auth_headers(
            user_id="south_trader_03",
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
            jurisdiction_id="DL-SOUTH",
        )
        inst_res = client.post(
            f"/api/v1/tenants/IN-DL/instruments",
            json={
                "jurisdiction_id": multi_tenant_setup["jurisdiction_south_id"],
                "model_id": multi_tenant_setup["model_id"],
                "owner_id": multi_tenant_setup["stakeholder_id"],
                "facility_id": multi_tenant_setup["facility_id"],
                "serial_number": "SN-SOUTH-DISP-01",
                "year_of_manufacture": 2026,
            },
            headers=south_owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        app_res = client.post(
            f"/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": multi_tenant_setup["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=south_owner_hdr,
        )
        app_id = app_res.json()["application_id"]

        lmo_south_hdr = auth_headers(
            user_id="lmo_south_01",
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-SOUTH",
        )
        sess_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_south_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # Submit observations with south officer
        obs_payload = {
            "reference_standard_ids": multi_tenant_setup["standard_ids"],
            "observations": [
                {
                    "step_type": "ZERO_TEST",
                    "step_sequence": 1,
                    "nominal_load": "0.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "0.000000",
                    "reading_unit": "kg",
                }
            ],
        }
        client.post(f"/api/v1/tenants/IN-DL/sessions/{sess_id}/observations", json=obs_payload, headers=lmo_south_hdr)

        # North officer attempts disposition
        lmo_north_hdr = auth_headers(
            user_id="lmo_north_01",
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        res = client.post(
            f"/api/v1/tenants/IN-DL/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_north_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "OUTSIDE_JURISDICTION"

    def test_unauthorized_role_model_registration_blocked(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """TRADER/OWNER attempting Section 22 model registration is rejected with 403."""
        owner_hdr = auth_headers(
            user_id=multi_tenant_setup["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        res = client.post(
            f"/api/v1/tenants/IN-DL/instruments/models",
            json={
                "category": "NAWI",
                "subtype": "ELECTRONIC_COUNTER",
                "manufacturer_name": "Counterfeit Mfg",
                "model_name": "CF-100",
                "model_approval_number": "IND/99/9999/999",
                "accuracy_class": "CLASS_III",
                "verification_scale_interval_e": "0.005000",
                "scale_interval_unit": "kg",
                "min_capacity": "0.100000",
                "max_capacity": "15.000000",
                "capacity_unit": "kg",
                "number_of_intervals_n": 3000,
            },
            headers=owner_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "INSUFFICIENT_PERMISSIONS"

    def test_unauthorized_role_fee_assessment_blocked(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """TRADER/OWNER attempting statutory fee assessment notice issuance is rejected with 403."""
        owner_hdr = auth_headers(
            user_id=multi_tenant_setup["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        res = client.post(
            f"/api/v1/tenants/IN-DL/applications/app_dummy_123/fee",
            json={"base_verification_fee": "500.00"},
            headers=owner_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "INSUFFICIENT_PERMISSIONS"

    def test_unauthorized_role_scheduling_blocked(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """TRADER/OWNER attempting to schedule application is rejected with 403."""
        owner_hdr = auth_headers(
            user_id=multi_tenant_setup["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        res = client.post(
            f"/api/v1/tenants/IN-DL/applications/app_dummy_123/schedule",
            json={"slot_start": "2026-08-25T10:00:00Z", "slot_end": "2026-08-25T11:00:00Z"},
            headers=owner_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "INSUFFICIENT_PERMISSIONS"

    def test_unauthorized_role_observation_recording_blocked(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """TRADER/OWNER attempting to record test observations directly is rejected with 403."""
        owner_hdr = auth_headers(
            user_id=multi_tenant_setup["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        res = client.post(
            f"/api/v1/tenants/IN-DL/sessions/sess_dummy_123/observations",
            json={"reference_standard_ids": ["std1"], "observations": []},
            headers=owner_hdr,
        )
        assert res.status_code == 403
        assert res.json()["error_code"] == "INSUFFICIENT_PERMISSIONS"


# ============================================================================
# 3. Cryptographic Certificate Tampering & Trust Integrity
# ============================================================================

class TestCryptographicCertificateTampering:
    """Adversarial challenge tests for canonical byte serialization, signature verification, and QR security."""

    def test_canonical_json_determinism_and_key_order(self):
        """Canonical JSON serialization must strictly enforce alphabetical sorting and compact formatting."""
        dict_a = {"tenant_id": "IN-DL", "certificate_number": "CERT-001", "validity": {"valid_until": "2027-08-23", "issue_date": "2026-08-23"}}
        dict_b = {"certificate_number": "CERT-001", "validity": {"issue_date": "2026-08-23", "valid_until": "2027-08-23"}, "tenant_id": "IN-DL"}

        bytes_a = canonical_json_bytes(dict_a)
        bytes_b = canonical_json_bytes(dict_b)

        assert bytes_a == bytes_b
        assert b" " not in bytes_a  # Compact delimiters (',', ':')
        assert bytes_a.startswith(b'{"certificate_number":')

    def test_tampered_canonical_hash_rejected_by_crypto_adapter(self):
        """Tampering with SHA-256 canonical hash causes signature verification to fail."""
        adapter = MockCryptoSignatureAdapter()
        context = SignerContext(
            signer_id="lmo_dl_01",
            signer_role="LMO",
            jurisdiction_id="DL-NORTH",
            certificate_id="cert_test_001",
        )
        orig_hash = calculate_sha256_hex("valid_canonical_payload_bytes")
        sig_result = adapter.sign_hash(orig_hash, context)

        # 1. Verification of original passes
        is_valid = adapter.verify_signature(
            canonical_hash=orig_hash,
            signature_base64=sig_result.signature_bytes_base64,
            key_identifier=sig_result.key_identifier,
        )
        assert is_valid is True

        # 2. Tampered hash fails
        tampered_hash = calculate_sha256_hex("tampered_canonical_payload_bytes")
        is_tampered_valid = adapter.verify_signature(
            canonical_hash=tampered_hash,
            signature_base64=sig_result.signature_bytes_base64,
            key_identifier=sig_result.key_identifier,
        )
        assert is_tampered_valid is False

    def test_tampered_signature_bytes_rejected_by_public_qr_endpoint(
        self, client: TestClient, db_session: Session, multi_tenant_setup: dict, auth_headers
    ):
        """Modifying signature bytes in DB causes public verification endpoint to report INVALID_SIGNATURE."""
        flow = create_passing_session_flow(client, multi_tenant_setup, auth_headers)
        lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        cert_res = client.post(
            f"/api/v1/tenants/IN-DL/certificates/issue",
            json={"session_id": flow["session_id"]},
            headers=lmo_hdr,
        )
        assert cert_res.status_code == 201
        cert_id = cert_res.json()["certificate_id"]
        qr_tok = cert_res.json()["public_verification_token"]

        # 1. Unaltered cert passes public verification
        res_valid = client.get(f"/api/v1/public/certificates/verify/{qr_tok}")
        assert res_valid.status_code == 200
        assert res_valid.json()["cryptographic_validity"] == "VALID_SIGNATURE"

        # 2. Tamper signature in database directly
        db_cert = db_session.execute(
            select(Certificate).where(Certificate.certificate_id == cert_id)
        ).scalar_one()
        # Flip signature characters
        parts = db_cert.digital_signature_reference.split(":")
        corrupted_sig = ("B" if parts[0][0] == "A" else "A") + parts[0][1:]
        db_cert.digital_signature_reference = f"{corrupted_sig}:{parts[1]}"
        db_session.commit()

        # 3. Public verification detects corruption
        res_corrupt = client.get(f"/api/v1/public/certificates/verify/{qr_tok}")
        assert res_corrupt.status_code == 200
        assert res_corrupt.json()["cryptographic_validity"] == "INVALID_SIGNATURE"

    def test_tampered_key_identifier_rejected(
        self, client: TestClient, db_session: Session, multi_tenant_setup: dict, auth_headers
    ):
        """Replacing signing key identifier with an unauthorized key fails verification."""
        flow = create_passing_session_flow(client, multi_tenant_setup, auth_headers)
        lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        cert_res = client.post(
            f"/api/v1/tenants/IN-DL/certificates/issue",
            json={"session_id": flow["session_id"]},
            headers=lmo_hdr,
        )
        cert_id = cert_res.json()["certificate_id"]
        qr_tok = cert_res.json()["public_verification_token"]

        # Tamper key identifier in database
        db_cert = db_session.execute(
            select(Certificate).where(Certificate.certificate_id == cert_id)
        ).scalar_one()
        parts = db_cert.digital_signature_reference.split(":")
        db_cert.digital_signature_reference = f"{parts[0]}:key_attacker_rogue_jurisdiction"
        db_session.commit()

        res = client.get(f"/api/v1/public/certificates/verify/{qr_tok}")
        assert res.status_code == 200
        assert res.json()["cryptographic_validity"] == "INVALID_SIGNATURE"

    def test_high_entropy_token_characteristics_and_enumeration_resistance(self, client: TestClient):
        """Token generator produces high entropy tokens (>= 32 bytes URL-safe), non-existent tokens 404."""
        tokens = [generate_high_entropy_token("cert_tok_") for _ in range(100)]
        assert len(set(tokens)) == 100  # Zero collisions in 100 samples
        for tok in tokens:
            assert tok.startswith("cert_tok_")
            assert len(tok) >= 40

        # Attempt to enumerate or guess token
        res = client.get(f"/api/v1/public/certificates/verify/cert_tok_guessed_token_1234567890")
        assert res.status_code == 404
        assert res.json()["error_code"] == "CERTIFICATE_NOT_FOUND"

    def test_zero_pii_leakage_in_public_qr_projection(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """Public projection strictly masks serial numbers and contains zero owner PII."""
        flow = create_passing_session_flow(client, multi_tenant_setup, auth_headers)
        lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        cert_res = client.post(
            f"/api/v1/tenants/IN-DL/certificates/issue",
            json={"session_id": flow["session_id"]},
            headers=lmo_hdr,
        )
        qr_tok = cert_res.json()["public_verification_token"]

        res = client.get(f"/api/v1/public/certificates/verify/{qr_tok}")
        assert res.status_code == 200
        raw_text = res.text

        # Zero PII assertions
        assert "Kishore" not in raw_text
        assert "kishore@retail.in" not in raw_text
        assert "9811000000" not in raw_text
        assert "Shop 4" not in raw_text
        assert "REC-" not in raw_text
        assert "500.00" not in raw_text

        # Serial masking check
        summary = res.json()["instrument_summary"]
        assert "****" in summary["serial_number_masked"]


# ============================================================================
# 4. Metrological & Domain Safety Guards
# ============================================================================

class TestMetrologicalAndDomainSafetyGuards:
    """Adversarial challenge tests for legal metrology domain invariants."""

    def test_failing_stepped_mpe_rejects_passing_disposition_via_api(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """Observations with gross error exceeding MPE causes automated check to fail and blocks 'Passed' disposition."""
        owner_hdr = auth_headers(
            user_id=multi_tenant_setup["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        # Instrument & App
        inst_res = client.post(
            f"/api/v1/tenants/IN-DL/instruments",
            json={
                "jurisdiction_id": multi_tenant_setup["jurisdiction_id"],
                "model_id": multi_tenant_setup["model_id"],
                "owner_id": multi_tenant_setup["stakeholder_id"],
                "facility_id": multi_tenant_setup["facility_id"],
                "serial_number": "SN-FAILING-MPE-01",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        app_res = client.post(
            f"/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": multi_tenant_setup["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = app_res.json()["application_id"]
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/pay", json={"receipt_number": "REC-MPE-FAIL"}, headers=owner_hdr)

        sess_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # Gross error at 15kg load (reading 15.050 kg, MPE is 0.0075 kg)
        obs_payload = {
            "reference_standard_ids": multi_tenant_setup["standard_ids"],
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
                    "nominal_load": "15.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "15.050000",  # +50g error!
                    "reading_unit": "kg",
                },
            ],
        }
        client.post(f"/api/v1/tenants/IN-DL/sessions/{sess_id}/observations", json=obs_payload, headers=lmo_hdr)

        # Attempt to record PASSED disposition
        disp_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization", "disposition_notes": "Attempting invalid pass"},
            headers=lmo_hdr,
        )
        assert disp_res.status_code == 422
        assert disp_res.json()["error_code"] == "GUARD_CONDITION_FAILED"

        # Record legitimate FAILED disposition
        fail_disp_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions/{sess_id}/disposition",
            json={"outcome": "Verification failed", "disposition_notes": "Load cell error exceeds Class III MPE"},
            headers=lmo_hdr,
        )
        assert fail_disp_res.status_code == 200
        assert fail_disp_res.json()["status"] == "FINALIZED"
        assert fail_disp_res.json()["outcome"] == "Verification failed"

    def test_expired_reference_standard_blocks_verification_pass(
        self, client: TestClient, db_session: Session, multi_tenant_setup: dict, auth_headers
    ):
        """Using expired standard causes procedure pack evaluation to fail and blocks certificate readiness."""
        now_utc = datetime.now(timezone.utc)
        expired_std = ReferenceStandard(
            standard_id="std_m1_expired_99",
            tenant_id="IN-DL",
            custodian_type=CustodianTypeEnum.LMO_OFFICE,
            custodian_id="DL-NORTH",
            asset_tag="STD-EXPIRED-99",
            denomination_mass=Decimal("10.000000"),
            mass_unit="kg",
            accuracy_class="M1",
            serial_number="M1-EXP-99",
            calibration_certificate_number="CAL/OLD/2020/001",
            calibrating_laboratory="NPL",
            calibrated_at=now_utc - timedelta(days=500),
            valid_until=now_utc - timedelta(days=100),  # Expired!
            expanded_uncertainty=Decimal("0.000050"),
            calibration_status=ReferenceStandardStatusEnum.EXPIRED,
        )
        db_session.add(expired_std)
        db_session.commit()

        owner_hdr = auth_headers(
            user_id=multi_tenant_setup["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        inst_res = client.post(
            f"/api/v1/tenants/IN-DL/instruments",
            json={
                "jurisdiction_id": multi_tenant_setup["jurisdiction_id"],
                "model_id": multi_tenant_setup["model_id"],
                "owner_id": multi_tenant_setup["stakeholder_id"],
                "facility_id": multi_tenant_setup["facility_id"],
                "serial_number": "SN-EXPIRED-STD-01",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        app_res = client.post(
            f"/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": multi_tenant_setup["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = app_res.json()["application_id"]
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/pay", json={"receipt_number": "REC-EXP-STD"}, headers=owner_hdr)

        sess_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        obs_payload = {
            "reference_standard_ids": ["std_m1_expired_99"],
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
                    "nominal_load": "10.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "10.000000",
                    "reading_unit": "kg",
                },
            ],
        }
        client.post(f"/api/v1/tenants/IN-DL/sessions/{sess_id}/observations", json=obs_payload, headers=lmo_hdr)

        # Attempt to record passing disposition fails closed
        disp_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )
        assert disp_res.status_code == 422
        assert disp_res.json()["error_code"] == "GUARD_CONDITION_FAILED"

    def test_premature_certificate_issuance_on_in_progress_session_rejected(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """Attempting to issue a certificate on an unfinalized session fails with 422 GUARD_CONDITION_FAILED."""
        owner_hdr = auth_headers(
            user_id=multi_tenant_setup["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        inst_res = client.post(
            f"/api/v1/tenants/IN-DL/instruments",
            json={
                "jurisdiction_id": multi_tenant_setup["jurisdiction_id"],
                "model_id": multi_tenant_setup["model_id"],
                "owner_id": multi_tenant_setup["stakeholder_id"],
                "facility_id": multi_tenant_setup["facility_id"],
                "serial_number": "SN-PREMATURE-01",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        app_res = client.post(
            f"/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": multi_tenant_setup["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = app_res.json()["application_id"]

        sess_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # Attempt to issue certificate immediately while session is still in PLANNED status
        cert_res = client.post(
            f"/api/v1/tenants/IN-DL/certificates/issue",
            json={"session_id": sess_id},
            headers=lmo_hdr,
        )
        assert cert_res.status_code == 422
        assert cert_res.json()["error_code"] == "GUARD_CONDITION_FAILED"

    def test_failed_session_certificate_issuance_rejected(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """Attempting to issue certificate on a finalized 'Verification failed' session is rejected."""
        owner_hdr = auth_headers(
            user_id=multi_tenant_setup["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        inst_res = client.post(
            f"/api/v1/tenants/IN-DL/instruments",
            json={
                "jurisdiction_id": multi_tenant_setup["jurisdiction_id"],
                "model_id": multi_tenant_setup["model_id"],
                "owner_id": multi_tenant_setup["stakeholder_id"],
                "facility_id": multi_tenant_setup["facility_id"],
                "serial_number": "SN-FAILED-CERT-01",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        app_res = client.post(
            f"/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": multi_tenant_setup["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = app_res.json()["application_id"]
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/applications/{app_id}/pay", json={"receipt_number": "REC-FAIL-CERT"}, headers=owner_hdr)

        sess_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        obs_payload = {
            "reference_standard_ids": multi_tenant_setup["standard_ids"],
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
                    "nominal_load": "15.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "15.090000",  # 90g error
                    "reading_unit": "kg",
                },
            ],
        }
        client.post(f"/api/v1/tenants/IN-DL/sessions/{sess_id}/observations", json=obs_payload, headers=lmo_hdr)
        client.post(
            f"/api/v1/tenants/IN-DL/sessions/{sess_id}/disposition",
            json={"outcome": "Verification failed", "disposition_notes": "Rejected for gross measurement error"},
            headers=lmo_hdr,
        )

        # Attempt to issue certificate on failed session
        cert_res = client.post(
            f"/api/v1/tenants/IN-DL/certificates/issue",
            json={"session_id": sess_id},
            headers=lmo_hdr,
        )
        assert cert_res.status_code == 422
        assert cert_res.json()["error_code"] == "GUARD_CONDITION_FAILED"

    def test_reverification_supersession_flow(
        self, client: TestClient, multi_tenant_setup: dict, auth_headers
    ):
        """Issuing a new verification certificate automatically supersedes prior active certificate."""
        lmo_hdr = auth_headers(
            user_id=multi_tenant_setup["lmo_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        owner_hdr = auth_headers(
            user_id=multi_tenant_setup["owner_user_id"],
            tenant_id="IN-DL",
            role=RoleEnum.OWNER,
        )

        # 1. First verification and cert issue
        flow1 = create_passing_session_flow(client, multi_tenant_setup, auth_headers)
        inst_id = flow1["instrument_id"]

        cert1_res = client.post(
            f"/api/v1/tenants/IN-DL/certificates/issue",
            json={"session_id": flow1["session_id"]},
            headers=lmo_hdr,
        )
        cert1_id = cert1_res.json()["certificate_id"]
        cert1_token = cert1_res.json()["public_verification_token"]

        # 2. Re-verification application for the same instrument
        app2_res = client.post(
            f"/api/v1/tenants/IN-DL/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": multi_tenant_setup["stakeholder_id"],
                "application_type": "RE_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app2_id = app2_res.json()["application_id"]
        client.post(f"/api/v1/tenants/IN-DL/applications/{app2_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/applications/{app2_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/IN-DL/applications/{app2_id}/pay", json={"receipt_number": "REC-REVERIF-01"}, headers=owner_hdr)

        sess2_res = client.post(
            f"/api/v1/tenants/IN-DL/sessions",
            json={"application_id": app2_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess2_id = sess2_res.json()["session_id"]

        obs_payload = {
            "reference_standard_ids": multi_tenant_setup["standard_ids"],
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
                    "nominal_load": "15.000000",
                    "load_unit": "kg",
                    "raw_indication_reading": "15.000000",
                    "reading_unit": "kg",
                },
            ],
        }
        client.post(f"/api/v1/tenants/IN-DL/sessions/{sess2_id}/observations", json=obs_payload, headers=lmo_hdr)
        client.post(
            f"/api/v1/tenants/IN-DL/sessions/{sess2_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )

        # 3. Issue Second Certificate
        cert2_res = client.post(
            f"/api/v1/tenants/IN-DL/certificates/issue",
            json={"session_id": sess2_id},
            headers=lmo_hdr,
        )
        assert cert2_res.status_code == 201
        cert2_id = cert2_res.json()["certificate_id"]
        cert2_token = cert2_res.json()["public_verification_token"]

        # 4. Verify First Certificate is now SUPERSEDED
        cert1_check = client.get(f"/api/v1/tenants/IN-DL/certificates/{cert1_id}", headers=lmo_hdr)
        assert cert1_check.status_code == 200
        assert cert1_check.json()["certificate_status"] == "SUPERSEDED"
        assert cert1_check.json()["superseding_certificate_id"] == cert2_id

        # 5. Verify Public Projection reports SUPERSEDED and links new QR token
        pub_check = client.get(f"/api/v1/public/certificates/verify/{cert1_token}")
        assert pub_check.status_code == 200
        assert pub_check.json()["status"] == "SUPERSEDED"
        assert pub_check.json()["superseded_by"] == cert2_token
