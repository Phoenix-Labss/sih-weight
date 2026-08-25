"""Unit and Integration tests for Deterministic PDF/A Certificate Generator and Endpoints.
"""

import hashlib
from datetime import date, datetime, timedelta
from typing import Dict
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from packages.verification_certificates import (
    CertificateDocumentData,
    CertificatePdfGenerator,
    InstrumentDocData,
    SignatureDocData,
    StampDocData,
    StandardDocData,
    VerificationDocData,
    calculate_canonical_payload_hash,
    calculate_pdf_bytes_hash,
    canonical_json_dumps,
    render_certificate_pdf,
    verify_certificate_hash,
)
from app.core.auth import create_access_token
from app.models.certificate import Certificate, CertificateStatusEnum
from app.models.instrument import AccuracyClassEnum, Instrument, InstrumentModel, InstrumentStatusEnum
from app.models.reference_standard import ReferenceStandard, ReferenceStandardStatusEnum, CustodianTypeEnum
from app.models.session import (
    SessionReferenceStandard,
    SessionStatusEnum,
    VerificationOutcomeEnum,
    VerificationSession,
)
from app.models.stakeholder import Facility, LMOProfile, RoleEnum, Stakeholder, User
from app.models.stamp import PhysicalSealActionEnum, PhysicalStampAction, SealTypeEnum
from app.models.tenant import Jurisdiction, Office, Tenant


@pytest.fixture
def sample_certificate_doc_data() -> CertificateDocumentData:
    """Fixture providing rich, realistic Form 8 Legal Metrology certificate data."""
    return CertificateDocumentData(
        certificate_number="DL/LM/2026/CERT-891024",
        public_verification_token="cert_tok_99182a8fe710bc4a",
        qr_payload_url="http://localhost:5173/verify/cert_tok_99182a8fe710bc4a",
        tenant_id="DL-DELHI",
        jurisdiction_name="GOVERNMENT OF NCT OF DELHI - DEPARTMENT OF LEGAL METROLOGY",
        office_name="Office of Assistant Controller, Central Zone, Delhi",
        issue_date=date(2026, 8, 23),
        valid_until=date(2027, 8, 23),
        procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
        certificate_status="ISSUED",
        instrument=InstrumentDocData(
            category="Non-Automatic Weighing Instrument (NAWI)",
            subtype="Electronic Counter Scale",
            manufacturer="Essae-Teraoka Ltd.",
            model_name="DS-215",
            model_approval_number="IND/09/2024/412",
            serial_number="DL-2026-98214",
            accuracy_class="CLASS_III",
            max_capacity="30.000 kg",
            min_capacity="100 g",
            verification_scale_interval_e="5 g",
            division_d="5 g",
            capacity_unit="kg",
            installation_location="Shop #42, Main Market, Connaught Place, New Delhi",
            owner_name="Delhi Retail Mart Pvt Ltd",
            owner_trade_name="Delhi SuperMart",
        ),
        verification_details=VerificationDocData(
            verification_type="Periodic Re-verification",
            service_mode="ON_SITE",
            session_id="SESS-DL-2026-00412",
            test_date=date(2026, 8, 23),
            metrological_outcome="PASSED",
            repeatability_result="PASSED (max error <= 1.0 e)",
            eccentricity_result="PASSED (eccentricity error <= 1.0 e)",
            linearity_result="PASSED (all 5 load steps <= MPE)",
            tare_result="PASSED (tare effect <= 0.25 e)",
        ),
        reference_standards=[
            StandardDocData(
                standard_id="STD-M1-20KG-01",
                standard_name="Working Standard Mass Set (20 kg)",
                accuracy_class="M1",
                calibration_certificate_number="NPL/CAL/2026/8942",
                calibrating_laboratory="National Physical Laboratory (NPL India)",
                calibration_valid_until=date(2027, 5, 15),
            ),
            StandardDocData(
                standard_id="STD-M1-10KG-02",
                standard_name="Working Standard Mass Set (10 kg)",
                accuracy_class="M1",
                calibration_certificate_number="NPL/CAL/2026/8943",
                calibrating_laboratory="Regional Reference Standards Laboratory (RRSL)",
                calibration_valid_until=date(2027, 6, 20),
            ),
        ],
        physical_stamps=[
            StampDocData(
                stamp_type="VERIFICATION_STAMP",
                seal_serial_number="26/DL/A",
                seal_location="Main Verification Nameplate",
                affixed_date=date(2026, 8, 23),
            ),
            StampDocData(
                stamp_type="LEAD_WIRE_SEAL",
                seal_serial_number="DL-SEAL-89102",
                seal_location="Calibration Port Security Screw",
                affixed_date=date(2026, 8, 23),
            ),
            StampDocData(
                stamp_type="SECURITY_STICKER_HOLOGRAM",
                seal_serial_number="DL-HOL-34190",
                seal_location="Housing Top-Bottom Junction",
                affixed_date=date(2026, 8, 23),
            ),
        ],
        signature=SignatureDocData(
            signer_name="Rajesh Sharma",
            signer_role="Legal Metrology Officer (LMO)",
            authority_id="LMO-DL-CENTRAL-01",
            posting_id="POSTING-DL-2026-99",
            signature_timestamp=datetime(2026, 8, 23, 12, 0, 0),
            sha256_digest="7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
            signature_reference="SIG-DL-2026-00412-ED25519",
            is_verified=True,
        ),
    )


