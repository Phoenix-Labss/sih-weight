"""Cryptographic Webhook Verification & Anti-Replay Engine.

Implements HMAC-SHA256 signature verification and timestamp anti-replay tolerance checks.
"""

from __future__ import annotations

import hmac
import hashlib
import json
import time
from typing import Any, Dict, Optional, Tuple

from .errors import InvalidWebhookSignatureError, WebhookReplayError
from .models import WebhookPayload

DEFAULT_WEBHOOK_SECRET = "sec_mock_gateway_metrology_2026_x7k9p"
DEFAULT_TOLERANCE_SECONDS = 300  # 5 minutes anti-replay window


def compute_webhook_signature(secret: str, timestamp: int, body_str: str) -> str:
    """Compute canonical HMAC-SHA256 signature for webhook payload."""
    signature_payload = f"{timestamp}.{body_str}"
    return hmac.new(
        secret.encode("utf-8"),
        signature_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def parse_signature_header(header_value: str) -> Tuple[Optional[int], Optional[str]]:
    """Parse signature header format e.g. 't=1724410800,v1=abcdef123456'."""
    parts = header_value.strip().split(",")
    timestamp = None
    v1_sig = None
    for p in parts:
        kv = p.strip().split("=", 1)
        if len(kv) == 2:
            k, v = kv[0].strip(), kv[1].strip()
            if k == "t":
                try:
                    timestamp = int(v)
                except ValueError:
                    pass
            elif k == "v1":
                v1_sig = v
    if timestamp is None and v1_sig is None and len(parts) == 1:
        # Direct raw hex signature provided
        v1_sig = parts[0].strip()
    return timestamp, v1_sig


class WebhookVerifier:
    """Verifies gateway webhook callbacks with HMAC-SHA256 & replay defense."""

    def __init__(
        self,
        secret: str = DEFAULT_WEBHOOK_SECRET,
        tolerance_seconds: int = DEFAULT_TOLERANCE_SECONDS,
    ):
        self.secret = secret
        self.tolerance_seconds = tolerance_seconds

    def verify(
        self,
        raw_body: str,
        signature_header: Optional[str] = None,
        provided_timestamp: Optional[int] = None,
        current_time: Optional[int] = None,
    ) -> WebhookPayload:
        """Verify webhook signature and timestamp anti-replay."""
        now = current_time if current_time is not None else int(time.time())

        # 1. Parse json body
        try:
            body_dict = json.loads(raw_body)
        except json.JSONDecodeError as exc:
            raise InvalidWebhookSignatureError(f"Invalid JSON webhook body: {exc}") from exc

        # 2. Extract timestamp and signature
        ts = provided_timestamp
        sig = signature_header

        if signature_header and ("t=" in signature_header or "v1=" in signature_header):
            parsed_ts, parsed_sig = parse_signature_header(signature_header)
            if parsed_ts is not None:
                ts = parsed_ts
            if parsed_sig is not None:
                sig = parsed_sig

        if ts is None:
            ts = body_dict.get("timestamp")

        if ts is None:
            raise WebhookReplayError("Missing timestamp in webhook payload or signature header.")

        # 3. Anti-replay verification
        time_delta = abs(now - int(ts))
        if time_delta > self.tolerance_seconds:
            raise WebhookReplayError(
                f"Webhook timestamp {ts} is outside the allowed anti-replay tolerance window "
                f"({time_delta}s skew, max allowed {self.tolerance_seconds}s)."
            )

        # 4. If signature is in body, use it if not provided in header
        if not sig and "signature" in body_dict:
            sig = body_dict["signature"]

        if not sig:
            raise InvalidWebhookSignatureError("Missing HMAC-SHA256 signature in webhook header or body.")

        # 5. Compute expected signature
        # We compute over body with signature removed or canonical signature payload
        body_dict_for_sig = dict(body_dict)
        body_dict_for_sig.pop("signature", None)
        canonical_body = json.dumps(body_dict_for_sig, sort_keys=True, separators=(",", ":"))

        expected_sig_canonical = compute_webhook_signature(self.secret, int(ts), canonical_body)
        expected_sig_raw = compute_webhook_signature(self.secret, int(ts), raw_body)

        # Constant-time comparison
        valid_canonical = hmac.compare_digest(sig.lower(), expected_sig_canonical.lower())
        valid_raw = hmac.compare_digest(sig.lower(), expected_sig_raw.lower())

        if not (valid_canonical or valid_raw):
            raise InvalidWebhookSignatureError(
                f"HMAC-SHA256 signature verification failed. Provided: '{sig[:8]}...', Mismatch."
            )

        # Convert to WebhookPayload
        return WebhookPayload(**body_dict)
