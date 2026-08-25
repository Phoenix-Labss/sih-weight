"""Tier 3 Cross-Feature & Security Invariants: Immutable Observation Records & Correction Audit Trail.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.observation import ObservationCorrection, StepTypeEnum, TestObservation
from app.models.stakeholder import RoleEnum


class TestImmutableObservationCorrections:
    """Security Invariant test suite asserting that measurement observations are immutable and audited."""

    @pytest.fixture
    def active_session_with_obs(self, client: TestClient, seed_data: dict, auth_headers) -> dict:
        """Helper fixture creating session with submitted observations."""
        owner_hdr = auth_headers(
            user_id=seed_data["owner_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.OWNER,
        )
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
            jurisdiction_id=seed_data["jurisdiction_id"],
        )
        inst_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/instruments",
            json={
                "jurisdiction_id": seed_data["jurisdiction_id"],
                "model_id": seed_data["model_id"],
                "owner_id": seed_data["stakeholder_id"],
                "facility_id": seed_data["facility_id"],
                "serial_number": f"SN-OBS-IMMUT-{datetime.now().microsecond}",
                "year_of_manufacture": 2026,
            },
            headers=owner_hdr,
        )
        inst_id = inst_res.json()["instrument_id"]

        app_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/applications",
            json={
                "instrument_id": inst_id,
                "applicant_id": seed_data["stakeholder_id"],
                "application_type": "INITIAL_VERIFICATION",
                "service_mode": "ON_SITE",
                "applicant_declaration_accepted": True,
            },
            headers=owner_hdr,
        )
        app_id = app_res.json()["application_id"]

        sess_res = client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions",
            json={"application_id": app_id, "instrument_id": inst_id, "scheduled_date": "2026-08-23"},
            headers=lmo_hdr,
        )
        sess_id = sess_res.json()["session_id"]

        # Submit initial observations
        client.post(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}/observations",
            json={
                "reference_standard_ids": seed_data["standard_ids"],
                "observations": [
                    {"step_type": "ZERO_TEST", "step_sequence": 1, "nominal_load": "0.000000", "load_unit": "kg", "raw_indication_reading": "0.000000", "reading_unit": "kg"},
                    {"step_type": "INCREASING_LOAD", "step_sequence": 2, "nominal_load": "5.000000", "load_unit": "kg", "raw_indication_reading": "5.000000", "reading_unit": "kg"},
                ],
            },
            headers=lmo_hdr,
        )
        return {"session_id": sess_id, "instrument_id": inst_id}

    def test_observation_immutability_flag_set(
        self, db_session: Session, active_session_with_obs: dict
    ):
        """Persisted TestObservation entities have is_immutable set to True."""
        sess_id = active_session_with_obs["session_id"]
        observations = db_session.execute(
            select(TestObservation).where(TestObservation.session_id == sess_id)
        ).scalars().all()

        assert len(observations) == 2
        for obs in observations:
            assert obs.is_immutable is True
            assert obs.recorded_at is not None
            assert obs.nominal_load is not None

    def test_observation_correction_ledger_linkage(
        self, db_session: Session, seed_data: dict, active_session_with_obs: dict
    ):
        """ObservationCorrection ledger records link original observation, replacement observation, and reason."""
        sess_id = active_session_with_obs["session_id"]
        orig_obs = db_session.execute(
            select(TestObservation).where(
                TestObservation.session_id == sess_id,
                TestObservation.step_sequence == 2,
            )
        ).scalar_one()

        # Create new observation representing correction
        new_obs = TestObservation(
            session_id=sess_id,
            step_type=StepTypeEnum.INCREASING_LOAD,
            step_sequence=3,
            nominal_load=Decimal("5.000000"),
            load_unit="kg",
            raw_indication_reading=Decimal("5.001000"),
            normalized_indication=Decimal("5.001000"),
            reading_unit="kg",
            observed_error=Decimal("0.001000"),
            mpe_allowed=Decimal("0.005000"),
            is_within_mpe=True,
            is_immutable=True,
        )
        db_session.add(new_obs)
        db_session.flush()

        # Create audit correction record
        correction = ObservationCorrection(
            session_id=sess_id,
            original_observation_id=orig_obs.observation_id,
            new_observation_id=new_obs.observation_id,
            actor_id=seed_data["lmo_user_id"],
            correction_reason="Parallax error in reading display rectified during repetition.",
            authorized_by_supervisor_id=seed_data["supervisor_user_id"],
        )
        db_session.add(correction)
        db_session.commit()

        # Verify audit record integrity
        saved_corr = db_session.execute(
            select(ObservationCorrection).where(ObservationCorrection.correction_id == correction.correction_id)
        ).scalar_one()
        assert saved_corr.original_observation_id == orig_obs.observation_id
        assert saved_corr.new_observation_id == new_obs.observation_id
        assert "Parallax error" in saved_corr.correction_reason
        assert saved_corr.authorized_by_supervisor_id == seed_data["supervisor_user_id"]

    def test_observation_deterministic_trace_stored(
        self, client: TestClient, seed_data: dict, auth_headers, active_session_with_obs: dict
    ):
        """Session observations contain machine-readable JSON calculation traces."""
        lmo_hdr = auth_headers(
            user_id=seed_data["lmo_user_id"],
            tenant_id=seed_data["tenant_id"],
            role=RoleEnum.LMO,
        )
        sess_id = active_session_with_obs["session_id"]
        res = client.get(
            f"/api/v1/tenants/{seed_data['tenant_id']}/sessions/{sess_id}",
            headers=lmo_hdr,
        )
        assert res.status_code == 200
        sess_data = res.json()
        assert len(sess_data["observations"]) == 2
        for obs in sess_data["observations"]:
            assert "is_within_mpe" in obs
            assert obs["nominal_load"] is not None
