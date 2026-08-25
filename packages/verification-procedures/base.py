"""Abstract procedure pack definitions, observation models, and evaluation results.

Defines standard schemas and domain contracts under The Legal Metrology (General) Rules, 2011
and OIML R 76-1.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from packages.measurement.units import Quantity


class AccuracyClassEnum(str, Enum):
    """Accuracy classes for weighing instruments."""
    CLASS_I = "CLASS_I"      # Special Accuracy
    CLASS_II = "CLASS_II"    # High Accuracy
    CLASS_III = "CLASS_III"  # Medium Accuracy
    CLASS_IIII = "CLASS_IIII"# Ordinary Accuracy


class VerificationTypeEnum(str, Enum):
    """Statutory verification type."""
    INITIAL = "INITIAL"
    RE_VERIFICATION = "RE_VERIFICATION"


class VerificationOutcomeEnum(str, Enum):
    """Authoritative legal outcomes for verification evaluations."""
    VERIFICATION_PASSED_PENDING_AUTHORIZATION = "Verification passed — pending authorization"
    VERIFICATION_FAILED = "Verification failed"
    NEEDS_REVIEW = "Needs review"
    INCOMPLETE_VERIFICATION = "Incomplete verification"
    OUTSIDE_AUTHORIZATION_SCOPE = "Outside authorization scope"


class EccentricityPositionEnum(str, Enum):
    """Standardized loading positions for eccentricity tests."""
    CENTER = "CENTER"
    FRONT_LEFT = "FRONT_LEFT"
    FRONT_RIGHT = "FRONT_RIGHT"
    BACK_RIGHT = "BACK_RIGHT"
    BACK_LEFT = "BACK_LEFT"


class TestDirectionEnum(str, Enum):
    """Direction of applied load during linearity performance tests."""
    __test__ = False  # Prevent pytest from treating this enum as a test class
    INCREASING = "INCREASING"
    DECREASING = "DECREASING"


class StandardAccuracyClassEnum(str, Enum):
    """Standard weights accuracy classes under OIML R 111-1 and 2011 Rules."""
    E1 = "E1"
    E2 = "E2"
    F1 = "F1"
    F2 = "F2"
    M1 = "M1"
    M2 = "M2"
    M3 = "M3"


@dataclass(frozen=True)
class InstrumentParameters:
    """Metrological specifications of the weighing instrument under test."""
    accuracy_class: AccuracyClassEnum
    max_capacity: Quantity
    min_capacity: Quantity
    verification_scale_interval_e: Quantity
    actual_scale_interval_d: Quantity
    num_support_points: int = 4
    instrument_type: str = "NON_AUTOMATIC_WEIGHING_INSTRUMENT"

    def calculate_n(self) -> ExactDecimal:
        """Calculate number of verification scale intervals n = Max / e."""
        max_in_e_unit = self.max_capacity.to_unit(self.verification_scale_interval_e.unit)
        return ExactDecimal(max_in_e_unit.value / self.verification_scale_interval_e.value)


@dataclass(frozen=True)
class ReferenceStandardItem:
    """Certified reference standard used in verification."""
    standard_id: str
    standard_name: str
    accuracy_class: StandardAccuracyClassEnum
    nominal_mass: Quantity
    calibration_date: Union[date, str]
    expiry_date: Union[date, str]
    is_quarantined: bool = False
    status: str = "ACTIVE"
    uncertainty_k2: Optional[Quantity] = None
    certificate_hash: Optional[str] = None


@dataclass(frozen=True)
class ZeroSettingObservation:
    """Zero-load observation for true zero indication P0 calculation."""
    indicated_I0: Quantity
    delta_L0: Quantity


@dataclass(frozen=True)
class LinearityStepObservation:
    """Observation at a specific nominal test load."""
    step_number: int
    direction: TestDirectionEnum
    nominal_load: Quantity
    indicated_I: Quantity
    delta_L: Quantity


@dataclass(frozen=True)
class EccentricityPositionObservation:
    """Observation at an off-center position."""
    position: EccentricityPositionEnum
    indicated_I: Quantity
    delta_L: Quantity


@dataclass(frozen=True)
class EccentricityTestObservation:
    """Complete 5-position eccentricity test observation."""
    test_load: Quantity
    positions: List[EccentricityPositionObservation]


@dataclass(frozen=True)
class RepeatabilityRunObservation:
    """Individual run in a repeatability series."""
    run_number: int
    indicated_I: Quantity
    delta_L: Quantity


@dataclass(frozen=True)
class RepeatabilitySeriesObservation:
    """Series of repeated weighings at a constant nominal load."""
    nominal_load: Quantity
    runs: List[RepeatabilityRunObservation]


@dataclass(frozen=True)
class TareObservation:
    """Observation for tare balancing and net weighing accuracy."""
    tare_load: Quantity
    net_load: Quantity
    indicated_I_net: Quantity
    delta_L_net: Quantity


@dataclass(frozen=True)
class SessionEvaluationInput:
    """Input payload for deterministic procedure evaluation."""
    session_id: str
    instrument: InstrumentParameters
    verification_type: VerificationTypeEnum
    test_timestamp: Union[datetime, str]
    zero_setting: ZeroSettingObservation
    linearity_steps: List[LinearityStepObservation]
    reference_standards: List[ReferenceStandardItem] = field(default_factory=list)
    eccentricity: Optional[EccentricityTestObservation] = None
    repeatability: Optional[List[RepeatabilitySeriesObservation]] = None
    tare: Optional[TareObservation] = None
    temperature_celsius: Optional[ExactDecimal] = None
    relative_humidity_pct: Optional[ExactDecimal] = None


@dataclass(frozen=True)
class StepEvaluationResult:
    """Evaluated result for a single linearity step."""
    step_number: int
    direction: str
    nominal_load: Quantity
    load_in_e: ExactDecimal
    indicated_I: Quantity
    delta_L: Quantity
    true_indication_P: Quantity
    raw_error_E: Quantity
    corrected_error_Ec: Quantity
    mpe_e: ExactDecimal
    mpe_mass: Quantity
    is_within_mpe: bool


@dataclass(frozen=True)
class EvaluationResult:
    """Authoritative outcome of procedure pack execution."""
    is_passed: bool
    candidate_outcome: VerificationOutcomeEnum
    failure_reasons: List[str]
    calculation_trace: Dict[str, Any]
    errors: List[str] = field(default_factory=list)


class BaseProcedurePack(ABC):
    """Abstract base class for legal metrology verification procedure packs."""

    @property
    @abstractmethod
    def pack_id(self) -> str:
        """Unique identifier for this procedure pack version."""
        pass

    @property
    @abstractmethod
    def version(self) -> str:
        """Semantic version of the procedure pack."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Display name of the procedure pack."""
        pass

    @property
    @abstractmethod
    def legal_source_ref(self) -> str:
        """Legal citation reference."""
        pass

    @property
    @abstractmethod
    def source_checksum_sha256(self) -> str:
        """Cryptographic checksum of legal source text."""
        pass

    @abstractmethod
    def evaluate_session(self, session_input: SessionEvaluationInput) -> EvaluationResult:
        """Execute deterministic evaluation against test session observations."""
        pass
