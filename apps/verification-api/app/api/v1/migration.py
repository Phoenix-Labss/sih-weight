"""Legacy Record Migration & Batch Reconciliation REST endpoints.
"""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.core.permissions import require_roles
from app.database import get_db
from app.models.stakeholder import RoleEnum
from app.schemas.migration import (
    MigrationBatchCreateRequest,
    MigrationBatchResponse,
)
from app.services.migration_service import LegacyMigrationService

router = APIRouter(prefix="/tenants/{tenant_id}/migration/batches", tags=["Legacy Migration"])


@router.post(
    "",
    response_model=MigrationBatchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest historical verification register batch",
)
def upload_migration_batch(
    tenant_id: str,
    payload: MigrationBatchCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.ADMIN, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER)
    ),
) -> MigrationBatchResponse:
    """Ingest, confidence-tag, and reconcile legacy verification records."""
    batch = LegacyMigrationService.process_migration_batch(db, tenant_id, current_user.user_id, payload)
    return MigrationBatchResponse.model_validate(batch)


@router.get(
    "",
    response_model=List[MigrationBatchResponse],
    status_code=status.HTTP_200_OK,
    summary="List legacy migration batches",
)
def list_migration_batches(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.ADMIN, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.AUDITOR)
    ),
) -> List[MigrationBatchResponse]:
    """List all historical import batches in tenant."""
    batches = LegacyMigrationService.list_batches(db, tenant_id)
    return [MigrationBatchResponse.model_validate(b) for b in batches]


@router.get(
    "/{batch_id}",
    response_model=MigrationBatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Get legacy migration batch summary",
)
def get_migration_batch(
    tenant_id: str,
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.ADMIN, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.AUDITOR)
    ),
) -> MigrationBatchResponse:
    """Fetch migration batch summary and reconciliation report."""
    batch = LegacyMigrationService.get_batch(db, tenant_id, batch_id)
    return MigrationBatchResponse.model_validate(batch)
