"""Payment Engine and Statutory Settlement Package.

Provides 6-state lifecycle state machine, mock payment gateway integration,
HMAC-SHA256 signature webhook verification, idempotency management, and receipt generation.
"""

from .errors import (
    PaymentEngineError,
    IllegalPaymentStateTransitionError,
    InvalidWebhookSignatureError,
    WebhookReplayError,
    IdempotencyConflictError,
    DuplicatePaymentError,
    PaymentNotFoundError,
    PaymentGatewayError,
)
from .gateway import MockPaymentGateway
from .idempotency import IdempotencyManager, default_idempotency_manager
from .models import (
    PaymentIntentRequest,
    PaymentIntentResponse,
    PaymentLifecycleState,
    PaymentMethodEnum,
    StatutoryReceipt,
    WebhookPayload,
)
from .receipt import StatutoryReceiptGenerator
from .state_machine import PaymentStateMachine
from .webhook import (
    DEFAULT_TOLERANCE_SECONDS,
    DEFAULT_WEBHOOK_SECRET,
    WebhookVerifier,
    compute_webhook_signature,
    parse_signature_header,
)

__all__ = [
    "PaymentEngineError",
    "IllegalPaymentStateTransitionError",
    "InvalidWebhookSignatureError",
    "WebhookReplayError",
    "IdempotencyConflictError",
    "DuplicatePaymentError",
    "PaymentNotFoundError",
    "PaymentGatewayError",
    "MockPaymentGateway",
    "IdempotencyManager",
    "default_idempotency_manager",
    "PaymentIntentRequest",
    "PaymentIntentResponse",
    "PaymentLifecycleState",
    "PaymentMethodEnum",
    "StatutoryReceipt",
    "WebhookPayload",
    "StatutoryReceiptGenerator",
    "PaymentStateMachine",
    "WebhookVerifier",
    "compute_webhook_signature",
    "parse_signature_header",
    "DEFAULT_WEBHOOK_SECRET",
    "DEFAULT_TOLERANCE_SECONDS",
]
