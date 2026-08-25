"""Structured domain errors and RFC 7807 problem details handlers.
"""

from __future__ import annotations

from datetime import datetime, timezone
import uuid
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.state_machines import (
    GuardConditionFailedError,
    ImmutableEntityModificationError,
    InvalidStateTransitionError,
    StateMachineError,
    UnauthorizedTransitionError,
)


class APIError(Exception):
    """Base exception for API errors with RFC 7807 structured details."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        error_code: str = "BAD_REQUEST",
        details: Optional[Dict[str, Any]] = None,
        errors: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        self.errors = errors or []


class NotFoundError(APIError):
    def __init__(
        self,
        message: str = "Resource not found",
        error_code: str = "RECORD_NOT_FOUND",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code=error_code,
            details=details,
        )


class UnauthorizedError(APIError):
    def __init__(
        self,
        message: str = "Authentication required",
        error_code: str = "UNAUTHORIZED",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code=error_code,
            details=details,
        )


class ForbiddenError(APIError):
    def __init__(
        self,
        message: str = "Access denied",
        error_code: str = "FORBIDDEN",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code=error_code,
            details=details,
        )


class ConflictError(APIError):
    def __init__(
        self,
        message: str = "Resource state conflict",
        error_code: str = "STATE_CONFLICT",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code=error_code,
            details=details,
        )


class PreconditionFailedError(APIError):
    def __init__(
        self,
        message: str = "Precondition failed",
        error_code: str = "PRECONDITION_FAILED",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            message=message,
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            error_code=error_code,
            details=details,
        )


class UnprocessableError(APIError):
    def __init__(
        self,
        message: str = "Unprocessable entity",
        error_code: str = "UNPROCESSABLE_ENTITY",
        details: Optional[Dict[str, Any]] = None,
        errors: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code=error_code,
            details=details,
            errors=errors,
        )


def create_rfc7807_error_response(
    status_code: int,
    error_code: str,
    title: str,
    detail: str,
    instance: str,
    tenant_id: Optional[str] = None,
    errors: Optional[List[Dict[str, Any]]] = None,
    correlation_id: Optional[str] = None,
) -> JSONResponse:
    """Construct a RFC 7807 compliant JSONResponse."""
    payload = {
        "type": f"https://api.legalmetrology.gov.in/errors/{error_code}",
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": instance,
        "error_code": error_code,
        "correlation_id": correlation_id or f"corr_{uuid.uuid4().hex[:16]}",
        "tenant_id": tenant_id or "N/A",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "errors": errors or [],
    }
    return JSONResponse(
        status_code=status_code,
        content=payload,
        media_type="application/problem+json",
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all structured error handlers on the FastAPI application."""

    @app.exception_handler(APIError)
    async def handle_api_error(request: Request, exc: APIError) -> JSONResponse:
        tenant_id = request.path_params.get("tenant_id") or getattr(request.state, "tenant_id", None)
        return create_rfc7807_error_response(
            status_code=exc.status_code,
            error_code=exc.error_code,
            title=exc.error_code.replace("_", " ").title(),
            detail=exc.message,
            instance=request.url.path,
            tenant_id=tenant_id,
            errors=exc.errors,
        )

    @app.exception_handler(InvalidStateTransitionError)
    async def handle_invalid_state_transition(
        request: Request, exc: InvalidStateTransitionError
    ) -> JSONResponse:
        tenant_id = request.path_params.get("tenant_id") or getattr(request.state, "tenant_id", None)
        return create_rfc7807_error_response(
            status_code=status.HTTP_409_CONFLICT,
            error_code="INVALID_STATE_TRANSITION",
            title="Invalid State Transition",
            detail=exc.message,
            instance=request.url.path,
            tenant_id=tenant_id,
            errors=[{"field": "status", "message": exc.message, "details": exc.details}],
        )

    @app.exception_handler(UnauthorizedTransitionError)
    async def handle_unauthorized_transition(
        request: Request, exc: UnauthorizedTransitionError
    ) -> JSONResponse:
        tenant_id = request.path_params.get("tenant_id") or getattr(request.state, "tenant_id", None)
        return create_rfc7807_error_response(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="UNAUTHORIZED_ACTION",
            title="Unauthorized Action",
            detail=exc.message,
            instance=request.url.path,
            tenant_id=tenant_id,
            errors=[{"field": "role", "message": exc.message, "details": exc.details}],
        )

    @app.exception_handler(GuardConditionFailedError)
    async def handle_guard_condition_failed(
        request: Request, exc: GuardConditionFailedError
    ) -> JSONResponse:
        tenant_id = request.path_params.get("tenant_id") or getattr(request.state, "tenant_id", None)
        return create_rfc7807_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="GUARD_CONDITION_FAILED",
            title="Guard Condition Failed",
            detail=exc.message,
            instance=request.url.path,
            tenant_id=tenant_id,
            errors=[{"field": exc.details.get("condition_name", "guard"), "message": exc.message, "details": exc.details}],
        )

    @app.exception_handler(ImmutableEntityModificationError)
    async def handle_immutable_modification(
        request: Request, exc: ImmutableEntityModificationError
    ) -> JSONResponse:
        tenant_id = request.path_params.get("tenant_id") or getattr(request.state, "tenant_id", None)
        return create_rfc7807_error_response(
            status_code=status.HTTP_409_CONFLICT,
            error_code="IMMUTABLE_ENTITY_MODIFICATION",
            title="Immutable Entity Modification Disallowed",
            detail=exc.message,
            instance=request.url.path,
            tenant_id=tenant_id,
            errors=[{"field": "immutable", "message": exc.message, "details": exc.details}],
        )

    @app.exception_handler(StateMachineError)
    async def handle_generic_state_machine_error(
        request: Request, exc: StateMachineError
    ) -> JSONResponse:
        tenant_id = request.path_params.get("tenant_id") or getattr(request.state, "tenant_id", None)
        return create_rfc7807_error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="STATE_MACHINE_ERROR",
            title="State Machine Error",
            detail=exc.message,
            instance=request.url.path,
            tenant_id=tenant_id,
            errors=[{"field": "state_machine", "message": exc.message, "details": exc.details}],
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        tenant_id = request.path_params.get("tenant_id") or getattr(request.state, "tenant_id", None)
        formatted_errors = []
        for err in exc.errors():
            loc = " -> ".join(str(l) for l in err.get("loc", []))
            formatted_errors.append({
                "field": loc,
                "message": err.get("msg", "Validation error"),
                "type": err.get("type", "value_error"),
            })
        return create_rfc7807_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="SCHEMA_VALIDATION_ERROR",
            title="Schema Validation Error",
            detail="Request body or parameters failed schema validation rules.",
            instance=request.url.path,
            tenant_id=tenant_id,
            errors=formatted_errors,
        )

    @app.exception_handler(HTTPException)
    async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
        tenant_id = request.path_params.get("tenant_id") or getattr(request.state, "tenant_id", None)
        detail = str(exc.detail) if isinstance(exc.detail, str) else str(exc.detail)
        error_code = "HTTP_ERROR"
        if exc.status_code == 404:
            error_code = "RECORD_NOT_FOUND"
        elif exc.status_code == 403:
            error_code = "FORBIDDEN"
        elif exc.status_code == 401:
            error_code = "UNAUTHORIZED"
        elif exc.status_code == 409:
            error_code = "STATE_CONFLICT"

        return create_rfc7807_error_response(
            status_code=exc.status_code,
            error_code=error_code,
            title=error_code.replace("_", " ").title(),
            detail=detail,
            instance=request.url.path,
            tenant_id=tenant_id,
        )
