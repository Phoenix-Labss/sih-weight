"""Itemized Statutory Receipt Generator.

Generates official, tamper-evident payment receipts with unique serial numbers
and SHA-256 digital verification integrity hashes.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from .models import StatutoryReceipt


class StatutoryReceiptGenerator:
    """Generates official verification fee receipts with cryptographic hash badges."""

    @staticmethod
    def generate_receipt_number(tenant_id: str, paid_at: Optional[datetime] = None) -> str:
        """Generate official receipt number e.g. REC-DL-20260823-A8F19C."""
        dt = paid_at or datetime.now(timezone.utc)
        date_str = dt.strftime("%Y%m%d")
        t_clean = tenant_id.replace("IN-", "").replace("-", "")[:3].upper()
        rand_suffix = uuid.uuid4().hex[:6].upper()
        return f"REC-{t_clean}-{date_str}-{rand_suffix}"

    @classmethod
    def create_receipt(
        cls,
        payment_id: str,
        application_id: str,
        tenant_id: str,
        payer_name: str,
        amount: Decimal,
        gateway_reference: str,
        payment_method: str = "ONLINE_GATEWAY",
        application_number: Optional[str] = None,
        itemized_breakdown: Optional[List[Dict[str, Any]]] = None,
        paid_at: Optional[datetime] = None,
        receipt_number: Optional[str] = None,
    ) -> StatutoryReceipt:
        """Create a validated statutory receipt with canonical hash."""
        dt_paid = paid_at or datetime.now(timezone.utc)
        rcpt_num = receipt_number or cls.generate_receipt_number(tenant_id, dt_paid)
        breakdown = itemized_breakdown or []

        # Canonical data for hash verification
        canonical_data = {
            "receipt_number": rcpt_num,
            "payment_id": payment_id,
            "application_id": application_id,
            "application_number": application_number,
            "tenant_id": tenant_id,
            "payer_name": payer_name,
            "amount": str(amount),
            "currency": "INR",
            "gateway_reference": gateway_reference,
            "paid_at": dt_paid.isoformat(),
            "itemized_breakdown": breakdown,
        }

        canonical_json = json.dumps(canonical_data, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

        return StatutoryReceipt(
            receipt_number=rcpt_num,
            payment_id=payment_id,
            application_id=application_id,
            application_number=application_number,
            tenant_id=tenant_id,
            payer_name=payer_name,
            amount=amount,
            currency="INR",
            payment_method=payment_method,
            gateway_reference=gateway_reference,
            paid_at=dt_paid,
            itemized_breakdown=breakdown,
            digital_verification_hash=digest,
        )