class TestCertificatePdfGenerationUnit:
    """Unit test suite for ReportLab PDF generator and deterministic hashing."""

    def test_pdf_generation_produces_valid_bytes(self, sample_certificate_doc_data):
        generator = CertificatePdfGenerator()
        pdf_bytes = generator.generate_pdf(sample_certificate_doc_data)

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 5000, f"Expected PDF bytes > 5KB, got {len(pdf_bytes)} bytes"
        # Validate PDF magic header
        assert pdf_bytes.startswith(b"%PDF-"), "Generated file does not start with valid %PDF- header"
        # Validate PDF EOF marker
        assert b"%%EOF" in pdf_bytes[-1024:], "Generated file does not contain %%EOF trailer"

    def test_pdf_generation_with_hash(self, sample_certificate_doc_data):
        generator = CertificatePdfGenerator()
        pdf_bytes, pdf_hash = generator.generate_pdf_with_hash(sample_certificate_doc_data)

        assert isinstance(pdf_bytes, bytes)
        assert isinstance(pdf_hash, str)
        assert len(pdf_hash) == 64
        # Verify hash match
        assert verify_certificate_hash(pdf_bytes, pdf_hash) is True
        assert verify_certificate_hash(pdf_bytes, "0" * 64) is False

    def test_canonical_payload_hashing_determinism(self, sample_certificate_doc_data):
        hash1 = calculate_canonical_payload_hash(sample_certificate_doc_data)
        hash2 = calculate_canonical_payload_hash(sample_certificate_doc_data)
        assert hash1 == hash2

        # Dict with different key ordering must yield identical canonical hash
        dict_a = {"b": 2, "a": 1, "nested": {"z": 9, "y": 8}}
        dict_b = {"a": 1, "b": 2, "nested": {"y": 8, "z": 9}}
        assert calculate_canonical_payload_hash(dict_a) == calculate_canonical_payload_hash(dict_b)

    def test_render_certificate_pdf_convenience_helper(self, sample_certificate_doc_data):
        pdf_bytes = render_certificate_pdf(sample_certificate_doc_data)
        assert len(pdf_bytes) > 5000
        assert pdf_bytes.startswith(b"%PDF-")

    def test_pdf_rendering_different_accuracy_classes(self, sample_certificate_doc_data):
        generator = CertificatePdfGenerator()
        for acc_class in ["CLASS_I", "CLASS_II", "CLASS_III", "CLASS_IIII"]:
            sample_certificate_doc_data.instrument.accuracy_class = acc_class
            pdf_bytes = generator.generate_pdf(sample_certificate_doc_data)
            assert len(pdf_bytes) > 4000
            assert pdf_bytes.startswith(b"%PDF-")

    def test_pdf_rendering_various_statuses(self, sample_certificate_doc_data):
        generator = CertificatePdfGenerator()
        for st in ["ISSUED", "EXPIRED", "SUSPENDED", "REVOKED", "SUPERSEDED"]:
            sample_certificate_doc_data.certificate_status = st
            pdf_bytes = generator.generate_pdf(sample_certificate_doc_data)
            assert len(pdf_bytes) > 4000
            assert pdf_bytes.startswith(b"%PDF-")

    def test_pdf_rendering_high_capacity_weighbridge(self, sample_certificate_doc_data):
        sample_certificate_doc_data.instrument.category = "Automatic / Non-Automatic Weighbridge"
        sample_certificate_doc_data.instrument.subtype = "Pitless Heavy Vehicle Weighbridge"
        sample_certificate_doc_data.instrument.max_capacity = "60000 kg (60 Tonnes)"
        sample_certificate_doc_data.instrument.min_capacity = "400 kg"
        sample_certificate_doc_data.instrument.verification_scale_interval_e = "20 kg"

        generator = CertificatePdfGenerator()
        pdf_bytes = generator.generate_pdf(sample_certificate_doc_data)
        assert len(pdf_bytes) > 5000


