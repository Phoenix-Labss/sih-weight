"""Unit and Integration test suite for Statutory Expiry Reminders and Re-verification Engine.
"""

from datetime import date, datetime, timedelta
from typing import Dict, List
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from packages.verification_reminders import (
    ExpiryReminderEngine,
    ReminderChannelEnum,
    ReminderNotificationData,
    ReminderPriorityEnum,
    ReminderScanResult,
    ReminderStageEnum,
    StatutoryValidityCalculator,
    build_reminder_message,
    determine_reminder_stage,
    generate_idempotency_key,
)
from app.models.certificate import Certificate, CertificateStatusEnum, CertificateStatusEvent
from app.models.instrument import Instrument, InstrumentStatusEnum
from app.models.reminder import ReminderRecord, ReminderTypeEnum
from app.models.session import SessionStatusEnum, VerificationOutcomeEnum, VerificationSession
from app.models.stakeholder import RoleEnum
from app.services.reminder_service import ReminderService


class TestStatutoryValidityCalculatorUnit:
    """Unit tests for Statutory Validity Calculator."""

    def test_validity_nawi_commercial_classes(self):
        # Class III and IIII commercial scales -> 12 months (1 Year)
        m3 = StatutoryValidityCalculator.get_validity_months("NAWI", "CLASS_III")
        m4 = StatutoryValidityCalculator.get_validity_months("NAWI", "CLASS_IIII")
        assert m3 == 12
        assert m4 == 12

    def test_validity_nawi_precision_classes(self):
        # Class I and II analytical balances -> 12 months (1 Year)
        m1 = StatutoryValidityCalculator.get_validity_months("NAWI", "CLASS_I")
        m2 = StatutoryValidityCalculator.get_validity_months("NAWI", "CLASS_II")
        assert m1 == 12
        assert m2 == 12

    def test_validity_biennial_storage_tanks(self):
        # Liquid storage tanks -> 24 months (2 Years)
        m_tank = StatutoryValidityCalculator.get_validity_months("LIQUID_MEASURE", "STORAGE_TANK")
        assert m_tank == 24

    def test_validity_custom_override(self):
        m_custom = StatutoryValidityCalculator.get_validity_months("NAWI", "CLASS_III", custom_validity_months=36)
        assert m_custom == 36

    def test_calculate_validity_dates_exact_calendar(self):
        issue = date(2026, 8, 23)
        i_date, v_date, months = StatutoryValidityCalculator.calculate_validity_dates(issue, "NAWI", "CLASS_III")
        assert i_date == date(2026, 8, 23)
        assert v_date == date(2027, 8, 23)
        assert months == 12


