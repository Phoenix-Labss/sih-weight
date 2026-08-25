"""Supervisor & Controller Metrics and Privileged Audit REST endpoints.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.core.permissions import require_roles
from app.database import get_db
from app.models.stakeholder import RoleEnum
from app.schemas.supervisor import SupervisorOverviewMetrics
from app.services.supervisor_service import SupervisorService

router = APIRouter(prefix="/tenants/{tenant_id}/supervisor", tags=["Supervisor Dashboard"])


@router.get(
    "/overview",
    response_model=SupervisorOverviewMetrics,
    status_code=status.HTTP_200_OK,
    summary="Get tenant-wide operational and pendency overview",
)
def get_supervisor_overview(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN, RoleEnum.AUDITOR)
    ),
) -> SupervisorOverviewMetrics:
    """Fetch aggregated pendency, turnaround, revenue, and officer workload statistics."""
    return SupervisorService.get_overview_metrics(db, tenant_id)


@router.get(
    "/audit-logs",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Query privileged audit logs",
)
def get_audit_logs(
    tenant_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN, RoleEnum.AUDITOR)
    ),
) -> List[Dict[str, Any]]:
    """Query immutable audit events for scrutiny, overrides, and administrative actions."""
    return SupervisorService.get_audit_logs(db, tenant_id, limit, offset, action)