@pytest.fixture
def cert_test_db(db_session: Session, seed_data: dict, auth_headers) -> Dict:
    """Fixture creating complete database hierarchy with issued certificate using seed_data."""
    tenant_id = seed_data["tenant_id"]
    model_id = seed_data["model_id"]
    owner_id = seed_data["stakeholder_id"]
    lmo_user_id = seed_data["lmo_user_id"]
    std_id = seed_data["standard_ids"][0]

    jurisdiction_id = seed_data["jurisdiction_id"]
    facility_id = seed_data["facility_id"]

    # 1. Create Instrument
    instrument = Instrument(
        instrument_id="INST-CERT-01",
        tenant_id=tenant_id,
        jurisdiction_id=jurisdiction_id,
        facility_id=facility_id,
        model_id=model_id,
        owner_id=owner_id,
        serial_number="DL-CERT-SN-9912",
        year_of_manufacture=2025,
        current_status=InstrumentStatusEnum.ACTIVE_VERIFIED,
        physical_location_address="Shop 42, Connaught Place, New Delhi",
    )



    db_session.add(instrument)
    db_session.flush()

    # 2. Verification Session & Stamps
    session = VerificationSession(
        session_id="SESS-CERT-01",
        tenant_id=tenant_id,
        application_id="APP-CERT-01",
        instrument_id=instrument.instrument_id,
        procedure_pack_id="IN-NAWI-CLASS-III-2026.1",
        procedure_pack_checksum="checksum-nawi-2026-v1",
        verifier_id=lmo_user_id,
        verifier_role="LMO",
        scheduled_date=date(2026, 8, 23),
        actual_test_timestamp=datetime(2026, 8, 23, 11, 0, 0),
        status=SessionStatusEnum.FINALIZED,
        automated_evaluation_flag=True,
        outcome=VerificationOutcomeEnum.VERIFICATION_PASSED_PENDING_AUTHORIZATION,
    )
    db_session.add(session)
    db_session.flush()

    srs = SessionReferenceStandard(
        session_id=session.session_id,
        standard_id=std_id,
        snapshot_calibration_certificate="NPL/CAL/2026/8891",
        snapshot_valid_until=datetime(2027, 1, 15, 0, 0, 0),
        verified_suitable=True,
    )
    db_session.add(srs)

    stamp = PhysicalStampAction(
        stamp_action_id="STAMP-CERT-01",
        tenant_id=tenant_id,
        session_id=session.session_id,
        instrument_id=instrument.instrument_id,
        verifier_id=lmo_user_id,
        action_type=PhysicalSealActionEnum.SEAL_APPLIED,
        seal_type=SealTypeEnum.LEAD_WIRE_SEAL,
        seal_identification_number="DL-SEAL-89102",
        seal_position="Calibration Port Screw",
        action_timestamp=datetime(2026, 8, 23, 11, 30, 0),
    )
    db_session.add(stamp)
    db_session.flush()

    # 3. Certificate
    cert = Certificate(
        certificate_id="CERT-ID-TEST-01",
        certificate_number="IN-DL/LM/2026/CERT-778899",
        public_verification_token="cert_tok_test_778899aabbcc",
        tenant_id=tenant_id,
        session_id=session.session_id,
        instrument_id=instrument.instrument_id,
        owner_id=owner_id,
        procedure_pack_id=session.procedure_pack_id,
        verifier_id=lmo_user_id,
        signer_id=lmo_user_id,
        issue_date=date(2026, 8, 23),
        valid_until=date(2027, 8, 23),
        certificate_status=CertificateStatusEnum.ISSUED,
        certificate_bytes_sha256="7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
        qr_code_payload="http://localhost:5173/verify/cert_tok_test_778899aabbcc",
        signature_timestamp=datetime(2026, 8, 23, 12, 0, 0),
    )
    db_session.add(cert)
    db_session.commit()

    return {
        "tenant_id": tenant_id,
        "certificate": cert,
        "instrument": instrument,
        "headers_lmo": auth_headers(user_id=lmo_user_id, tenant_id=tenant_id, role=RoleEnum.LMO),
        "headers_owner": auth_headers(user_id=seed_data["owner_user_id"], tenant_id=tenant_id, role=RoleEnum.OWNER),
    }



