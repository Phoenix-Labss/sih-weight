"""Tenant and Jurisdiction models for multi-tenant isolation and administrative hierarchy.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    Column,
    Enum as SQLEnum,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import (
    Base,
    JSONType,
    TenantMixin,
    TimestampMixin,
    generate_uuid,
)


class TenantStateEnum(str, Enum):
    """Tenant administrative status."""
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    MAINTENANCE = "MAINTENANCE"


class JurisdictionLevelEnum(str, Enum):
    """Hierarchical level of Legal Metrology departmental jurisdiction."""
    ZONE = "ZONE"
    REGION = "REGION"
    DISTRICT = "DISTRICT"
    OFFICE = "OFFICE"
    SUB_OFFICE = "SUB_OFFICE"


class Tenant(Base, TimestampMixin):
    """State / Union Territory multi-tenant root entity."""

    __tablename__ = "tenants"

    tenant_id = Column(String(36), primary_key=True, default=generate_uuid)
    state_code = Column(String(10), unique=True, nullable=False, index=True)
    state_name = Column(String(100), nullable=False)
    status = Column(
        SQLEnum(TenantStateEnum, name="tenant_state_enum", native_enum=False),
        default=TenantStateEnum.ACTIVE,
        nullable=False,
    )
    config = Column(JSONType, default=dict, nullable=False)

    # Relationships
    jurisdictions = relationship("Jurisdiction", back_populates="tenant", cascade="all, delete-orphan")
    stakeholders = relationship("Stakeholder", back_populates="tenant")
    instruments = relationship("Instrument", back_populates="tenant")
    applications = relationship("VerificationApplication", back_populates="tenant")
    reference_standards = relationship("ReferenceStandard", back_populates="tenant")
    users = relationship("User", back_populates="tenant")


class Jurisdiction(Base, TimestampMixin, TenantMixin):
    """Administrative jurisdiction (District, Zonal Office, Field Office) within a Tenant."""

    __tablename__ = "jurisdictions"

    jurisdiction_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    parent_jurisdiction_id = Column(String(36), ForeignKey("jurisdictions.jurisdiction_id", ondelete="RESTRICT"), nullable=True, index=True)
    name = Column(String(150), nullable=False)
    code = Column(String(50), nullable=False)
    level = Column(
        SQLEnum(JurisdictionLevelEnum, name="jurisdiction_level_enum", native_enum=False),
        nullable=False,
    )
    boundary_geo = Column(JSONType, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_jurisdiction_code"),
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="jurisdictions")
    parent_jurisdiction = relationship("Jurisdiction", remote_side=[jurisdiction_id], backref="sub_jurisdictions")
    stakeholders = relationship("Stakeholder", back_populates="jurisdiction")
    instruments = relationship("Instrument", back_populates="jurisdiction")
    lmo_profiles = relationship("LMOProfile", back_populates="jurisdiction")


class Office(Jurisdiction):
    """Convenience alias/proxy for departmental office level jurisdictions."""
    pass
