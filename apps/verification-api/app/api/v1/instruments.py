"""Instrument pattern models and physical unit registry REST endpoints.
"""

from __future__ import annotations

import math
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.core.permissions import require_roles
from app.database import get_db
from app.models.stakeholder import RoleEnum
from app.schemas.common import PaginatedResponse
from app.schemas.instrument import (
    InstrumentModelCreate,
    InstrumentModelResponse,
    InstrumentRegisterRequest,
    InstrumentResponse,
)
from app.services.instrument_service import InstrumentService

router = APIRouter(prefix="/tenants/{tenant_id}/instruments", tags=["Instruments"])


@router.get(
    "/models",
    response_model=List[InstrumentModelResponse],
    summary="List approved instrument models",
)
def list_instrument_models(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> List[InstrumentModelResponse]:
    """List all registered and approved pattern models."""
    models = InstrumentService.list_instrument_models(db)
    return [InstrumentModelResponse.model_validate(m) for m in models]


@router.post(
    "/models",
    response_model=InstrumentModelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register approved instrument model pattern",
)
def create_instrument_model(
    tenant_id: str,
    payload: InstrumentModelCreate,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN)
    ),
) -> InstrumentModelResponse:
    """Register statutory model approval pattern under Section 22 / General Rules."""
    model = InstrumentService.create_instrument_model(db, payload, current_user)
    return InstrumentModelResponse.model_validate(model)


@router.get(
    "/models/{model_id}",
    response_model=InstrumentModelResponse,
    summary="Get instrument model specifications",
)
def get_instrument_model(
    tenant_id: str,
    model_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> InstrumentModelResponse:
    """Fetch model approval specifications by ID or approval number."""
    model = InstrumentService.get_instrument_model(db, model_id)
    return InstrumentModelResponse.model_validate(model)


@router.post(
    "",
    response_model=InstrumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register physical measuring instrument unit",
)
def register_instrument(
    tenant_id: str,
    payload: InstrumentRegisterRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.OWNER, RoleEnum.APPLICANT, RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
    ),
) -> InstrumentResponse:
    """Register a new physical weighing/measuring instrument unit at a premises."""
    inst = InstrumentService.register_instrument(db, tenant_id, payload, current_user)
    return InstrumentResponse.model_validate(inst)


@router.get(
    "/{instrument_id}",
    response_model=InstrumentResponse,
    summary="Fetch instrument details and history",
)
def get_instrument(
    tenant_id: str,
    instrument_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> InstrumentResponse:
    """Fetch full instrument technical summary, component list, and verification status."""
    inst = InstrumentService.get_instrument(db, tenant_id, instrument_id, current_user)
    return InstrumentResponse.model_validate(inst)


@router.get(
    "",
    response_model=PaginatedResponse[InstrumentResponse],
    summary="List instruments within tenant/jurisdiction",
)
def list_instruments(
    tenant_id: str,
    jurisdiction_id: Optional[str] = Query(None, description="Filter by jurisdiction"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> PaginatedResponse[InstrumentResponse]:
    """Filter and paginate instruments."""
    items, total = InstrumentService.list_instruments(
        db=db,
        tenant_id=tenant_id,
        jurisdiction_id=jurisdiction_id,
        page=page,
        page_size=page_size,
        actor=current_user,
    )
    pages = math.ceil(total / page_size) if total > 0 else 0
    return PaginatedResponse[InstrumentResponse](
        items=[InstrumentResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
