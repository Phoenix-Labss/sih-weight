"""Payment Gateway, Webhooks, Reconciliation, and Statutory Receipts API Endpoints.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.database import get_db
from app.schemas.payment import (
    MockCompletePaymentRequest,
    PaymentInitiateRequest,
    PaymentInitiateResponse,
    PaymentTransactionResponse,
    StatutoryReceiptResponse,
)
from app.services.payment_service import PaymentService

router = APIRouter(tags=["Payments"])


@router.post(
    "/payments/initiate",
    response_model=PaymentInitiateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate payment checkout session",
)
def initiate_payment(
    payload: PaymentInitiateRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> PaymentInitiateResponse:
    """Initiate payment checkout session for an assessed application with idempotency protection."""
    return PaymentService.initiate_payment(db, payload, current_user)


@router.post(
    "/tenants/{tenant_id}/payments/initiate",
    response_model=PaymentInitiateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate payment checkout under tenant",
)
def initiate_tenant_payment(
    tenant_id: str,
    payload: PaymentInitiateRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> PaymentInitiateResponse:
    """Initiate payment checkout within tenant scope."""
    return PaymentService.initiate_payment(db, payload, current_user)


@router.post(
    "/payments/webhook",
    response_model=PaymentTransactionResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify and process gateway webhook callback",
)
async def payment_gateway_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_gateway_signature: Optional[str] = Header(None, alias="X-Gateway-Signature"),
    signature: Optional[str] = Header(None, alias="Signature"),
) -> PaymentTransactionResponse:
    """Process cryptographic signed payment gateway webhook notification."""
    sig_header = x_gateway_signature or signature
    raw_body = (await request.body()).decode("utf-8")
    return PaymentService.process_webhook(db, raw_body, signature_header=sig_header)


@router.post(
    "/payments/mock-complete",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Simulate payment authorization in test/demo environments",
)
def mock_complete_payment(
    payload: MockCompletePaymentRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> Dict[str, Any]:
    """Test/demo endpoint to simulate gateway payment completion and trigger signed webhook processing."""
    return PaymentService.mock_complete_payment(db, payload, current_user)


@router.post(
    "/tenants/{tenant_id}/payments/mock-complete",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Simulate payment completion under tenant",
)
def mock_complete_tenant_payment(
    tenant_id: str,
    payload: MockCompletePaymentRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> Dict[str, Any]:
    """Simulate payment completion within tenant scope."""
    return PaymentService.mock_complete_payment(db, payload, current_user)


@router.get(
    "/payments/{payment_id}",
    response_model=PaymentTransactionResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch payment transaction status",
)
def get_payment_details(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> PaymentTransactionResponse:
    """Fetch payment transaction details and status."""
    return PaymentService.get_payment(db, payment_id, current_user)


@router.get(
    "/tenants/{tenant_id}/payments/{payment_id}",
    response_model=PaymentTransactionResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch payment transaction details under tenant",
)
def get_tenant_payment_details(
    tenant_id: str,
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> PaymentTransactionResponse:
    """Fetch payment details within tenant scope."""
    return PaymentService.get_payment(db, payment_id, current_user)


@router.get(
    "/payments/receipt/{receipt_id}",
    response_model=StatutoryReceiptResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch itemized statutory receipt",
)
def get_statutory_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> StatutoryReceiptResponse:
    """Fetch official itemized statutory receipt by receipt number or payment ID."""
    return PaymentService.get_receipt(db, receipt_id, current_user)


@router.get(
    "/tenants/{tenant_id}/payments/receipt/{receipt_id}",
    response_model=StatutoryReceiptResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch statutory receipt under tenant",
)
def get_tenant_statutory_receipt(
    tenant_id: str,
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> StatutoryReceiptResponse:
    """Fetch statutory receipt within tenant scope."""
    return PaymentService.get_receipt(db, receipt_id, current_user)
