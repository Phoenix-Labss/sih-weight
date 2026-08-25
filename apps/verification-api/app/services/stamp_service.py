"""Service layer for Physical Stamps and Security Seals (Decoupled Ledger).
"""

from __future__ import annotations

from typing import List
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import UserContext
from app.core.errors import NotFoundError
from app.core.permissions import verify_tenant_access
from app.models.session import VerificationSession
from app.models.stamp import PhysicalStampAction
from app.schemas.stamp import PhysicalStampRecordRequest


class StampService:
    """Business logic for physical stamping and wire sealing actions."""

    @staticmethod
    def record_stamp_action(
        db: Session,
        tenant_id: str,
        session_id: str,
        data: PhysicalStampRecordRequest,
        actor: UserContext,
    ) -> PhysicalStampAction:
        """Record a physical stamp or lead/wire seal application."""
        verify_tenant_access(actor, tenant_id)

        session = db.execute(
            select(VerificationSession).where(
                VerificationSession.tenant_id == tenant_id,
                VerificationSession.session_id == session_id,
            )
        ).scalar_one_or_none()
        if not session:
            raise NotFoundError(f"Verification session [{session_id}] not found in tenant [{tenant_id}]")

        instrument_id = data.instrument_id or session.instrument_id

        stamp_action = PhysicalStampAction(
            tenant_id=tenant_id,
            session_id=session.session_id,
            instrument_id=instrument_id,
            verifier_id=actor.user_id,
            action_type=data.action_type,
            seal_type=data.seal_type,
            seal_identification_number=data.seal_identification_number,
            seal_position=data.seal_position,
            photo_evidence_hash=data.photo_evidence_hash,
            photo_storage_path=data.photo_storage_path,
            notes=data.notes,
        )
        db.add(stamp_action)
        db.flush()
        db.refresh(stamp_action)
        return stamp_action

    @staticmethod
    def list_session_stamps(
        db: Session,
        tenant_id: str,
        session_id: str,
        actor: UserContext,
    ) -> List[PhysicalStampAction]:
        """List all physical stamps and seals recorded during a session."""
        verify_tenant_access(actor, tenant_id)
        results = db.execute(
            select(PhysicalStampAction).where(
                PhysicalStampAction.tenant_id == tenant_id,
                PhysicalStampAction.session_id == session_id,
            )
        ).scalars().all()
        return list(results)

    @staticmethod
    def list_instrument_stamps(
        db: Session,
        tenant_id: str,
        instrument_id: str,
        actor: UserContext,
    ) -> List[PhysicalStampAction]:
        """List physical stamping lifetime history for an instrument."""
        verify_tenant_access(actor, tenant_id)
        results = db.execute(
            select(PhysicalStampAction).where(
                PhysicalStampAction.tenant_id == tenant_id,
                PhysicalStampAction.instrument_id == instrument_id,
            )
        ).scalars().all()
        return list(results)
