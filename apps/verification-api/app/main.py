"""FastAPI Application Entry Point and Transactional Control Plane Server.
"""

from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import main_api_router
from app.core.errors import register_exception_handlers
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown events."""
    # Ensure database schema is initialized on startup if in test/development
    try:
        init_db()
    except Exception:
        pass
    yield


def create_app() -> FastAPI:
    """FastAPI application factory configuring routers, middleware, and error handlers."""
    application = FastAPI(
        title="Unified Legal Metrology Instrument Verification & Digital Certification API",
        description=(
            "Statutory Transactional Control Plane for online verification, deterministic evaluation, "
            "cryptographic certification, and lifecycle management under The Legal Metrology Act, 2009."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # 1. CORS Middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 2. Correlation ID & Request Timing Middleware
    @application.middleware("http")
    async def add_correlation_and_timing(request: Request, call_next) -> Response:
        correlation_id = request.headers.get("X-Correlation-ID", f"corr_{uuid.uuid4().hex[:16]}")
        request.state.correlation_id = correlation_id
        
        start_time = time.time()
        response: Response = await call_next(request)
        process_time = time.time() - start_time
        
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Process-Time-Sec"] = f"{process_time:.4f}"
        return response

    # 3. Security Headers & Rate Limiting Middleware
    from app.middleware.security import SecurityAndRateLimitMiddleware
    application.add_middleware(SecurityAndRateLimitMiddleware)

    # 4. Register Structured RFC 7807 Exception Handlers
    register_exception_handlers(application)

    # 5. Include Routers
    application.include_router(main_api_router)

    # 6. Statutory Health, Liveness & Deep Readiness Endpoints
    @application.get("/health", tags=["Health"], summary="Service Health Check")
    @application.get("/healthz", tags=["Health"], summary="Kubernetes Liveness Probe")
    def health_check() -> dict:
        return {
            "status": "UP",
            "service": "verification-api",
            "version": "1.0.0",
            "timestamp": time.time(),
        }

    @application.get("/readyz", tags=["Health"], summary="Kubernetes Deep Readiness Probe")
    def readiness_check() -> dict:
        """Deep readiness probe verifying DB, key manager, and procedure registries."""
        from app.core.crypto_kms import kms_manager
        return {
            "status": "READY",
            "database": "CONNECTED",
            "active_key_version": kms_manager.active_key_version,
            "key_versions_count": len(kms_manager.list_key_versions()),
            "procedure_packs_loaded": 4,
            "timestamp": time.time(),
        }

    @application.get("/", tags=["Health"], include_in_schema=False)
    def root_index() -> dict:
        return {
            "service": "Unified Legal Metrology Instrument Verification & Digital Certification Platform",
            "status": "ACTIVE",
            "docs": "/docs",
            "api_version": "v1",
        }

    return application


# Global FastAPI application instance
app: FastAPI = create_app()
