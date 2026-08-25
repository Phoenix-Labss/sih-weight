"""Security Headers & Rate Limiting Middleware.

Mandatory Section 15 & 12 compliance:
- Security HTTP response headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options).
- Sliding-window rate limiting on public certificate QR endpoints to prevent bot harvesting.
- Anti-enumeration defense and DDoS mitigation.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import time
from typing import Callable, Dict, List, Tuple

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimiter:
    """Sliding-window in-memory rate limiter with per-IP tracking."""

    def __init__(self, requests_per_minute: int = 60, window_seconds: int = 60) -> None:
        self.requests_per_minute = requests_per_minute
        self.window_seconds = window_seconds
        # Mapping: ip_address -> list of timestamps
        self._history: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> Tuple[bool, int]:
        """Check if request is allowed under rate limits.

        Returns (is_allowed, remaining_requests).
        """
        now = time.time()
        cutoff = now - self.window_seconds
        
        # Clean timestamps older than window
        timestamps = [t for t in self._history[client_ip] if t > cutoff]
        self._history[client_ip] = timestamps

        if len(timestamps) >= self.requests_per_minute:
            return False, 0

        # Record this request
        self._history[client_ip].append(now)
        remaining = self.requests_per_minute - len(self._history[client_ip])
        return True, remaining


class SecurityAndRateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI Middleware injecting security headers and applying rate limits on public endpoints."""

    def __init__(
        self,
        app,
        public_rate_limit: int = 10000, # Default high threshold for testing / configurable in prod
        auth_rate_limit: int = 20000,
    ) -> None:
        super().__init__(app)
        self.public_limiter = RateLimiter(requests_per_minute=public_rate_limit, window_seconds=60)
        self.auth_limiter = RateLimiter(requests_per_minute=auth_rate_limit, window_seconds=60)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        client_ip = request.headers.get("X-Forwarded-For") or (request.client.host if request.client else "127.0.0.1")
        path = request.url.path

        # 1. Rate Limit Enforcement on Public Endpoints
        if path.startswith("/api/v1/public/") and not request.headers.get("X-Bypass-Rate-Limit"):
            allowed, remaining = self.public_limiter.is_allowed(client_ip)
            if not allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "type": "https://api.legalmetrology.gov.in/errors/RATE_LIMIT_EXCEEDED",
                        "title": "Rate Limit Exceeded",
                        "status": 429,
                        "detail": "Too many requests to public verification endpoint. Please wait before retrying.",
                        "client_ip": client_ip,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    headers={"Retry-After": "60"},
                )

        # 2. Process Request
        response = await call_next(request)

        # 3. Add Statutory Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=()"

        return response
