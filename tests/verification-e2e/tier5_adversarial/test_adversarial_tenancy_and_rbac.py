"""Tier 5 Adversarial Property-Based Tests: Multi-Tenant Boundaries, ABAC/RBAC, and Auth Hardening.

Validates security requirements under AGENTS.md §15:
- Strict logical multi-tenancy isolation (tenant_id boundaries).
- Role-based and attribute-based access control (RBAC/ABAC).
- Cross-district LMO jurisdiction boundaries.
- Cryptographic JWT security against token forgery, tampering, and expiration bypasses.
"""

from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
import json
import secrets
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.auth import create_access_token, decode_access_token
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.permissions import verify_jurisdiction_access, verify_tenant_access
from app.models.stakeholder import RoleEnum


class TestMultiTenantIsolationAdversarial:
    """Adversarial challenge tests for multi-tenant isolation."""

    def test_verify_tenant_access_rejects_cross_tenant_non_admin(self):
        """Property: verify_tenant_access fails closed on cross-tenant requests unless actor is ADMIN."""
        from app.core.auth import UserContext

        lmo_dl = UserContext(
            user_id="lmo_01",
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        # Accessing own tenant passes
        verify_tenant_access(lmo_dl, "IN-DL")

        # Accessing foreign tenant raises ForbiddenError
        with pytest.raises(ForbiddenError) as exc:
            verify_tenant_access(lmo_dl, "IN-MH")
        assert exc.value.error_code == "TENANT_ACCESS_DENIED"

        # Global Admin can access foreign tenant
        admin_user = UserContext(
            user_id="admin_01",
            tenant_id="IN-DL",
            role=RoleEnum.ADMIN,
        )
        verify_tenant_access(admin_user, "IN-MH")

    def test_verify_jurisdiction_access_rejects_cross_district_officer(self):
        """Property: LMO assigned to District A cannot act on District B resources."""
        from app.core.auth import UserContext

        lmo_north = UserContext(
            user_id="lmo_01",
            tenant_id="IN-DL",
            role=RoleEnum.LMO,
            jurisdiction_id="DL-NORTH",
        )
        # Own jurisdiction passes
        verify_jurisdiction_access(lmo_north, "DL-NORTH")

        # Cross-jurisdiction raises ForbiddenError
        with pytest.raises(ForbiddenError) as exc:
            verify_jurisdiction_access(lmo_north, "DL-SOUTH")
        assert exc.value.error_code == "OUTSIDE_JURISDICTION"

        # Supervisor has tenant-wide jurisdiction
        supervisor = UserContext(
            user_id="sup_01",
            tenant_id="IN-DL",
            role=RoleEnum.SUPERVISOR,
            jurisdiction_id="DL-NORTH",
        )
        verify_jurisdiction_access(supervisor, "DL-SOUTH")


class TestJWTSecurityAdversarial:
    """Adversarial tests for JWT token authentication."""

    def test_expired_jwt_token_rejected(self):
        """Adversarial: Expired JWT tokens must raise UnauthorizedError(TOKEN_EXPIRED)."""
        expired_token = create_access_token(
            data={"sub": "user_01", "tenant_id": "IN-DL", "role": "LMO"},
            expires_delta=timedelta(seconds=-10),  # Expired in past
        )
        with pytest.raises(UnauthorizedError) as exc:
            decode_access_token(expired_token)
        assert exc.value.error_code == "TOKEN_EXPIRED"

    def test_forged_signature_jwt_token_rejected(self):
        """Adversarial: JWT token signed with wrong secret must raise UnauthorizedError(INVALID_SIGNATURE)."""
        forged_token = create_access_token(
            data={"sub": "user_01", "tenant_id": "IN-DL", "role": "ADMIN"},
            secret_key="attacker-wrong-secret-key-12345",
        )
        with pytest.raises(UnauthorizedError) as exc:
            decode_access_token(forged_token)
        assert exc.value.error_code == "INVALID_SIGNATURE"

    def test_malformed_jwt_tokens_rejected(self):
        """Adversarial: Malformed token structures raise UnauthorizedError(INVALID_TOKEN)."""
        bad_tokens = [
            "not.a.jwt",
            "singleparttoken",
            "two.parts",
            "four.parts.in.this.token",
            "",
            "header.payload.badbase64!!!",
        ]
        for tok in bad_tokens:
            with pytest.raises(UnauthorizedError):
                decode_access_token(tok)

    def test_altered_payload_jwt_token_rejected(self):
        """Adversarial: Modifying role in JWT payload invalidates HMAC signature."""
        valid_token = create_access_token(
            data={"sub": "user_01", "tenant_id": "IN-DL", "role": "OWNER"}
        )
        parts = valid_token.split(".")
        # Decode payload, alter role from OWNER to ADMIN, re-encode
        payload_dict = json.loads(base64.urlsafe_b64decode(parts[1] + "==").decode("utf-8"))
        payload_dict["role"] = "ADMIN"
        tampered_payload_b64 = base64.urlsafe_b64encode(json.dumps(payload_dict).encode("utf-8")).decode("utf-8").rstrip("=")

        tampered_token = f"{parts[0]}.{tampered_payload_b64}.{parts[2]}"
        with pytest.raises(UnauthorizedError) as exc:
            decode_access_token(tampered_token)
        assert exc.value.error_code == "INVALID_SIGNATURE"
