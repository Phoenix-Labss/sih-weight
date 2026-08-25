"""Payment engine error hierarchy.
"""

class PaymentEngineError(Exception):
    """Base exception for payment and reconciliation errors."""
    pass


class IllegalPaymentStateTransitionError(PaymentEngineError):
    """Raised when an illegal payment state transition is attempted."""
    pass


class InvalidWebhookSignatureError(PaymentEngineError):
    """Raised when payment gateway webhook signature does not match or is forged."""
    pass


class WebhookReplayError(PaymentEngineError):
    """Raised when webhook timestamp is outside allowed anti-replay tolerance window."""
    pass


class IdempotencyConflictError(PaymentEngineError):
    """Raised when a concurrent request with the same idempotency key is in progress."""
    pass


class DuplicatePaymentError(PaymentEngineError):
    """Raised when attempting to pay an already settled/paid fee assessment."""
    pass


class PaymentNotFoundError(PaymentEngineError):
    """Raised when a payment transaction is not found."""
    pass


class PaymentGatewayError(PaymentEngineError):
    """Raised when the payment gateway rejects an operation."""
    pass
