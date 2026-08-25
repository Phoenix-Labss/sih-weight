"""Compatibility alias re-exporting domain errors and exceptions from app.core.errors.
"""

from app.core.errors import (
    APIError,
    ConflictError,
    ForbiddenError,
    GuardConditionFailedError,
    ImmutableEntityModificationError,
    InvalidStateTransitionError,
    NotFoundError,
    PreconditionFailedError,
    StateMachineError,
    UnauthorizedError,
    UnauthorizedTransitionError,
    UnprocessableError,
)

__all__ = [
    "APIError",
    "ConflictError",
    "ForbiddenError",
    "GuardConditionFailedError",
    "ImmutableEntityModificationError",
    "InvalidStateTransitionError",
    "NotFoundError",
    "PreconditionFailedError",
    "StateMachineError",
    "UnauthorizedError",
    "UnauthorizedTransitionError",
    "UnprocessableError",
]
