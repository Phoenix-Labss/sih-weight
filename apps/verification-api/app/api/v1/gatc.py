"""GATC (Government Approved Test Centre) REST endpoints.
"""

from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.core.permissions import require_roles
from app.database import get_db
from app.models.stakeholder import RoleEnum
from app.schemas.gatc import (
    GATCProfileCreateRequest,
    GATCProfileResponse,
    GATCScopeCheckRequest,
)
from app.services.gatc_service import GATCService

router = APIRouter(prefix="/tenants/{tenant_id}/gatc", tags=["GATC Authorizations"])


@router.post(
    "",
    response_model=GATCProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new GATC authorization profile",
)
def register_gatc_profile(
    tenant_id: str,
    payload: GATCProfileCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.CONTROLLER, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
    ),
) -> GATCProfileResponse:
    """Register approved GATC center, approval order, and test scope."""
    profile = GATCService.register_gatc_profile(db, tenant_id, payload)
    return GATCProfileResponse.model_validate(profile)


@router.get(
    "",
    response_model=List[GATCProfileResponse],
    status_code=status.HTTP_200_OK,
    summary="List approved GATC profiles",
)
def list_gatc_profiles(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.CONTROLLER, RoleEnum.SUPERVISOR, RoleEnum.ADMIN, RoleEnum.LMO, RoleEnum.AUDITOR)
    ),
) -> List[GATCProfileResponse]:
    """List all accredited GATC centers in tenant."""
    profiles = GATCService.list_gatc_profiles(db, tenant_id)
    return [GATCProfileResponse.model_validate(p) for p in profiles]


@router.get(
    "/{gatc_id}",
    response_model=GATCProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get GATC profile details",
)
def get_gatc_profile(
    tenant_id: str,
    gatc_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.CONTROLLER, RoleEnum.SUPERVISOR, RoleEnum.ADMIN, RoleEnum.LMO, RoleEnum.AUDITOR)
    ),
) -> GATCProfileResponse:
    """Get GATC profile by ID."""
    profile = GATCService.get_gatc_profile(db, tenant_id, gatc_id)
    return GATCProfileResponse.model_validate(profile)


@router.post(
    "/{gatc_id}/check-scope",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Check GATC testing authorization scope",
)
def check_gatc_scope(
    tenant_id: str,
    gatc_id: str,
    payload: GATCScopeCheckRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.SUPERVISOR, RoleEnum.ADMIN, RoleEnum.CONTROLLER)
    ),
) -> Dict[str, Any]:
    """Verify if instrument category, accuracy class, and capacity fall within GATC statutory approval."""
    return GATCService.check_gatc_scope(db, tenant_id, gatc_id, payload)
