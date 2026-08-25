"""Statutory Fee Calculator Engine for Legal Metrology Instrument Verification.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional, Union

from .errors import InvalidFeePolicyError, FeeError
from .models import (
    FeeAccuracyClass,
    FeeAssessmentRequest,
    FeeAssessmentResult,
    FeeServiceMode,
    FeeVerificationType,
)
from .policies import BaseFeePolicy, ScheduleXII2011FeePolicy


class StatutoryFeeCalculator:
    """Central deterministic fee assessment engine with policy version routing."""

    DEFAULT_POLICY_VERSION = "IN-FEES-2026.1"

    def __init__(self):
        self._policies: Dict[str, BaseFeePolicy] = {}
        # Register standard statutory policies
        self.register_policy(ScheduleXII2011FeePolicy("IN-FEES-2026.1", "CENTRAL"))
        self.register_policy(ScheduleXII2011FeePolicy("DL-FEES-2026.1", "DL"))
        self.register_policy(ScheduleXII2011FeePolicy("MH-FEES-2026.1", "MH"))
        self.register_policy(ScheduleXII2011FeePolicy("SCHEDULE_XII_2011", "CENTRAL"))

    def register_policy(self, policy: BaseFeePolicy) -> None:
        """Register or override a versioned fee policy."""
        self._policies[policy.policy_version.upper()] = policy

    def get_policy(self, policy_version: Optional[str] = None) -> BaseFeePolicy:
        """Retrieve policy instance by version string."""
        key = (policy_version or self.DEFAULT_POLICY_VERSION).strip().upper()
        if key not in self._policies:
            # Fallback to default if version is standard prefix or alias
            if key in ("DEFAULT", "LATEST", "CENTRAL", "2026.1", "SCHEDULE_XII"):
                return self._policies[self.DEFAULT_POLICY_VERSION]
            raise InvalidFeePolicyError(
                f"Statutory fee policy version '{policy_version}' is not registered. Available: {list(self._policies.keys())}"
            )
        return self._policies[key]

    def calculate(self, request: Union[FeeAssessmentRequest, Dict[str, Any]]) -> FeeAssessmentResult:
        """Calculate statutory fee assessment for given request."""
        if isinstance(request, dict):
            req_obj = FeeAssessmentRequest(**request)
        elif isinstance(request, FeeAssessmentRequest):
            req_obj = request
        else:
            raise FeeError(f"Expected FeeAssessmentRequest or dict, got {type(request).__name__}")

        policy = self.get_policy(req_obj.policy_version)
        return policy.calculate(req_obj)

    def calculate_nawi_fee(
        self,
        max_capacity: Union[Decimal, str, int],
        capacity_unit: str = "kg",
        accuracy_class: str = "CLASS_III",
        service_mode: str = "ON_SITE",
        verification_type: str = "INITIAL_VERIFICATION",
        is_late_submission: bool = False,
        days_overdue: int = 0,
        months_overdue: int = 0,
        policy_version: str = "IN-FEES-2026.1",
    ) -> FeeAssessmentResult:
        """Convenience method for calculating NAWI verification fees."""
        req = FeeAssessmentRequest(
            category="NAWI",
            accuracy_class=accuracy_class,
            max_capacity=Decimal(str(max_capacity)),
            capacity_unit=capacity_unit,
            service_mode=FeeServiceMode(service_mode) if isinstance(service_mode, str) else service_mode,
            verification_type=FeeVerificationType(verification_type) if isinstance(verification_type, str) else verification_type,
            is_late_submission=is_late_submission,
            days_overdue=days_overdue,
            months_overdue=months_overdue,
            policy_version=policy_version,
        )
        return self.calculate(req)


# Default global instance
default_fee_calculator = StatutoryFeeCalculator()
