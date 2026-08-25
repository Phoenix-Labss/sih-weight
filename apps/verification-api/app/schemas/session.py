"""Pydantic v2 schemas for Verification Sessions, Observations, and Metrological Evaluations.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import ConfigDict, Field

from app.models.observation import StepTypeEnum
from app.models.session import SessionStatusEnum, VerificationOutcomeEnum
from app.schemas.common import BaseSchema


class ObservationItemInput(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    step_type: StepTypeEnum = Field(..., description="ZERO_TEST, INCREASING_LOAD, DECREASING_LOAD, ECCENTRICITY, REPEATABILITY, TARE_TEST")
    step_sequence: int = Field(..., ge=1)
    nominal_load: Decimal = Field(..., ge=0, decimal_places=6)
    load_unit: str = Field("kg", min_length=1, max_length=20)
    raw_indication_reading: Decimal = Field(..., ge=0, decimal_places=6)

    reading_unit: str = Field("kg", min_length=1, max_length=20)
    normalized_indication: Optional[Decimal] = Field(None, ge=0, decimal_places=6)
    repetition_index: int = Field(1, ge=1, le=10)
    eccentricity_position: Optional[str] = Field(None, max_length=50)
    delta_L: Optional[Decimal] = Field(None, ge=0, decimal_places=6, description="Additional small weights at turning point (defaults to 0.5e)")






class ObservationResponse(BaseSchema):
    observation_id: str
    session_id: str
    step_type: StepTypeEnum
    step_sequence: int
    nominal_load: Decimal
    load_unit: str
    raw_indication_reading: Decimal
    normalized_indication: Decimal
    reading_unit: str
    observed_error: Decimal
    mpe_allowed: Decimal
    is_within_mpe: bool
    repetition_index: int
    eccentricity_position: Optional[str] = None
    calculation_trace: Dict[str, Any] = Field(default_factory=dict)
    is_immutable: bool
    recorded_at: Optional[datetime] = None


class SessionReferenceStandardResponse(BaseSchema):
    standard_id: str
    snapshot_calibration_certificate: str
    snapshot_valid_until: datetime
    verified_suitable: bool


class SessionCreateRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    application_id: str = Field(..., min_length=1, max_length=36)
    instrument_id: str = Field(..., min_length=1, max_length=36)
    procedure_pack_id: str = Field("IND-LM-NAWI-CLASS-III-IIII-2026.1", min_length=2, max_length=100)
    scheduled_date: date
    environmental_temp_celsius: Optional[Decimal] = Field(None, decimal_places=2)
    environmental_humidity_percent: Optional[Decimal] = Field(None, decimal_places=2)


class SessionObservationSubmitRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    reference_standard_ids: List[str] = Field(..., min_length=1, description="List of standard_ids used for testing")
    observations: List[ObservationItemInput] = Field(..., min_length=1, description="Recorded test measurement readings")
    environmental_temp_celsius: Optional[Decimal] = Field(None, decimal_places=2)
    environmental_humidity_percent: Optional[Decimal] = Field(None, decimal_places=2)


class SessionDispositionRequest(BaseSchema):
    model_config = ConfigDict(extra="forbid")
    outcome: VerificationOutcomeEnum = Field(..., description="Official statutory officer disposition outcome")
    disposition_notes: Optional[str] = Field(None, max_length=1000)


class SessionResponse(BaseSchema):
    session_id: str
    tenant_id: str
    application_id: str
    instrument_id: str
    procedure_pack_id: str
    procedure_pack_checksum: str
    verifier_id: str
    verifier_role: str
    scheduled_date: date
    actual_test_timestamp: Optional[datetime] = None
    test_location_geo: Optional[Dict[str, Any]] = None
    environmental_temp_celsius: Optional[Decimal] = None
    environmental_humidity_percent: Optional[Decimal] = None
    status: SessionStatusEnum
    automated_evaluation_flag: Optional[bool] = None
    outcome: Optional[VerificationOutcomeEnum] = None
    officer_disposition_notes: Optional[str] = None
    finalized_at: Optional[datetime] = None
    reference_standards: List[SessionReferenceStandardResponse] = Field(default_factory=list)
    observations: List[ObservationResponse] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
