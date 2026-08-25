"""Deterministic Hashing and Canonical Digest Engine for Digital Certificates.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Union
try:
    from .models import CertificateDocumentData
except ImportError:
    from models import CertificateDocumentData



def canonical_json_dumps(data: Any) -> str:
    """Serialize dictionary or model to canonical, deterministic JSON string."""
    if hasattr(data, "model_dump"):
        data_dict = data.model_dump(mode="json")
    elif isinstance(data, dict):
        data_dict = data
    else:
        data_dict = json.loads(json.dumps(data, default=str))

    return json.dumps(
        data_dict,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )


def calculate_canonical_payload_hash(data: Union[CertificateDocumentData, Dict[str, Any]]) -> str:
    """Calculate SHA-256 hexadecimal digest of canonical certificate JSON payload."""
    canonical_str = canonical_json_dumps(data)
    return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()


def calculate_pdf_bytes_hash(pdf_bytes: bytes) -> str:
    """Calculate SHA-256 hexadecimal digest of generated binary PDF bytes."""
    return hashlib.sha256(pdf_bytes).hexdigest()


def verify_certificate_hash(pdf_bytes: bytes, expected_hash: str) -> bool:
    """Check if the SHA-256 digest of PDF bytes matches the expected hash."""
    actual_hash = calculate_pdf_bytes_hash(pdf_bytes)
    return actual_hash.lower() == expected_hash.lower()
