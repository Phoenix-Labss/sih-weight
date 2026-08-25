"""Authentication, JWT tokens, and request security context.
"""

from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import os
from typing import Any, Dict, Optional

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.errors import UnauthorizedError, ForbiddenError
from app.models.stakeholder import RoleEnum

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "legal-metrology-jwt-secret-key-2026-auth")
JWT_ALGORITHM = "HS256"
DEFAULT_EXPIRE_MINUTES = 60 * 24  # 24 hours

security_bearer = HTTPBearer(auto_error=False)


class UserContext(BaseModel):
    """Authenticated user context injected into request handlers."""
    user_id: str
    tenant_id: str
    role: RoleEnum
    jurisdiction_id: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool = True

    model_config = {"use_enum_values": False}

    def role_str(self) -> str:
        if isinstance(self.role, RoleEnum):
            return self.role.value
        return str(self.role)

    def has_role(self, *allowed_roles: RoleEnum | str) -> bool:
        current = self.role_str()
        allowed_str_set = {r.value if isinstance(r, RoleEnum) else str(r) for r in allowed_roles}
        return current in allowed_str_set


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _base64url_decode(data: str) -> bytes:
    padding = "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
    secret_key: str = JWT_SECRET_KEY,
) -> str:
    """Create signed HMAC-SHA256 JWT access token."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = data.copy()
    
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=DEFAULT_EXPIRE_MINUTES)
        
    payload["exp"] = int(expire.timestamp())
    payload["iat"] = int(now.timestamp())

    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    header_b64 = _base64url_encode(header_bytes)
    payload_b64 = _base64url_encode(payload_bytes)

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(
    token: str,
    secret_key: str = JWT_SECRET_KEY,
) -> Dict[str, Any]:
    """Decode and cryptographically verify HMAC-SHA256 JWT token."""
    parts = token.split(".")
    if len(parts) != 3:
        raise UnauthorizedError("Malformed JWT token structure", error_code="INVALID_TOKEN")

    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_sig = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()

    try:
        actual_sig = _base64url_decode(sig_b64)
    except Exception:
        raise UnauthorizedError("Invalid token signature encoding", error_code="INVALID_TOKEN")

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise UnauthorizedError("Signature verification failed", error_code="INVALID_SIGNATURE")

    try:
        payload_json = _base64url_decode(payload_b64).decode("utf-8")
        payload = json.loads(payload_json)
    except Exception:
        raise UnauthorizedError("Invalid token payload", error_code="INVALID_TOKEN")

    # Check expiration
    exp = payload.get("exp")
    if exp:
        now_ts = int(datetime.now(timezone.utc).timestamp())
        if now_ts > exp:
            raise UnauthorizedError("JWT token has expired", error_code="TOKEN_EXPIRED")

    return payload


async def get_current_user(
    request: Request,
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
) -> UserContext:
    """FastAPI dependency resolving and verifying the authenticated UserContext."""
    # 1. Check Bearer Token
    if auth_credentials and auth_credentials.credentials:
        token = auth_credentials.credentials
        payload = decode_access_token(token)
        role_val = payload.get("role", RoleEnum.OWNER.value)
        if isinstance(role_val, str):
            try:
                role = RoleEnum(role_val)
            except ValueError:
                role = RoleEnum.OWNER
        else:
            role = role_val

        user = UserContext(
            user_id=payload.get("sub", payload.get("user_id", "anonymous")),
            tenant_id=payload.get("tenant_id", "IN-DL"),
            role=role,
            jurisdiction_id=payload.get("jurisdiction_id"),
            email=payload.get("email"),
            full_name=payload.get("full_name"),
            is_active=payload.get("is_active", True),
        )
        request.state.current_user = user
        return user

    # 2. Check Test / Dev Headers (for fast integration testing and frontend UI preview)
    test_user_id = request.headers.get("X-Actor-Id") or request.headers.get("X-Test-User-Id") or request.headers.get("X-User-Id")
    if test_user_id:
        test_tenant = request.headers.get("X-Tenant-Id") or request.headers.get("X-Test-Tenant-Id") or "tenant-delhi-central"
        test_role_str = request.headers.get("X-Actor-Role") or request.headers.get("X-Test-Role") or "OWNER"
        test_jurisdiction = request.headers.get("X-Jurisdiction-Id") or request.headers.get("X-Test-Jurisdiction-Id") or "JUR-DL-01"
        try:
            role = RoleEnum(test_role_str)
        except ValueError:
            role = RoleEnum.OWNER

        user = UserContext(
            user_id=test_user_id,
            tenant_id=test_tenant,
            role=role,
            jurisdiction_id=test_jurisdiction,
            email=f"{test_user_id}@metrology.gov.in",
            full_name=f"User {test_user_id}",
            is_active=True,
        )
        request.state.current_user = user
        return user

    # No credentials provided
    raise UnauthorizedError("Missing or invalid Authorization header", error_code="UNAUTHORIZED")


async def get_optional_user(
    request: Request,
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
) -> Optional[UserContext]:
    """Optional user context for public endpoints."""
    try:
        return await get_current_user(request, auth_credentials)
    except APIError:
        return None
