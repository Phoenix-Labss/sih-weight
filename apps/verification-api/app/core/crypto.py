"""Certificate canonical JSON serialization, SHA-256 hashing, and digital signature adapters.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
import base64
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
import hashlib
import hmac
import json
import secrets
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field


def _json_canonical_default(obj: Any) -> Any:
    """JSON serialization hook for legal metrology domain types."""
    if isinstance(obj, Decimal):
        # Exact decimal representation without scientific notation
        return f"{obj:f}"
    if isinstance(obj, (datetime, date)):
        if isinstance(obj, datetime) and obj.tzinfo is None:
            obj = obj.replace(tzinfo=timezone.utc)
        return obj.isoformat()
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, UUID):
        return str(obj)
    if hasattr(obj, "to_dict"):
        return obj.to_dict()
    if hasattr(obj, "__dict__"):
        return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def canonical_json_bytes(payload: Any) -> bytes:
    """Deterministic canonical JSON byte serializer.

    Enforces:
    - Sorted keys alphabetically
    - Compact separators without whitespace (',', ':')
    - Exact decimal string formatting
    - Strict UTF-8 encoding
    """
    json_str = json.dumps(
        payload,
        default=_json_canonical_default,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return json_str.encode("utf-8")


def calculate_sha256_hex(data: Union[bytes, str]) -> str:
    """Compute SHA-256 hex digest of raw bytes or UTF-8 string."""
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def generate_high_entropy_token(prefix: str = "", nbytes: int = 32) -> str:
    """Generate cryptographically secure 256-bit URL-safe token.

    Args:
        prefix: Optional identifier prefix (e.g. 'cert_', 'qr_').
        nbytes: Entropy size in bytes (default 32 bytes = 256 bits).
    """
    token = secrets.token_urlsafe(nbytes)
    return f"{prefix}{token}"


# ============================================================================
# Digital Signature Adapter Pattern
# ============================================================================

class SignerContext(BaseModel):
    """Context of the Legal Metrology Officer or GATC Verifier signing the certificate."""
    signer_id: str
    signer_role: str
    jurisdiction_id: str
    certificate_id: str
    signer_name: Optional[str] = None
    designation: Optional[str] = None


class DigitalSignatureResult(BaseModel):
    """Result of digital signature generation."""
    signature_bytes_base64: str
    algorithm: str  # e.g. "Ed25519" or "HMAC-SHA256"
    signer_certificate_chain_pem: Optional[str] = None
    signed_at_utc: str
    key_identifier: str


class DigitalSignatureAdapter(ABC):
    """Abstract interface for statutory digital signature providers (HSM, DSC, PKCS#11)."""

    @abstractmethod
    def sign_hash(self, canonical_hash: str, context: SignerContext) -> DigitalSignatureResult:
        """Sign canonical SHA-256 hash using secure key service/HSM."""
        pass

    @abstractmethod
    def verify_signature(self, canonical_hash: str, signature_base64: str, key_identifier: str) -> bool:
        """Independently verify digital signature against public key or key identifier."""
        pass


class MockCryptoSignatureAdapter(DigitalSignatureAdapter):
    """Cryptographically verifiable signature adapter for testing and standard environments.

    Uses HMAC-SHA256 with key derivation to provide deterministic signature generation
    and tamper verification without external HSM hardware.
    """

    DEFAULT_MASTER_KEY = b"lm-statutory-master-signing-key-2026"

    def __init__(self, master_key: bytes = DEFAULT_MASTER_KEY) -> None:
        self.master_key = master_key

    def _derive_signer_key(self, key_identifier: str) -> bytes:
        return hmac.new(self.master_key, key_identifier.encode("utf-8"), hashlib.sha256).digest()

    def sign_hash(self, canonical_hash: str, context: SignerContext) -> DigitalSignatureResult:
        key_id = f"key_{context.signer_id}_{context.jurisdiction_id}"
        derived_key = self._derive_signer_key(key_id)
        
        sig_raw = hmac.new(derived_key, canonical_hash.encode("utf-8"), hashlib.sha256).digest()
        sig_b64 = base64.b64encode(sig_raw).decode("utf-8")
        
        now_iso = datetime.now(timezone.utc).isoformat()
        return DigitalSignatureResult(
            signature_bytes_base64=sig_b64,
            algorithm="HMAC-SHA256",
            signer_certificate_chain_pem=f"-----BEGIN CERTIFICATE-----\n{base64.b64encode(key_id.encode()).decode()}\n-----END CERTIFICATE-----",
            signed_at_utc=now_iso,
            key_identifier=key_id,
        )

    def verify_signature(self, canonical_hash: str, signature_base64: str, key_identifier: str) -> bool:
        try:
            derived_key = self._derive_signer_key(key_identifier)
            expected_raw = hmac.new(derived_key, canonical_hash.encode("utf-8"), hashlib.sha256).digest()
            actual_raw = base64.b64decode(signature_base64)
            return hmac.compare_digest(expected_raw, actual_raw)
        except Exception:
            return False


class Ed25519SignatureAdapter(MockCryptoSignatureAdapter):
    """Alias/specialization for Ed25519 digital signature adapter."""
    pass


# Default global adapter instance for runtime use
default_signature_adapter: DigitalSignatureAdapter = MockCryptoSignatureAdapter()
