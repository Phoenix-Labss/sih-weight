"""Statutory Fee Assessment Engine for Legal Metrology Instruments.

Provides exact rational/decimal calculation of verification fees under Twelfth Schedule
of The Legal Metrology (General) Rules, 2011.
"""

from .calculator import StatutoryFeeCalculator, default_fee_calculator
from .errors import (
    FeeError,
    InvalidCapacityError,
    UnsupportedAccuracyClassError,
    InvalidFeePolicyError,
    FeeCalculationError,
)
from .models import (
    FeeAccuracyClass,
    FeeAssessmentRequest,
    FeeAssessmentResult,
    FeeItemBreakdown,
    FeeServiceMode,
    FeeVerificationType,
)
from .policies import (
    BaseFeePolicy,
    ScheduleXII2011FeePolicy,
)

__all__ = [
    "StatutoryFeeCalculator",
    "default_fee_calculator",
    "FeeError",
    "InvalidCapacityError",
    "UnsupportedAccuracyClassError",
    "InvalidFeePolicyError",
    "FeeCalculationError",
    "FeeAccuracyClass",
    "FeeAssessmentRequest",
    "FeeAssessmentResult",
    "FeeItemBreakdown",
    "FeeServiceMode",
    "FeeVerificationType",
    "BaseFeePolicy",
    "ScheduleXII2011FeePolicy",
]
