"""Pytest root configuration, path setup, and shared test fixtures."""

import sys
import importlib.util
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Dict, Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

MEASUREMENT_PATH = PROJECT_ROOT / "packages" / "measurement"
PROCEDURES_PATH = PROJECT_ROOT / "packages" / "verification-procedures"
FEES_PATH = PROJECT_ROOT / "packages" / "verification-fees"
PAYMENTS_PATH = PROJECT_ROOT / "packages" / "verification-payments"
CERTIFICATES_PATH = PROJECT_ROOT / "packages" / "verification-certificates"
REMINDERS_PATH = PROJECT_ROOT / "packages" / "verification-reminders"
API_PATH = PROJECT_ROOT / "apps" / "verification-api"

for p in (MEASUREMENT_PATH, PROCEDURES_PATH, FEES_PATH, PAYMENTS_PATH, CERTIFICATES_PATH, REMINDERS_PATH, API_PATH):
    if p.exists() and str(p) not in sys.path:
        sys.path.insert(0, str(p))

# Dynamically alias all hyphenated packages
def _load_hyphenated_pkgs():
    pkg_map = {
        "verification_procedures": PROCEDURES_PATH,
        "verification_fees": FEES_PATH,
        "verification_payments": PAYMENTS_PATH,
        "verification_certificates": CERTIFICATES_PATH,
        "verification_reminders": REMINDERS_PATH,
    }
    for mod_name, pkg_path in pkg_map.items():
        init_path = pkg_path / "__init__.py"
        if init_path.exists():
            spec = importlib.util.spec_from_file_location(
                mod_name,
                str(init_path),
                submodule_search_locations=[str(pkg_path)],
            )
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                sys.modules[mod_name] = mod
                sys.modules[f"packages.{mod_name}"] = mod
                spec.loader.exec_module(mod)

_load_hyphenated_pkgs()

# Import application components
from app.core.auth import create_access_token
from app.database import get_db
from app.main import app
from app.models.base import Base
from app.models.instrument import AccuracyClassEnum, InstrumentModel
from app.models.reference_standard import (
    CustodianTypeEnum,
    ReferenceStandard,
    ReferenceStandardStatusEnum,
)
from app.models.stakeholder import (
    Facility,
    LMOProfile,
    RoleEnum,
    Stakeholder,
    StakeholderTypeEnum,
    User,
)
from app.models.tenant import Jurisdiction, JurisdictionLevelEnum, Tenant, TenantStateEnum


from sqlalchemy.pool import StaticPool

@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Create fresh in-memory SQLite database session for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, future=True
    )
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """FastAPI TestClient wired to the test database session."""
    def _override_get_db():
        try:
            yield db_session
            db_session.commit()
        except Exception:
            db_session.rollback()
            raise

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()




@pytest.fixture
def auth_headers():
    """Factory helper generating JWT Authorization Bearer headers for various roles."""
    def _make_headers(
        user_id: str = "user_officer_01",
        tenant_id: str = "IN-DL",
        role: RoleEnum = RoleEnum.LMO,
        jurisdiction_id: str = "DL-NORTH",
    ) -> Dict[str, str]:
        token = create_access_token(
            data={
                "sub": user_id,
                "tenant_id": tenant_id,
                "role": role.value if isinstance(role, RoleEnum) else str(role),
                "jurisdiction_id": jurisdiction_id,
                "email": f"{user_id}@{tenant_id.lower()}.gov.in",
                "full_name": f"Officer {user_id}",
            }
        )
        return {"Authorization": f"Bearer {token}"}

    return _make_headers


