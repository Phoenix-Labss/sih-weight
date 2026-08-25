"""Pydantic v2 schemas for Payment Initiation, Webhooks, Reconciliation, and Receipts.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import ConfigDict, Field

from app.models.payment import PaymentLifecycleEnum
from app.schemas.common import BaseSchema


class PaymentInitiateRequest(BaseSchema):
    """Initiate payment checkout for an assessed application."""
    model_config = ConfigDict(extra="forbid")

    application_id: str = Field(..., min_length=1, max_length=36, description="Verification application ID")
    payment_method: str = Field(default="ONLINE_GATEWAY", description="Settlement channel e.g. ONLINE_GATEWAY, UPI, NET_BANKING")
    idempotency_key: Optional[str] = Field(default=None, max_length=100, description="Optional unique client idempotency key")


class PaymentInitiateResponse(BaseSchema):
    """Checkout intent session details."""
    payment_id: str
    application_id: str
    fee_assessment_id: str
    idempotency_key: str
    amount: Decimal
    currency: str
    status: PaymentLifecycleEnum
    checkout_url: str
    gateway_order_id: str
    gateway_session_token: str
    created_at: datetime
    expires_at: datetime


class PaymentWebhookPayload(BaseSchema):
    """Incoming signed payment gateway webhook notification."""
    model_config = ConfigDict(extra="ignore")

    event_id: str
    event_type: str
    payment_id: str
    gateway_transaction_id: str
    amount: Decimal
    currency: str = "INR"
    status: str
    failure_reason: Optional[str] = None
    timestamp: int
    signature: Optional[str] = None


class MockCompletePaymentRequest(BaseSchema):
    """Simulate gateway payment completion in test/demo environment."""
    model_config = ConfigDict(extra="forbid")

    payment_id: str = Field(..., min_length=1, max_length=36)
    status: str = Field(default="SUCCESS", description="'SUCCESS' or 'FAILED'")
    failure_reason: Optional[str] = None


class PaymentTransactionResponse(BaseSchema):
    """Payment transaction details."""
    payment_id: str
    tenant_id: str
    application_id: str
    fee_assessment_id: str
    idempotency_key: str
    gateway_provider: str
    gateway_transaction_id: Optional[str] = None
    amount: Decimal
    currency: str
    status: PaymentLifecycleEnum
    payment_method: str
    receipt_number: Optional[str] = None
    payer_id: str
    payer_name: str
    failure_reason: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class StatutoryReceiptResponse(BaseSchema):
    """Official itemized statutory fee receipt."""
    receipt_number: str
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
    digital_verification_hash: str
