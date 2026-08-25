"""Core security, authentication, state machines, and cryptographic utilities.
"""

from app.core.auth import UserContext, create_access_token, decode_access_token, get_current_user, get_optional_user
from app.core.crypto import (
    DigitalSignatureAdapter,
    DigitalSignatureResult,
    Ed25519SignatureAdapter,
    MockCryptoSignatureAdapter,
    SignerContext,
    calculate_sha256_hex,
    canonical_json_bytes,
    default_signature_adapter,
    generate_high_entropy_token,
)
from app.core.errors import (
    APIError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    UnprocessableError,
    register_exception_handlers,
)
from app.core.permissions import require_roles, verify_jurisdiction_access, verify_tenant_access
from app.core.state_machines import (
    ApplicationStateMachine,
    CertificateStateMachine,
    GuardConditionFailedError,
    ImmutableEntityModificationError,
    InvalidStateTransitionError,
    StateMachineError,
    UnauthorizedTransitionError,
    VerificationSessionStateMachine,
)

__all__ = [
    "UserContext",
    "create_access_token",
    "decode_access_token",
    "get_current_user",
    "get_optional_user",
    "verify_tenant_access",
    "verify_jurisdiction_access",
    "require_roles",
    "canonical_json_bytes",
    "calculate_sha256_hex",
    "generate_high_entropy_token",
    "SignerContext",
    "DigitalSignatureResult",
    "DigitalSignatureAdapter",
    "MockCryptoSignatureAdapter",
    "Ed25519SignatureAdapter",
    "default_signature_adapter",
    "APIError",
    "NotFoundError",
    "UnauthorizedError",
    "ForbiddenError",
    "ConflictError",
    "UnprocessableError",
    "register_exception_handlers",
    "ApplicationStateMachine",
    "VerificationSessionStateMachine",
    "CertificateStateMachine",
    "StateMachineError",
    "InvalidStateTransitionError",
    "UnauthorizedTransitionError",
    "GuardConditionFailedError",
    "ImmutableEntityModificationError",
]
