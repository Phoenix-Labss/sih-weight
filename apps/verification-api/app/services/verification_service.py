"""Service layer for Verification Sessions, Observation recording, NAWI evaluation, and Disposition.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import UserContext
from app.core.errors import ForbiddenError, NotFoundError, UnprocessableError
from app.core.permissions import verify_jurisdiction_access, verify_tenant_access
from app.core.state_machines import (
    ApplicationStateMachine,
    UserContext as SmUserContext,
    VerificationSessionStateMachine,
)
from app.models.application import ApplicationStatusEnum, ApplicationTypeEnum, VerificationApplication
from app.models.instrument import Instrument
from app.models.observation import StepTypeEnum, TestObservation
from app.models.reference_standard import ReferenceStandard, ReferenceStandardStatusEnum
from app.models.session import (
    SessionReferenceStandard,
    SessionStatusEnum,
    VerificationOutcomeEnum,
    VerificationSession,
)
from app.models.stakeholder import RoleEnum
from app.schemas.session import (
    ObservationItemInput,
    SessionCreateRequest,
    SessionDispositionRequest,
    SessionObservationSubmitRequest,
)
from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from packages.measurement.units import Quantity

try:
    from verification_procedures.base import (
        AccuracyClassEnum as ProcAccuracyClassEnum,
        EccentricityPositionEnum,
        EccentricityPositionObservation,
        EccentricityTestObservation,
        InstrumentParameters,
        LinearityStepObservation,
        ReferenceStandardItem,
        RepeatabilityRunObservation,
        RepeatabilitySeriesObservation,
        SessionEvaluationInput,
        StandardAccuracyClassEnum,
        TareObservation,
        TestDirectionEnum,
        VerificationTypeEnum,
        ZeroSettingObservation,
    )
    from verification_procedures.nawi.pack import NAWIProcedurePack
except ImportError:
    from packages.verification_procedures.base import (
        AccuracyClassEnum as ProcAccuracyClassEnum,
        EccentricityPositionEnum,
        EccentricityPositionObservation,
        EccentricityTestObservation,
        InstrumentParameters,
        LinearityStepObservation,
        ReferenceStandardItem,
        RepeatabilityRunObservation,
        RepeatabilitySeriesObservation,
        SessionEvaluationInput,
        StandardAccuracyClassEnum,
        TareObservation,
        TestDirectionEnum,
        VerificationTypeEnum,
        ZeroSettingObservation,
    )
    from packages.verification_procedures.nawi.pack import NAWIProcedurePack



def _to_sm_context(actor: UserContext) -> SmUserContext:
    return SmUserContext(
        user_id=actor.user_id,
        tenant_id=actor.tenant_id,
        role=actor.role,
        jurisdiction_id=actor.jurisdiction_id,
        is_active=actor.is_active,
    )


class VerificationService:
    """Business logic for statutory verification test execution."""

    @staticmethod
    def create_session(
        db: Session,
        tenant_id: str,
        data: SessionCreateRequest,
        actor: UserContext,
    ) -> VerificationSession:
        """Initialize a new verification session."""
        verify_tenant_access(actor, tenant_id)

        # 1. Verify application exists
        app = db.execute(
            select(VerificationApplication).where(
                VerificationApplication.tenant_id == tenant_id,
                VerificationApplication.application_id == data.application_id,
            )
        ).scalar_one_or_none()
        if not app:
            raise NotFoundError(f"Application [{data.application_id}] not found in tenant [{tenant_id}]")

        # 2. Verify instrument exists
        instrument = db.execute(
            select(Instrument)
            .options(joinedload(Instrument.model))
            .where(
                Instrument.tenant_id == tenant_id,
                Instrument.instrument_id == data.instrument_id,
            )
        ).unique().scalar_one_or_none()
        if not instrument:
            raise NotFoundError(f"Instrument [{data.instrument_id}] not found in tenant [{tenant_id}]")

        pack = NAWIProcedurePack()

        session = VerificationSession(
            tenant_id=tenant_id,
            application_id=app.application_id,
            instrument_id=instrument.instrument_id,
            procedure_pack_id=pack.pack_id,
            procedure_pack_checksum=pack.source_checksum_sha256,
            verifier_id=actor.user_id,
            verifier_role=actor.role_str(),
            scheduled_date=data.scheduled_date,
            environmental_temp_celsius=data.environmental_temp_celsius,
            environmental_humidity_percent=data.environmental_humidity_percent,
            status=SessionStatusEnum.PLANNED,
        )
        db.add(session)
        db.flush()

        # Advance application status if in SCHEDULED state
        sm_actor = _to_sm_context(actor)
        if app.current_status == ApplicationStatusEnum.SCHEDULED:
            try:
                ApplicationStateMachine.commence_testing(app, sm_actor)
            except Exception:
                pass

        db.flush()
        db.refresh(session)
        return session

    @staticmethod
    def confirm_identity(
        db: Session,
        tenant_id: str,
        session_id: str,
        serial_verified: bool,
        actor: UserContext,
    ) -> VerificationSession:
        """Confirm physical instrument serial and characteristics."""
        session = VerificationService.get_session(db, tenant_id, session_id, actor)
        sm_actor = _to_sm_context(actor)
        VerificationSessionStateMachine.confirm_identity(session, sm_actor, serial_verified=serial_verified)
        db.flush()
        db.refresh(session)
        return session

    @staticmethod
    def start_session(
        db: Session,
        tenant_id: str,
        session_id: str,
        actor: UserContext,
    ) -> VerificationSession:
        """Start executing metrological test steps."""
        session = VerificationService.get_session(db, tenant_id, session_id, actor)
        sm_actor = _to_sm_context(actor)
        if session.status == SessionStatusEnum.PLANNED:
            VerificationSessionStateMachine.confirm_identity(session, sm_actor, serial_verified=True)
        VerificationSessionStateMachine.start_testing(session, sm_actor)
        db.flush()
        db.refresh(session)
        return session

    @staticmethod
    def submit_session_observations(
        db: Session,
        tenant_id: str,
        session_id: str,
        submit_data: SessionObservationSubmitRequest,
        actor: UserContext,
    ) -> VerificationSession:
        """Record observations, execute deterministic calculation, and submit session."""
        session = VerificationService.get_session(db, tenant_id, session_id, actor)
        verify_jurisdiction_access(actor, session.application.jurisdiction_id if session.application else None)
        sm_actor = _to_sm_context(actor)

        # Transition to IN_PROGRESS if currently in PLANNED or IDENTITY_CONFIRMED
        if session.status == SessionStatusEnum.PLANNED:
            VerificationSessionStateMachine.confirm_identity(session, sm_actor, serial_verified=True)
        if session.status == SessionStatusEnum.IDENTITY_CONFIRMED:
            VerificationSessionStateMachine.start_testing(
                session,
                sm_actor,
                temp_celsius=float(submit_data.environmental_temp_celsius) if submit_data.environmental_temp_celsius else None,
                humidity_pct=float(submit_data.environmental_humidity_percent) if submit_data.environmental_humidity_percent else None,
            )

        # 1. Load instrument parameters
        instrument = session.instrument
        model = instrument.model
        accuracy_class_enum = ProcAccuracyClassEnum(model.accuracy_class.value)
        unit = model.capacity_unit or "kg"
        e_unit = model.scale_interval_unit or "kg"

        inst_params = InstrumentParameters(
            accuracy_class=accuracy_class_enum,
            max_capacity=Quantity(exact_decimal(model.max_capacity), unit),
            min_capacity=Quantity(exact_decimal(model.min_capacity), unit),
            verification_scale_interval_e=Quantity(exact_decimal(model.verification_scale_interval_e), e_unit),
            actual_scale_interval_d=Quantity(exact_decimal(model.verification_scale_interval_e), e_unit),
        )

        # 2. Load and map Reference Standards
        ref_standards = db.execute(
            select(ReferenceStandard).where(
                ReferenceStandard.tenant_id == tenant_id,
                ReferenceStandard.standard_id.in_(submit_data.reference_standard_ids),
            )
        ).scalars().all()

        test_ts = session.actual_test_timestamp or datetime.now(timezone.utc)
        ref_std_items: List[ReferenceStandardItem] = []
        for std in ref_standards:
            # Map accuracy class to standard class enum
            std_class = StandardAccuracyClassEnum(std.accuracy_class)
            is_quarantined = std.calibration_status == ReferenceStandardStatusEnum.QUARANTINED
            ref_std_items.append(
                ReferenceStandardItem(
                    standard_id=std.standard_id,
                    standard_name=std.asset_tag,
                    accuracy_class=std_class,
                    nominal_mass=Quantity(exact_decimal(std.denomination_mass), std.mass_unit),
                    calibration_date=std.calibrated_at.date() if isinstance(std.calibrated_at, datetime) else std.calibrated_at,
                    expiry_date=std.valid_until.date() if isinstance(std.valid_until, datetime) else std.valid_until,
                    is_quarantined=is_quarantined,
                    status=std.calibration_status.value,
                    uncertainty_k2=Quantity(exact_decimal(std.expanded_uncertainty or "0.000001"), std.mass_unit),
                )
            )
            # Record SessionReferenceStandard snapshot
            existing_snap = db.execute(
                select(SessionReferenceStandard).where(
                    SessionReferenceStandard.session_id == session.session_id,
                    SessionReferenceStandard.standard_id == std.standard_id,
                )
            ).scalar_one_or_none()
            if not existing_snap:
                snap = SessionReferenceStandard(
                    session_id=session.session_id,
                    standard_id=std.standard_id,
                    snapshot_calibration_certificate=std.calibration_certificate_number,
                    snapshot_valid_until=std.valid_until,
                    verified_suitable=std.is_valid_at(test_ts),
                )
                db.add(snap)

        # 3. Categorize observation entries
        half_e = (
            ExactDecimal(inst_params.verification_scale_interval_e.value / ExactDecimal("2"))
            if inst_params.verification_scale_interval_e
            else ExactDecimal("0")
        )

        zero_obs: Optional[ZeroSettingObservation] = None
        linearity_steps: List[LinearityStepObservation] = []
        ecc_positions: List[EccentricityPositionObservation] = []
        ecc_load: Optional[Quantity] = None
        rep_runs_by_load: dict[Decimal, List[RepeatabilityRunObservation]] = {}
        tare_obs: Optional[TareObservation] = None

        for obs in submit_data.observations:
            obs_dl = exact_decimal(obs.delta_L) if getattr(obs, "delta_L", None) is not None else half_e
            if obs.step_type == StepTypeEnum.ZERO_TEST or (obs.step_type == StepTypeEnum.INCREASING_LOAD and obs.nominal_load == Decimal(0)):
                if not zero_obs:
                    zero_obs = ZeroSettingObservation(
                        indicated_I0=Quantity(exact_decimal(obs.raw_indication_reading), obs.reading_unit),
                        delta_L0=Quantity(obs_dl, obs.reading_unit),
                    )
            elif obs.step_type in (StepTypeEnum.INCREASING_LOAD, StepTypeEnum.DECREASING_LOAD):
                direction = (
                    TestDirectionEnum.DECREASING
                    if obs.step_type == StepTypeEnum.DECREASING_LOAD
                    else TestDirectionEnum.INCREASING
                )
                linearity_steps.append(
                    LinearityStepObservation(
                        step_number=obs.step_sequence,
                        direction=direction,
                        nominal_load=Quantity(exact_decimal(obs.nominal_load), obs.load_unit),
                        indicated_I=Quantity(exact_decimal(obs.raw_indication_reading), obs.reading_unit),
                        delta_L=Quantity(obs_dl, obs.reading_unit),
                    )
                )
            elif obs.step_type == StepTypeEnum.ECCENTRICITY:
                ecc_load = Quantity(exact_decimal(obs.nominal_load), obs.load_unit)
                pos_str = (obs.eccentricity_position or "CENTER").upper()
                try:
                    pos_enum = EccentricityPositionEnum(pos_str)
                except ValueError:
                    pos_enum = EccentricityPositionEnum.CENTER
                ecc_positions.append(
                    EccentricityPositionObservation(
                        position=pos_enum,
                        indicated_I=Quantity(exact_decimal(obs.raw_indication_reading), obs.reading_unit),
                        delta_L=Quantity(obs_dl, obs.reading_unit),
                    )
                )
            elif obs.step_type == StepTypeEnum.REPEATABILITY:
                load_val = obs.nominal_load
                if load_val not in rep_runs_by_load:
                    rep_runs_by_load[load_val] = []
                rep_runs_by_load[load_val].append(
                    RepeatabilityRunObservation(
                        run_number=obs.repetition_index,
                        indicated_I=Quantity(exact_decimal(obs.raw_indication_reading), obs.reading_unit),
                        delta_L=Quantity(obs_dl, obs.reading_unit),
                    )
                )
            elif obs.step_type == StepTypeEnum.TARE_TEST:
                if not tare_obs:
                    tare_obs = TareObservation(
                        tare_load=Quantity(exact_decimal(obs.nominal_load), obs.load_unit),
                        net_load=Quantity(exact_decimal(obs.nominal_load), obs.load_unit),
                        indicated_I_net=Quantity(exact_decimal(obs.raw_indication_reading), obs.reading_unit),
                        delta_L_net=Quantity(obs_dl, obs.reading_unit),
                    )

        unit = inst_params.verification_scale_interval_e.unit if inst_params.verification_scale_interval_e else "kg"
        if not zero_obs:
            zero_obs = ZeroSettingObservation(
                indicated_I0=Quantity(exact_decimal(0), unit),
                delta_L0=Quantity(half_e, unit),
            )

        ecc_test_obs = None
        if ecc_positions and ecc_load:
            ecc_test_obs = EccentricityTestObservation(test_load=ecc_load, positions=ecc_positions)

        rep_series_list = None
        if rep_runs_by_load:
            rep_series_list = []
            for load_val, runs in rep_runs_by_load.items():
                rep_series_list.append(
                    RepeatabilitySeriesObservation(
                        nominal_load=Quantity(exact_decimal(load_val), unit),
                        runs=runs,
                    )
                )

        # 4. Build SessionEvaluationInput and evaluate
        verif_type = (
            VerificationTypeEnum.RE_VERIFICATION
            if session.application and session.application.application_type == ApplicationTypeEnum.RE_VERIFICATION
            else VerificationTypeEnum.INITIAL
        )

        session_input = SessionEvaluationInput(
            session_id=session.session_id,
            instrument=inst_params,
            verification_type=verif_type,
            test_timestamp=test_ts,
            zero_setting=zero_obs,
            linearity_steps=linearity_steps,
            reference_standards=ref_std_items,
            eccentricity=ecc_test_obs,
            repeatability=rep_series_list,
            tare=tare_obs,
        )

        pack = NAWIProcedurePack()
        eval_result = pack.evaluate_session(session_input)
        print("DEBUG EVAL RESULT:", eval_result.is_passed, eval_result.candidate_outcome, eval_result.failure_reasons, eval_result.errors)


        # 5. Persist TestObservation records
        # Clear existing observations for this session if re-submitting in same session
        for old_obs in list(session.observations):
            db.delete(old_obs)
        db.flush()

        for obs in submit_data.observations:
            # Find per-step trace if linearity step
            step_calc_trace = {}
            is_within_mpe = eval_result.is_passed
            obs_err = Decimal("0.000000")
            mpe_val = Decimal("0.000000")

            if obs.step_type in (StepTypeEnum.INCREASING_LOAD, StepTypeEnum.DECREASING_LOAD):
                for step_eval in eval_result.calculation_trace.get("steps", []):
                    if step_eval.get("step_number") == obs.step_sequence:
                        step_calc_trace = step_eval
                        is_within_mpe = step_eval.get("is_within_mpe", False)
                        obs_err = Decimal(str(step_eval.get("corrected_error_Ec", {}).get("value", "0.000000")))
                        mpe_val = Decimal(str(step_eval.get("mpe_mass", {}).get("value", "0.000000")))
                        break

            test_obs_entity = TestObservation(
                session_id=session.session_id,
                step_type=obs.step_type,
                step_sequence=obs.step_sequence,
                nominal_load=obs.nominal_load,
                load_unit=obs.load_unit,
                raw_indication_reading=obs.raw_indication_reading,
                normalized_indication=obs.normalized_indication or obs.raw_indication_reading,
                reading_unit=obs.reading_unit,
                observed_error=obs_err,
                mpe_allowed=mpe_val,
                is_within_mpe=is_within_mpe,
                repetition_index=obs.repetition_index,
                eccentricity_position=obs.eccentricity_position,
                calculation_trace=step_calc_trace,
                is_immutable=True,
            )
            db.add(test_obs_entity)

        # Advance session state machine to SUBMITTED
        VerificationSessionStateMachine.submit_observations(
            session=session,
            actor=sm_actor,
            automated_evaluation_passed=eval_result.is_passed,
        )

        db.flush()
        db.refresh(session)
        return session

    @staticmethod
    def record_session_disposition(
        db: Session,
        tenant_id: str,
        session_id: str,
        disposition: SessionDispositionRequest,
        actor: UserContext,
    ) -> VerificationSession:
        """Record formal officer disposition and finalize session."""
        session = VerificationService.get_session(db, tenant_id, session_id, actor)
        verify_jurisdiction_access(actor, session.application.jurisdiction_id if session.application else None)
        sm_actor = _to_sm_context(actor)

        VerificationSessionStateMachine.record_disposition(
            session=session,
            actor=sm_actor,
            outcome=disposition.outcome,
            disposition_notes=disposition.disposition_notes,
        )

        # Complete linked application if finalized
        if session.application and session.application.current_status == ApplicationStatusEnum.VERIFICATION_IN_PROGRESS:
            try:
                ApplicationStateMachine.complete_application(session.application, session, sm_actor)
            except Exception:
                pass

        db.flush()
        db.refresh(session)
        return session

    @staticmethod
    def get_session(
        db: Session,
        tenant_id: str,
        session_id: str,
        actor: UserContext,
    ) -> VerificationSession:
        """Retrieve verification session with relationships."""
        verify_tenant_access(actor, tenant_id)

        session = db.execute(
            select(VerificationSession)
            .options(
                joinedload(VerificationSession.reference_standards),
                joinedload(VerificationSession.observations),
                joinedload(VerificationSession.instrument).joinedload(Instrument.model),
                joinedload(VerificationSession.application),
            )
            .where(
                VerificationSession.tenant_id == tenant_id,
                VerificationSession.session_id == session_id,
            )
        ).unique().scalar_one_or_none()

        if not session:
            raise NotFoundError(f"Verification session [{session_id}] not found in tenant [{tenant_id}]")

        return session

    @staticmethod
    def list_sessions(
        db: Session,
        tenant_id: str,
        page: int = 1,
        page_size: int = 50,
        actor: Optional[UserContext] = None,
    ) -> Tuple[List[VerificationSession], int]:
        """List and paginate verification sessions."""
        if actor:
            verify_tenant_access(actor, tenant_id)

        stmt = (
            select(VerificationSession)
            .options(
                joinedload(VerificationSession.reference_standards),
                joinedload(VerificationSession.observations),
                joinedload(VerificationSession.instrument),
            )
            .where(VerificationSession.tenant_id == tenant_id)
        )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        offset = (page - 1) * page_size
        results = db.execute(stmt.offset(offset).limit(page_size)).unique().scalars().all()
        return list(results), total
