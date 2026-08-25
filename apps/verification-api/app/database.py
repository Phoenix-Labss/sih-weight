"""Database connection, session management, and configuration.

Provides SQLite and PostgreSQL compatible engine and session factories,
supporting both development/testing and production transactional environments.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import StaticPool

from packages.measurement.decimal_math import ExactDecimal

# Connect to real PostgreSQL database (metrology_db on port 5432)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:root@127.0.0.1:5432/metrology_db",
)


def get_engine_args(database_url: str) -> dict:
    """Return dialect-specific engine parameters."""
    args = {}
    if database_url.startswith("sqlite"):
        args["connect_args"] = {"check_same_thread": False}
        if ":memory:" in database_url:
            args["poolclass"] = StaticPool
    else:
        # PostgreSQL connection pooling parameters
        args["pool_pre_ping"] = True
        args["pool_size"] = int(os.getenv("DB_POOL_SIZE", "10"))
        args["max_overflow"] = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    return args


def create_database_engine(database_url: str | None = None) -> Engine:
    """Create a configured SQLAlchemy engine."""
    url = database_url or DATABASE_URL
    return create_engine(url, future=True, **get_engine_args(url))


# Global default engine and sessionmaker
engine: Engine = create_database_engine(DATABASE_URL)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
    future=True,
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a transactional database session."""
    db: Session = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def get_db_context(engine_override: Engine | None = None) -> Generator[Session, None, None]:
    """Context manager for standalone transactional database sessions."""
    session_factory = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine_override or engine,
        expire_on_commit=False,
        future=True,
    )
    db: Session = session_factory()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db(engine_override: Engine | None = None) -> None:
    """Create all tables in the target database and seed baseline fixtures."""
    import app.models  # Crucial: imports all model modules so Base.metadata is fully populated
    from app.models.base import Base
    target_engine = engine_override or engine
    Base.metadata.create_all(bind=target_engine)

    # Seed baseline fixtures if empty
    seed_factory = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=target_engine,
        expire_on_commit=False,
        future=True,
    )
    with seed_factory() as session:
        try:
            _seed_default_fixtures(session)
            session.commit()
        except Exception as e:
            session.rollback()
            import logging
            logging.error(f"Error seeding default database fixtures: {e}")