class TestMilestoneTrackingAndEngineUnit:
    """Unit tests for reminder milestone evaluation and idempotency engine."""

    def test_determine_reminder_stage_boundaries(self):
        as_of = date(2026, 8, 23)

        # > 60 days -> None
        assert determine_reminder_stage(as_of + timedelta(days=65), as_of) is None
        assert determine_reminder_stage(as_of + timedelta(days=61), as_of) is None

        # 31 to 60 days -> DAYS_60
        assert determine_reminder_stage(as_of + timedelta(days=60), as_of) == ReminderStageEnum.DAYS_60
        assert determine_reminder_stage(as_of + timedelta(days=45), as_of) == ReminderStageEnum.DAYS_60
        assert determine_reminder_stage(as_of + timedelta(days=31), as_of) == ReminderStageEnum.DAYS_60

        # 16 to 30 days -> DAYS_30
        assert determine_reminder_stage(as_of + timedelta(days=30), as_of) == ReminderStageEnum.DAYS_30
        assert determine_reminder_stage(as_of + timedelta(days=20), as_of) == ReminderStageEnum.DAYS_30
        assert determine_reminder_stage(as_of + timedelta(days=16), as_of) == ReminderStageEnum.DAYS_30

        # 1 to 15 days -> DAYS_15
        assert determine_reminder_stage(as_of + timedelta(days=15), as_of) == ReminderStageEnum.DAYS_15
        assert determine_reminder_stage(as_of + timedelta(days=7), as_of) == ReminderStageEnum.DAYS_15
        assert determine_reminder_stage(as_of + timedelta(days=1), as_of) == ReminderStageEnum.DAYS_15

        # <= 0 days -> OVERDUE
        assert determine_reminder_stage(as_of, as_of) == ReminderStageEnum.OVERDUE
        assert determine_reminder_stage(as_of - timedelta(days=1), as_of) == ReminderStageEnum.OVERDUE
        assert determine_reminder_stage(as_of - timedelta(days=30), as_of) == ReminderStageEnum.OVERDUE

    def test_idempotency_key_generation(self):
        key = generate_idempotency_key("cert_12345", ReminderStageEnum.DAYS_30)
        assert key == "cert_12345:DAYS_30"

    def test_reminder_message_statutory_content(self):
        msg60 = build_reminder_message("CERT-01", "SN-991", date(2027, 8, 23), ReminderStageEnum.DAYS_60, 45)
        assert "Statutory Advisory" in msg60["title"]
        assert msg60["priority"] == ReminderPriorityEnum.LOW

        msg30 = build_reminder_message("CERT-01", "SN-991", date(2027, 8, 23), ReminderStageEnum.DAYS_30, 20)
        assert "Section 24" in msg30["message"]
        assert msg30["priority"] == ReminderPriorityEnum.MEDIUM

        msg15 = build_reminder_message("CERT-01", "SN-991", date(2027, 8, 23), ReminderStageEnum.DAYS_15, 10)
        assert "CRITICAL REMINDER" in msg15["message"]
        assert msg15["priority"] == ReminderPriorityEnum.HIGH

        msg_od = build_reminder_message("CERT-01", "SN-991", date(2027, 8, 23), ReminderStageEnum.OVERDUE, -5)
        assert "Section 30" in msg_od["message"]
        assert msg_od["priority"] == ReminderPriorityEnum.CRITICAL

    def test_reminder_engine_deduplication(self):
        engine = ExpiryReminderEngine()
        as_of = date(2026, 8, 23)

        notif1 = engine.evaluate_certificate(
            certificate_id="cert_101",
            certificate_number="CERT-101",
            instrument_id="inst_101",
            instrument_serial="SN-101",
            owner_id="owner_1",
            tenant_id="IN-DL",
            valid_until=as_of + timedelta(days=25),
            as_of_date=as_of,
            existing_keys=set(),
        )
        assert notif1 is not None
        assert notif1.stage == ReminderStageEnum.DAYS_30

        # Evaluating with the idempotency key in existing_keys must return None
        notif2 = engine.evaluate_certificate(
            certificate_id="cert_101",
            certificate_number="CERT-101",
            instrument_id="inst_101",
            instrument_serial="SN-101",
            owner_id="owner_1",
            tenant_id="IN-DL",
            valid_until=as_of + timedelta(days=25),
            as_of_date=as_of,
            existing_keys={notif1.idempotency_key},
        )
        assert notif2 is None


