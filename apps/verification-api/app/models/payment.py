"""SQLAlchemy declarative model for Payment Transactions.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import (
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
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


class PaymentLifecycleEnum(str, Enum):
    """Payment transaction states."""
    CREATED = "CREATED"
    PENDING = "PENDING"
    AUTHORIZED = "AUTHORIZED"
    RECONCILED = "RECONCILED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class PaymentTransaction(Base, TimestampMixin, TenantMixin):
    """Payment intent, authorization, and reconciliation transaction record."""

    __tablename__ = "payment_transactions"

    payment_id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id", ondelete="RESTRICT"), nullable=False, index=True)
    application_id = Column(String(36), ForeignKey("verification_applications.application_id", ondelete="RESTRICT"), nullable=False, index=True)
    fee_assessment_id = Column(String(36), ForeignKey("fee_assessments.fee_assessment_id", ondelete="RESTRICT"), nullable=False, index=True)
    idempotency_key = Column(String(100), unique=True, nullable=False, index=True)
    gateway_provider = Column(String(50), default="MOCK_TREASURY_GATEWAY", nullable=False)
    gateway_transaction_id = Column(String(100), nullable=True, index=True)
    amount = Column(CurrencyDecimal, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    status = Column(
        SQLEnum(PaymentLifecycleEnum, name="payment_lifecycle_enum", native_enum=False),
        default=PaymentLifecycleEnum.PENDING,
        nullable=False,
        index=True,
    )
    payment_method = Column(String(50), default="ONLINE_GATEWAY", nullable=False)
    receipt_number = Column(String(100), unique=True, nullable=True, index=True)
    payer_id = Column(String(36), nullable=False)
    payer_name = Column(String(100), default="Applicant", nullable=False)
    signature_payload = Column(Text, nullable=True)
    failure_reason = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    application = relationship("VerificationApplication")
    fee_assessment = relationship("FeeAssessment")
