"""Statutory Fee Assessment API Endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.database import get_db
from app.schemas.application import FeeAssessmentResponse
from app.schemas.fee import FeeCalculateRequest, FeeCalculateResponse
from app.services.fee_service import FeeService

router = APIRouter(tags=["Fees"])


@router.post(
    "/fees/calculate",
    response_model=FeeCalculateResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate statutory fee preview estimate",
)
def calculate_fee_preview(
    payload: FeeCalculateRequest,
) -> FeeCalculateResponse:
    """Calculate stateless statutory fee estimate under Twelfth Schedule of Legal Metrology Rules."""
    return FeeService.calculate_fee_estimate(payload)


@router.post(
    "/tenants/{tenant_id}/applications/calculate-fee",
    response_model=FeeCalculateResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate statutory fee preview for tenant application",
)
def calculate_fee_for_tenant(
    tenant_id: str,
    payload: FeeCalculateRequest,
) -> FeeCalculateResponse:
    """Calculate statutory fee estimate within tenant scope."""
    return FeeService.calculate_fee_estimate(payload)


@router.get(
    "/applications/{application_id}/fee-assessment",
    response_model=FeeAssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get or generate formal statutory fee assessment for application",
)
def get_application_fee_assessment(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> FeeAssessmentResponse:
    """Fetch or generate itemized statutory fee assessment for a verification application."""
    return FeeService.get_or_generate_application_fee_assessment(db, application_id, current_user)


@router.get(
    "/tenants/{tenant_id}/applications/{application_id}/fee-assessment",
    response_model=FeeAssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get formal statutory fee assessment for application under tenant",
)
def get_tenant_application_fee_assessment(
    tenant_id: str,
    application_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> FeeAssessmentResponse:
    """Fetch formal statutory fee assessment for an application under tenant."""
    return FeeService.get_or_generate_application_fee_assessment(db, application_id, current_user)
