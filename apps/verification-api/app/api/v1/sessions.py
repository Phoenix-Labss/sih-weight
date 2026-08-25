"""Verification Session, Test Observation Recording, Evaluation, and Disposition REST endpoints.
"""

from __future__ import annotations

import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.core.permissions import require_roles
from app.database import get_db
from app.models.stakeholder import RoleEnum
from app.schemas.common import PaginatedResponse
from app.schemas.session import (
    SessionCreateRequest,
    SessionDispositionRequest,
    SessionObservationSubmitRequest,
    SessionResponse,
)
from app.services.verification_service import VerificationService

router = APIRouter(prefix="/tenants/{tenant_id}/sessions", tags=["Verification Sessions"])


@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initialize verification session",
)
def create_session(
    tenant_id: str,
    payload: SessionCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
    ),
) -> SessionResponse:
    """Initialize a statutory verification test session."""
    session = VerificationService.create_session(db, tenant_id, payload, current_user)
    return SessionResponse.model_validate(session)


@router.post(
    "/{session_id}/identity",
    response_model=SessionResponse,
    summary="Confirm instrument physical serial & characteristics",
)
def confirm_identity(
    tenant_id: str,
    session_id: str,
    serial_verified: bool = Query(True, description="Physical serial matches registry"),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.ADMIN)
    ),
) -> SessionResponse:
    """Confirm physical instrument serial number and model match registry facts."""
    session = VerificationService.confirm_identity(db, tenant_id, session_id, serial_verified, current_user)
    return SessionResponse.model_validate(session)


@router.post(
    "/{session_id}/start",
    response_model=SessionResponse,
    summary="Start executing metrological test steps",
)
def start_session(
    tenant_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.ADMIN)
    ),
) -> SessionResponse:
    """Start testing and lock session into IN_PROGRESS state."""
    session = VerificationService.start_session(db, tenant_id, session_id, current_user)
    return SessionResponse.model_validate(session)


@router.post(
    "/{session_id}/observations",
    response_model=SessionResponse,
    summary="Record test observations and execute deterministic evaluation",
)
def submit_observations(
    tenant_id: str,
    session_id: str,
    payload: SessionObservationSubmitRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.ADMIN)
    ),
) -> SessionResponse:
    """Record raw measurement observations and execute deterministic procedure pack calculation."""
    session = VerificationService.submit_session_observations(db, tenant_id, session_id, payload, current_user)
    return SessionResponse.model_validate(session)


@router.post(
    "/{session_id}/disposition",
    response_model=SessionResponse,
    summary="Record formal officer legal disposition",
)
def record_disposition(
    tenant_id: str,
    session_id: str,
    payload: SessionDispositionRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
    ),
) -> SessionResponse:
    """Legal Metrology Officer records official disposition and finalizes session."""
    session = VerificationService.record_session_disposition(db, tenant_id, session_id, payload, current_user)
    return SessionResponse.model_validate(session)


@router.get(
    "/{session_id}",
    response_model=SessionResponse,
    summary="Fetch verification session details and trace",
)
def get_session(
    tenant_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> SessionResponse:
    """Fetch session with reference standards used, test observations, and calculation trace."""
    session = VerificationService.get_session(db, tenant_id, session_id, current_user)
    return SessionResponse.model_validate(session)


@router.get(
    "",
    response_model=PaginatedResponse[SessionResponse],
    summary="List verification sessions within tenant",
)
def list_sessions(
    tenant_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> PaginatedResponse[SessionResponse]:
    """Filter and paginate verification sessions."""
    items, total = VerificationService.list_sessions(
        db=db,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        actor=current_user,
    )
    pages = math.ceil(total / page_size) if total > 0 else 0
    return PaginatedResponse[SessionResponse](
        items=[SessionResponse.model_validate(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
