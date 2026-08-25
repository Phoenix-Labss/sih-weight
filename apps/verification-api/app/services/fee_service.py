"""Service layer for Statutory Fee Assessment and calculation.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import UserContext
from app.core.errors import NotFoundError, UnprocessableError
from app.core.permissions import verify_tenant_access
from app.core.state_machines import ApplicationStateMachine, UserContext as SmUserContext
from app.models.application import (
    ApplicationStatusEnum,
    FeeAssessment,
    PaymentStatusEnum,
    VerificationApplication,
)
from app.models.instrument import Instrument
from app.schemas.application import FeeAssessmentResponse
from app.schemas.fee import (
    FeeCalculateRequest,
    FeeCalculateResponse,
    FeeItemBreakdownSchema,
)
from packages.verification_fees import (
    FeeAssessmentRequest,
    FeeServiceMode,
    FeeVerificationType,
    default_fee_calculator,
)


class FeeService:
    """Business logic for fee assessment and statutory calculation."""

    @staticmethod
    def calculate_fee_estimate(data: FeeCalculateRequest) -> FeeCalculateResponse:
        """Stateless calculation of verification fee estimate for any instrument parameters."""
        pkg_req = FeeAssessmentRequest(
            category=data.category,
            accuracy_class=data.accuracy_class,
            max_capacity=data.max_capacity,
            capacity_unit=data.capacity_unit,
            service_mode=FeeServiceMode(data.service_mode.value if hasattr(data.service_mode, "value") else str(data.service_mode)),
            verification_type=FeeVerificationType(data.verification_type.value if hasattr(data.verification_type, "value") else str(data.verification_type)),
            is_late_submission=data.is_late_submission,
            days_overdue=data.days_overdue,
            months_overdue=data.months_overdue,
            policy_version=data.policy_version,
        )

        result = default_fee_calculator.calculate(pkg_req)

        breakdown = [
            FeeItemBreakdownSchema(
                code=item.code,
                name=item.name,
                amount=item.amount,
                description=item.description,
            )
            for item in result.itemized_breakdown
        ]

        return FeeCalculateResponse(
            base_verification_fee=result.base_fee,
            location_multiplier=result.location_multiplier,
            location_surcharge=result.location_surcharge,
            portal_charge=result.portal_charge,
            late_fee=result.late_fee,
            total_assessed_amount=result.total_fee,
            currency=result.currency,
            policy_version=result.policy_version,
            itemized_breakdown=breakdown,
            calculated_at=result.calculated_at,
        )

    @staticmethod
    def get_or_generate_application_fee_assessment(
        db: Session,
        application_id: str,
        actor: UserContext,
    ) -> FeeAssessmentResponse:
        """Fetch existing formal fee assessment or generate a statutory assessment from application facts."""
        app = db.execute(
            select(VerificationApplication)
            .options(
                joinedload(VerificationApplication.fee_assessment),
                joinedload(VerificationApplication.instrument).joinedload(Instrument.model),
            )
            .where(
                (VerificationApplication.application_id == application_id)
                | (VerificationApplication.application_number == application_id)
            )
        ).unique().scalar_one_or_none()

        if not app:
            raise NotFoundError(f"Application [{application_id}] not found")

        verify_tenant_access(actor, app.tenant_id)

        # 1. If already assessed, return existing assessment
        if app.fee_assessment:
            return FeeAssessmentResponse.model_validate(app.fee_assessment)

        # 2. Otherwise calculate based on instrument specifications
        instrument = app.instrument
        if not instrument:
            raise NotFoundError(f"Instrument linked to application [{application_id}] not found")

        # Extract capacity and accuracy class from instrument or pattern model
        accuracy_class = "CLASS_III"
        max_capacity = Decimal("15.00")
        capacity_unit = "kg"

        if instrument.model:
            accuracy_class = str(instrument.model.accuracy_class.value if hasattr(instrument.model.accuracy_class, "value") else instrument.model.accuracy_class)
            max_capacity = instrument.model.max_capacity
            capacity_unit = instrument.model.capacity_unit or "kg"

        calc_req = FeeAssessmentRequest(
            category="NAWI",
            accuracy_class=accuracy_class,
            max_capacity=max_capacity,
            capacity_unit=capacity_unit,
            service_mode=FeeServiceMode(app.service_mode.value if hasattr(app.service_mode, "value") else str(app.service_mode)),
            verification_type=FeeVerificationType(app.application_type.value if hasattr(app.application_type, "value") else str(app.application_type)),
            is_late_submission=False,
            policy_version="IN-FEES-2026.1",
        )

        fee_result = default_fee_calculator.calculate(calc_req)

        # Create FeeAssessment record
        fee_assessment = FeeAssessment(
            tenant_id=app.tenant_id,
            policy_version=fee_result.policy_version,
            base_verification_fee=fee_result.base_fee,
            user_charge=fee_result.portal_charge,
            late_fee=fee_result.late_fee,
            total_assessed_amount=fee_result.total_fee,
            currency="INR",
            payment_status=PaymentStatusEnum.PENDING,
        )
        db.add(fee_assessment)
        db.flush()

        app.fee_assessment_id = fee_assessment.fee_assessment_id
        # If application was accepted or in scrutiny, transition state machine
        if app.current_status in (ApplicationStatusEnum.ACCEPTED, ApplicationStatusEnum.UNDER_SCRUTINY):
            sm_actor = SmUserContext(
                user_id=actor.user_id,
                tenant_id=actor.tenant_id,
                role=actor.role,
                jurisdiction_id=actor.jurisdiction_id,
                is_active=actor.is_active,
            )
            ApplicationStateMachine.issue_fee_assessment(app, fee_assessment, sm_actor)

        db.flush()
        db.refresh(fee_assessment)
        return FeeAssessmentResponse.model_validate(fee_assessment)
