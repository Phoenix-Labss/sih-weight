"""Verification Application, Scrutiny, Fee Assessment, and Scheduling REST endpoints.
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
from app.schemas.application import (
    ApplicationCorrectionRequest,
    ApplicationCreateRequest,
    ApplicationResponse,
    ApplicationScheduleRequest,
    ApplicationScrutinyRequest,
    FeeAssessmentCreate,
    PaymentReconcileRequest,
)
from app.schemas.common import PaginatedResponse
from app.services.application_service import ApplicationService

router = APIRouter(prefix="/tenants/{tenant_id}/applications", tags=["Applications"])


@router.post(
    "",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit verification / re-verification application",
)
def create_application(
    tenant_id: str,
    payload: ApplicationCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.OWNER, RoleEnum.APPLICANT, RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
    ),
) -> ApplicationResponse:
    """Trader or instrument owner submits a new statutory verification application."""
    app = ApplicationService.create_application(db, tenant_id, payload, current_user)
    return ApplicationResponse.model_validate(app)


@router.post(
    "/{application_id}/submit",
    response_model=ApplicationResponse,
    summary="Submit draft application",
)
def submit_application(
    tenant_id: str,
    application_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.OWNER, RoleEnum.APPLICANT, RoleEnum.ADMIN)
    ),
) -> ApplicationResponse:
    """Submit a draft application for departmental scrutiny."""
    app = ApplicationService.submit_application(db, tenant_id, application_id, current_user)
    return ApplicationResponse.model_validate(app)


@router.post(
    "/{application_id}/scrutiny",
    response_model=ApplicationResponse,
    summary="Record officer scrutiny decision",
)
def scrutinize_application(
    tenant_id: str,
    application_id: str,
    payload: ApplicationScrutinyRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN)
    ),
) -> ApplicationResponse:
    """Officer accepts, queries, or rejects an application under scrutiny."""
    app = ApplicationService.scrutinize_application(db, tenant_id, application_id, payload, current_user)
    return ApplicationResponse.model_validate(app)


@router.post(
    "/{application_id}/correction",
    response_model=ApplicationResponse,
    summary="Submit correction for query deficiency",
)
def submit_correction(
    tenant_id: str,
    application_id: str,
    payload: ApplicationCorrectionRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.OWNER, RoleEnum.APPLICANT, RoleEnum.ADMIN)
    ),
) -> ApplicationResponse:
    """Applicant responds to deficiency query, creating versioned correction."""
    app = ApplicationService.submit_correction(db, tenant_id, application_id, payload, current_user)
    return ApplicationResponse.model_validate(app)


@router.post(
    "/{application_id}/fee",
    response_model=ApplicationResponse,
    summary="Issue statutory fee assessment notice",
)
def assess_fee(
    tenant_id: str,
    application_id: str,
    payload: FeeAssessmentCreate,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN)
    ),
) -> ApplicationResponse:
    """Issue itemized fee assessment notice after application acceptance."""
    app = ApplicationService.assess_fee(db, tenant_id, application_id, payload, current_user)
    return ApplicationResponse.model_validate(app)


@router.post(
    "/{application_id}/pay",
    response_model=ApplicationResponse,
    summary="Reconcile verified treasury / gateway payment",
)
def reconcile_payment(
    tenant_id: str,
    application_id: str,
    payload: PaymentReconcileRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.OWNER, RoleEnum.APPLICANT, RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
    ),
) -> ApplicationResponse:
    """Reconcile verified treasury or payment gateway transaction."""
    app = ApplicationService.reconcile_payment(db, tenant_id, application_id, payload, current_user)
    return ApplicationResponse.model_validate(app)


@router.post(
    "/{application_id}/schedule",
    response_model=ApplicationResponse,
    summary="Schedule verification slot and assign officer",
)
def schedule_application(
    tenant_id: str,
    application_id: str,
    payload: ApplicationScheduleRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN)
    ),
) -> ApplicationResponse:
    """Allocate verification slot and assign inspecting officer or GATC centre."""
    app = ApplicationService.schedule_application(db, tenant_id, application_id, payload, current_user)
    return ApplicationResponse.model_validate(app)


@router.get(
    "/{application_id}",
    response_model=ApplicationResponse,
    summary="Fetch application details and progression",
)
def get_application(
    tenant_id: str,
    application_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> ApplicationResponse:
    """Fetch application details with linked fee assessment and instrument."""
    app = ApplicationService.get_application(db, tenant_id, application_id, current_user)
    return ApplicationResponse.model_validate(app)


@router.get(
    "",
    response_model=PaginatedResponse[ApplicationResponse],
    summary="List applications within tenant",
)
def list_applications(
    tenant_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> PaginatedResponse[ApplicationResponse]:
    """Filter and paginate verification applications."""
    items, total = ApplicationService.list_applications(
        db=db,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        actor=current_user,
    )
    pages = math.ceil(total / page_size) if total > 0 else 0
    return PaginatedResponse[ApplicationResponse](
        items=[ApplicationResponse.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