def _seed_default_fixtures(session: Session) -> None:
    """Seed default demonstration fixtures (tenants, models, certificates)."""
    from datetime import datetime, timezone, timedelta
    from app.models.tenant import Tenant, Jurisdiction, TenantStateEnum, JurisdictionLevelEnum
    from app.models.stakeholder import Stakeholder, StakeholderTypeEnum, Facility, User, RoleEnum
    from app.models.instrument import InstrumentModel, Instrument, AccuracyClassEnum, InstrumentStatusEnum
    from app.models.session import VerificationSession, SessionStatusEnum, VerificationOutcomeEnum
    from app.models.certificate import Certificate, CertificateStatusEnum
    from app.models.application import VerificationApplication, FeeAssessment, ApplicationStatusEnum, ApplicationTypeEnum, ServiceModeEnum, PaymentStatusEnum
    from decimal import Decimal

    # Check if tenant already exists
    existing_tenant = session.execute(
        select(Tenant).where(Tenant.tenant_id == "tenant-delhi-central")
    ).scalars().first()

    if existing_tenant:
        return

    # 1. Create Default Tenant
    t_delhi = Tenant(
        tenant_id="tenant-delhi-central",
        state_code="DL",
        state_name="NCT of Delhi",
        status=TenantStateEnum.ACTIVE,
        config={"zone": "Central", "portal_version": "0.0.1"}
    )
    session.add(t_delhi)
    session.flush()

    # 2. Create Jurisdiction
    jur_delhi = Jurisdiction(
        jurisdiction_id="JUR-DL-01",
        tenant_id=t_delhi.tenant_id,
        code="JUR-DL-01",
        name="Central Delhi Metrology Zone",
        level=JurisdictionLevelEnum.DISTRICT,
        boundary_geo={"type": "Polygon", "coordinates": []}
    )
    session.add(jur_delhi)
    session.flush()

    # 3. Create Stakeholders
    trader_stk = Stakeholder(
        stakeholder_id="stk-trader-01",
        tenant_id=t_delhi.tenant_id,
        jurisdiction_id=jur_delhi.jurisdiction_id,
        legal_name="Rajesh Enterprises Pvt Ltd",
        trade_name="Rajesh Kirana & Provisions",
        stakeholder_type=StakeholderTypeEnum.OWNER_USER,
        identifier_type="GSTIN",
        identifier_value="07ABCDE1234F1Z5",
        email="rajesh@kirana.in",
        phone="+919876543210",
        address_line1="104 Chandni Chowk",
        city="Delhi",
        pincode="110006",
        is_active=True,
    )
    session.add(trader_stk)
    session.flush()

    # 4. Create Facilities
    fac_delhi = Facility(
        facility_id="fac-delhi-01",
        tenant_id=t_delhi.tenant_id,
        stakeholder_id=trader_stk.stakeholder_id,
        facility_name="Main Chandni Chowk Retail Store",
        address_line="104 Chandni Chowk",
        district="Central Delhi",
        pincode="110006",
    )
    fac_retail = Facility(
        facility_id="fac-retail-01",
        tenant_id=t_delhi.tenant_id,
        stakeholder_id=trader_stk.stakeholder_id,
        facility_name="Star Hypermarket Retail Branch 1",
        address_line="Connaught Place",
        district="Central Delhi",
        pincode="110001",
    )
    session.add_all([fac_delhi, fac_retail])
    session.flush()

    # 5. Create Users (Trader & Officer)
    trader_user = User(
        user_id="usr-trader-01",
        tenant_id=t_delhi.tenant_id,
        stakeholder_id=trader_stk.stakeholder_id,
        role=RoleEnum.OWNER,
        email="rajesh@kirana.in",
        full_name="Rajesh Kumar",
        is_active=True,
    )
    officer_user = User(
        user_id="lmo-officer-01",
        tenant_id=t_delhi.tenant_id,
        role=RoleEnum.LMO,
        email="officer.delhi@metrology.gov.in",
        full_name="Dr. Ramesh Kumar (LMO)",
        is_active=True,
    )
    session.add_all([trader_user, officer_user])
    session.flush()

    # 5b. Create Certified Reference Standard Weights
    from app.models.reference_standard import ReferenceStandard, CustodianTypeEnum, ReferenceStandardStatusEnum
    std_f2 = ReferenceStandard(
        standard_id="STD-MASS-CLASS-F2-001",
        tenant_id=t_delhi.tenant_id,
        custodian_type=CustodianTypeEnum.DEPARTMENTAL_LAB,
        custodian_id=jur_delhi.jurisdiction_id,
        asset_tag="F2 Working Standard Mass Set (1g - 5kg)",
        denomination_mass=Decimal("5.0"),
        mass_unit="kg",
        accuracy_class="F2",
        serial_number="STD-F2-9981",
        calibration_certificate_number="CAL-NPL-2025-F2-089",
        calibrating_laboratory="National Physical Laboratory (NPL India)",
        calibrated_at=datetime.now(timezone.utc) - timedelta(days=60),
        valid_until=datetime.now(timezone.utc) + timedelta(days=730),
        expanded_uncertainty=Decimal("0.000005"),
        calibration_status=ReferenceStandardStatusEnum.ACTIVE,
    )
    std_m1 = ReferenceStandard(
        standard_id="STD-MASS-CLASS-M1-002",
        tenant_id=t_delhi.tenant_id,
        custodian_type=CustodianTypeEnum.DEPARTMENTAL_LAB,
        custodian_id=jur_delhi.jurisdiction_id,
        asset_tag="M1 Cast Iron Weights (10kg, 20kg)",
        denomination_mass=Decimal("20.0"),
        mass_unit="kg",
        accuracy_class="M1",
        serial_number="STD-M1-4421",
        calibration_certificate_number="CAL-RRSL-2025-M1-442",
        calibrating_laboratory="Regional Reference Standards Laboratory (RRSL)",
        calibrated_at=datetime.now(timezone.utc) - timedelta(days=90),
        valid_until=datetime.now(timezone.utc) + timedelta(days=730),
        expanded_uncertainty=Decimal("0.000020"),
        calibration_status=ReferenceStandardStatusEnum.ACTIVE,
    )
    std_m2 = ReferenceStandard(
        standard_id="STD-MASS-CLASS-M2-003",
        tenant_id=t_delhi.tenant_id,
        custodian_type=CustodianTypeEnum.DEPARTMENTAL_LAB,
        custodian_id=jur_delhi.jurisdiction_id,
        asset_tag="M2 Cast Iron Weights (50kg)",
        denomination_mass=Decimal("50.0"),
        mass_unit="kg",
        accuracy_class="M2",
        serial_number="STD-M2-1011",
        calibration_certificate_number="CAL-RRSL-2025-M2-101",
        calibrating_laboratory="Regional Reference Standards Laboratory (RRSL)",
        calibrated_at=datetime.now(timezone.utc) - timedelta(days=120),
        valid_until=datetime.now(timezone.utc) + timedelta(days=730),
        expanded_uncertainty=Decimal("0.000050"),
        calibration_status=ReferenceStandardStatusEnum.ACTIVE,
    )
    session.add_all([std_f2, std_m1, std_m2])
    session.flush()

    # 6. Create Instrument Models
    model_30kg = InstrumentModel(
        model_id="mod-nawi-cl3-30kg",
        category="NAWI",
        subtype="ELECTRONIC_COUNTER_SCALE",
        manufacturer_name="Eagle Digital Scales India Ltd",
        model_name="Eagle Pro Commercial Counter Scale",
        model_approval_number="IND/09/2022/451",
        accuracy_class=AccuracyClassEnum.CLASS_III,
        verification_scale_interval_e=Decimal("5.0"),
        scale_interval_unit="g",
        min_capacity=Decimal("100.0"),
        max_capacity=Decimal("30000.0"),
        capacity_unit="g",
        number_of_intervals_n=6000,
        is_active=True,
    )
    model_mod1 = InstrumentModel(
        model_id="MOD-NAWI-01",
        category="NAWI",
        subtype="ELECTRONIC_COUNTER_SCALE",
        manufacturer_name="Eagle Digital Scales India Ltd",
        model_name="Eagle Electronic Counter Scale Model E-30",
        model_approval_number="IND/09/2024/110",
        accuracy_class=AccuracyClassEnum.CLASS_III,
        verification_scale_interval_e=Decimal("5.0"),
        scale_interval_unit="g",
        min_capacity=Decimal("100.0"),
        max_capacity=Decimal("30000.0"),
        capacity_unit="g",
        number_of_intervals_n=6000,
        is_active=True,
    )
    model_mod2 = InstrumentModel(
        model_id="MOD-NAWI-02",
        category="NAWI",
        subtype="PRECISION_BALANCE",
        manufacturer_name="Mettler Toledo Metrology India",
        model_name="Precision Laboratory Balance XP-5",
        model_approval_number="IND/12/2023/890",
        accuracy_class=AccuracyClassEnum.CLASS_II,
        verification_scale_interval_e=Decimal("0.1"),
        scale_interval_unit="g",
        min_capacity=Decimal("5.0"),
        max_capacity=Decimal("5000.0"),
        capacity_unit="g",
        number_of_intervals_n=50000,
        is_active=True,
    )
    model_mod3 = InstrumentModel(
        model_id="MOD-NAWI-03",
        category="NAWI",
        subtype="WEIGHBRIDGE",
        manufacturer_name="Avery India Metrology Ltd",
        model_name="Pitless Heavy Truck Weighbridge 50T",
        model_approval_number="IND/04/2025/302",
        accuracy_class=AccuracyClassEnum.CLASS_IIII,
        verification_scale_interval_e=Decimal("10.0"),
        scale_interval_unit="kg",
        min_capacity=Decimal("200.0"),
        max_capacity=Decimal("50000.0"),
        capacity_unit="kg",
        number_of_intervals_n=5000,
        is_active=True,
    )
    session.add_all([model_30kg, model_mod1, model_mod2, model_mod3])
    session.flush()

    # 7. Create Instrument
    now = datetime.now(timezone.utc)
    inst_1 = Instrument(
        instrument_id="inst-dl-001",
        public_instrument_token="INST_TOKEN_DL_001",
        tenant_id=t_delhi.tenant_id,
        jurisdiction_id=jur_delhi.jurisdiction_id,
        model_id=model_30kg.model_id,
        owner_id=trader_stk.stakeholder_id,
        facility_id=fac_delhi.facility_id,
        serial_number="SN-2026-DL-9941",
        year_of_manufacture=2024,
        intended_use="COMMERCIAL_RETAIL",
        installation_location_notes="Main Checkout Counter 1, Chandni Chowk, Delhi",
        current_status=InstrumentStatusEnum.DRAFT,
        verification_due_date=now + timedelta(days=30),
    )
    session.add(inst_1)
    session.flush()

    # 8. Create Verification Application in DRAFT status
    app_1 = VerificationApplication(
        application_id="app-dl-2026-00142",
        application_number="APP-2026-DL-00142",
        tenant_id=t_delhi.tenant_id,
        jurisdiction_id=jur_delhi.jurisdiction_id,
        instrument_id=inst_1.instrument_id,
        applicant_id=trader_stk.stakeholder_id,
        application_type=ApplicationTypeEnum.RE_VERIFICATION,
        service_mode=ServiceModeEnum.ON_SITE,
        current_status=ApplicationStatusEnum.DRAFT,
    )
    session.add(app_1)
    session.flush()


def drop_db(engine_override: Engine | None = None) -> None:
    """Drop all tables in the target database (testing only)."""
    from app.models.base import Base
    target_engine = engine_override or engine
    Base.metadata.drop_all(bind=target_engine)
