"""Statutory Expiry Reminders REST endpoints.
"""

from __future__ import annotations

import math
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.core.permissions import require_roles
from app.database import get_db
from app.models.stakeholder import RoleEnum
from app.schemas.common import PaginatedResponse
from app.schemas.reminder import (
    ReminderRecordResponse,
    ReminderScanRequest,
    ReminderScanResponse,
)
from app.services.reminder_service import ReminderService

# Tenant-scoped router: /api/v1/tenants/{tenant_id}/reminders
tenant_reminders_router = APIRouter(
    prefix="/tenants/{tenant_id}/reminders",
    tags=["Expiry Reminders"],
)

# Global router: /api/v1/reminders
global_reminders_router = APIRouter(
    prefix="/reminders",
    tags=["Expiry Reminders"],
)


@tenant_reminders_router.post(
    "/scan",
    response_model=ReminderScanResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger statutory expiry scan and reminder generation for tenant",
)
def run_tenant_reminder_scan(
    tenant_id: str,
    payload: Optional[ReminderScanRequest] = None,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN)
    ),
) -> ReminderScanResponse:
    """Scan active certificates in tenant, detect expiring/overdue milestones, and dispatch notifications."""
    as_of = payload.as_of_date if payload else None
    auto_exp = payload.auto_expire if payload else True
    return ReminderService.trigger_expiry_scan(
        db=db,
        tenant_id=tenant_id,
        as_of_date=as_of,
        auto_expire=auto_exp,
        actor=current_user,
    )


@tenant_reminders_router.post(
    "/run-batch",
    response_model=ReminderScanResponse,
    status_code=status.HTTP_200_OK,
    summary="Alias to trigger expiry reminder batch run",
    include_in_schema=False,
)
def run_tenant_reminder_batch_alias(
    tenant_id: str,
    payload: Optional[ReminderScanRequest] = None,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN)
    ),
) -> ReminderScanResponse:
    """Alias for automated cron worker / batch runner."""
    as_of = payload.as_of_date if payload else None
    auto_exp = payload.auto_expire if payload else True
    return ReminderService.trigger_expiry_scan(
        db=db,
        tenant_id=tenant_id,
        as_of_date=as_of,
        auto_expire=auto_exp,
        actor=current_user,
    )


@tenant_reminders_router.get(
    "",
    response_model=PaginatedResponse[ReminderRecordResponse],
    summary="List reminder records within tenant",
)
def list_tenant_reminders(
    tenant_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    reminder_type: Optional[str] = Query(None, description="Filter by stage: DAYS_60, DAYS_30, DAYS_15, OVERDUE"),
    overdue_only: bool = Query(False, description="Filter only overdue reminders"),
    instrument_id: Optional[str] = Query(None, description="Filter by instrument ID"),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> PaginatedResponse[ReminderRecordResponse]:
    """List reminder records with pagination and milestone filters."""
    items, total = ReminderService.list_reminders(
        db=db,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        reminder_type=reminder_type,
        overdue_only=overdue_only,
        instrument_id=instrument_id,
        actor=current_user,
    )
    pages = math.ceil(total / page_size) if total > 0 else 0
    return PaginatedResponse[ReminderRecordResponse](
        items=[ReminderRecordResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# -----------------------------------------------------------------
# Global / Non-tenant-prefixed routes (/api/v1/reminders)
# -----------------------------------------------------------------

@global_reminders_router.post(
    "/scan",
    response_model=ReminderScanResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger cross-tenant or specific-tenant expiry reminder scan",
)
def run_global_reminder_scan(
    payload: Optional[ReminderScanRequest] = None,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN)
    ),
) -> ReminderScanResponse:
    """Trigger system-wide or tenant-filtered expiry scan."""
    as_of = payload.as_of_date if payload else None
    t_id = payload.tenant_id if payload else None
    auto_exp = payload.auto_expire if payload else True
    return ReminderService.trigger_expiry_scan(
        db=db,
        tenant_id=t_id,
        as_of_date=as_of,
        auto_expire=auto_exp,
        actor=current_user,
    )


@global_reminders_router.get(
    "",
    response_model=PaginatedResponse[ReminderRecordResponse],
    summary="List all reminder records (with optional tenant filter)",
)
def list_global_reminders(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    tenant_id: Optional[str] = Query(None, description="Optional tenant ID filter"),
    reminder_type: Optional[str] = Query(None, description="Filter by stage: DAYS_60, DAYS_30, DAYS_15, OVERDUE"),
    overdue_only: bool = Query(False, description="Filter only overdue reminders"),
    instrument_id: Optional[str] = Query(None, description="Filter by instrument ID"),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> PaginatedResponse[ReminderRecordResponse]:
    """Fetch paginated reminder records across tenants or for current user."""
    items, total = ReminderService.list_reminders(
        db=db,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        reminder_type=reminder_type,
        overdue_only=overdue_only,
        instrument_id=instrument_id,
        actor=current_user,
    )
    pages = math.ceil(total / page_size) if total > 0 else 0
    return PaginatedResponse[ReminderRecordResponse](
        items=[ReminderRecordResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
