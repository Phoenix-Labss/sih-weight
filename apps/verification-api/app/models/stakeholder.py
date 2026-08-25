"""Stakeholder, Facility, User, LMO Profile, GATC Profile, and Delegation models.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Numeric,
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


class RoleEnum(str, Enum):
    """User and authorization roles."""
    OWNER = "OWNER"
    LMO = "LMO"
    GATC_VERIFIER = "GATC_VERIFIER"
    SUPERVISOR = "SUPERVISOR"
    CONTROLLER = "CONTROLLER"
    ADMIN = "ADMIN"
    APPLICANT = "APPLICANT"
    AUDITOR = "AUDITOR"
    PUBLIC_VERIFIER = "PUBLIC_VERIFIER"


class StakeholderTypeEnum(str, Enum):
    """Type of legal entity / person registered as a metrology stakeholder."""
    OWNER_USER = "OWNER_USER"
    MANUFACTURER = "MANUFACTURER"
    DEALER = "DEALER"
    REPAIRER = "REPAIRER"
    GATC_OPERATOR = "GATC_OPERATOR"


class Stakeholder(Base, TimestampMixin, TenantMixin):
    """Legal metrology stakeholder (instrument owner, user, dealer, repairer, manufacturer)."""

    __tablename__ = "stakeholders"

    stakeholder_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    jurisdiction_id = Column(String(36), ForeignKey("jurisdictions.jurisdiction_id", ondelete="RESTRICT"), nullable=False, index=True)
    legal_name = Column(String(255), nullable=False)
    trade_name = Column(String(255), nullable=True)
    stakeholder_type = Column(
        SQLEnum(StakeholderTypeEnum, name="stakeholder_type_enum", native_enum=False),
        nullable=False,
    )
    identifier_type = Column(String(50), nullable=True)  # GSTIN, PAN, CIN, or STATE_REGISTRATION
    identifier_value = Column(String(100), nullable=True)
    email = Column(String(255), nullable=False)
    phone = Column(String(30), nullable=False)
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    pincode = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "identifier_type", "identifier_value", name="uq_tenant_identifier"),
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="stakeholders")
    jurisdiction = relationship("Jurisdiction", back_populates="stakeholders")
    facilities = relationship("Facility", back_populates="stakeholder", cascade="all, delete-orphan")
    instruments = relationship("Instrument", back_populates="owner")
    applications = relationship("VerificationApplication", back_populates="applicant")


class Facility(Base, TimestampMixin, TenantMixin):
    """Physical premises, factory, petrol pump, or retail outlet where instruments are deployed."""

    __tablename__ = "facilities"

    facility_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    stakeholder_id = Column(String(36), ForeignKey("stakeholders.stakeholder_id", ondelete="RESTRICT"), nullable=False, index=True)
    facility_name = Column(String(255), nullable=False)
    address_line = Column(String(255), nullable=False)
    district = Column(String(100), nullable=False)
    pincode = Column(String(20), nullable=False)
    gps_latitude = Column(Numeric(precision=10, scale=7), nullable=True)
    gps_longitude = Column(Numeric(precision=10, scale=7), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    stakeholder = relationship("Stakeholder", back_populates="facilities")
    instruments = relationship("Instrument", back_populates="facility")
    gatc_profiles = relationship("GATCProfile", back_populates="facility")


class User(Base, TimestampMixin, TenantMixin):
    """System user with authentication identity, role, and departmental posting."""

    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    role = Column(
        SQLEnum(RoleEnum, name="user_role_enum", native_enum=False),
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    lmo_profile = relationship("LMOProfile", uselist=False, back_populates="user")
    granted_delegations = relationship("Delegation", foreign_keys="Delegation.granter_user_id", back_populates="granter")
    received_delegations = relationship("Delegation", foreign_keys="Delegation.delegatee_user_id", back_populates="delegatee")


class LMOProfile(Base, TimestampMixin, TenantMixin):
    """Statutory Legal Metrology Officer posting, jurisdiction assignment, and DSC credentials."""

    __tablename__ = "lmo_profiles"

    user_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), primary_key=True)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    jurisdiction_id = Column(String(36), ForeignKey("jurisdictions.jurisdiction_id", ondelete="RESTRICT"), nullable=False, index=True)
    designation = Column(String(100), nullable=False)
    posting_order_number = Column(String(100), nullable=False)
    authorized_from = Column(DateTime(timezone=True), nullable=False)
    authorized_to = Column(DateTime(timezone=True), nullable=True)
    digital_signature_cert_id = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    user = relationship("User", back_populates="lmo_profile")
    jurisdiction = relationship("Jurisdiction", back_populates="lmo_profiles")


class GATCProfile(Base, TimestampMixin, TenantMixin):
    """Government Approved Test Centre accreditation scope, validity, and facility mapping."""

    __tablename__ = "gatc_profiles"

    gatc_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    facility_id = Column(String(36), ForeignKey("facilities.facility_id", ondelete="RESTRICT"), nullable=False, index=True)
    approval_order_number = Column(String(100), nullable=False)
    approved_scope = Column(JSONType, nullable=False, default=dict)  # instrument types, accuracy classes, max capacities
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_to = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(30), default="ACTIVE", nullable=False)

    # Relationships
    facility = relationship("Facility", back_populates="gatc_profiles")


class Delegation(Base, TimestampMixin, TenantMixin):
    """Formal authority delegation from one officer to another within a jurisdiction."""

    __tablename__ = "delegations"

    delegation_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    granter_user_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    delegatee_user_id = Column(String(36), ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    jurisdiction_id = Column(String(36), ForeignKey("jurisdictions.jurisdiction_id", ondelete="RESTRICT"), nullable=False, index=True)
    reason = Column(String(255), nullable=False)
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_to = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    granter = relationship("User", foreign_keys=[granter_user_id], back_populates="granted_delegations")
    delegatee = relationship("User", foreign_keys=[delegatee_user_id], back_populates="received_delegations")
    jurisdiction = relationship("Jurisdiction")
