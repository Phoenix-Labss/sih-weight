"""Physical Stamp and Security Seal Decoupled Ledger REST endpoints.
"""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.core.permissions import require_roles
from app.database import get_db
from app.models.stakeholder import RoleEnum
from app.schemas.stamp import (
    PhysicalStampRecordRequest,
    PhysicalStampResponse,
)
from app.services.stamp_service import StampService

router = APIRouter(prefix="/tenants/{tenant_id}", tags=["Physical Stamps & Seals"])


@router.post(
    "/sessions/{session_id}/stamps",
    response_model=PhysicalStampResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record physical stamp or wire seal application",
)
def record_stamp_action(
    tenant_id: str,
    session_id: str,
    payload: PhysicalStampRecordRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
    ),
) -> PhysicalStampResponse:
    """Record physical stamping or security sealing actions (strictly decoupled from digital certificate)."""
    action = StampService.record_stamp_action(db, tenant_id, session_id, payload, current_user)
    return PhysicalStampResponse.model_validate(action)


@router.get(
    "/sessions/{session_id}/stamps",
    response_model=List[PhysicalStampResponse],
    summary="Retrieve physical stamps/seals recorded in a session",
)
def list_session_stamps(
    tenant_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> List[PhysicalStampResponse]:
    """List physical stamp and seal records affixed during a specific verification session."""
    actions = StampService.list_session_stamps(db, tenant_id, session_id, current_user)
    return [PhysicalStampResponse.model_validate(a) for a in actions]


@router.get(
    "/instruments/{instrument_id}/stamps",
    response_model=List[PhysicalStampResponse],
    summary="Retrieve physical stamping history of an instrument",
)
def list_instrument_stamps(
    tenant_id: str,
    instrument_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> List[PhysicalStampResponse]:
    """Retrieve complete physical seal and stamping audit trail for an instrument unit."""
    actions = StampService.list_instrument_stamps(db, tenant_id, instrument_id, current_user)
    return [PhysicalStampResponse.model_validate(a) for a in actions]
