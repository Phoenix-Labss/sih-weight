"""Deterministic PDF/A Certificate Generator Package.

Provides Form 8 / Schedule XI compliant Legal Metrology Certificate rendering,
embedded dynamic QR codes, digital signature badges, and SHA-256 integrity verification.
"""

from .models import (
    InstrumentDocData,
    VerificationDocData,
    StandardDocData,
    StampDocData,
    SignatureDocData,
    CertificateDocumentData,
)
from .generator import (
    CertificatePdfGenerator,
    render_certificate_pdf,
)
from .hasher import (
    canonical_json_dumps,
    calculate_canonical_payload_hash,
    calculate_pdf_bytes_hash,
    verify_certificate_hash,
)

__all__ = [
    "InstrumentDocData",
    "VerificationDocData",
    "StandardDocData",
    "StampDocData",
    "SignatureDocData",
    "CertificateDocumentData",
    "CertificatePdfGenerator",
    "render_certificate_pdf",
    "canonical_json_dumps",
    "calculate_canonical_payload_hash",
    "calculate_pdf_bytes_hash",
    "verify_certificate_hash",
]
