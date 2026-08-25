"""Phase 3 Test Suite: Legacy Record Migration & Reconciliation.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.stakeholder import RoleEnum


class TestLegacyMigration:
    """Historical migration tests."""

    def test_legacy_batch_import_and_reconciliation(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        tenant_id = seed_data["tenant_id"]
        admin_user_id = seed_data["lmo_user_id"]
        jurisdiction_id = seed_data["jurisdiction_id"]
        headers_admin = auth_headers(user_id=admin_user_id, tenant_id=tenant_id, role=RoleEnum.ADMIN)

        now_utc = datetime.now(timezone.utc)
        serial_1 = f"SN-LEGACY-{uuid.uuid4().hex[:6].upper()}"
        serial_2 = f"SN-LEGACY-{uuid.uuid4().hex[:6].upper()}"

        records = [
            {
                "legacy_certificate_number": f"MH/VER/2024/{uuid.uuid4().hex[:4].upper()}",
                "legacy_verification_date": (now_utc - timedelta(days=120)).isoformat(),
                "legacy_expiry_date": (now_utc + timedelta(days=245)).isoformat(),
                "trader_name": "Sharma Supermarket",
                "instrument_category": "NAWI",
                "instrument_serial": serial_1,
                "capacity_text": "30 kg",
                "trust_level": "VERIFIED_LEGACY",
            },
            {
                "legacy_certificate_number": f"MH/VER/2024/{uuid.uuid4().hex[:4].upper()}",
                "legacy_verification_date": (now_utc - timedelta(days=90)).isoformat(),
                "legacy_expiry_date": (now_utc + timedelta(days=275)).isoformat(),
                "trader_name": "Patel Hardware",
                "instrument_category": "NAWI",
                "instrument_serial": serial_2,
                "capacity_text": "50 kg",
                "trust_level": "DIGITIZED_FROM_SOURCE",
            },
            {
                "legacy_certificate_number": f"MH/VER/2024/{uuid.uuid4().hex[:4].upper()}",
                "legacy_verification_date": (now_utc - timedelta(days=90)).isoformat(),
                "legacy_expiry_date": (now_utc + timedelta(days=275)).isoformat(),
                "trader_name": "Patel Hardware Duplicate",
                "instrument_category": "NAWI",
                "instrument_serial": serial_2,  # Duplicate serial to trigger conflict
                "capacity_text": "50 kg",
                "trust_level": "UNVERIFIED_LEGACY",
            },
        ]

        payload = {
            "jurisdiction_id": jurisdiction_id,
            "source_register_name": "Verification_Register_Volume_14_2024.xlsx",
            "source_checksum_sha256": hashlib.sha256(b"sample_register_content").hexdigest(),
            "records": records,
        }

        resp = client.post(
            f"/api/v1/tenants/{tenant_id}/migration/batches",
            json=payload,
            headers=headers_admin,
        )
        assert resp.status_code == 201, resp.text
        batch_data = resp.json()
        assert batch_data["total_records"] == 3
        assert batch_data["imported_records"] == 2
        assert batch_data["conflicted_records"] == 1
        assert batch_data["status"] == "COMPLETED_WITH_ERRORS"
        assert "reconciliation_summary" in batch_data
        assert batch_data["reconciliation_summary"]["successfully_imported"] == 2
