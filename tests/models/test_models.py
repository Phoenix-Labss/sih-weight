"""Comprehensive unit and relational integrity tests for all domain models."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.models.base import Base, generate_opaque_token, generate_uuid, get_utc_now
from app.models.tenant import Tenant, Jurisdiction, TenantStateEnum, JurisdictionLevelEnum
from app.models.stakeholder import (
    Stakeholder,
    Facility,
    User,
    LMOProfile,
    GATCProfile,
    Delegation,
    RoleEnum,
    StakeholderTypeEnum,
)
from app.models.instrument import (
    InstrumentModel,
    Instrument,
    InstrumentComponent,
    AccuracyClassEnum,
    InstrumentStatusEnum,
    LegacyTrustStatusEnum,
)
from app.models.reference_standard import (
    ReferenceStandard,
    CalibrationRecord,
    ReferenceStandardStatusEnum,
    CustodianTypeEnum,
)
from app.models.application import (
    VerificationApplication,
    FeeAssessment,
    ApplicationStatusEnum,
    ApplicationTypeEnum,
    ServiceModeEnum,
    PaymentStatusEnum,
)
from app.models.session import (
    VerificationSession,
    SessionReferenceStandard,
    SessionStatusEnum,
    VerificationOutcomeEnum,
)
from app.models.observation import (
    TestObservation,
    ObservationCorrection,
    StepTypeEnum,
)
from app.models.stamp import (
    PhysicalStampAction,
    PhysicalSealActionEnum,
    SealTypeEnum,
)
from app.models.certificate import (
    Certificate,
    CertificateStatusEvent,
    CertificateStatusEnum,
)
from app.models.audit import AuditLog


@pytest.fixture
def db_session():
    """Create fresh in-memory SQLite database session for testing."""
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


class TestDomainModelsRelationalIntegrity:
    """Test suite verifying CRUD operations, relational links, and constraints."""

    def test_tenant_and_jurisdiction_hierarchy(self, db_session):
        """Test tenant creation with child jurisdiction tree."""
        tenant = Tenant(
            tenant_id="IN-DL",
            state_code="DL",
            state_name="Delhi",
            status=TenantStateEnum.ACTIVE,
            config={"portal_enabled": True, "currency": "INR"},
        )
        db_session.add(tenant)
        db_session.commit()

        # Add zone and district jurisdictions
        zone = Jurisdiction(
            tenant_id="IN-DL",
            name="South Zone Delhi",
            code="DL-SZ",
            level=JurisdictionLevelEnum.ZONE,
        )
        db_session.add(zone)
        db_session.commit()

        district = Jurisdiction(
            tenant_id="IN-DL",
            parent_jurisdiction_id=zone.jurisdiction_id,
            name="South West District",
            code="DL-SWD",
            level=JurisdictionLevelEnum.DISTRICT,
        )
        db_session.add(district)
        db_session.commit()

        # Query back and verify relations
        saved_tenant = db_session.execute(select(Tenant).where(Tenant.tenant_id == "IN-DL")).scalar_one()
        assert saved_tenant.state_name == "Delhi"
        assert len(saved_tenant.jurisdictions) == 2
        assert district.parent_jurisdiction.code == "DL-SZ"

    def test_stakeholder_and_facility(self, db_session):
        """Test stakeholder registration and facility mapping."""
        tenant = Tenant(tenant_id="IN-MH", state_code="MH", state_name="Maharashtra")
        jurisdiction = Jurisdiction(tenant_id="IN-MH", name="Mumbai Central", code="MH-MUM-C", level=JurisdictionLevelEnum.DISTRICT)
        db_session.add_all([tenant, jurisdiction])
        db_session.commit()

        stakeholder = Stakeholder(
            tenant_id="IN-MH",
            jurisdiction_id=jurisdiction.jurisdiction_id,
            legal_name="Apex Retail Supermarkets Pvt Ltd",
            trade_name="Apex Fresh",
            stakeholder_type=StakeholderTypeEnum.OWNER_USER,
            identifier_type="GSTIN",
            identifier_value="27AAACA1234A1Z5",
            email="compliance@apexretail.in",
            phone="+919876543210",
            address_line1="Plot 42, Bandra Kurla Complex",
            city="Mumbai",
            pincode="400051",
        )
        db_session.add(stakeholder)
        db_session.commit()

        facility = Facility(
            tenant_id="IN-MH",
            stakeholder_id=stakeholder.stakeholder_id,
            facility_name="Bandra Hypermarket Store #1",
            address_line="Ground Floor, Apex Mall, BKC",
            district="Mumbai Suburban",
            pincode="400051",
            gps_latitude=Decimal("19.0657000"),
            gps_longitude=Decimal("72.8682000"),
        )
        db_session.add(facility)
        db_session.commit()

        assert stakeholder.facilities[0].facility_name == "Bandra Hypermarket Store #1"
        assert stakeholder.facilities[0].gps_latitude == Decimal("19.0657000")

    def test_user_and_lmo_profile(self, db_session):
        """Test user creation and Legal Metrology Officer posting profile."""
        tenant = Tenant(tenant_id="IN-KA", state_code="KA", state_name="Karnataka")
        jurisdiction = Jurisdiction(tenant_id="IN-KA", name="Bengaluru North", code="KA-BLR-N", level=JurisdictionLevelEnum.DISTRICT)
        db_session.add_all([tenant, jurisdiction])
        db_session.commit()

        user = User(
            tenant_id="IN-KA",
            email="lmo.kumar@karnataka.gov.in",
            full_name="Rajesh Kumar, Senior Inspector",
            role=RoleEnum.LMO,
        )
        db_session.add(user)
        db_session.commit()

        lmo_profile = LMOProfile(
            user_id=user.user_id,
            tenant_id="IN-KA",
            jurisdiction_id=jurisdiction.jurisdiction_id,
            designation="Senior Legal Metrology Officer",
            posting_order_number="LM/KA/GO-2025/998",
            authorized_from=datetime.now(timezone.utc) - timedelta(days=365),
            digital_signature_cert_id="DSC-KA-88231",
        )
        db_session.add(lmo_profile)
        db_session.commit()

        assert user.lmo_profile.designation == "Senior Legal Metrology Officer"
        assert user.lmo_profile.jurisdiction.code == "KA-BLR-N"

    def test_instrument_model_and_instrument_registry(self, db_session):
        """Test instrument model pattern and physical instrument unit."""
        tenant = Tenant(tenant_id="IN-TN", state_code="TN", state_name="Tamil Nadu")
        jurisdiction = Jurisdiction(tenant_id="IN-TN", name="Chennai South", code="TN-CHN-S", level=JurisdictionLevelEnum.DISTRICT)
        stakeholder = Stakeholder(
            tenant_id="IN-TN",
            jurisdiction_id=jurisdiction.jurisdiction_id,
            legal_name="Chennai Agro Traders",
            stakeholder_type=StakeholderTypeEnum.OWNER_USER,
            email="agro@chennai.in",
            phone="+919444012345",
            address_line1="10 Market Road",
            city="Chennai",
            pincode="600001",
        )
        facility = Facility(
            tenant_id="IN-TN",
            stakeholder_id=stakeholder.stakeholder_id,
            facility_name="Main Warehouse",
            address_line="10 Market Road",
            district="Chennai",
            pincode="600001",
        )
        db_session.add_all([tenant, jurisdiction, stakeholder, facility])
        db_session.commit()

        # Register Instrument Model
        model = InstrumentModel(
            category="NAWI",
            subtype="ELECTRONIC_BENCH_SCALE",
            manufacturer_name="Eagle Weighing Instruments Ltd",
            model_name="EAGLE-PRO-30K",
            model_approval_number="IND/09/2024/451",
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_scale_interval_e=Decimal("5.000000"),
            scale_interval_unit="g",
            min_capacity=Decimal("100.000000"),
            max_capacity=Decimal("30000.000000"),
            capacity_unit="g",
            number_of_intervals_n=6000,
            specifications={"dual_range": False, "pan_dimensions": "300x300mm"},
        )
        db_session.add(model)
        db_session.commit()

        # Register Physical Instrument
        inst = Instrument(
            tenant_id="IN-TN",
            jurisdiction_id=jurisdiction.jurisdiction_id,
            model_id=model.model_id,
            owner_id=stakeholder.stakeholder_id,
            facility_id=facility.facility_id,
            serial_number="EAGLE-2026-9901",
            year_of_manufacture=2026,
            intended_use="Retail Grocery Trade",
            current_status=InstrumentStatusEnum.DRAFT,
            verification_due_date=date(2027, 8, 23),
        )
        db_session.add(inst)
        db_session.commit()

        # Add Component
        load_cell = InstrumentComponent(
            instrument_id=inst.instrument_id,
            component_type="LOAD_CELL",
            serial_number="LC-ZEMIC-4410",
            model_name="ZEMIC-L6E3-35kg",
        )
        db_session.add(load_cell)
        db_session.commit()

        assert inst.public_instrument_token.startswith("inst_")
        assert len(inst.components) == 1
        assert inst.components[0].serial_number == "LC-ZEMIC-4410"
        assert inst.model.model_approval_number == "IND/09/2024/451"

    def test_reference_standard_and_validity_check(self, db_session):
        """Test working standard calibration validity check method."""
        tenant = Tenant(tenant_id="IN-GJ", state_code="GJ", state_name="Gujarat")
        db_session.add(tenant)
        db_session.commit()

        now = get_utc_now()
        standard = ReferenceStandard(
            tenant_id="IN-GJ",
            custodian_type=CustodianTypeEnum.LMO_OFFICE,
            custodian_id="GJ-AHM-01",
            asset_tag="GJ-LMO-MASS-05KG-01",
            denomination_mass=Decimal("5.000000"),
            mass_unit="kg",
            accuracy_class="M1",
            serial_number="RR-5KG-771",
            calibration_certificate_number="NABL/CAL/2026/0991",
            calibrating_laboratory="Regional Reference Standard Laboratory, Ahmedabad",
            calibrated_at=now - timedelta(days=30),
            valid_until=now + timedelta(days=335),
            expanded_uncertainty=Decimal("0.00002500"),
            calibration_status=ReferenceStandardStatusEnum.ACTIVE,
        )
        db_session.add(standard)
        db_session.commit()

        assert standard.is_valid_at(now) is True
        assert standard.is_valid_at(now - timedelta(days=60)) is False
        assert standard.is_valid_at(now + timedelta(days=400)) is False

        # Quarantined standard must fail validity
        standard.calibration_status = ReferenceStandardStatusEnum.QUARANTINED
        assert standard.is_valid_at(now) is False

    def test_fee_assessment_and_payment_reconciliation(self, db_session):
        """Test statutory fee assessment calculations and payment status updates."""
        tenant = Tenant(tenant_id="IN-UP", state_code="UP", state_name="Uttar Pradesh")
        db_session.add(tenant)
        db_session.commit()

        fee = FeeAssessment(
            tenant_id="IN-UP",
            policy_version="UP-LM-FEES-2025.1",
            base_verification_fee=Decimal("500.00"),
            user_charge=Decimal("50.00"),
            late_fee=Decimal("100.00"),
            total_assessed_amount=Decimal("650.00"),
            currency="INR",
            payment_status=PaymentStatusEnum.PENDING,
        )
        db_session.add(fee)
        db_session.commit()

        assert fee.total_assessed_amount == Decimal("650.00")
        assert fee.payment_status == PaymentStatusEnum.PENDING

        fee.payment_status = PaymentStatusEnum.SUCCESS
        fee.paid_at = get_utc_now()
        fee.receipt_number = "UP-TREASURY-2026-009941"
        db_session.commit()

        saved_fee = db_session.execute(select(FeeAssessment).where(FeeAssessment.fee_assessment_id == fee.fee_assessment_id)).scalar_one()
        assert saved_fee.payment_status == PaymentStatusEnum.SUCCESS
        assert saved_fee.receipt_number == "UP-TREASURY-2026-009941"

    def test_observations_and_correction_audit(self, db_session):
        """Test test observation recording and append-only correction audit."""
        tenant = Tenant(tenant_id="IN-TS", state_code="TS", state_name="Telangana")
        jurisdiction = Jurisdiction(tenant_id="IN-TS", name="Hyderabad Central", code="TS-HYD-C", level=JurisdictionLevelEnum.DISTRICT)
        stakeholder = Stakeholder(tenant_id="IN-TS", jurisdiction_id=jurisdiction.jurisdiction_id, legal_name="Deccan Jewellers", stakeholder_type=StakeholderTypeEnum.OWNER_USER, email="gold@deccan.in", phone="+919888877777", address_line1="Abids", city="Hyderabad", pincode="500001")
        facility = Facility(tenant_id="IN-TS", stakeholder_id=stakeholder.stakeholder_id, facility_name="Main Showroom", address_line="Abids", district="Hyderabad", pincode="500001")
        model = InstrumentModel(category="NAWI", subtype="PRECISION_BALANCE", manufacturer_name="Sartorius", model_name="BSA224S", model_approval_number="IND/08/2023/112", accuracy_class=AccuracyClassEnum.CLASS_I, verification_scale_interval_e=Decimal("0.001000"), scale_interval_unit="g", min_capacity=Decimal("0.010000"), max_capacity=Decimal("220.000000"), capacity_unit="g", number_of_intervals_n=220000)
        inst = Instrument(tenant_id="IN-TS", jurisdiction_id=jurisdiction.jurisdiction_id, model_id=model.model_id, owner_id=stakeholder.stakeholder_id, facility_id=facility.facility_id, serial_number="SART-9901", year_of_manufacture=2024)
        user = User(tenant_id="IN-TS", email="verifier@telangana.gov.in", full_name="LMO Reddy", role=RoleEnum.LMO)
        supervisor = User(tenant_id="IN-TS", email="supervisor@telangana.gov.in", full_name="Assistant Controller Rao", role=RoleEnum.SUPERVISOR)
        app = VerificationApplication(application_number="TS/2026/APP-01", tenant_id="IN-TS", jurisdiction_id=jurisdiction.jurisdiction_id, instrument_id=inst.instrument_id, applicant_id=stakeholder.stakeholder_id, application_type=ApplicationTypeEnum.RE_VERIFICATION, service_mode=ServiceModeEnum.ON_SITE, applicant_declaration_accepted=True)
        session = VerificationSession(tenant_id="IN-TS", application_id=app.application_id, instrument_id=inst.instrument_id, procedure_pack_id="IN-NAWI-CLASS-I-2026.1", procedure_pack_checksum="a"*64, verifier_id=user.user_id, verifier_role="LMO", scheduled_date=date.today())
        db_session.add_all([tenant, jurisdiction, stakeholder, facility, model, inst, user, supervisor, app, session])
        db_session.commit()

        # Record Observation 1
        obs1 = TestObservation(
            session_id=session.session_id,
            step_type=StepTypeEnum.INCREASING_LOAD,
            step_sequence=1,
            nominal_load=Decimal("50.000000"),
            load_unit="g",
            raw_indication_reading=Decimal("50.000400"),
            normalized_indication=Decimal("50.000400"),
            reading_unit="g",
            observed_error=Decimal("0.000400"),
            mpe_allowed=Decimal("0.001000"),
            is_within_mpe=True,
            calculation_trace={"P": "50.000400", "E": "0.000400", "MPE": "0.001000"},
        )
        db_session.add(obs1)
        db_session.commit()

        # Record Correction for Observation 1 (e.g. transposition fix)
        obs1_corrected = TestObservation(
            session_id=session.session_id,
            step_type=StepTypeEnum.INCREASING_LOAD,
            step_sequence=1,
            nominal_load=Decimal("50.000000"),
            load_unit="g",
            raw_indication_reading=Decimal("50.000200"),
            normalized_indication=Decimal("50.000200"),
            reading_unit="g",
            observed_error=Decimal("0.000200"),
            mpe_allowed=Decimal("0.001000"),
            is_within_mpe=True,
            repetition_index=2,
            calculation_trace={"P": "50.000200", "E": "0.000200", "MPE": "0.001000"},
        )
        db_session.add(obs1_corrected)
        db_session.commit()

        correction = ObservationCorrection(
            session_id=session.session_id,
            original_observation_id=obs1.observation_id,
            new_observation_id=obs1_corrected.observation_id,
            actor_id=user.user_id,
            correction_reason="Transposition error in initial reading entry, verified against standard test sheet.",
            authorized_by_supervisor_id=supervisor.user_id,
        )
        db_session.add(correction)
        db_session.commit()

        saved_correction = db_session.execute(select(ObservationCorrection).where(ObservationCorrection.correction_id == correction.correction_id)).scalar_one()
        assert saved_correction.original_observation.raw_indication_reading == Decimal("50.000400")
        assert saved_correction.new_observation.raw_indication_reading == Decimal("50.000200")
        assert saved_correction.supervisor.full_name == "Assistant Controller Rao"

    def test_physical_stamp_action_decoupled(self, db_session):
        """Test physical stamp/seal recording independent of certificate lifecycle."""
        tenant = Tenant(tenant_id="IN-PB", state_code="PB", state_name="Punjab")
        jurisdiction = Jurisdiction(tenant_id="IN-PB", name="Ludhiana Industrial", code="PB-LDH-IND", level=JurisdictionLevelEnum.DISTRICT)
        stakeholder = Stakeholder(tenant_id="IN-PB", jurisdiction_id=jurisdiction.jurisdiction_id, legal_name="Punjab Mills", stakeholder_type=StakeholderTypeEnum.OWNER_USER, email="mills@pb.in", phone="+919811122233", address_line1="GT Road", city="Ludhiana", pincode="141001")
        facility = Facility(tenant_id="IN-PB", stakeholder_id=stakeholder.stakeholder_id, facility_name="Plant 1", address_line="GT Road", district="Ludhiana", pincode="141001")
        model = InstrumentModel(category="NAWI", subtype="WEIGHBRIDGE", manufacturer_name="Essae", model_name="WB-60T", model_approval_number="IND/01/2021/01", accuracy_class=AccuracyClassEnum.CLASS_III, verification_scale_interval_e=Decimal("20.000000"), scale_interval_unit="kg", min_capacity=Decimal("400.000000"), max_capacity=Decimal("60000.000000"), capacity_unit="kg", number_of_intervals_n=3000)
        inst = Instrument(tenant_id="IN-PB", jurisdiction_id=jurisdiction.jurisdiction_id, model_id=model.model_id, owner_id=stakeholder.stakeholder_id, facility_id=facility.facility_id, serial_number="ESSAE-WB-099", year_of_manufacture=2021)
        user = User(tenant_id="IN-PB", email="lmo.pb@punjab.gov.in", full_name="LMO Singh", role=RoleEnum.LMO)
        app = VerificationApplication(application_number="PB/2026/APP-99", tenant_id="IN-PB", jurisdiction_id=jurisdiction.jurisdiction_id, instrument_id=inst.instrument_id, applicant_id=stakeholder.stakeholder_id, application_type=ApplicationTypeEnum.RE_VERIFICATION, service_mode=ServiceModeEnum.ON_SITE, applicant_declaration_accepted=True)
        session = VerificationSession(tenant_id="IN-PB", application_id=app.application_id, instrument_id=inst.instrument_id, procedure_pack_id="IN-NAWI-CLASS-III-2026.1", procedure_pack_checksum="b"*64, verifier_id=user.user_id, verifier_role="LMO", scheduled_date=date.today())
        db_session.add_all([tenant, jurisdiction, stakeholder, facility, model, inst, user, app, session])
        db_session.commit()

        stamp_action = PhysicalStampAction(
            tenant_id="IN-PB",
            session_id=session.session_id,
            instrument_id=inst.instrument_id,
            verifier_id=user.user_id,
            action_type=PhysicalSealActionEnum.SEAL_APPLIED,
            seal_type=SealTypeEnum.LEAD_WIRE_SEAL,
            seal_identification_number="PB-SEAL-2026-0088912",
            seal_position="JUNCTION_BOX_PORT_A",
            photo_evidence_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            notes="Lead wire seal intact and stamped with departmental punch 'PB-LDH-26'.",
        )
        db_session.add(stamp_action)
        db_session.commit()

        saved_action = db_session.execute(select(PhysicalStampAction).where(PhysicalStampAction.stamp_action_id == stamp_action.stamp_action_id)).scalar_one()
        assert saved_action.seal_identification_number == "PB-SEAL-2026-0088912"
        assert saved_action.action_type == PhysicalSealActionEnum.SEAL_APPLIED
        assert saved_action.instrument.serial_number == "ESSAE-WB-099"

    def test_certificate_and_status_event_ledger(self, db_session):
        """Test digital certificate creation and status events append-only audit."""
        tenant = Tenant(tenant_id="IN-KL", state_code="KL", state_name="Kerala")
        jurisdiction = Jurisdiction(tenant_id="IN-KL", name="Kochi Central", code="KL-KOC-C", level=JurisdictionLevelEnum.DISTRICT)
        stakeholder = Stakeholder(tenant_id="IN-KL", jurisdiction_id=jurisdiction.jurisdiction_id, legal_name="Cochin Spices", stakeholder_type=StakeholderTypeEnum.OWNER_USER, email="spices@cochin.in", phone="+919447000000", address_line1="Spice Market", city="Kochi", pincode="682001")
        facility = Facility(tenant_id="IN-KL", stakeholder_id=stakeholder.stakeholder_id, facility_name="Export Warehouse", address_line="Wellingdon Island", district="Ernakulam", pincode="682003")
        model = InstrumentModel(category="NAWI", subtype="BENCH_SCALE", manufacturer_name="Avery", model_name="Avery-100", model_approval_number="IND/05/2020/01", accuracy_class=AccuracyClassEnum.CLASS_III, verification_scale_interval_e=Decimal("1.000000"), scale_interval_unit="g", min_capacity=Decimal("20.000000"), max_capacity=Decimal("15000.000000"), capacity_unit="g", number_of_intervals_n=15000)
        inst = Instrument(tenant_id="IN-KL", jurisdiction_id=jurisdiction.jurisdiction_id, model_id=model.model_id, owner_id=stakeholder.stakeholder_id, facility_id=facility.facility_id, serial_number="AVERY-9988", year_of_manufacture=2023)
        user = User(tenant_id="IN-KL", email="lmo.kl@kerala.gov.in", full_name="LMO Thomas", role=RoleEnum.LMO)
        app = VerificationApplication(application_number="KL/2026/APP-01", tenant_id="IN-KL", jurisdiction_id=jurisdiction.jurisdiction_id, instrument_id=inst.instrument_id, applicant_id=stakeholder.stakeholder_id, application_type=ApplicationTypeEnum.RE_VERIFICATION, service_mode=ServiceModeEnum.ON_SITE, applicant_declaration_accepted=True)
        session = VerificationSession(tenant_id="IN-KL", application_id=app.application_id, instrument_id=inst.instrument_id, procedure_pack_id="IN-NAWI-CLASS-III-2026.1", procedure_pack_checksum="c"*64, verifier_id=user.user_id, verifier_role="LMO", scheduled_date=date.today(), status=SessionStatusEnum.FINALIZED, outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION)
        db_session.add_all([tenant, jurisdiction, stakeholder, facility, model, inst, user, app, session])
        db_session.commit()

        cert = Certificate(
            certificate_number="LM-CERT/IN-KL/2026/00098471",
            tenant_id="IN-KL",
            session_id=session.session_id,
            instrument_id=inst.instrument_id,
            owner_id=stakeholder.stakeholder_id,
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            verifier_id=user.user_id,
            signer_id=user.user_id,
            issue_date=date(2026, 8, 23),
            valid_until=date(2027, 8, 22),
            certificate_status=CertificateStatusEnum.ISSUED,
            certificate_bytes_sha256="d"*64,
            digital_signature_reference="DSC-TXN-998231",
            signature_timestamp=get_utc_now(),
            qr_code_payload="https://verify.legalmetrology.gov.in/qr/cert_xyz123456",
        )
        db_session.add(cert)
        db_session.commit()

        event = CertificateStatusEvent(
            certificate_id=cert.certificate_id,
            previous_status=CertificateStatusEnum.PENDING_SIGNATURE,
            new_status=CertificateStatusEnum.ISSUED,
            actor_id=user.user_id,
            reason="Certificate digitally signed with Class 3 DSC.",
            statutory_authority_reference="Section 24, Legal Metrology Act, 2009",
        )
        db_session.add(event)
        db_session.commit()

        assert cert.public_verification_token.startswith("cert_")
        assert len(cert.status_events) == 1
        assert cert.status_events[0].new_status == CertificateStatusEnum.ISSUED

    def test_audit_log_recording(self, db_session):
        """Test append-only system audit log recording."""
        audit = AuditLog(
            tenant_id="IN-DL",
            actor_id="usr-12345",
            actor_role="LMO",
            action="DISPOSITION_RECORDED",
            entity_type="VerificationSession",
            entity_id="sess-889900",
            correlation_id="corr-abc12345",
            causation_id="cause-xyz987",
            before_state={"status": "SUBMITTED"},
            after_state={"status": "FINALIZED", "outcome": "VERIFICATION_PASSED_PENDING_AUTHORIZATION"},
            client_ip="10.20.30.40",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        )
        db_session.add(audit)
        db_session.commit()

        saved_audit = db_session.execute(select(AuditLog).where(AuditLog.audit_id == audit.audit_id)).scalar_one()
        assert saved_audit.action == "DISPOSITION_RECORDED"
        assert saved_audit.after_state["outcome"] == "VERIFICATION_PASSED_PENDING_AUTHORIZATION"
