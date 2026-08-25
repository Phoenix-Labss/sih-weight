"""Pydantic v2 schemas for Verification Applications and Statutory Fee Assessments.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import ConfigDict, Field

from app.models.application import (
    ApplicationStatusEnum,
    ApplicationTypeEnum,
    PaymentStatusEnum,
    ServiceModeEnum,
)
from app.schemas.common import BaseSchema


class FeeAssessmentResponse(BaseSchema):
    fee_assessment_id: str
    tenant_id: str
    policy_version: str
    base_verification_fee: Decimal
    user_charge: Decimal
    late_fee: Decimal
    total_assessed_amount: Decimal
    currency: str
    payment_status: PaymentStatusEnum
    payment_gateway_ref: Optional[str] = None
    treasury_challan_number: Optional[str] = None
    receipt_number: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class FeeAssessmentCreate(BaseSchema):
    base_verification_fee: Decimal = Field(..., gt=0, decimal_places=2)
    user_charge: Decimal = Field(Decimal("0.00"), ge=0, decimal_places=2)
    late_fee: Decimal = Field(Decimal("0.00"), ge=0, decimal_places=2)
    policy_version: str = Field("POL-FEES-2026.1", min_length=2, max_length=50)


class PaymentReconcileRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    receipt_number: Optional[str] = Field(None, min_length=2, max_length=100)
    payment_gateway_ref: Optional[str] = Field(None, min_length=2, max_length=100)


class ApplicationCreateRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    instrument_id: str = Field(..., min_length=1, max_length=36)
    applicant_id: str = Field(..., min_length=1, max_length=36)
    application_type: ApplicationTypeEnum = Field(default=ApplicationTypeEnum.INITIAL_VERIFICATION)
    service_mode: ServiceModeEnum = Field(default=ServiceModeEnum.ON_SITE)
    preferred_verification_date: Optional[date] = None
    applicant_declaration_accepted: bool = Field(default=True)


class ApplicationScrutinyRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    action: str = Field(..., description="'ACCEPT', 'QUERY', or 'REJECT'")
    notes: Optional[str] = Field(None, max_length=1000)
    query_text: Optional[str] = Field(None, max_length=1000)
    rejection_reason: Optional[str] = Field(None, max_length=1000)


class ApplicationCorrectionRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    correction_notes: str = Field(..., min_length=3, max_length=1000)


class ApplicationScheduleRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    slot_start: datetime
    slot_end: datetime
    assigned_lmo_id: Optional[str] = None
    assigned_gatc_id: Optional[str] = None


class ApplicationResponse(BaseSchema):
    application_id: str
    application_number: str
    tenant_id: str
    jurisdiction_id: str
    instrument_id: str
    applicant_id: str
    application_type: ApplicationTypeEnum
    service_mode: ServiceModeEnum
    preferred_verification_date: Optional[date] = None
    scheduled_slot_start: Optional[datetime] = None
    scheduled_slot_end: Optional[datetime] = None
    assigned_lmo_id: Optional[str] = None
    assigned_gatc_id: Optional[str] = None
    fee_assessment_id: Optional[str] = None
    current_status: ApplicationStatusEnum
    scrutiny_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    active_query: Optional[str] = None
    query_raised_at: Optional[datetime] = None
    applicant_declaration_accepted: bool
    version: int
    fee_assessment: Optional[FeeAssessmentResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
