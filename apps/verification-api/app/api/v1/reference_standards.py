"""Reference Standards & Calibration Lifecycle REST endpoints.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.core.permissions import require_roles
from app.database import get_db
from app.models.reference_standard import ReferenceStandardStatusEnum
from app.models.stakeholder import RoleEnum
from app.schemas.reference_standard import (
    RecalibrationRecordRequest,
    ReferenceStandardCreateRequest,
    ReferenceStandardResponse,
    StandardQuarantineRequest,
)
from app.services.reference_standard_service import ReferenceStandardService

router = APIRouter(prefix="/tenants/{tenant_id}/reference-standards", tags=["Reference Standards"])


@router.post(
    "",
    response_model=ReferenceStandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new reference standard mass/equipment",
)
def create_standard(
    tenant_id: str,
    payload: ReferenceStandardCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
    ),
) -> ReferenceStandardResponse:
    """Register reference standard with valid calibration certificate."""
    std = ReferenceStandardService.create_standard(db, tenant_id, payload)
    return ReferenceStandardResponse.model_validate(std)


@router.get(
    "",
    response_model=List[ReferenceStandardResponse],
    status_code=status.HTTP_200_OK,
    summary="List certified reference standards",
)
def list_standards(
    tenant_id: str,
    custodian_id: Optional[str] = Query(None),
    accuracy_class: Optional[str] = Query(None),
    status_filter: Optional[ReferenceStandardStatusEnum] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.SUPERVISOR, RoleEnum.ADMIN, RoleEnum.AUDITOR)
    ),
) -> List[ReferenceStandardResponse]:
    """Query reference standards matching filters."""
    stds = ReferenceStandardService.list_standards(db, tenant_id, custodian_id, accuracy_class, status_filter)
    return [ReferenceStandardResponse.model_validate(s) for s in stds]


@router.get(
    "/{standard_id}",
    response_model=ReferenceStandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get reference standard details",
)
def get_standard(
    tenant_id: str,
    standard_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.SUPERVISOR, RoleEnum.ADMIN, RoleEnum.AUDITOR)
    ),
) -> ReferenceStandardResponse:
    """Fetch standard details by standard ID."""
    std = ReferenceStandardService.get_standard(db, tenant_id, standard_id)
    return ReferenceStandardResponse.model_validate(std)


@router.post(
    "/{standard_id}/recalibrate",
    response_model=ReferenceStandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Record recalibration certificate",
)
def record_recalibration(
    tenant_id: str,
    standard_id: str,
    payload: RecalibrationRecordRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
    ),
) -> ReferenceStandardResponse:
    """Append new calibration record and extend validity period."""
    std = ReferenceStandardService.record_recalibration(db, tenant_id, standard_id, payload)
    return ReferenceStandardResponse.model_validate(std)


@router.post(
    "/{standard_id}/quarantine",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Quarantine standard and initiate impact review",
)
def quarantine_standard(
    tenant_id: str,
    standard_id: str,
    payload: StandardQuarantineRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
    ),
) -> Dict[str, Any]:
    """Quarantine standard out of calibration and audit affected verification sessions."""
    return ReferenceStandardService.quarantine_standard(
        db, tenant_id, standard_id, payload.reason, payload.initiate_impact_review
    )
