"""Digital Certificate Issuance, Cryptographic Signing, Status Event, and PDF Download REST endpoints.
"""

from __future__ import annotations

import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, get_current_user
from app.core.permissions import require_roles
from app.database import get_db
from app.models.stakeholder import RoleEnum
from app.schemas.certificate import (
    CertificateIssueRequest,
    CertificateResponse,
    CertificateStatusUpdateRequest,
)
from app.schemas.common import PaginatedResponse
from app.services.certificate_service import CertificateService
from app.services.pdf_certificate_service import PdfCertificateService

# Tenant-scoped router: /api/v1/tenants/{tenant_id}/certificates
router = APIRouter(prefix="/tenants/{tenant_id}/certificates", tags=["Certificates"])

# Direct router: /api/v1/certificates
direct_certificates_router = APIRouter(prefix="/certificates", tags=["Certificates"])


@router.post(
    "/issue",
    response_model=CertificateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Authorize and digitally sign certificate",
)
def issue_certificate(
    tenant_id: str,
    payload: CertificateIssueRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN)
    ),
) -> CertificateResponse:
    """Authorize, render immutable canonical SHA-256 hash, cryptographically sign, and issue certificate."""
    cert = CertificateService.issue_certificate(db, tenant_id, payload, current_user)
    return CertificateResponse.model_validate(cert)


@router.post(
    "/{certificate_id}/status",
    response_model=CertificateResponse,
    summary="Transition certificate lifecycle status (Suspend/Revoke/Supersede)",
)
def update_certificate_status(
    tenant_id: str,
    certificate_id: str,
    payload: CertificateStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(
        require_roles(RoleEnum.LMO, RoleEnum.SUPERVISOR, RoleEnum.CONTROLLER, RoleEnum.ADMIN)
    ),
) -> CertificateResponse:
    """Execute statutory state change on certificate (Suspend, Reinstate, Revoke, Supersede, Expire)."""
    cert = CertificateService.update_certificate_status(db, tenant_id, certificate_id, payload, current_user)
    return CertificateResponse.model_validate(cert)


@router.get(
    "/{certificate_id}/pdf",
    summary="Download official signed binary PDF certificate within tenant",
)
def download_certificate_pdf_tenant(
    tenant_id: str,
    certificate_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> Response:
    """Download binary Form 8 / Schedule XI PDF certificate for authenticated user."""
    pdf_bytes, filename = PdfCertificateService.render_pdf_for_certificate(
        db=db,
        certificate_identifier=certificate_id,
        tenant_id=tenant_id,
        actor=current_user,
        is_public=False,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{certificate_id}",
    response_model=CertificateResponse,
    summary="Download certificate metadata and status trail",
)
def get_certificate(
    tenant_id: str,
    certificate_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> CertificateResponse:
    """Fetch complete certificate record, canonical SHA-256 hash, signature, and status events."""
    cert = CertificateService.get_certificate(db, tenant_id, certificate_id, current_user)
    return CertificateResponse.model_validate(cert)


@router.get(
    "",
    response_model=PaginatedResponse[CertificateResponse],
    summary="List certificates within tenant",
)
def list_certificates(
    tenant_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> PaginatedResponse[CertificateResponse]:
    """Filter and paginate digital certificates."""
    items, total = CertificateService.list_certificates(
        db=db,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        actor=current_user,
    )
    pages = math.ceil(total / page_size) if total > 0 else 0
    return PaginatedResponse[CertificateResponse](
        items=[CertificateResponse.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# -----------------------------------------------------------------
# Direct routes (/api/v1/certificates/...)
# -----------------------------------------------------------------

@direct_certificates_router.get(
    "/{certificate_id}/pdf",
    summary="Download official signed binary PDF certificate by ID",
)
def download_certificate_pdf_direct(
    certificate_id: str,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
) -> Response:
    """Download binary Form 8 PDF certificate by certificate ID or certificate number."""
    pdf_bytes, filename = PdfCertificateService.render_pdf_for_certificate(
        db=db,
        certificate_identifier=certificate_id,
        actor=current_user,
        is_public=False,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@direct_certificates_router.get(
    "/by-token/{qr_token}/pdf",
    summary="Download public verifiable binary PDF certificate via opaque QR token",
)
def download_certificate_pdf_by_token(
    qr_token: str,
    db: Session = Depends(get_db),
) -> Response:
    """Public binary PDF certificate download via high-entropy opaque verification token."""
    pdf_bytes, filename = PdfCertificateService.render_pdf_for_certificate(
        db=db,
        certificate_identifier=qr_token,
        is_public=True,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "public, max-age=3600",
        },
    )