@pytest.fixture
def seed_data(db_session: Session) -> dict:
    """Seed base master data for testing (Tenants, Jurisdictions, Users, Standards, Models)."""
    # 1. Tenants
    tenant_dl = Tenant(
        tenant_id="IN-DL",
        state_code="DL",
        state_name="NCT of Delhi",
        status=TenantStateEnum.ACTIVE,
        config={"currency": "INR"},
    )
    tenant_mh = Tenant(
        tenant_id="IN-MH",
        state_code="MH",
        state_name="Maharashtra",
        status=TenantStateEnum.ACTIVE,
        config={"currency": "INR"},
    )
    db_session.add_all([tenant_dl, tenant_mh])
    db_session.flush()

    # 2. Jurisdictions
    jur_north = Jurisdiction(
        jurisdiction_id="DL-NORTH",
        tenant_id="IN-DL",
        name="North Delhi District",
        code="DL-01-NORTH",
        level=JurisdictionLevelEnum.DISTRICT,
    )
    jur_south = Jurisdiction(
        jurisdiction_id="DL-SOUTH",
        tenant_id="IN-DL",
        name="South Delhi District",
        code="DL-02-SOUTH",
        level=JurisdictionLevelEnum.DISTRICT,
    )
    jur_mh_mumbai = Jurisdiction(
        jurisdiction_id="MH-MUMBAI",
        tenant_id="IN-MH",
        name="Mumbai District",
        code="MH-01-MUMBAI",
        level=JurisdictionLevelEnum.DISTRICT,
    )
    db_session.add_all([jur_north, jur_south, jur_mh_mumbai])
    db_session.flush()

    # 3. Users & LMO Profiles
    lmo_user = User(
        user_id="lmo_dl_01",
        tenant_id="IN-DL",
        email="lmo.north@delhi.gov.in",
        full_name="Rajesh Sharma, LMO",
        role=RoleEnum.LMO,
        is_active=True,
    )
    owner_user = User(
        user_id="owner_user_01",
        tenant_id="IN-DL",
        email="trader.delhi@example.com",
        full_name="Kishore Trader",
        role=RoleEnum.OWNER,
        is_active=True,
    )
    supervisor_user = User(
        user_id="supervisor_dl_01",
        tenant_id="IN-DL",
        email="supervisor@delhi.gov.in",
        full_name="Sunil Verma, Dy. Controller",
        role=RoleEnum.SUPERVISOR,
        is_active=True,
    )
    db_session.add_all([lmo_user, owner_user, supervisor_user])
    db_session.flush()

    lmo_profile = LMOProfile(
        user_id="lmo_dl_01",
        tenant_id="IN-DL",
        jurisdiction_id="DL-NORTH",
        designation="Inspector / Legal Metrology Officer",
        posting_order_number="ORD/DL/2025/891",
        authorized_from=datetime.now(timezone.utc) - timedelta(days=100),
        is_active=True,
    )
    db_session.add(lmo_profile)
    db_session.flush()

    # 4. Stakeholder & Facility
    stakeholder = Stakeholder(
        stakeholder_id="stk_trader_01",
        tenant_id="IN-DL",
        jurisdiction_id="DL-NORTH",
        legal_name="Kishore Retail Enterprises Pvt Ltd",
        trade_name="Kishore Supermarket",
        stakeholder_type=StakeholderTypeEnum.OWNER_USER,
        email="kishore@retail.in",
        phone="+919811000000",
        address_line1="Shop 4, Market Complex",
        city="Delhi",
        pincode="110001",
    )
    db_session.add(stakeholder)
    db_session.flush()

    facility = Facility(
        facility_id="fac_retail_01",
        tenant_id="IN-DL",
        stakeholder_id="stk_trader_01",
        facility_name="Kishore Supermarket Branch 1",
        address_line="Main Road, North Delhi",
        district="North Delhi",
        pincode="110001",
    )
    db_session.add(facility)
    db_session.flush()

    # 5. Approved NAWI Model Pattern
    model = InstrumentModel(
        model_id="mod_nawi_class3_15kg",
        category="NAWI",
        subtype="COUNTER_MACHINE_ELECTRONIC",
        manufacturer_name="National Scales Ltd",
        model_name="NS-15-DIGITAL",
        model_approval_number="IND/09/2024/491",
        accuracy_class=AccuracyClassEnum.CLASS_III,
        verification_scale_interval_e=Decimal("0.005000"),
        scale_interval_unit="kg",
        min_capacity=Decimal("0.100000"),
        max_capacity=Decimal("15.000000"),
        capacity_unit="kg",
        number_of_intervals_n=3000,
        specifications={"dual_display": True, "pole_mount": True},
        is_active=True,
    )
    db_session.add(model)
    db_session.flush()

    # 6. Reference Standard Test Weights (Class M1)
    now_utc = datetime.now(timezone.utc)
    std_weight_5kg = ReferenceStandard(
        standard_id="std_m1_5kg_01",
        tenant_id="IN-DL",
        custodian_type=CustodianTypeEnum.LMO_OFFICE,
        custodian_id="DL-NORTH",
        asset_tag="STD-M1-5KG-001",
        denomination_mass=Decimal("5.000000"),
        mass_unit="kg",
        accuracy_class="M1",
        serial_number="M1-5K-9901",
        calibration_certificate_number="CAL/NPL/2026/0411",
        calibrating_laboratory="National Physical Laboratory (NPL India)",
        calibrated_at=now_utc - timedelta(days=60),
        valid_until=now_utc + timedelta(days=300),
        expanded_uncertainty=Decimal("0.000025"),
        calibration_status=ReferenceStandardStatusEnum.ACTIVE,
    )
    std_weight_10kg = ReferenceStandard(
        standard_id="std_m1_10kg_01",
        tenant_id="IN-DL",
        custodian_type=CustodianTypeEnum.LMO_OFFICE,
        custodian_id="DL-NORTH",
        asset_tag="STD-M1-10KG-001",
        denomination_mass=Decimal("10.000000"),
        mass_unit="kg",
        accuracy_class="M1",
        serial_number="M1-10K-9902",
        calibration_certificate_number="CAL/NPL/2026/0412",
        calibrating_laboratory="National Physical Laboratory (NPL India)",
        calibrated_at=now_utc - timedelta(days=60),
        valid_until=now_utc + timedelta(days=300),
        expanded_uncertainty=Decimal("0.000050"),
        calibration_status=ReferenceStandardStatusEnum.ACTIVE,
    )
    db_session.add_all([std_weight_5kg, std_weight_10kg])
    db_session.commit()

    return {
        "tenant_id": "IN-DL",
        "tenant_mh_id": "IN-MH",
        "jurisdiction_id": "DL-NORTH",
        "jurisdiction_south_id": "DL-SOUTH",
        "lmo_user_id": "lmo_dl_01",
        "owner_user_id": "owner_user_01",
        "supervisor_user_id": "supervisor_dl_01",
        "stakeholder_id": "stk_trader_01",
        "facility_id": "fac_retail_01",
        "model_id": "mod_nawi_class3_15kg",
        "standard_ids": ["std_m1_5kg_01", "std_m1_10kg_01"],
    }
