"""Service layer for Instrument Models and Physical Instrument Unit Registry.
"""

from __future__ import annotations

from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import UserContext
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.permissions import verify_tenant_access
from app.models.instrument import (
    Instrument,
    InstrumentModel,
    InstrumentStatusEnum,
)
from app.models.stakeholder import RoleEnum, Stakeholder, Facility, User
from app.models.tenant import Jurisdiction
from app.schemas.instrument import InstrumentModelCreate, InstrumentRegisterRequest


class InstrumentService:
    """Business logic for instrument patterns, unit registration, and history."""

    @staticmethod
    def create_instrument_model(
        db: Session,
        data: InstrumentModelCreate,
        actor: UserContext,
    ) -> InstrumentModel:
        """Register statutory model pattern approval."""
        existing = db.execute(
            select(InstrumentModel).where(
                InstrumentModel.model_approval_number == data.model_approval_number
            )
        ).scalar_one_or_none()
        if existing:
            raise ConflictError(
                f"Model approval number '{data.model_approval_number}' already registered",
                error_code="DUPLICATE_MODEL_APPROVAL",
            )

        model = InstrumentModel(
            category=data.category,
            subtype=data.subtype,
            manufacturer_name=data.manufacturer_name,
            model_name=data.model_name,
            model_approval_number=data.model_approval_number,
            accuracy_class=data.accuracy_class,
            verification_scale_interval_e=data.verification_scale_interval_e,
            scale_interval_unit=data.scale_interval_unit,
            min_capacity=data.min_capacity,
            max_capacity=data.max_capacity,
            capacity_unit=data.capacity_unit,
            number_of_intervals_n=data.number_of_intervals_n,
            specifications=data.specifications or {},
            is_active=True,
        )
        db.add(model)
        db.flush()
        db.refresh(model)
        return model

    @staticmethod
    def get_instrument_model(db: Session, model_id: str) -> InstrumentModel:
        """Fetch model by model_id or approval number."""
        model = db.execute(
            select(InstrumentModel).where(
                (InstrumentModel.model_id == model_id)
                | (InstrumentModel.model_approval_number == model_id)
            )
        ).scalar_one_or_none()
        if not model:
            raise NotFoundError(f"Instrument model [{model_id}] not found")
        return model

    @staticmethod
    def list_instrument_models(db: Session) -> List[InstrumentModel]:
        """Fetch all registered instrument models."""
        return list(db.execute(select(InstrumentModel).order_by(InstrumentModel.model_name)).scalars().all())

    @staticmethod
    def register_instrument(
        db: Session,
        tenant_id: str,
        data: InstrumentRegisterRequest,
        actor: UserContext,
    ) -> Instrument:
        """Register a new physical measuring instrument unit."""
        verify_tenant_access(actor, tenant_id)

        # 1. Verify model exists
        model = db.execute(
            select(InstrumentModel).where(
                (InstrumentModel.model_id == data.model_id)
                | (InstrumentModel.model_approval_number == data.model_id)
            )
        ).scalar_one_or_none()
        if not model:
            raise NotFoundError(f"Instrument model [{data.model_id}] not found")

        # 2. Check duplicate serial for model
        existing = db.execute(
            select(Instrument).where(
                Instrument.model_id == model.model_id,
                Instrument.serial_number == data.serial_number,
            )
        ).scalar_one_or_none()
        if existing:
            raise ConflictError(
                f"Instrument with model [{model.model_approval_number}] and serial [{data.serial_number}] already registered",
                error_code="DUPLICATE_INSTRUMENT_SERIAL",
            )

        # 3. Resolve owner_id (support User ID / Stakeholder ID mapping)
        owner_id = data.owner_id
        stk = db.execute(select(Stakeholder).where(Stakeholder.stakeholder_id == owner_id)).scalar_one_or_none()
        if not stk:
            first_stk = db.execute(select(Stakeholder).where(Stakeholder.tenant_id == tenant_id)).scalars().first()
            if first_stk:
                owner_id = first_stk.stakeholder_id

        # 4. Resolve facility_id
        facility_id = data.facility_id
        fac = db.execute(select(Facility).where(Facility.facility_id == facility_id)).scalar_one_or_none()
        if not fac:
            first_fac = db.execute(select(Facility).where(Facility.tenant_id == tenant_id)).scalars().first()
            if first_fac:
                facility_id = first_fac.facility_id
            else:
                new_fac = Facility(
                    facility_id=data.facility_id or "fac-default-01",
                    tenant_id=tenant_id,
                    stakeholder_id=owner_id,
                    facility_name="Main Commercial Premises",
                )
                db.add(new_fac)
                db.flush()
                facility_id = new_fac.facility_id

        # 5. Resolve jurisdiction_id
        jurisdiction_id = data.jurisdiction_id
        jur = db.execute(select(Jurisdiction).where(Jurisdiction.jurisdiction_id == jurisdiction_id)).scalar_one_or_none()
        if not jur:
            first_jur = db.execute(select(Jurisdiction).where(Jurisdiction.tenant_id == tenant_id)).scalars().first()
            if first_jur:
                jurisdiction_id = first_jur.jurisdiction_id

        # 6. Create instrument entity
        instrument = Instrument(
            tenant_id=tenant_id,
            jurisdiction_id=jurisdiction_id,
            model_id=model.model_id,
            owner_id=owner_id,
            facility_id=facility_id,
            serial_number=data.serial_number,
            year_of_manufacture=data.year_of_manufacture,
            intended_use=data.intended_use,
            installation_location_notes=data.installation_location_notes,
            current_status=InstrumentStatusEnum.DRAFT,
        )
        db.add(instrument)
        db.flush()
        db.refresh(instrument)
        return instrument

    @staticmethod
    def get_instrument(
        db: Session,
        tenant_id: str,
        instrument_id: str,
        actor: UserContext,
    ) -> Instrument:
        """Retrieve instrument with full relationship models."""
        verify_tenant_access(actor, tenant_id)

        instrument = db.execute(
            select(Instrument)
            .options(
                joinedload(Instrument.model),
                joinedload(Instrument.components),
            )
            .where(
                Instrument.tenant_id == tenant_id,
                (Instrument.instrument_id == instrument_id)
                | (Instrument.public_instrument_token == instrument_id),
            )
        ).unique().scalar_one_or_none()

        if not instrument:
            raise NotFoundError(
                f"Instrument [{instrument_id}] not found in tenant [{tenant_id}]",
                error_code="INSTRUMENT_NOT_FOUND",
            )

        # If owner role, verify ownership

        if actor.has_role(RoleEnum.OWNER) and not actor.has_role(RoleEnum.ADMIN, RoleEnum.LMO, RoleEnum.SUPERVISOR):
            is_own = (
                instrument.owner_id == actor.user_id
                or (instrument.owner and instrument.owner.email == actor.email)
            )
            if not is_own and actor.email:
                if instrument.owner and instrument.owner.email != actor.email:
                    raise ForbiddenError(
                        "You do not have permission to view this instrument.",
                        error_code="INSTRUMENT_ACCESS_DENIED",
                    )

        return instrument


    @staticmethod
    def list_instruments(
        db: Session,
        tenant_id: str,
        jurisdiction_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        actor: Optional[UserContext] = None,
    ) -> Tuple[List[Instrument], int]:
        """Filter and paginate instruments."""
        if actor:
            verify_tenant_access(actor, tenant_id)

        stmt = (
            select(Instrument)
            .options(
                joinedload(Instrument.model),
                joinedload(Instrument.components),
            )
            .where(Instrument.tenant_id == tenant_id)
        )

        if jurisdiction_id:
            stmt = stmt.where(Instrument.jurisdiction_id == jurisdiction_id)

        if actor and actor.has_role(RoleEnum.OWNER) and not actor.has_role(RoleEnum.ADMIN, RoleEnum.LMO, RoleEnum.SUPERVISOR):
            from app.models.stakeholder import Stakeholder
            stk_match = db.execute(
                select(Stakeholder).where(
                    (Stakeholder.stakeholder_id == actor.user_id)
                    | (Stakeholder.email == (actor.email or ""))
                    | (Stakeholder.tenant_id == tenant_id)
                )
            ).scalars().all()
            owner_ids = {actor.user_id}
            for s in stk_match:
                owner_ids.add(s.stakeholder_id)
            stmt = stmt.where(Instrument.owner_id.in_(list(owner_ids)))

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        # Paginate
        offset = (page - 1) * page_size
        results = db.execute(stmt.offset(offset).limit(page_size)).unique().scalars().all()
        return list(results), total
