"""Government Approved Test Centre (GATC) Lifecycle & Competency Service.

Enforces statutory scope restrictions, category/capacity bounds, accreditation validity,
and competency checks under Legal Metrology (GATC) Rules, 2013.
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    PreconditionFailedError,
    UnprocessableError,
)
from app.models.stakeholder import Facility, GATCProfile
from app.schemas.gatc import (
    GATCProfileCreateRequest,
    GATCProfileResponse,
    GATCScopeCheckRequest,
)

logger = logging.getLogger(__name__)


class GATCService:
    """Service managing GATC center approvals and scope compliance."""

    @staticmethod
    def register_gatc_profile(
        db: Session,
        tenant_id: str,
        payload: GATCProfileCreateRequest,
    ) -> GATCProfile:
        """Register a new approved GATC test facility and scope."""
        facility = (
            db.query(Facility)
            .filter(
                Facility.facility_id == payload.facility_id,
                Facility.tenant_id == tenant_id,
            )
            .first()
        )
        if not facility:
            raise NotFoundError(f"Facility '{payload.facility_id}' not found in tenant.")

        if payload.valid_to <= payload.valid_from:
            raise UnprocessableError("GATC authorization valid_to date must be after valid_from date.")

        profile = GATCProfile(
            tenant_id=tenant_id,
            facility_id=payload.facility_id,
            approval_order_number=payload.approval_order_number,
            approved_scope=payload.approved_scope,
            valid_from=payload.valid_from,
            valid_to=payload.valid_to,
            status="ACTIVE",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    @staticmethod
    def check_gatc_scope(
        db: Session,
        tenant_id: str,
        gatc_id: str,
        payload: GATCScopeCheckRequest,
    ) -> Dict[str, Any]:
        """Verify whether a GATC is legally authorized to test an instrument of given class & capacity."""
        gatc = (
            db.query(GATCProfile)
            .filter(
                GATCProfile.gatc_id == gatc_id,
                GATCProfile.tenant_id == tenant_id,
            )
            .first()
        )
        if not gatc:
            raise NotFoundError(f"GATC Profile '{gatc_id}' not found in tenant.")

        now_utc = datetime.now(timezone.utc)
        valid_from = gatc.valid_from if gatc.valid_from.tzinfo else gatc.valid_from.replace(tzinfo=timezone.utc)
        valid_to = gatc.valid_to if gatc.valid_to.tzinfo else gatc.valid_to.replace(tzinfo=timezone.utc)

        if not (valid_from <= now_utc <= valid_to):
            return {
                "is_authorized": False,
                "reason": f"GATC approval order '{gatc.approval_order_number}' is outside valid window ({valid_from.date()} to {valid_to.date()}).",
            }

        if gatc.status != "ACTIVE":
            return {
                "is_authorized": False,
                "reason": f"GATC center status is currently '{gatc.status}'.",
            }

        scope = gatc.approved_scope or {}
        allowed_categories = scope.get("instrument_categories", ["NAWI"])
        allowed_classes = scope.get("accuracy_classes", ["Class III", "Class IIII"])
        max_capacity = scope.get("max_capacity_kg", 50000)

        if payload.instrument_category not in allowed_categories:
            return {
                "is_authorized": False,
                "reason": f"Category '{payload.instrument_category}' is outside GATC approved categories: {allowed_categories}.",
            }

        if payload.accuracy_class not in allowed_classes:
            return {
                "is_authorized": False,
                "reason": f"Accuracy class '{payload.accuracy_class}' is outside GATC approved classes: {allowed_classes}.",
            }

        if payload.capacity_kg > max_capacity:
            return {
                "is_authorized": False,
                "reason": f"Instrument capacity {payload.capacity_kg}kg exceeds GATC maximum approved capacity {max_capacity}kg.",
            }

        return {
            "is_authorized": True,
            "gatc_id": gatc.gatc_id,
            "approval_order_number": gatc.approval_order_number,
            "valid_until": gatc.valid_to.isoformat(),
        }

    @staticmethod
    def list_gatc_profiles(db: Session, tenant_id: str) -> List[GATCProfile]:
        """List all GATC centers in tenant."""
        return db.query(GATCProfile).filter(GATCProfile.tenant_id == tenant_id).all()

    @staticmethod
    def get_gatc_profile(db: Session, tenant_id: str, gatc_id: str) -> GATCProfile:
        """Fetch single GATC profile by ID."""
        gatc = (
            db.query(GATCProfile)
            .filter(
                GATCProfile.gatc_id == gatc_id,
                GATCProfile.tenant_id == tenant_id,
            )
            .first()
        )
        if not gatc:
            raise NotFoundError(f"GATC Profile '{gatc_id}' not found.")
        return gatc