class TestCertificatePdfApiEndpoints:
    """Integration test suite for Certificate PDF download endpoints."""

    def test_get_certificate_pdf_by_id_direct(self, client: TestClient, cert_test_db: Dict):
        cert = cert_test_db["certificate"]
        headers = cert_test_db["headers_lmo"]

        response = client.get(
            f"/api/v1/certificates/{cert.certificate_id}/pdf",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "attachment; filename=" in response.headers["content-disposition"]
        assert response.content.startswith(b"%PDF-")
        assert len(response.content) > 5000

    def test_get_certificate_pdf_tenant_scoped(self, client: TestClient, cert_test_db: Dict):
        cert = cert_test_db["certificate"]
        tenant_id = cert_test_db["tenant_id"]
        headers = cert_test_db["headers_lmo"]

        response = client.get(
            f"/api/v1/tenants/{tenant_id}/certificates/{cert.certificate_id}/pdf",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content.startswith(b"%PDF-")

    def test_get_certificate_pdf_by_qr_token_public(self, client: TestClient, cert_test_db: Dict):
        cert = cert_test_db["certificate"]

        # Public download requires no Authorization header
        response = client.get(f"/api/v1/certificates/by-token/{cert.public_verification_token}/pdf")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content.startswith(b"%PDF-")
        assert len(response.content) > 5000

    def test_get_public_certificate_pdf_route(self, client: TestClient, cert_test_db: Dict):
        cert = cert_test_db["certificate"]

        response = client.get(f"/public/certificates/{cert.public_verification_token}/pdf")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content.startswith(b"%PDF-")

    def test_get_short_url_pdf_route(self, client: TestClient, cert_test_db: Dict):
        cert = cert_test_db["certificate"]

        response = client.get(f"/v/{cert.public_verification_token}/pdf")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content.startswith(b"%PDF-")

    def test_get_certificate_pdf_not_found(self, client: TestClient, cert_test_db: Dict):
        headers = cert_test_db["headers_lmo"]
        response = client.get(
            "/api/v1/certificates/NON-EXISTENT-CERT-ID/pdf",
            headers=headers,
        )
        assert response.status_code == 404

    def test_get_certificate_pdf_public_token_not_found(self, client: TestClient):
        response = client.get("/api/v1/certificates/by-token/INVALID-TOKEN-1234/pdf")
        assert response.status_code == 404

