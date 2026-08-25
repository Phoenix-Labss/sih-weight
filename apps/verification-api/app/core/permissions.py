"""Multi-tenancy boundary enforcement and Role/Attribute-Based Access Control (RBAC/ABAC).
"""

from __future__ import annotations

from typing import Callable, Optional, Set

from fastapi import Depends

from app.core.auth import UserContext, get_current_user
from app.core.errors import ForbiddenError
from app.models.stakeholder import RoleEnum


def verify_tenant_access(current_user: UserContext, requested_tenant_id: str) -> None:
    """Enforce strict logical tenant isolation.

    Fail-closed: Rejects any attempt to read/write across state/UT tenant boundaries
    unless the caller is a global Administrator.
    """
    if current_user.tenant_id != requested_tenant_id and not current_user.has_role(RoleEnum.ADMIN):
        raise ForbiddenError(
            message=f"Access denied: User tenant [{current_user.tenant_id}] cannot access tenant [{requested_tenant_id}].",
            error_code="TENANT_ACCESS_DENIED",
            details={
                "user_tenant_id": current_user.tenant_id,
                "requested_tenant_id": requested_tenant_id,
            },
        )


def verify_jurisdiction_access(current_user: UserContext, target_jurisdiction_id: Optional[str]) -> None:
    """Enforce Legal Metrology Officer and GATC departmental jurisdiction boundaries."""
    if not target_jurisdiction_id:
        return

    # Admins and Supervisors possess tenant-wide jurisdiction
    if current_user.has_role(RoleEnum.ADMIN, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER):
        return

    # LMO and GATC verifiers must have an assigned jurisdiction matching target
    if current_user.has_role(RoleEnum.LMO, RoleEnum.GATC_VERIFIER):
        if current_user.jurisdiction_id and current_user.jurisdiction_id.lower() != target_jurisdiction_id.lower():
            raise ForbiddenError(
                message=(
                    f"Action outside authorized jurisdiction: Officer jurisdiction [{current_user.jurisdiction_id}] "
                    f"does not match target jurisdiction [{target_jurisdiction_id}]."
                ),
                error_code="OUTSIDE_JURISDICTION",
                details={
                    "officer_jurisdiction_id": current_user.jurisdiction_id,
                    "target_jurisdiction_id": target_jurisdiction_id,
                },
            )


def require_roles(*allowed_roles: RoleEnum | str) -> Callable[[UserContext], UserContext]:
    """Dependency factory checking if authenticated user possesses any of the required roles."""
    allowed_str_set: Set[str] = {
        r.value if isinstance(r, RoleEnum) else str(r) for r in allowed_roles
    }

    async def role_checker(current_user: UserContext = Depends(get_current_user)) -> UserContext:
        if not current_user.has_role(*allowed_roles):
            raise ForbiddenError(
                message=(
                    f"Insufficient permissions: Role '{current_user.role_str()}' is not authorized. "
                    f"Required one of: {sorted(list(allowed_str_set))}."
                ),
                error_code="INSUFFICIENT_PERMISSIONS",
                details={
                    "user_role": current_user.role_str(),
                    "required_roles": list(allowed_str_set),
                },
            )
        return current_user

    return role_checker
