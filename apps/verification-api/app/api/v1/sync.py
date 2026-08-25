"""Offline Synchronization & Device Registration REST endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.core.permissions import require_roles
from app.database import get_db
from app.models.stakeholder import RoleEnum
from app.schemas.sync import (
    DeviceRegisterRequest,
    DeviceResponse,
    SyncPullRequest,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from app.services.sync_service import SyncService

router = APIRouter(prefix="/tenants/{tenant_id}/sync", tags=["Offline Sync"])


@router.post(
    "/devices",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register field device for offline sync",
)
def register_device(
    tenant_id: str,
    payload: DeviceRegisterRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.ADMIN, RoleEnum.SUPERVISOR)
    ),
) -> DeviceResponse:
    """Register mobile/handheld device authorized to pull and cache tasks offline."""
    device = SyncService.register_device(db, tenant_id, current_user.user_id, payload)
    return DeviceResponse.model_validate(device)


@router.post(
    "/pull",
    response_model=SyncPullResponse,
    status_code=status.HTTP_200_OK,
    summary="Pull assigned verification tasks and reference standards",
)
def pull_sync_delta(
    tenant_id: str,
    payload: SyncPullRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.ADMIN, RoleEnum.SUPERVISOR)
    ),
) -> SyncPullResponse:
    """Download delta changes, assigned tasks, standards, and procedure packs for offline inspection."""
    return SyncService.pull_sync_delta(
        db,
        tenant_id,
        current_user.user_id,
        payload.device_id,
        payload.last_known_revision,
        payload.jurisdiction_id,
    )


@router.post(
    "/push",
    response_model=SyncPushResponse,
    status_code=status.HTTP_200_OK,
    summary="Push offline recorded observations, stamps, and dispositions",
)
def push_sync_actions(
    tenant_id: str,
    payload: SyncPushRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.GATC_VERIFIER, RoleEnum.ADMIN, RoleEnum.SUPERVISOR)
    ),
) -> SyncPushResponse:
    """Batch upload and commit actions taken while field inspector device was offline."""
    return SyncService.push_sync_actions(db, tenant_id, current_user.user_id, payload)
