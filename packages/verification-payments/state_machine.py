"""Explicit 6-State Payment Lifecycle State Machine.

States:
    CREATED -> PENDING -> AUTHORIZED -> RECONCILED / FAILED / REFUNDED

Rejects all unauthorized state jumps, browser-redirect self-authentications,
and invalid terminal state mutations.
"""

from __future__ import annotations

from typing import Dict, Set
from .errors import IllegalPaymentStateTransitionError
from .models import PaymentLifecycleState


class PaymentStateMachine:
    """Deterministic state machine governing statutory payment lifecycle."""

    _ALLOWED_TRANSITIONS: Dict[PaymentLifecycleState, Set[PaymentLifecycleState]] = {
        PaymentLifecycleState.CREATED: {
            PaymentLifecycleState.PENDING,
            PaymentLifecycleState.FAILED,
        },
        PaymentLifecycleState.PENDING: {
            PaymentLifecycleState.AUTHORIZED,
            PaymentLifecycleState.FAILED,
        },
        PaymentLifecycleState.AUTHORIZED: {
            PaymentLifecycleState.RECONCILED,
            PaymentLifecycleState.FAILED,
        },
        PaymentLifecycleState.RECONCILED: {
            PaymentLifecycleState.REFUNDED,
        },
        PaymentLifecycleState.FAILED: set(),    # Terminal state
        PaymentLifecycleState.REFUNDED: set(),  # Terminal state
    }

    @classmethod
    def can_transition(
        cls,
        current_state: PaymentLifecycleState,
        target_state: PaymentLifecycleState,
    ) -> bool:
        """Check if transition from current_state to target_state is permitted."""
        allowed = cls._ALLOWED_TRANSITIONS.get(current_state, set())
        return target_state in allowed

    @classmethod
    def validate_transition(
        cls,
        current_state: PaymentLifecycleState,
        target_state: PaymentLifecycleState,
        payment_id: str = "unknown",
        reason: str = "",
    ) -> None:
        """Validate state transition; raises IllegalPaymentStateTransitionError if illegal."""
        if not cls.can_transition(current_state, target_state):
            msg = (
                f"Illegal payment state transition for payment {payment_id}: "
                f"cannot transition from '{current_state.value}' to '{target_state.value}'."
            )
            if reason:
                msg += f" (Reason: {reason})"
            if current_state in (PaymentLifecycleState.FAILED, PaymentLifecycleState.REFUNDED):
                msg += f" State '{current_state.value}' is terminal and cannot be mutated."
            elif target_state == PaymentLifecycleState.RECONCILED and current_state != PaymentLifecycleState.AUTHORIZED:
                msg += " Payment must be AUTHORIZED by a verified gateway callback before it can be RECONCILED."
            raise IllegalPaymentStateTransitionError(msg)
