"""Mock Payment Gateway Integration & Simulator.

Simulates state treasury / online payment gateway checkout intent creation
and signed webhook event dispatch.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple

from .models import PaymentIntentRequest, PaymentIntentResponse, PaymentLifecycleState, WebhookPayload
from .webhook import DEFAULT_WEBHOOK_SECRET, compute_webhook_signature


class MockPaymentGateway:
    """Mock Gateway simulating Treasury / NetBanking / UPI gateway integrations."""

    def __init__(self, secret: str = DEFAULT_WEBHOOK_SECRET, base_checkout_url: str = "https://gateway.mock.gov.in/checkout"):
        self.secret = secret
        self.base_checkout_url = base_checkout_url

    def create_checkout_session(self, request: PaymentIntentRequest, payment_id: str, idempotency_key: str) -> PaymentIntentResponse:
        """Create a mock checkout session and gateway order."""
        short_id = uuid.uuid4().hex[:10].upper()
        gateway_order_id = f"ORDER-MOCK-{short_id}"
        gateway_session_token = f"tok_mock_{uuid.uuid4().hex}"
        checkout_url = f"{self.base_checkout_url}/{gateway_order_id}?session={gateway_session_token}"
        now_utc = datetime.now(timezone.utc)
        expires_at = now_utc + timedelta(minutes=15)

        return PaymentIntentResponse(
            payment_id=payment_id,
            application_id=request.application_id,
            fee_assessment_id=request.fee_assessment_id,
            idempotency_key=idempotency_key,
            amount=request.amount,
            currency=request.currency,
            status=PaymentLifecycleState.PENDING,
            checkout_url=checkout_url,
            gateway_order_id=gateway_order_id,
            gateway_session_token=gateway_session_token,
            created_at=now_utc,
            expires_at=expires_at,
        )

    def simulate_webhook_event(
        self,
        payment_id: str,
        amount: Decimal,
        status: str = "SUCCESS",
        failure_reason: Optional[str] = None,
        custom_timestamp: Optional[int] = None,
    ) -> Tuple[Dict[str, Any], str, str]:
        """Generate a simulated, cryptographically signed gateway webhook callback.

        Returns:
            Tuple of (payload_dict, raw_json_str, signature_header)
        """
        ts = custom_timestamp if custom_timestamp is not None else int(time.time())
        event_id = f"EVT-MOCK-{uuid.uuid4().hex[:12].upper()}"
        gateway_txn_id = f"TXN-MOCK-{uuid.uuid4().hex[:12].upper()}"

        payload_dict: Dict[str, Any] = {
            "event_id": event_id,
            "event_type": "payment.authorized" if status.upper() == "SUCCESS" else "payment.failed",
            "payment_id": payment_id,
            "gateway_transaction_id": gateway_txn_id,
            "amount": str(amount),
            "currency": "INR",
            "status": status.upper(),
            "failure_reason": failure_reason,
            "timestamp": ts,
        }

        canonical_body = json.dumps(payload_dict, sort_keys=True, separators=(",", ":"))
        sig = compute_webhook_signature(self.secret, ts, canonical_body)
        payload_dict["signature"] = sig
        raw_json_str = json.dumps(payload_dict)
        signature_header = f"t={ts},v1={sig}"

        return payload_dict, raw_json_str, signature_header
