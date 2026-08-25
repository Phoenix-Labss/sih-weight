"""Reference Standard & Calibration Management Service.

Handles calibration tracking, automated expiry status transitions, fail-closed
quarantine workflows, and out-of-tolerance impact review for verification sessions.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PreconditionFailedError,
    UnprocessableError,
)
from app.models.reference_standard import (
    CalibrationRecord,
    CustodianTypeEnum,
    ReferenceStandard,
    ReferenceStandardStatusEnum,
)
from app.models.session import SessionReferenceStandard, VerificationSession
from app.schemas.reference_standard import (
    RecalibrationRecordRequest,
    ReferenceStandardCreateRequest,
    ReferenceStandardResponse,
)

logger = logging.getLogger(__name__)


class ReferenceStandardService:
    """Service managing working/secondary standards lifecycle."""

    @staticmethod
    def create_standard(
        db: Session,
        tenant_id: str,
        payload: ReferenceStandardCreateRequest,
    ) -> ReferenceStandard:
        """Register a new certified reference standard mass or equipment."""
        existing = (
            db.query(ReferenceStandard)
            .filter(
                ReferenceStandard.tenant_id == tenant_id,
                ReferenceStandard.asset_tag == payload.asset_tag,
            )
            .first()
        )
        if existing:
            raise ConflictError(f"Reference standard with asset tag '{payload.asset_tag}' already exists in tenant.")

        cal_at = payload.calibrated_at
        val_until = payload.valid_until
        if val_until <= cal_at:
            raise UnprocessableError("Calibration valid_until date must be strictly after calibrated_at date.")

        now_utc = datetime.now(timezone.utc)
        status = ReferenceStandardStatusEnum.ACTIVE if val_until > now_utc else ReferenceStandardStatusEnum.EXPIRED

        standard = ReferenceStandard(
            tenant_id=tenant_id,
            custodian_type=payload.custodian_type,
            custodian_id=payload.custodian_id,
            asset_tag=payload.asset_tag,
            denomination_mass=payload.denomination_mass,
            mass_unit=payload.mass_unit,
            accuracy_class=payload.accuracy_class,
            serial_number=payload.serial_number,
            calibration_certificate_number=payload.calibration_certificate_number,
            calibrating_laboratory=payload.calibrating_laboratory,
            calibrated_at=cal_at,
            valid_until=val_until,
            expanded_uncertainty=payload.expanded_uncertainty,
            calibration_status=status,
        )
        db.add(standard)
        db.flush()

        # Add initial calibration record
        initial_cal = CalibrationRecord(
            standard_id=standard.standard_id,
            certificate_number=payload.calibration_certificate_number,
            calibrated_at=cal_at,
            valid_until=val_until,
            calibrating_lab=payload.calibrating_laboratory,
            expanded_uncertainty=payload.expanded_uncertainty,
            calibration_data={"initial_registration": True},
        )
        db.add(initial_cal)
        db.commit()
        db.refresh(standard)
        return standard

    @staticmethod
    def record_recalibration(
        db: Session,
        tenant_id: str,
        standard_id: str,
        payload: RecalibrationRecordRequest,
    ) -> ReferenceStandard:
        """Record new calibration certificate, updating validity and activating standard."""
        standard = (
            db.query(ReferenceStandard)
            .filter(
                ReferenceStandard.standard_id == standard_id,
                ReferenceStandard.tenant_id == tenant_id,
            )
            .first()
        )
        if not standard:
            raise NotFoundError(f"Reference standard '{standard_id}' not found in tenant.")

        if payload.valid_until <= payload.calibrated_at:
            raise UnprocessableError("Calibration valid_until must be strictly after calibrated_at.")

        # Append calibration history record
        cal_record = CalibrationRecord(
            standard_id=standard.standard_id,
            certificate_number=payload.certificate_number,
            calibrated_at=payload.calibrated_at,
            valid_until=payload.valid_until,
            calibrating_lab=payload.calibrating_lab,
            expanded_uncertainty=payload.expanded_uncertainty,
            calibration_data=payload.calibration_data,
        )
        db.add(cal_record)

        # Update standard active parameters
        standard.calibration_certificate_number = payload.certificate_number
        standard.calibrated_at = payload.calibrated_at
        standard.valid_until = payload.valid_until
        standard.calibrating_laboratory = payload.calibrating_lab
        standard.expanded_uncertainty = payload.expanded_uncertainty
        standard.calibration_status = ReferenceStandardStatusEnum.ACTIVE
        standard.quarantine_reason = None

        db.commit()
        db.refresh(standard)
        return standard

    @staticmethod
    def quarantine_standard(
        db: Session,
        tenant_id: str,
        standard_id: str,
        reason: str,
        initiate_impact_review: bool = True,
    ) -> Dict[str, Any]:
        """Quarantine standard and identify affected verification sessions for supervisor audit."""
        standard = (
            db.query(ReferenceStandard)
            .filter(
                ReferenceStandard.standard_id == standard_id,
                ReferenceStandard.tenant_id == tenant_id,
            )
            .first()
        )
        if not standard:
            raise NotFoundError(f"Reference standard '{standard_id}' not found in tenant.")

        standard.calibration_status = ReferenceStandardStatusEnum.QUARANTINED
        standard.quarantine_reason = reason
        db.flush()

        affected_sessions_count = 0
        affected_session_ids = []

        if initiate_impact_review:
            # Query sessions in last 180 days that used this standard
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=180)
            affected_records = (
                db.query(SessionReferenceStandard)
                .join(VerificationSession, SessionReferenceStandard.session_id == VerificationSession.session_id)
                .filter(
                    SessionReferenceStandard.standard_id == standard_id,
                    VerificationSession.tenant_id == tenant_id,
                    VerificationSession.created_at >= cutoff_date,
                )
                .all()
            )
            affected_session_ids = [r.session_id for r in affected_records]
            affected_sessions_count = len(affected_session_ids)

        db.commit()
        db.refresh(standard)

        return {
            "standard_id": standard.standard_id,
            "asset_tag": standard.asset_tag,
            "status": standard.calibration_status.value,
            "quarantine_reason": standard.quarantine_reason,
            "impact_review_initiated": initiate_impact_review,
            "affected_sessions_count": affected_sessions_count,
            "affected_session_ids": affected_session_ids,
        }

    @staticmethod
    def list_standards(
        db: Session,
        tenant_id: str,
        custodian_id: Optional[str] = None,
        accuracy_class: Optional[str] = None,
        status: Optional[ReferenceStandardStatusEnum] = None,
    ) -> List[ReferenceStandard]:
        """Query standards matching filter criteria."""
        query = db.query(ReferenceStandard).filter(ReferenceStandard.tenant_id == tenant_id)
        if custodian_id:
            query = query.filter(ReferenceStandard.custodian_id == custodian_id)
        if accuracy_class:
            query = query.filter(ReferenceStandard.accuracy_class == accuracy_class)
        if status:
            query = query.filter(ReferenceStandard.calibration_status == status)

        return query.order_by(ReferenceStandard.valid_until.asc()).all()

    @staticmethod
    def get_standard(
        db: Session,
        tenant_id: str,
        standard_id: str,
    ) -> ReferenceStandard:
        """Fetch single standard by ID with tenant isolation."""
        standard = (
            db.query(ReferenceStandard)
            .filter(
                ReferenceStandard.standard_id == standard_id,
                ReferenceStandard.tenant_id == tenant_id,
            )
            .first()
        )
        if not standard:
            raise NotFoundError(f"Reference standard '{standard_id}' not found in tenant.")
        return standard
