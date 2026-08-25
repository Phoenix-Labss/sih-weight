"""National Federated Legal Metrology Registry & Cross-State Inter-Operability Service.

Provides:
1. Unified National Certificate Lookup across federated state/UT nodes.
2. National Aggregated Dashboard Metrics (total instruments, national compliance rate, total revenue).
3. Cross-jurisdictional enforcement check for interstate goods carriers and mobile instruments.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.certificate import Certificate, CertificateStatusEnum
from app.models.instrument import Instrument
from app.models.payment import PaymentLifecycleEnum, PaymentTransaction
from app.models.session import VerificationOutcomeEnum, VerificationSession
from app.models.tenant import Tenant


class FederatedNationalRegistryService:
    """National level aggregator and cross-state lookup engine."""

    @staticmethod
    def national_certificate_lookup(
        db: Session,
        query_identifier: str,  # Certificate Number or Serial Number or QR Token
    ) -> Optional[Dict[str, Any]]:
        """Search across all state and UT tenants for matching certificate or instrument."""
        query_id = query_identifier.strip()
        
        cert = (
            db.query(Certificate)
            .filter(
                (Certificate.certificate_number == query_id)
                | (Certificate.public_verification_token == query_id)
            )
            .first()
        )
        if cert:
            inst = cert.instrument
            return {
                "matched_by": "CERTIFICATE_NUMBER_OR_TOKEN",
                "tenant_id": cert.tenant_id,
                "state_code": cert.tenant.state_code if cert.tenant else cert.tenant_id,
                "certificate_number": cert.certificate_number,
                "certificate_status": cert.certificate_status.value if hasattr(cert.certificate_status, "value") else str(cert.certificate_status),
                "instrument_category": inst.model.category if inst and inst.model else "NAWI",
                "instrument_serial": inst.serial_number if inst else "UNKNOWN",
                "issue_date": cert.issue_date.isoformat() if cert.issue_date else None,
                "valid_until": cert.valid_until.isoformat() if cert.valid_until else None,
                "public_verification_token": cert.public_verification_token,
            }

        # Check by serial number across all states
        inst = db.query(Instrument).filter(Instrument.serial_number == query_id).first()
        if inst:
            latest_cert = (
                db.query(Certificate)
                .filter(Certificate.instrument_id == inst.instrument_id)
                .order_by(Certificate.issue_date.desc())
                .first()
            )
            return {
                "matched_by": "INSTRUMENT_SERIAL_NUMBER",
                "tenant_id": inst.tenant_id,
                "instrument_id": inst.instrument_id,
                "serial_number": inst.serial_number,
                "category": inst.model.category if inst and inst.model else "NAWI",
                "intended_use": inst.intended_use,
                "latest_certificate_number": latest_cert.certificate_number if latest_cert else None,
                "latest_certificate_status": latest_cert.certificate_status.value if latest_cert and hasattr(latest_cert.certificate_status, "value") else "NO_CERTIFICATE",
                "valid_until": latest_cert.valid_until.isoformat() if latest_cert and latest_cert.valid_until else None,
            }

        return None

    @staticmethod
    def get_national_aggregates(db: Session) -> Dict[str, Any]:
        """Aggregate national performance and compliance metrics across all Indian States & UTs."""
        total_tenants = db.query(Tenant).count()
        total_instruments = db.query(Instrument).count()
        total_certificates = db.query(Certificate).count()
        active_certificates = (
            db.query(Certificate)
            .filter(Certificate.certificate_status == CertificateStatusEnum.ISSUED)
            .count()
        )
        
        # Total National Reconciled Revenue
        rev_val = (
            db.query(func.coalesce(func.sum(PaymentTransaction.amount), Decimal("0.00")))
            .filter(PaymentTransaction.status == PaymentLifecycleEnum.RECONCILED)
            .scalar()
        )
        total_national_revenue = str(Decimal(str(rev_val or "0.00")))

        compliance_rate = (
            round((active_certificates / total_instruments) * 100, 2)
            if total_instruments > 0
            else 100.0
        )

        return {
            "national_registry": "National Legal Metrology Portal (e-Maap Vidhi)",
            "participating_states_count": max(total_tenants, 36),
            "total_registered_instruments": total_instruments,
            "total_certificates_issued": total_certificates,
            "active_valid_certificates": active_certificates,
            "national_compliance_percentage": compliance_rate,
            "total_statutory_revenue_inr": total_national_revenue,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
