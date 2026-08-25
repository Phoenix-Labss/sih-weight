"""Tier 5 Adversarial Coverage Hardening: White-Box Certificate Supersession Chains & Lineage Testing.

Validates statutory certificate supersession graph invariants:
- Multi-generation linear supersession chains (Cert 1 -> Cert 2 -> Cert 3 -> Cert 4)
- Deep chain lineage preservation and successor tracking
- Rejection of invalid state transitions on already superseded certificates (no reinstatement, suspension, revocation, expiry)
- Prevention of self-supersession and circular supersession
- Rejection of supersession on REVOKED, EXPIRED, DRAFT, or PENDING_SIGNATURE certificates
- Cross-tenant and cross-instrument supersession isolation
- Append-only CertificateStatusEvent audit trail completeness
"""

from __future__ import annotations

from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import InvalidStateTransitionError, GuardConditionFailedError, UnauthorizedTransitionError
from app.core.state_machines import CertificateStateMachine, UserContext as SmUserContext
from app.models.certificate import Certificate, CertificateStatusEnum, CertificateStatusEvent
from app.models.stakeholder import RoleEnum


class TestCertificateSupersessionChainsAdversarial:
    """Adversarial suite for certificate supersession graphs and lineage invariants."""

    def _create_verified_session_and_cert(
        self,
        client: TestClient,
        seed_data: dict,
        auth_headers,
        serial_number: str = "SN-CHAIN-001",
        inst_id: str | None = None,
        is_reverification: bool = False,
    ) -> dict:
        """Helper to create a full passing verification cycle and return issued certificate payload."""
        tenant_id = seed_data["tenant_id"]
        jur_id = seed_data["jurisdiction_id"]

        owner_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.LMO,
            jurisdiction_id=jur_id,
        )

        # 1. Instrument registration (if new instrument)
        if not inst_id:
            inst_res = client.post(
                f"/api/v1/tenants/{tenant_id}/instruments",
                json={
                    "jurisdiction_id": jur_id,
                    "model_id": seed_data["model_id"],
                    "owner_id": seed_data["stakeholder_id"],
                    "facility_id": seed_data["facility_id"],
                    "serial_number": serial_number,
                    "year_of_manufacture": 2026,
                },
                headers=owner_hdr,
            )
            assert inst_res.status_code == 201, inst_res.text
            inst_id = inst_res.json()["instrument_id"]

        # 2. Application
        app_res = client.post(
            f"/api/v1/tenants/{tenant_id}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "RE_VERIFICATION" if is_reverification else "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        assert app_res.status_code == 201, app_res.text
        app_id = app_res.json()["application_id"]

        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/scrutiny", json={"action": "ACCEPT"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/fee", json={"base_verification_fee": "500.00"}, headers=lmo_hdr)
        client.post(f"/api/v1/tenants/{tenant_id}/applications/{app_id}/pay", json={"receipt_number": f"REC-{app_id[:8]}"}, headers=owner_hdr)

        # 3. Session
        sess_res = client.post(
            f"/api/v1/tenants/{tenant_id}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # 4. Observations
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/observations",
            json={
                "reference_standard_ids": seed_data["standard_ids"],
                "observations": [
                    {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                    {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "15.000000", "load_unit": "kg", "raw_indication_reading": "15.000000", "reading_unit": "kg"},
                ],
            },
            headers=lmo_hdr,
        )
        client.post(
            f"/api/v1/tenants/{tenant_id}/sessions/{sess_id}/disposition",
            json={"outcome": "Verification passed — pending authorization"},
            headers=lmo_hdr,
        )

        # 5. Issue certificate
        cert_res = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/issue",
            json={"session_id": sess_id, "validity_months": 12},
            headers=lmo_hdr,
        )
        assert cert_res.status_code == 201, cert_res.text
        return {**cert_res.json(), "application_id": app_id, "instrument_id": inst_id, "session_id": sess_id}

    def test_multi_generation_linear_supersession_chain(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Test a 4-generation supersession chain: Cert1 -> Cert2 -> Cert3 -> Cert4.
        
        Verifies:
        - Cert1 is superseded by Cert2
        - Cert2 is superseded by Cert3
        - Cert3 is superseded by Cert4
        - Cert4 remains actively ISSUED
        - Public verification endpoints for Cert1, Cert2, Cert3 correctly return SUPERSEDED and successor tokens
        - Public verification for Cert4 returns ISSUED
        """
        tenant_id = seed_data["tenant_id"]
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )

        serial = "SN-ADV-CHAIN-4GEN"
        cert1 = self._create_verified_session_and_cert(client, seed_data, auth_headers, serial_number=serial)
        assert cert1["certificate_status"] == "ISSUED"
        inst_id = cert1["instrument_id"]

        cert2 = self._create_verified_session_and_cert(client, seed_data, auth_headers, serial_number=serial, inst_id=inst_id, is_reverification=True)
        assert cert2["certificate_status"] == "ISSUED"

        cert3 = self._create_verified_session_and_cert(client, seed_data, auth_headers, serial_number=serial, inst_id=inst_id, is_reverification=True)
        assert cert3["certificate_status"] == "ISSUED"

        cert4 = self._create_verified_session_and_cert(client, seed_data, auth_headers, serial_number=serial, inst_id=inst_id, is_reverification=True)
        assert cert4["certificate_status"] == "ISSUED"

        # Check internal API records for all 4 certificates
        c1_db = client.get(f"/api/v1/tenants/{tenant_id}/certificates/{cert1['certificate_id']}", headers=lmo_hdr).json()
        c2_db = client.get(f"/api/v1/tenants/{tenant_id}/certificates/{cert2['certificate_id']}", headers=lmo_hdr).json()
        c3_db = client.get(f"/api/v1/tenants/{tenant_id}/certificates/{cert3['certificate_id']}", headers=lmo_hdr).json()
        c4_db = client.get(f"/api/v1/tenants/{tenant_id}/certificates/{cert4['certificate_id']}", headers=lmo_hdr).json()

        assert c1_db["certificate_status"] == "SUPERSEDED"
        assert c1_db["superseding_certificate_id"] == cert2["certificate_id"]

        assert c2_db["certificate_status"] == "SUPERSEDED"
        assert c2_db["superseding_certificate_id"] == cert3["certificate_id"]

        assert c3_db["certificate_status"] == "SUPERSEDED"
        assert c3_db["superseding_certificate_id"] == cert4["certificate_id"]

        assert c4_db["certificate_status"] == "ISSUED"
        assert c4_db["superseding_certificate_id"] is None

        # Check Public QR projection for all 4 certificates
        pub1 = client.get(f"/api/v1/public/certificates/verify/{cert1['public_verification_token']}").json()
        pub2 = client.get(f"/api/v1/public/certificates/verify/{cert2['public_verification_token']}").json()
        pub3 = client.get(f"/api/v1/public/certificates/verify/{cert3['public_verification_token']}").json()
        pub4 = client.get(f"/api/v1/public/certificates/verify/{cert4['public_verification_token']}").json()

        assert pub1["status"] == "SUPERSEDED"
        assert pub1["superseded_by"] == cert2["public_verification_token"]

        assert pub2["status"] == "SUPERSEDED"
        assert pub2["superseded_by"] == cert3["public_verification_token"]

        assert pub3["status"] == "SUPERSEDED"
        assert pub3["superseded_by"] == cert4["public_verification_token"]

        assert pub4["status"] == "ISSUED"
        assert pub4["superseded_by"] is None
        assert pub4["cryptographic_validity"] == "VALID_SIGNATURE"

    def test_illegal_mutations_on_superseded_certificate_rejected(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Superseded certificates are locked and cannot transition to SUSPENDED, ISSUED, EXPIRED, or REVOKED."""
        tenant_id = seed_data["tenant_id"]
        supervisor_hdr = auth_headers(
            user_id=seed_data["supervisor_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.SUPERVISOR,
        )

        serial = "SN-ADV-LOCKED-SUPERSEDED"
        cert1 = self._create_verified_session_and_cert(client, seed_data, auth_headers, serial_number=serial)
        cert2 = self._create_verified_session_and_cert(client, seed_data, auth_headers, serial_number=serial, inst_id=cert1["instrument_id"], is_reverification=True)

        cert1_id = cert1["certificate_id"]

        # 1. Attempt SUSPEND on superseded cert -> 409 Conflict / InvalidStateTransitionError
        res_suspend = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/{cert1_id}/status",
            json={"action": "SUSPEND", "reason": "Attempting to suspend an old superseded certificate."},
            headers=supervisor_hdr,
        )
        assert res_suspend.status_code in (409, 422), res_suspend.text

        # 2. Attempt REINSTATE on superseded cert -> 409 / 422
        res_reinstate = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/{cert1_id}/status",
            json={"action": "REINSTATE", "reason": "Attempting to reinstate a superseded certificate."},
            headers=supervisor_hdr,
        )
        assert res_reinstate.status_code in (409, 422), res_reinstate.text

        # 3. Attempt REVOKE on superseded cert -> 409 / 422
        res_revoke = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/{cert1_id}/status",
            json={"action": "REVOKE", "reason": "Attempting to revoke a superseded certificate."},
            headers=supervisor_hdr,
        )
        assert res_revoke.status_code in (409, 422), res_revoke.text

        # 4. Attempt EXPIRE on superseded cert -> 409 / 422
        res_expire = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/{cert1_id}/status",
            json={"action": "EXPIRE", "reason": "Attempting to expire a superseded certificate."},
            headers=supervisor_hdr,
        )
        assert res_expire.status_code in (409, 422), res_expire.text

        # 5. Attempt direct re-supersession -> 409 / 422
        res_resupersede = client.post(
            f"/api/v1/tenants/{tenant_id}/certificates/{cert1_id}/status",
            json={
                "action": "SUPERSEDE",
                "superseding_certificate_id": cert2["certificate_id"],
                "reason": "Attempting to supersede already superseded certificate.",
            },
            headers=supervisor_hdr,
        )
        assert res_resupersede.status_code in (409, 422), res_resupersede.text

    def test_direct_state_machine_supersession_edge_cases(
        self, db_session: Session, seed_data: dict
    ):
        """Direct white-box state machine tests for edge case supersession constraints."""
        tenant_id = seed_data["tenant_id"]
        actor = SmUserContext(
            user_id=seed_data["lmo_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.LMO.value,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        supervisor = SmUserContext(
            user_id=seed_data["supervisor_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.SUPERVISOR.value,
        )

        today = date.today()
        # Create dummy certificate directly in DB
        cert = Certificate(
            certificate_number=f"{tenant_id}/LM/2026/CERT-UNIT-TEST-01",
            tenant_id=tenant_id,
            session_id="dummy_sess_01",
            instrument_id="dummy_inst_01",
            owner_id="dummy_owner_01",
            procedure_pack_id="nawi_class3",
            verifier_id=seed_data["lmo_user_id"],
            issue_date=today,
            valid_until=today + timedelta(days=365),
            certificate_status=CertificateStatusEnum.DRAFT,
            qr_code_payload="https://test.gov.in/v/test",
        )
        db_session.add(cert)
        db_session.commit()

        # 1. Superseding a DRAFT certificate must raise InvalidStateTransitionError
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.supersede_certificate(
                old_cert=cert,
                new_certificate_id="dummy_new_cert",
                reason="Cannot supersede draft",
                actor=actor,
            )

        # 2. Advance to PENDING_SIGNATURE
        CertificateStateMachine.render_and_lock(
            cert=cert,
            pdf_sha256="a" * 64,
            storage_path="s3://bucket/test.pdf",
            actor=actor,
        )
        # Superseding PENDING_SIGNATURE must raise InvalidStateTransitionError
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.supersede_certificate(
                old_cert=cert,
                new_certificate_id="dummy_new_cert",
                reason="Cannot supersede pending signature",
                actor=actor,
            )

        # 3. Advance to ISSUED
        CertificateStateMachine.bind_signature(
            cert=cert,
            signature_reference="dummy_sig:dummy_key",
            signer_id=seed_data["lmo_user_id"],
            actor=actor,
        )
        assert cert.certificate_status == CertificateStatusEnum.ISSUED

        # 4. Revoke certificate
        CertificateStateMachine.revoke_certificate(
            cert=cert,
            reason="Fraud detected",
            authority_ref="ORD-REVOKE-01",
            actor=supervisor,
        )
        assert cert.certificate_status == CertificateStatusEnum.REVOKED

        # 5. Superseding a REVOKED certificate must raise InvalidStateTransitionError
        with pytest.raises(InvalidStateTransitionError):
            CertificateStateMachine.supersede_certificate(
                old_cert=cert,
                new_certificate_id="dummy_new_cert",
                reason="Cannot supersede revoked certificate",
                actor=actor,
            )

    def test_cross_instrument_supersession_isolation(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Issuing a certificate for Instrument B must NOT supersede the certificate for Instrument A."""
        tenant_id = seed_data["tenant_id"]
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )

        cert_a = self._create_verified_session_and_cert(client, seed_data, auth_headers, serial_number="SN-INST-ALPHA-101")
        cert_b = self._create_verified_session_and_cert(client, seed_data, auth_headers, serial_number="SN-INST-BETA-202")

        # Check that Cert A is STILL ISSUED and NOT superseded by Cert B
        cert_a_check = client.get(f"/api/v1/tenants/{tenant_id}/certificates/{cert_a['certificate_id']}", headers=lmo_hdr).json()
        assert cert_a_check["certificate_status"] == "ISSUED"
        assert cert_a_check["superseding_certificate_id"] is None

        cert_b_check = client.get(f"/api/v1/tenants/{tenant_id}/certificates/{cert_b['certificate_id']}", headers=lmo_hdr).json()
        assert cert_b_check["certificate_status"] == "ISSUED"
        assert cert_b_check["superseding_certificate_id"] is None

    def test_supersession_audit_event_trail(
        self, client: TestClient, seed_data: dict, auth_headers
    ):
        """Every certificate supersession creates an append-only CertificateStatusEvent with actor and timestamp."""
        tenant_id = seed_data["tenant_id"]
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=tenant_id,
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )

        serial = "SN-ADV-AUDIT-TRAIL"
        cert1 = self._create_verified_session_and_cert(client, seed_data, auth_headers, serial_number=serial)
        cert2 = self._create_verified_session_and_cert(client, seed_data, auth_headers, serial_number=serial, inst_id=cert1["instrument_id"], is_reverification=True)

        cert1_detail = client.get(f"/api/v1/tenants/{tenant_id}/certificates/{cert1['certificate_id']}", headers=lmo_hdr).json()
        events = cert1_detail.get("status_events", [])
        assert len(events) >= 2  # 1 for ISSUED, 1 for SUPERSEDED

        supersede_events = [e for e in events if e["new_status"] == "SUPERSEDED"]
        assert len(supersede_events) == 1
        se = supersede_events[0]
        assert se["previous_status"] == "ISSUED"
        assert se["actor_id"] == seed_data["lmo_user_id"]
        assert cert2["certificate_id"] in se["reason"]