@pytest.fixture
def reminders_test_db(db_session: Session, seed_data: dict, auth_headers) -> Dict:
    """Fixture with multiple certificates across reminder milestone windows."""
    tenant_id = seed_data["tenant_id"]
    model_id = seed_data["model_id"]
    owner_id = seed_data["stakeholder_id"]
    lmo_user_id = seed_data["lmo_user_id"]
    jurisdiction_id = seed_data["jurisdiction_id"]
    facility_id = seed_data["facility_id"]
    today = date(2026, 8, 23)

    # Helper to create an instrument, session, and certificate
    def _create_cert(suffix: str, valid_until_date: date, status: CertificateStatusEnum = CertificateStatusEnum.ISSUED):
        inst = Instrument(
            instrument_id=f"INST-REM-{suffix}",
            tenant_id=tenant_id,
            jurisdiction_id=jurisdiction_id,
            facility_id=facility_id,
            model_id=model_id,
            owner_id=owner_id,
            serial_number=f"SN-REM-{suffix}",
            year_of_manufacture=2025,
            current_status=InstrumentStatusEnum.ACTIVE_VERIFIED,
        )
        db_session.add(inst)
        db_session.flush()

        sess = VerificationSession(
            session_id=f"SESS-REM-{suffix}",
            tenant_id=tenant_id,
            application_id=f"APP-REM-{suffix}",
            instrument_id=inst.instrument_id,
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            procedure_pack_checksum="checksum-v1",
            verifier_id=lmo_user_id,
            verifier_role="LMO",
            scheduled_date=today,
            status=SessionStatusEnum.FINALIZED,
            automated_evaluation_flag=True,
            outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
        )
        db_session.add(sess)
        db_session.flush()

        cert = Certificate(
            certificate_id=f"CERT-REM-{suffix}",
            certificate_number=f"IN-DL/LM/2026/CERT-REM-{suffix}",
            public_verification_token=f"tok_rem_{suffix}_abc123",
            tenant_id=tenant_id,
            session_id=sess.session_id,
            instrument_id=inst.instrument_id,
            owner_id=owner_id,
            procedure_pack_id=sess.procedure_pack_id,
            verifier_id=lmo_user_id,
            signer_id=lmo_user_id,
            issue_date=today - timedelta(days=300),
            valid_until=valid_until_date,
            certificate_status=status,
            certificate_bytes_sha256="7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
            qr_code_payload=f"http://localhost:5173/verify/tok_rem_{suffix}_abc123",
            signature_timestamp=datetime(2026, 8, 23, 12, 0, 0),
        )
        db_session.add(cert)
        db_session.flush()
        return cert, inst

    # 1. Cert due in 50 days (DAYS_60)
    c60, i60 = _create_cert("60D", today + timedelta(days=50))
    # 2. Cert due in 25 days (DAYS_30)
    c30, i30 = _create_cert("30D", today + timedelta(days=25))
    # 3. Cert due in 10 days (DAYS_15)
    c15, i15 = _create_cert("15D", today + timedelta(days=10))
    # 4. Cert overdue by 5 days (OVERDUE)
    c_od, i_od = _create_cert("OD", today - timedelta(days=5))
    # 5. Cert far in future (180 days - no reminder due)
    c_fut, i_fut = _create_cert("FUT", today + timedelta(days=180))

    db_session.commit()

    return {
        "tenant_id": tenant_id,
        "today": today,
        "certs": {"60D": c60, "30D": c30, "15D": c15, "OD": c_od, "FUT": c_fut},
        "instruments": {"60D": i60, "30D": i30, "15D": i15, "OD": i_od, "FUT": i_fut},
        "headers_lmo": auth_headers(user_id=lmo_user_id, tenant_id=tenant_id, role=RoleEnum.LMO),
        "headers_owner": auth_headers(user_id=seed_data["owner_user_id"], tenant_id=tenant_id, role=RoleEnum.OWNER),
    }


