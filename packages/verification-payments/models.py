"""Data models and schemas for payment lifecycle and statutory receipts.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class PaymentLifecycleState(str, Enum):
    """Explicit 6-state payment lifecycle state machine."""
    CREATED = "CREATED"
    PENDING = "PENDING"
    AUTHORIZED = "AUTHORIZED"
    RECONCILED = "RECONCILED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class PaymentMethodEnum(str, Enum):
    """Payment settlement methods."""
    ONLINE_GATEWAY = "ONLINE_GATEWAY"
    UPI = "UPI"
    NET_BANKING = "NET_BANKING"
    DEBIT_CARD = "DEBIT_CARD"
    CREDIT_CARD = "CREDIT_CARD"
    TREASURY_CHALLAN = "TREASURY_CHALLAN"


class PaymentIntentRequest(BaseModel):
    """Request payload to initiate statutory fee checkout."""
    model_config = ConfigDict(extra="forbid")

    tenant_id: str = Field(..., min_length=1, max_length=36)
    application_id: str = Field(..., min_length=1, max_length=36)
    fee_assessment_id: str = Field(..., min_length=1, max_length=36)
    amount: Decimal = Field(..., gt=0, description="Amount payable in INR")
    currency: str = Field(default="INR", max_length=10)
    payer_id: str = Field(..., min_length=1, max_length=36)
    payer_name: str = Field(default="Applicant", max_length=100)
    payer_email: Optional[str] = Field(default=None, max_length=100)
    payment_method: str = Field(default="ONLINE_GATEWAY")
    idempotency_key: Optional[str] = Field(default=None, max_length=100)


class PaymentIntentResponse(BaseModel):
    """Response returned upon payment intent creation."""
    model_config = ConfigDict(frozen=True)

    payment_id: str
    application_id: str
    fee_assessment_id: str
    idempotency_key: str
    amount: Decimal
    currency: str
    status: PaymentLifecycleState
    checkout_url: str
    gateway_order_id: str
    gateway_session_token: str
    created_at: datetime
    expires_at: datetime


class WebhookPayload(BaseModel):
    """Gateway webhook notification payload."""
    model_config = ConfigDict(extra="ignore")

    event_id: str = Field(..., description="Unique event notification ID")
    event_type: str = Field(..., description="e.g. payment.authorized, payment.failed")
    payment_id: str = Field(..., description="Internal payment transaction ID")
    gateway_transaction_id: str = Field(..., description="Gateway external transaction ref")
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="INR")
    status: str = Field(..., description="'SUCCESS' or 'FAILED'")
    failure_reason: Optional[str] = None
    timestamp: int = Field(..., description="Unix epoch timestamp in seconds")
    signature: Optional[str] = None


class StatutoryReceipt(BaseModel):
    """Official Itemized Statutory Verification Fee Receipt."""
    model_config = ConfigDict(frozen=True)

    receipt_number: str = Field(..., description="Unique receipt number e.g. REC-20260823-A8F19C")
    payment_id: str
    application_id: str
    application_number: Optional[str] = None
    tenant_id: str
    payer_name: str
    amount: Decimal
    currency: str = "INR"
    payment_method: str
    gateway_reference: str
    paid_at: datetime
    itemized_breakdown: List[Dict[str, Any]] = Field(default_factory=list)
    digital_verification_hash: str = Field(..., description="SHA-256 integrity digest")
