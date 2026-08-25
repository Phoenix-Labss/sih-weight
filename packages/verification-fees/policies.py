"""Statutory Fee Policies for Legal Metrology Verification.

Implements Twelfth Schedule of The Legal Metrology (General) Rules, 2011
with exact rational/decimal arithmetic.
"""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple

from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from .errors import InvalidCapacityError, UnsupportedAccuracyClassError
from .models import (
    FeeAccuracyClass,
    FeeAssessmentRequest,
    FeeAssessmentResult,
    FeeItemBreakdown,
    FeeServiceMode,
)

TWO_PLACES = Decimal("0.01")


def _quantize_currency(amount: Decimal | ExactDecimal) -> Decimal:
    """Quantize monetary amount to exactly 2 decimal places with ROUND_HALF_UP."""
    if isinstance(amount, (int, str)):
        amount = Decimal(str(amount))
    return Decimal(str(amount)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


class BaseFeePolicy(ABC):
    """Abstract Base Class for statutory fee policies."""

    @property
    @abstractmethod
    def policy_version(self) -> str:
        """Unique identifier and version of the statutory fee policy."""
        pass

    @property
    @abstractmethod
    def legal_reference(self) -> str:
        """Legal reference / statutory rule citation."""
        pass

    @abstractmethod
    def calculate(self, request: FeeAssessmentRequest) -> FeeAssessmentResult:
        """Calculate itemized fee assessment for the request."""
        pass


class ScheduleXII2011FeePolicy(BaseFeePolicy):
    """Statutory Fee Policy under Twelfth Schedule of The Legal Metrology (General) Rules, 2011.

    Supports NAWI Class I, Class II, Class III, and Class IIII.
    """

    def __init__(self, version_id: str = "IN-FEES-2026.1", state_code: str = "CENTRAL"):
        self._version_id = version_id
        self._state_code = state_code

    @property
    def policy_version(self) -> str:
        return self._version_id

    @property
    def legal_reference(self) -> str:
        return "Twelfth Schedule, The Legal Metrology (General) Rules, 2011 (Section 24)"

    def _normalize_capacity_to_kg(self, capacity: Decimal, unit: str) -> Decimal:
        """Normalize any metric mass unit to kilograms (kg)."""
        u = unit.strip().lower()
        if u in ("kg", "kilogram", "kilograms"):
            multiplier = Decimal("1")
        elif u in ("g", "gram", "grams"):
            multiplier = Decimal("0.001")
        elif u in ("mg", "milligram", "milligrams"):
            multiplier = Decimal("0.000001")
        elif u in ("t", "tonne", "tonnes", "ton", "tons", "metric_ton", "metric_tonne"):
            multiplier = Decimal("1000")
        elif u in ("q", "quintal", "quintals"):
            multiplier = Decimal("100")
        else:
            raise InvalidCapacityError(f"Unsupported capacity unit '{unit}'. Supported: mg, g, kg, t, q.")

        cap_kg = capacity * multiplier
        if cap_kg <= Decimal("0"):
            raise InvalidCapacityError(f"Instrument maximum capacity must be greater than zero, got {capacity} {unit}")
        return cap_kg

    def _get_base_fee(self, accuracy_class: str, cap_kg: Decimal) -> Tuple[Decimal, str]:
        """Calculate base statutory fee under Twelfth Schedule for given class & capacity.

        Returns (base_fee, description).
        """
        acc_upper = accuracy_class.strip().upper()

        if acc_upper in (FeeAccuracyClass.CLASS_I.value, "CLASS_I", "CLASS I", "I"):
            # Special Accuracy (Class I)
            if cap_kg <= Decimal("0.100"):
                return Decimal("100.00"), "Class I Precision Balance (<= 100 g)"
            elif cap_kg <= Decimal("1.000"):
                return Decimal("200.00"), "Class I Precision Balance (> 100 g and <= 1 kg)"
            elif cap_kg <= Decimal("5.000"):
                return Decimal("500.00"), "Class I Precision Balance (> 1 kg and <= 5 kg)"
            elif cap_kg <= Decimal("50.000"):
                return Decimal("1000.00"), "Class I Precision Balance (> 5 kg and <= 50 kg)"
            else:
                return Decimal("2000.00"), "Class I Precision Balance (> 50 kg)"

        elif acc_upper in (FeeAccuracyClass.CLASS_II.value, "CLASS_II", "CLASS II", "II"):
            # High Accuracy (Class II)
            if cap_kg <= Decimal("0.100"):
                return Decimal("100.00"), "Class II High Accuracy Scale (<= 100 g)"
            elif cap_kg <= Decimal("1.000"):
                return Decimal("150.00"), "Class II High Accuracy Scale (> 100 g and <= 1 kg)"
            elif cap_kg <= Decimal("5.000"):
                return Decimal("300.00"), "Class II High Accuracy Scale (> 1 kg and <= 5 kg)"
            elif cap_kg <= Decimal("50.000"):
                return Decimal("500.00"), "Class II High Accuracy Scale (> 5 kg and <= 50 kg)"
            else:
                return Decimal("1000.00"), "Class II High Accuracy Scale (> 50 kg)"

        elif acc_upper in (
            FeeAccuracyClass.CLASS_III.value,
            FeeAccuracyClass.CLASS_IIII.value,
            "CLASS_III",
            "CLASS III",
            "III",
            "CLASS_IIII",
            "CLASS IIII",
            "IIII",
            "CLASS_4",
            "4",
        ):
            # Medium Accuracy (Class III) & Ordinary Accuracy (Class IIII)
            if cap_kg <= Decimal("10.000"):
                return Decimal("100.00"), "Class III/IIII Non-Automatic Weighing Instrument (<= 10 kg)"
            elif cap_kg <= Decimal("50.000"):
                return Decimal("200.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 10 kg and <= 50 kg)"
            elif cap_kg <= Decimal("100.000"):
                return Decimal("300.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 50 kg and <= 100 kg)"
            elif cap_kg <= Decimal("300.000"):
                return Decimal("400.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 100 kg and <= 300 kg)"
            elif cap_kg <= Decimal("500.000"):
                return Decimal("500.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 300 kg and <= 500 kg)"
            elif cap_kg <= Decimal("1000.000"):
                return Decimal("1000.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 500 kg and <= 1 tonne)"
            elif cap_kg <= Decimal("2000.000"):
                return Decimal("1500.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 1 t and <= 2 tonnes)"
            elif cap_kg <= Decimal("3000.000"):
                return Decimal("2000.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 2 t and <= 3 tonnes)"
            elif cap_kg <= Decimal("5000.000"):
                return Decimal("3000.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 3 t and <= 5 tonnes)"
            elif cap_kg <= Decimal("10000.000"):
                return Decimal("4000.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 5 t and <= 10 tonnes)"
            elif cap_kg <= Decimal("20000.000"):
                return Decimal("5000.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 10 t and <= 20 tonnes)"
            elif cap_kg <= Decimal("30000.000"):
                return Decimal("6000.00"), "Class III/IIII Non-Automatic Weighing Instrument (> 20 t and <= 30 tonnes)"
            elif cap_kg <= Decimal("50000.000"):
                return Decimal("7000.00"), "Class III/IIII Heavy Weighbridge / Instrument (> 30 t and <= 50 tonnes)"
            else:
                # Capacity > 50 tonnes: Rs. 7,000 + Rs. 1,000 per additional 10 tonnes or part thereof
                add_kg = cap_kg - Decimal("50000.000")
                add_tonnes = add_kg / Decimal("1000.000")
                add_brackets = math.ceil(float(add_tonnes) / 10.0)
                add_fee = Decimal(str(add_brackets)) * Decimal("1000.00")
                total_base = Decimal("7000.00") + add_fee
                return total_base, f"Class III/IIII High-Capacity Weighbridge (> 50 tonnes: 50t base + {add_brackets}x 10t tier)"
        else:
            raise UnsupportedAccuracyClassError(
                f"Unsupported accuracy class '{accuracy_class}'. Supported: CLASS_I, CLASS_II, CLASS_III, CLASS_IIII."
            )

    def calculate(self, request: FeeAssessmentRequest) -> FeeAssessmentResult:
        """Perform deterministic statutory fee assessment."""
        cap_kg = self._normalize_capacity_to_kg(request.max_capacity, request.capacity_unit)
        base_fee_raw, base_desc = self._get_base_fee(request.accuracy_class, cap_kg)
        base_fee = _quantize_currency(base_fee_raw)

        # 1. Location Surcharge / Multiplier
        # Under statutory rules, on-site verification incurs a 2.0x base multiplier (100% additional surcharge)
        if request.service_mode == FeeServiceMode.ON_SITE:
            loc_multiplier = Decimal("2.00")
            loc_surcharge = _quantize_currency(base_fee * Decimal("1.00"))
            loc_desc = "Statutory 100% surcharge for on-site / user premises verification"
        else:
            loc_multiplier = Decimal("1.00")
            loc_surcharge = Decimal("0.00")
            loc_desc = "Departmental laboratory / office verification (no on-site surcharge)"

        # 2. Portal User Charge (Standard Digital Processing Fee)
        portal_charge = _quantize_currency(Decimal("50.00"))
        portal_desc = "Digital portal processing and maintenance statutory user charge"

        # 3. Late Submission Penalty
        if request.months_overdue > 0:
            late_months = request.months_overdue
            late_fee = _quantize_currency(Decimal(str(late_months)) * base_fee)
            late_desc = f"Statutory late submission penalty: {late_months} month(s) overdue @ 100% base fee per month"
        elif request.days_overdue > 0:
            late_months = (request.days_overdue + 29) // 30  # Ceil division
            late_fee = _quantize_currency(Decimal(str(late_months)) * base_fee)
            late_desc = f"Statutory late submission penalty: {request.days_overdue} day(s) ({late_months} month cycle) @ 100% base fee"
        elif request.is_late_submission:
            late_fee = _quantize_currency(base_fee * Decimal("1.00"))
            late_desc = "Statutory late submission penalty (100% base verification fee)"
        else:
            late_fee = Decimal("0.00")
            late_desc = "Application submitted on time; zero late fee"

        # Total Assessed Amount
        total_fee = _quantize_currency(base_fee + loc_surcharge + portal_charge + late_fee)

        # Build itemized breakdown
        breakdown_items = [
            FeeItemBreakdown(
                code="BASE_STATUTORY_FEE",
                name="Base Statutory Verification Fee",
                amount=base_fee,
                description=f"{base_desc} under {self.legal_reference}",
            ),
        ]

        if loc_surcharge > Decimal("0.00"):
            breakdown_items.append(
                FeeItemBreakdown(
                    code="LOCATION_ON_SITE_SURCHARGE",
                    name="On-Site Verification Surcharge (100%)",
                    amount=loc_surcharge,
                    description=loc_desc,
                )
            )

        breakdown_items.append(
            FeeItemBreakdown(
                code="PORTAL_USER_CHARGE",
                name="Portal Administrative User Charge",
                amount=portal_charge,
                description=portal_desc,
            )
        )

        if late_fee > Decimal("0.00"):
            breakdown_items.append(
                FeeItemBreakdown(
                    code="LATE_SUBMISSION_PENALTY",
                    name="Late Submission Penalty",
                    amount=late_fee,
                    description=late_desc,
                )
            )

        return FeeAssessmentResult(
            base_fee=base_fee,
            location_multiplier=loc_multiplier,
            location_surcharge=loc_surcharge,
            portal_charge=portal_charge,
            late_fee=late_fee,
            total_fee=total_fee,
            currency="INR",
            policy_version=self.policy_version,
            itemized_breakdown=breakdown_items,
        )