class TestReminderServiceAndLifecycleIntegration:
    """Integration test suite for Reminder Service, DB persistence, and API endpoints."""

    def test_service_trigger_expiry_scan(self, db_session: Session, reminders_test_db: Dict):
        tenant_id = reminders_test_db["tenant_id"]
        today = reminders_test_db["today"]

        scan_res = ReminderService.trigger_expiry_scan(
            db=db_session,
            tenant_id=tenant_id,
            as_of_date=today,
            auto_expire=True,
        )

        assert scan_res.scanned_certificates_count >= 5
        assert scan_res.reminders_generated_count == 4  # 60D, 30D, 15D, OD
        assert scan_res.certificates_expired_count == 1
        assert "CERT-REM-OD" in scan_res.expired_certificate_ids

        # Check DB for reminder records
        records, total = ReminderService.list_reminders(db=db_session, tenant_id=tenant_id)
        assert total == 4

        # Check that expired cert and instrument transitioned status
        od_cert = db_session.get(Certificate, "CERT-REM-OD")
        assert od_cert.certificate_status == CertificateStatusEnum.EXPIRED

        od_inst = db_session.get(Instrument, "INST-REM-OD")
        assert od_inst.current_status == InstrumentStatusEnum.VERIFICATION_EXPIRED

        # Check audit trail
        events = db_session.query(CertificateStatusEvent).filter_by(certificate_id="CERT-REM-OD").all()
        assert len(events) >= 1
        assert events[0].new_status == CertificateStatusEnum.EXPIRED

    def test_service_scan_idempotency_second_run(self, db_session: Session, reminders_test_db: Dict):
        tenant_id = reminders_test_db["tenant_id"]
        today = reminders_test_db["today"]

        # First scan
        scan_1 = ReminderService.trigger_expiry_scan(
            db=db_session,
            tenant_id=tenant_id,
            as_of_date=today,
            auto_expire=True,
        )
        assert scan_1.reminders_generated_count == 4

        # Second scan on same date -> 0 new reminders, skipped duplicate = 3 (for 60D, 30D, 15D; OD already EXPIRED)
        scan_2 = ReminderService.trigger_expiry_scan(
            db=db_session,
            tenant_id=tenant_id,
            as_of_date=today,
            auto_expire=True,
        )
        assert scan_2.reminders_generated_count == 0
        assert scan_2.reminders_skipped_duplicate_count == 3


    def test_api_reminders_scan_and_list_endpoints(self, client: TestClient, reminders_test_db: Dict):
        headers_lmo = reminders_test_db["headers_lmo"]
        tenant_id = reminders_test_db["tenant_id"]
        today_str = reminders_test_db["today"].isoformat()

        # 1. POST /api/v1/reminders/scan (Global)
        resp_scan = client.post(
            "/api/v1/reminders/scan",
            json={"tenant_id": tenant_id, "as_of_date": today_str, "auto_expire": True},
            headers=headers_lmo,
        )
        assert resp_scan.status_code == 200
        scan_json = resp_scan.json()
        assert scan_json["reminders_generated_count"] == 4
        assert len(scan_json["reminders"]) == 4

        # 2. GET /api/v1/reminders (Global List)
        resp_list = client.get(
            "/api/v1/reminders",
            headers=headers_lmo,
        )
        assert resp_list.status_code == 200
        list_json = resp_list.json()
        assert list_json["total"] >= 4
        assert len(list_json["items"]) >= 4

        # 3. GET /api/v1/reminders?overdue_only=true
        resp_od = client.get(
            "/api/v1/reminders?overdue_only=true",
            headers=headers_lmo,
        )
        assert resp_od.status_code == 200
        od_json = resp_od.json()
        assert od_json["total"] == 1
        assert od_json["items"][0]["reminder_type"] == "OVERDUE"

        # 4. POST /api/v1/tenants/{tenant_id}/reminders/scan (Tenant-scoped)
        resp_tenant_scan = client.post(
            f"/api/v1/tenants/{tenant_id}/reminders/scan",
            json={"as_of_date": today_str, "auto_expire": True},
            headers=headers_lmo,
        )
        assert resp_tenant_scan.status_code == 200
        # Second run should skip duplicates
        assert resp_tenant_scan.json()["reminders_generated_count"] == 0

        # 5. GET /api/v1/tenants/{tenant_id}/reminders (Tenant-scoped List)
        resp_tenant_list = client.get(
            f"/api/v1/tenants/{tenant_id}/reminders",
            headers=headers_lmo,
        )
        assert resp_tenant_list.status_code == 200
        assert resp_tenant_list.json()["total"] >= 4

    def test_api_reminders_scan_unauthorized_role(self, client: TestClient, reminders_test_db: Dict):
        headers_owner = reminders_test_db["headers_owner"]
        resp = client.post(
            "/api/v1/reminders/scan",
            json={"as_of_date": "2026-08-23", "auto_expire": True},
            headers=headers_owner,
        )
        assert resp.status_code == 403
