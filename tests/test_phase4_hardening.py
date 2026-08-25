"""Phase 4 Test Suite: Production Hardening, Key Rotation / HSM Failover, Security Headers, Rate Limiting, and Deep Readiness.
"""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.crypto import SignerContext
from app.core.crypto_kms import (
    KeyRotationManager,
    ResilientHSMSignatureAdapter,
    kms_manager,
    resilient_signature_adapter,
)
from app.models.stakeholder import RoleEnum


class TestPhase4ProductionHardening:
    """Security, KMS Key Rotation, Health & Readiness Probes."""

    def test_healthz_and_readyz_probes(self, client: TestClient):
        """Verify Kubernetes liveness and deep readiness probes."""
        # 1. Liveness check
        resp_liveness = client.get("/healthz")
        assert resp_liveness.status_code == 200
        assert resp_liveness.json()["status"] == "UP"

        # 2. Deep readiness probe
        resp_readiness = client.get("/readyz")
        assert resp_readiness.status_code == 200
        data = resp_readiness.json()
        assert data["status"] == "READY"
        assert data["database"] == "CONNECTED"
        assert "active_key_version" in data
        assert data["key_versions_count"] >= 2

    def test_security_headers_injected_on_responses(self, client: TestClient):
        """Statutory HTTP security response headers."""
        resp = client.get("/healthz")
        assert resp.status_code == 200
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("X-Frame-Options") == "DENY"
        assert "max-age" in resp.headers.get("Strict-Transport-Security", "")

    def test_public_qr_rate_limiting_protection(self):
        """Verify RateLimiter sliding-window algorithm throttles requests past threshold."""
        from app.middleware.security import RateLimiter
        limiter = RateLimiter(requests_per_minute=5, window_seconds=60)
        client_ip = "192.168.1.100"

        # First 5 requests allowed
        for i in range(5):
            allowed, remaining = limiter.is_allowed(client_ip)
            assert allowed is True

        # 6th request rejected
        allowed, remaining = limiter.is_allowed(client_ip)
        assert allowed is False
        assert remaining == 0

    def test_kms_key_rotation_and_backward_compatible_verification(self):
        """Test zero-downtime key rotation and signature verification across historic key versions."""
        custom_kms = KeyRotationManager({
            "v1": b"master-key-2025-legacy-seed",
            "v2": b"master-key-2026-current-seed",
        })
        adapter = ResilientHSMSignatureAdapter(custom_kms)

        ctx = SignerContext(
            signer_id="officer_dl_01",
            signer_role="LMO",
            jurisdiction_id="DL-NORTH",
            certificate_id="cert-rot-test-01",
        )

        canonical_hash = "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e"

        # 1. Sign under v2
        sig_v2 = adapter.sign_hash(canonical_hash, ctx)
        assert sig_v2.key_identifier.startswith("v2:")
        assert adapter.verify_signature(canonical_hash, sig_v2.signature_bytes_base64, sig_v2.key_identifier) is True

        # 2. Rotate to v3
        custom_kms.register_new_key_version("v3", b"master-key-2027-future-seed", set_active=True)
        assert custom_kms.active_key_version == "v3"

        # 3. Sign new certificate under active v3
        sig_v3 = adapter.sign_hash(canonical_hash, ctx)
        assert sig_v3.key_identifier.startswith("v3:")
        assert adapter.verify_signature(canonical_hash, sig_v3.signature_bytes_base64, sig_v3.key_identifier) is True

        # 4. Crucial: Old certificate signed under v2 MUST STILL VERIFY accurately after rotation!
        assert adapter.verify_signature(canonical_hash, sig_v2.signature_bytes_base64, sig_v2.key_identifier) is True

        # 5. Tampered hash must still fail under all keys
        assert adapter.verify_signature("tampered_hash_value_12345", sig_v2.signature_bytes_base64, sig_v2.key_identifier) is False
