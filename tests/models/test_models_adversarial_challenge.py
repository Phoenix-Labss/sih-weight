"""Empirical adversarial test suite challenging data model invariants for Milestone 2.

Challenges:
- Physical stamp action decoupling from certificate lifecycle
- Observation immutability, precision, and correction audit chains
- Multi-tenant key scoping, token entropy, and uniqueness constraints
- Reference standard calibration validity and check constraints
- Exact decimal precision and statutory fee calculations
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import secrets
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


@pytest.fixture
def standard_setup(db_session):
    """Seed standard tenant, jurisdiction, stakeholder, model, instrument, and officer."""
    tenant = Tenant(tenant_id="IN-DL", state_code="DL", state_name="Delhi", status=TenantStateEnum.ACTIVE)
    jurisdiction = Jurisdiction(tenant_id="IN-DL", name="West Delhi", code="DL-WD-01", level=JurisdictionLevelEnum.DISTRICT)
    stakeholder = Stakeholder(
        tenant_id="IN-DL",
        jurisdiction_id=jurisdiction.jurisdiction_id,
        legal_name="Apex Logistics Ltd",
        stakeholder_type=StakeholderTypeEnum.OWNER_USER,
        identifier_type="GSTIN",
        identifier_value="07AAAAA0000A1Z5",
        email="compliance@apex.in",
        phone="+911122334455",
        address_line1="Mayapuri Industrial Area",
        city="New Delhi",
        pincode="110064",
    )
    facility = Facility(
        tenant_id="IN-DL",
        stakeholder_id=stakeholder.stakeholder_id,
        facility_name="Main Terminal",
        address_line="Mayapuri Phase 1",
        district="West Delhi",
        pincode="110064",
    )
    user = User(tenant_id="IN-DL", email="lmo.delhi@gov.in", full_name="LMO Sharma", role=RoleEnum.LMO)
    supervisor = User(tenant_id="IN-DL", email="sup.delhi@gov.in", full_name="Assistant Controller Gupta", role=RoleEnum.SUPERVISOR)
    model = InstrumentModel(
        category="NAWI",
        subtype="WEIGHBRIDGE",
        manufacturer_name="Avery India",
        model_name="AVERY-WB-50T",
        model_approval_number="IND/01/2025/1199",
        accuracy_class=AccuracyClassEnum.CLASS_III,
        verification_scale_interval_e=Decimal("10.000000"),
        scale_interval_unit="kg",
        min_capacity=Decimal("200.000000"),
        max_capacity=Decimal("50000.000000"),
        capacity_unit="kg",
        number_of_intervals_n=5000,
    )
    db_session.add_all([tenant, jurisdiction, stakeholder, facility, user, supervisor, model])
    db_session.commit()

    inst = Instrument(
        tenant_id="IN-DL",
        jurisdiction_id=jurisdiction.jurisdiction_id,
        model_id=model.model_id,
        owner_id=stakeholder.stakeholder_id,
        facility_id=facility.facility_id,
        serial_number="AVERY-50T-2026-001",
        year_of_manufacture=2026,
    )
    db_session.add(inst)
    db_session.commit()

    return {
        "tenant": tenant,
        "jurisdiction": jurisdiction,
        "stakeholder": stakeholder,
        "facility": facility,
        "user": user,
        "supervisor": supervisor,
        "model": model,
        "instrument": inst,
    }


class TestAdversarialPhysicalStampDecoupling:
    """Stress tests verifying physical stamping and sealing records are decoupled from digital certificates."""

    def test_stamp_actions_recorded_without_certificate(self, db_session, standard_setup):
        """Stress: Failed verification session records physical seal inspection/actions without digital cert."""
        setup = standard_setup
        session = VerificationSession(
            tenant_id="IN-DL",
            application_id="app-adv-01",
            instrument_id=setup["instrument"].instrument_id,
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            procedure_pack_checksum="0"*64,
            verifier_id=setup["user"].user_id,
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.FINALIZED,
            outcome=VerificationOutcomeEnum.VERIFICATION_FAILED,
            officer_disposition_notes="Instrument failed repeatability test spread exceeding 1.5 e.",
        )
        db_session.add(session)
        db_session.commit()

        # Record broken seal found and replacement seal applied
        broken_seal = PhysicalStampAction(
            tenant_id="IN-DL",
            session_id=session.session_id,
            instrument_id=setup["instrument"].instrument_id,
            verifier_id=setup["user"].user_id,
            action_type=PhysicalSealActionEnum.SEAL_BROKEN_OLD,
            seal_type=SealTypeEnum.LEAD_WIRE_SEAL,
            seal_identification_number="OLD-SEAL-DL-2025-99",
            seal_position="CALIBRATION_PORT_MAIN",
            notes="Previous wire seal cut; signs of adjustment access.",
        )
        new_seal = PhysicalStampAction(
            tenant_id="IN-DL",
            session_id=session.session_id,
            instrument_id=setup["instrument"].instrument_id,
            verifier_id=setup["user"].user_id,
            action_type=PhysicalSealActionEnum.SEAL_DEFECTIVE_REPLACED,
            seal_type=SealTypeEnum.SECURITY_STICKER_HOLOGRAM,
            seal_identification_number="DL-HOLO-2026-00129",
            seal_position="CALIBRATION_PORT_MAIN",
            photo_evidence_hash="1"*64,
            notes="Temporary inspection hologram sticker applied pending repair.",
        )
        db_session.add_all([broken_seal, new_seal])
        db_session.commit()

        # Verify physical stamp actions exist in DB
        stamps = db_session.execute(
            select(PhysicalStampAction).where(PhysicalStampAction.session_id == session.session_id)
        ).scalars().all()
        assert len(stamps) == 2
        assert {s.action_type for s in stamps} == {
            PhysicalSealActionEnum.SEAL_BROKEN_OLD,
            PhysicalSealActionEnum.SEAL_DEFECTIVE_REPLACED,
        }

        # Verify NO certificate exists
        certs = db_session.execute(
            select(Certificate).where(Certificate.session_id == session.session_id)
        ).scalars().all()
        assert len(certs) == 0

    def test_multi_seal_technology_composite_stamping(self, db_session, standard_setup):
        """Stress: A single passing verification session records multiple distinct seal technologies."""
        setup = standard_setup
        session = VerificationSession(
            tenant_id="IN-DL",
            application_id="app-adv-02",
            instrument_id=setup["instrument"].instrument_id,
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            procedure_pack_checksum="0"*64,
            verifier_id=setup["user"].user_id,
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.FINALIZED,
            outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
        )
        db_session.add(session)
        db_session.commit()

        # Apply 4 distinct seal technologies on different positions
        seal_configs = [
            (SealTypeEnum.LEAD_WIRE_SEAL, "DL-LEAD-2026-01", "LOAD_CELL_JUNCTION_BOX"),
            (SealTypeEnum.SECURITY_STICKER_HOLOGRAM, "DL-HOLO-2026-02", "INDICATOR_ENCLOSURE_SEAL"),
            (SealTypeEnum.METALLIC_PUNCH_MARK, "DL-PUNCH-2026-03", "NAMEPLATE_VERIFICATION_RIVET"),
            (SealTypeEnum.BARCODED_TAMPER_SEAL, "DL-BAR-2026-04", "CALIBRATION_ACCESS_SWITCH"),
        ]

        for seal_type, seal_id, pos in seal_configs:
            stamp = PhysicalStampAction(
                tenant_id="IN-DL",
                session_id=session.session_id,
                instrument_id=setup["instrument"].instrument_id,
                verifier_id=setup["user"].user_id,
                action_type=PhysicalSealActionEnum.SEAL_APPLIED,
                seal_type=seal_type,
                seal_identification_number=seal_id,
                seal_position=pos,
                photo_evidence_hash=secrets.token_hex(32),
            )
            db_session.add(stamp)
        db_session.commit()

        saved_stamps = db_session.execute(
            select(PhysicalStampAction).where(PhysicalStampAction.session_id == session.session_id)
        ).scalars().all()
        assert len(saved_stamps) == 4
        assert {s.seal_type for s in saved_stamps} == {
            SealTypeEnum.LEAD_WIRE_SEAL,
            SealTypeEnum.SECURITY_STICKER_HOLOGRAM,
            SealTypeEnum.METALLIC_PUNCH_MARK,
            SealTypeEnum.BARCODED_TAMPER_SEAL,
        }

    def test_certificate_revocation_does_not_mutate_physical_stamp_ledger(self, db_session, standard_setup):
        """Stress: When a digital certificate is revoked, the physical stamp action records remain immutable."""
        setup = standard_setup
        session = VerificationSession(
            tenant_id="IN-DL",
            application_id="app-adv-03",
            instrument_id=setup["instrument"].instrument_id,
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            procedure_pack_checksum="0"*64,
            verifier_id=setup["user"].user_id,
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.FINALIZED,
            outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
        )
        db_session.add(session)
        db_session.commit()

        stamp = PhysicalStampAction(
            tenant_id="IN-DL",
            session_id=session.session_id,
            instrument_id=setup["instrument"].instrument_id,
            verifier_id=setup["user"].user_id,
            action_type=PhysicalSealActionEnum.SEAL_APPLIED,
            seal_type=SealTypeEnum.LEAD_WIRE_SEAL,
            seal_identification_number="DL-PERM-SEAL-9988",
            seal_position="MAIN_BEAM",
        )
        cert = Certificate(
            certificate_number="CERT-REV-TEST-001",
            tenant_id="IN-DL",
            session_id=session.session_id,
            instrument_id=setup["instrument"].instrument_id,
            owner_id=setup["stakeholder"].stakeholder_id,
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            verifier_id=setup["user"].user_id,
            issue_date=date.today(),
            valid_until=date.today() + timedelta(days=365),
            certificate_status=CertificateStatusEnum.ISSUED,
            qr_code_payload="https://qr.gov.in/c1",
        )
        db_session.add_all([stamp, cert])
        db_session.commit()

        # Revoke certificate
        cert.certificate_status = CertificateStatusEnum.REVOKED
        db_session.commit()

        # Verify physical stamp action is unchanged
        saved_stamp = db_session.execute(
            select(PhysicalStampAction).where(PhysicalStampAction.stamp_action_id == stamp.stamp_action_id)
        ).scalar_one()
        assert saved_stamp.action_type == PhysicalSealActionEnum.SEAL_APPLIED
        assert saved_stamp.seal_identification_number == "DL-PERM-SEAL-9988"


class TestAdversarialObservationImmutability:
    """Stress tests verifying test observation immutability, numeric exactness, and correction audit chains."""

    def test_multi_generation_observation_correction_chain(self, db_session, standard_setup):
        """Stress: Chain of multiple corrections (v1 -> v2 -> v3) preserving full audit provenance."""
        setup = standard_setup
        session = VerificationSession(
            tenant_id="IN-DL",
            application_id="app-adv-04",
            instrument_id=setup["instrument"].instrument_id,
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            procedure_pack_checksum="0"*64,
            verifier_id=setup["user"].user_id,
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.IN_PROGRESS,
        )
        db_session.add(session)
        db_session.commit()

        # Observation 1: Initial (erroneous entry)
        obs1 = TestObservation(
            session_id=session.session_id,
            step_type=StepTypeEnum.INCREASING_LOAD,
            step_sequence=1,
            nominal_load=Decimal("10000.000000"),
            load_unit="kg",
            raw_indication_reading=Decimal("10050.000000"),  # Transposition
            normalized_indication=Decimal("10050.000000"),
            reading_unit="kg",
            observed_error=Decimal("50.000000"),
            mpe_allowed=Decimal("15.000000"),
            is_within_mpe=False,
            repetition_index=1,
            calculation_trace={"raw": "10050.000000"},
        )
        db_session.add(obs1)
        db_session.commit()

        # Observation 2: First correction (supervisor authorized)
        obs2 = TestObservation(
            session_id=session.session_id,
            step_type=StepTypeEnum.INCREASING_LOAD,
            step_sequence=1,
            nominal_load=Decimal("10000.000000"),
            load_unit="kg",
            raw_indication_reading=Decimal("10005.000000"),
            normalized_indication=Decimal("10005.000000"),
            reading_unit="kg",
            observed_error=Decimal("5.000000"),
            mpe_allowed=Decimal("15.000000"),
            is_within_mpe=True,
            repetition_index=2,
            calculation_trace={"raw": "10005.000000"},
        )
        db_session.add(obs2)
        db_session.commit()

        corr1 = ObservationCorrection(
            session_id=session.session_id,
            original_observation_id=obs1.observation_id,
            new_observation_id=obs2.observation_id,
            actor_id=setup["user"].user_id,
            correction_reason="Corrected keying typo from 10050 to 10005 kg verified with field test sheet.",
            authorized_by_supervisor_id=setup["supervisor"].user_id,
        )
        db_session.add(corr1)
        db_session.commit()

        # Observation 3: Second correction (tare offset adjustment)
        obs3 = TestObservation(
            session_id=session.session_id,
            step_type=StepTypeEnum.INCREASING_LOAD,
            step_sequence=1,
            nominal_load=Decimal("10000.000000"),
            load_unit="kg",
            raw_indication_reading=Decimal("10004.000000"),
            normalized_indication=Decimal("10004.000000"),
            reading_unit="kg",
            observed_error=Decimal("4.000000"),
            mpe_allowed=Decimal("15.000000"),
            is_within_mpe=True,
            repetition_index=3,
            calculation_trace={"raw": "10004.000000", "tare_adjusted": True},
        )
        db_session.add(obs3)
        db_session.commit()

        corr2 = ObservationCorrection(
            session_id=session.session_id,
            original_observation_id=obs2.observation_id,
            new_observation_id=obs3.observation_id,
            actor_id=setup["user"].user_id,
            correction_reason="Zero tracking offset correction applied under supervisory direction.",
            authorized_by_supervisor_id=setup["supervisor"].user_id,
        )
        db_session.add(corr2)
        db_session.commit()

        # Verify full correction lineage
        corrections = db_session.execute(
            select(ObservationCorrection)
            .where(ObservationCorrection.session_id == session.session_id)
            .order_by(ObservationCorrection.corrected_at.asc())
        ).scalars().all()
        assert len(corrections) == 2
        assert corrections[0].original_observation_id == obs1.observation_id
        assert corrections[0].new_observation_id == obs2.observation_id
        assert corrections[1].original_observation_id == obs2.observation_id
        assert corrections[1].new_observation_id == obs3.observation_id
        assert corrections[0].original_observation.raw_indication_reading == Decimal("10050.000000")
        assert corrections[1].new_observation.raw_indication_reading == Decimal("1004.000000") or corrections[1].new_observation.raw_indication_reading == Decimal("10004.000000")

    def test_observation_unique_constraint_rejects_duplicate_step(self, db_session, standard_setup):
        """Stress: Duplicate observation on same step sequence without repetition increment is rejected."""
        setup = standard_setup
        session = VerificationSession(
            tenant_id="IN-DL",
            application_id="app-adv-05",
            instrument_id=setup["instrument"].instrument_id,
            procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
            procedure_pack_checksum="0"*64,
            verifier_id=setup["user"].user_id,
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.IN_PROGRESS,
        )
        db_session.add(session)
        db_session.commit()

        obs1 = TestObservation(
            session_id=session.session_id,
            step_type=StepTypeEnum.ECCENTRICITY,
            step_sequence=1,
            nominal_load=Decimal("15000.000000"),
            load_unit="kg",
            raw_indication_reading=Decimal("15002.000000"),
            normalized_indication=Decimal("15002.000000"),
            reading_unit="kg",
            observed_error=Decimal("2.000000"),
            mpe_allowed=Decimal("15.000000"),
            is_within_mpe=True,
            repetition_index=1,
            eccentricity_position="FRONT_LEFT",
        )
        db_session.add(obs1)
        db_session.commit()

        # Duplicate step_sequence + repetition_index + position on same session
        obs_duplicate = TestObservation(
            session_id=session.session_id,
            step_type=StepTypeEnum.ECCENTRICITY,
            step_sequence=1,
            nominal_load=Decimal("15000.000000"),
            load_unit="kg",
            raw_indication_reading=Decimal("15003.000000"),
            normalized_indication=Decimal("15003.000000"),
            reading_unit="kg",
            observed_error=Decimal("3.000000"),
            mpe_allowed=Decimal("15.000000"),
            is_within_mpe=True,
            repetition_index=1,
            eccentricity_position="FRONT_LEFT",
        )
        db_session.add(obs_duplicate)
        with pytest.raises(IntegrityError):
            db_session.commit()
        db_session.rollback()

    def test_observation_decimal_precision_scale_and_sign(self, db_session, standard_setup):
        """Stress: Exact decimal precision across small precision balance values (sub-mg) and negative errors."""
        setup = standard_setup
        session = VerificationSession(
            tenant_id="IN-DL",
            application_id="app-adv-06",
            instrument_id=setup["instrument"].instrument_id,
            procedure_pack_id="IN-NAWI-CLASS-I-2026.1",
            procedure_pack_checksum="0"*64,
            verifier_id=setup["user"].user_id,
            verifier_role="LMO",
            scheduled_date=date.today(),
            status=SessionStatusEnum.IN_PROGRESS,
        )
        db_session.add(session)
        db_session.commit()

        obs = TestObservation(
            session_id=session.session_id,
            step_type=StepTypeEnum.ZERO_TEST,
            step_sequence=1,
            nominal_load=Decimal("0.000000"),
            load_unit="g",
            raw_indication_reading=Decimal("-0.000250"),  # Negative error
            normalized_indication=Decimal("-0.000250"),
            reading_unit="g",
            observed_error=Decimal("-0.000250"),
            mpe_allowed=Decimal("0.000500"),
            is_within_mpe=True,
            repetition_index=1,
        )
        db_session.add(obs)
        db_session.commit()

        saved_obs = db_session.execute(
            select(TestObservation).where(TestObservation.observation_id == obs.observation_id)
        ).scalar_one()
        assert saved_obs.observed_error == Decimal("-0.000250")
        assert saved_obs.raw_indication_reading == Decimal("-0.000250")
        assert isinstance(saved_obs.observed_error, Decimal)


class TestAdversarialMultiTenantKeyScoping:
    """Stress tests verifying tenant isolation, key scopes, and enumeration-resistant tokens."""

    def test_public_tokens_entropy_and_uniqueness(self):
        """Stress: High-volume token generation produces unique, non-sequential, prefixed strings."""
        inst_tokens = set()
        cert_tokens = set()
        N = 1000

        for _ in range(N):
            it = generate_opaque_token("inst_")
            ct = generate_opaque_token("cert_")
            assert it.startswith("inst_")
            assert ct.startswith("cert_")
            assert len(it) > 40  # 32 bytes urlsafe is ~43 chars + prefix
            assert len(ct) > 40
            inst_tokens.add(it)
            cert_tokens.add(ct)

        assert len(inst_tokens) == N
        assert len(cert_tokens) == N
        assert inst_tokens.isdisjoint(cert_tokens)

    def test_instrument_model_serial_unique_per_model(self, db_session, standard_setup):
        """Stress: Same serial number under different models is allowed; under same model is rejected."""
        setup = standard_setup
        model1 = setup["model"]

        # Second model
        model2 = InstrumentModel(
            category="NAWI",
            subtype="COUNTER_SCALE",
            manufacturer_name="Crown Scales",
            model_name="CROWN-CS-10K",
            model_approval_number="IND/02/2026/8899",
            accuracy_class=AccuracyClassEnum.CLASS_III,
            verification_scale_interval_e=Decimal("1.000000"),
            scale_interval_unit="g",
            min_capacity=Decimal("20.000000"),
            max_capacity=Decimal("10000.000000"),
            capacity_unit="g",
        )
        db_session.add(model2)
        db_session.commit()

        # Same serial under model2 -> Allowed
        inst_diff_model = Instrument(
            tenant_id="IN-DL",
            jurisdiction_id=setup["jurisdiction"].jurisdiction_id,
            model_id=model2.model_id,
            owner_id=setup["stakeholder"].stakeholder_id,
            facility_id=setup["facility"].facility_id,
            serial_number="AVERY-50T-2026-001",  # Same serial as inst1
            year_of_manufacture=2026,
        )
        db_session.add(inst_diff_model)
        db_session.commit()

        # Same serial under model1 -> Rejected
        inst_same_model_dup = Instrument(
            tenant_id="IN-DL",
            jurisdiction_id=setup["jurisdiction"].jurisdiction_id,
            model_id=model1.model_id,
            owner_id=setup["stakeholder"].stakeholder_id,
            facility_id=setup["facility"].facility_id,
            serial_number="AVERY-50T-2026-001",  # Duplicate under model1
            year_of_manufacture=2026,
        )
        db_session.add(inst_same_model_dup)
        with pytest.raises(IntegrityError):
            db_session.commit()
        db_session.rollback()

    def test_stakeholder_identifier_unique_per_tenant(self, db_session, standard_setup):
        """Stress: Same GSTIN under different tenants is allowed; under same tenant is rejected."""
        setup = standard_setup

        # Tenant 2
        tenant2 = Tenant(tenant_id="IN-HR", state_code="HR", state_name="Haryana")
        jur2 = Jurisdiction(tenant_id="IN-HR", name="Gurugram", code="HR-GGN-01", level=JurisdictionLevelEnum.DISTRICT)
        db_session.add_all([tenant2, jur2])
        db_session.commit()

        # Same GSTIN under Tenant HR -> Allowed
        stk_tenant2 = Stakeholder(
            tenant_id="IN-HR",
            jurisdiction_id=jur2.jurisdiction_id,
            legal_name="Apex Logistics Haryana Branch",
            stakeholder_type=StakeholderTypeEnum.OWNER_USER,
            identifier_type="GSTIN",
            identifier_value="07AAAAA0000A1Z5",  # Same identifier
            email="haryana@apex.in",
            phone="+91124556677",
            address_line1="Udyog Vihar",
            city="Gurugram",
            pincode="122016",
        )
        db_session.add(stk_tenant2)
        db_session.commit()

        # Same GSTIN duplicate under Tenant DL -> Rejected
        stk_dup_dl = Stakeholder(
            tenant_id="IN-DL",
            jurisdiction_id=setup["jurisdiction"].jurisdiction_id,
            legal_name="Apex Logistics Duplicate DL",
            stakeholder_type=StakeholderTypeEnum.OWNER_USER,
            identifier_type="GSTIN",
            identifier_value="07AAAAA0000A1Z5",
            email="dup@apex.in",
            phone="+9111998877",
            address_line1="Connaught Place",
            city="New Delhi",
            pincode="110001",
        )
        db_session.add(stk_dup_dl)
        with pytest.raises(IntegrityError):
            db_session.commit()
        db_session.rollback()


class TestAdversarialReferenceStandardIntegrity:
    """Stress tests verifying reference standard calibration dates, constraints, and status rules."""

    def test_calibration_dates_check_constraint(self, db_session, standard_setup):
        """Stress: Database check constraint rejects standard where valid_until <= calibrated_at."""
        setup = standard_setup
        now = get_utc_now()

        invalid_standard = ReferenceStandard(
            tenant_id="IN-DL",
            custodian_type=CustodianTypeEnum.LMO_OFFICE,
            custodian_id=setup["jurisdiction"].jurisdiction_id,
            asset_tag="DL-BAD-DATES-01",
            denomination_mass=Decimal("20.000000"),
            mass_unit="kg",
            accuracy_class="M1",
            serial_number="BAD-DATE-001",
            calibration_certificate_number="CAL-BAD-01",
            calibrating_laboratory="NPL Delhi",
            calibrated_at=now,
            valid_until=now - timedelta(days=1),  # Invalid: valid_until before calibrated_at
        )
        db_session.add(invalid_standard)
        with pytest.raises(IntegrityError):
            db_session.commit()
        db_session.rollback()

    def test_calibration_record_cascade_deletion(self, db_session, standard_setup):
        """Stress: Deleting a reference standard cascades to its historical calibration records."""
        setup = standard_setup
        now = get_utc_now()

        standard = ReferenceStandard(
            tenant_id="IN-DL",
            custodian_type=CustodianTypeEnum.DEPARTMENTAL_LAB,
            custodian_id=setup["jurisdiction"].jurisdiction_id,
            asset_tag="DL-CASCADE-TEST-01",
            denomination_mass=Decimal("10.000000"),
            mass_unit="kg",
            accuracy_class="F2",
            serial_number="CASC-001",
            calibration_certificate_number="CAL-CASC-01",
            calibrating_laboratory="RRSL Delhi",
            calibrated_at=now - timedelta(days=60),
            valid_until=now + timedelta(days=305),
        )
        db_session.add(standard)
        db_session.commit()

        cal_rec = CalibrationRecord(
            standard_id=standard.standard_id,
            certificate_number="CAL-HIST-2025-01",
            calibrated_at=now - timedelta(days=425),
            valid_until=now - timedelta(days=60),
            calibrating_lab="RRSL Delhi",
        )
        db_session.add(cal_rec)
        db_session.commit()

        # Delete standard
        db_session.delete(standard)
        db_session.commit()

        # Verify calibration record was deleted via cascade
        remaining_cal = db_session.execute(
            select(CalibrationRecord).where(CalibrationRecord.calibration_record_id == cal_rec.calibration_record_id)
        ).scalar_one_or_none()
        assert remaining_cal is None
