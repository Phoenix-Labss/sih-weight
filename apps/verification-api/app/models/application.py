"""Verification Application and Statutory Fee Assessment models.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.base import (
    Base,
    CurrencyDecimal,
    TenantMixin,
    TimestampMixin,
    generate_uuid,
)


class ApplicationStatusEnum(str, Enum):
    """Statutory verification application workflow states."""
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_SCRUTINY = "UNDER_SCRUTINY"
    QUERY_RAISED = "QUERY_RAISED"
    CORRECTION_SUBMITTED = "CORRECTION_SUBMITTED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"
    FEE_PENDING = "FEE_PENDING"
    FEE_PAID = "FEE_PAID"
    SCHEDULED = "SCHEDULED"
    VERIFICATION_IN_PROGRESS = "VERIFICATION_IN_PROGRESS"
    COMPLETED = "COMPLETED"


class ApplicationTypeEnum(str, Enum):
    """Type of legal metrology verification requested."""
    INITIAL_VERIFICATION = "INITIAL_VERIFICATION"
    RE_VERIFICATION = "RE_VERIFICATION"
    AFTER_REPAIR_VERIFICATION = "AFTER_REPAIR_VERIFICATION"
    VOLUNTARY_VERIFICATION = "VOLUNTARY_VERIFICATION"


class ServiceModeEnum(str, Enum):
    """Location / service delivery channel for statutory verification."""
    ON_SITE = "ON_SITE"
    DEPARTMENTAL_LAB = "DEPARTMENTAL_LAB"
    GATC_CENTRE = "GATC_CENTRE"


class PaymentStatusEnum(str, Enum):
    """Treasury / payment gateway transaction status."""
    PENDING = "PENDING"
    INITIATED = "INITIATED"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    WAIVED = "WAIVED"


class FeeAssessment(Base, TimestampMixin, TenantMixin):
    """Itemized statutory verification fee quote and payment reconciliation ledger."""

    __tablename__ = "fee_assessments"

    fee_assessment_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    policy_version = Column(String(50), nullable=False)  # Pinned statutory fee schedule version
    base_verification_fee = Column(CurrencyDecimal, nullable=False)
    user_charge = Column(CurrencyDecimal, default=0.00, nullable=False)
    late_fee = Column(CurrencyDecimal, default=0.00, nullable=False)
    total_assessed_amount = Column(CurrencyDecimal, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    payment_status = Column(
        SQLEnum(PaymentStatusEnum, name="payment_status_enum", native_enum=False),
        default=PaymentStatusEnum.PENDING,
        nullable=False,
        index=True,
    )
    payment_gateway_ref = Column(String(100), nullable=True)
    treasury_challan_number = Column(String(100), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    receipt_number = Column(String(100), unique=True, nullable=True, index=True)

    # Relationships
    tenant = relationship("Tenant")
    applications = relationship("VerificationApplication", back_populates="fee_assessment")


class VerificationApplication(Base, TimestampMixin, TenantMixin):
    """Formal statutory application for instrument initial or periodic re-verification."""

    __tablename__ = "verification_applications"

    application_id = Column(String(36), primary_key=True, default=generate_uuid)
    application_number = Column(String(50), unique=True, nullable=False, index=True)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    jurisdiction_id = Column(String(36), ForeignKey("jurisdictions.jurisdiction_id", ondelete="RESTRICT"), nullable=False, index=True)
    instrument_id = Column(String(36), ForeignKey("instruments.instrument_id", ondelete="RESTRICT"), nullable=False, index=True)
    applicant_id = Column(String(36), ForeignKey("stakeholders.stakeholder_id", ondelete="RESTRICT"), nullable=False, index=True)
    application_type = Column(
        SQLEnum(ApplicationTypeEnum, name="application_type_enum", native_enum=False),
        nullable=False,
    )
    service_mode = Column(
        SQLEnum(ServiceModeEnum, name="service_mode_enum", native_enum=False),
        nullable=False,
    )
    preferred_verification_date = Column(Date, nullable=True)
    scheduled_slot_start = Column(DateTime(timezone=True), nullable=True)
    scheduled_slot_end = Column(DateTime(timezone=True), nullable=True)
    assigned_lmo_id = Column(String(36), ForeignKey("lmo_profiles.user_id", ondelete="RESTRICT"), nullable=True, index=True)
    assigned_gatc_id = Column(String(36), ForeignKey("gatc_profiles.gatc_id", ondelete="RESTRICT"), nullable=True, index=True)
    fee_assessment_id = Column(String(36), ForeignKey("fee_assessments.fee_assessment_id", ondelete="RESTRICT"), nullable=True, index=True)
    current_status = Column(
        SQLEnum(ApplicationStatusEnum, name="application_status_enum", native_enum=False),
        default=ApplicationStatusEnum.DRAFT,
        nullable=False,
        index=True,
    )
    scrutiny_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    active_query = Column(Text, nullable=True)
    query_raised_at = Column(DateTime(timezone=True), nullable=True)
    applicant_declaration_accepted = Column(Boolean, default=False, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="applications")
    jurisdiction = relationship("Jurisdiction")
    instrument = relationship("Instrument", back_populates="applications")
    applicant = relationship("Stakeholder", back_populates="applications")
    fee_assessment = relationship("FeeAssessment", back_populates="applications")
    assigned_lmo = relationship("LMOProfile", foreign_keys=[assigned_lmo_id])
    assigned_gatc = relationship("GATCProfile", foreign_keys=[assigned_gatc_id])
    sessions = relationship("VerificationSession", back_populates="application")
