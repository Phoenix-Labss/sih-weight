"""Public Verification Endpoint (Zero PII / Privacy-Preserving / Opaque QR Token Resolution).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.public import PublicCertificateVerifyResponse
from app.services.pdf_certificate_service import PdfCertificateService
from app.services.public_service import PublicService

router = APIRouter(tags=["Public Verification"])


@router.get(
    "/public/certificates/verify/{qr_reference}",
    response_model=PublicCertificateVerifyResponse,
    summary="Verify statutory certificate authenticity via opaque QR token",
)
def verify_public_certificate(
    qr_reference: str,
    db: Session = Depends(get_db),
) -> PublicCertificateVerifyResponse:
    """Public verification projection resolving 256-bit opaque QR reference.

    Guarantees:
    - Cryptographic signature check against immutable canonical SHA-256 payload.
    - Full PII Redaction: No trader/owner personal name, phone, email, address, or payment secrets.
    - Masked serial number for on-site physical comparison.
    - Authoritative lifecycle status (ISSUED, EXPIRED, SUSPENDED, REVOKED, SUPERSEDED).
    """
    return PublicService.verify_public_certificate(db, qr_reference)


@router.get(
    "/v/{qr_reference}",
    response_model=PublicCertificateVerifyResponse,
    summary="Short verification URL alias",
    include_in_schema=False,
)
def verify_short_url(
    qr_reference: str,
    db: Session = Depends(get_db),
) -> PublicCertificateVerifyResponse:
    """Alias route for QR code scanner payloads."""
    return PublicService.verify_public_certificate(db, qr_reference)


@router.get(
    "/public/certificates/{qr_reference}/pdf",
    summary="Download public verifiable binary PDF certificate via opaque QR token",
)
def download_public_certificate_pdf(
    qr_reference: str,
    db: Session = Depends(get_db),
) -> Response:
    """Public binary PDF certificate download with masked PII via opaque QR reference token."""
    pdf_bytes, filename = PdfCertificateService.render_pdf_for_certificate(
        db=db,
        certificate_identifier=qr_reference,
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


@router.get(
    "/v/{qr_reference}/pdf",
    summary="Short verification URL alias for public PDF certificate download",
    include_in_schema=False,
)
def download_short_url_pdf(
    qr_reference: str,
    db: Session = Depends(get_db),
) -> Response:
    """Short URL alias for downloading public verifiable PDF certificate."""
    pdf_bytes, filename = PdfCertificateService.render_pdf_for_certificate(
        db=db,
        certificate_identifier=qr_reference,
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
