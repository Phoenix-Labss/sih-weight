"""Statutory Validity Calculator for Weighing & Measuring Instruments.

Implements statutory verification periods under Section 24 of The Legal Metrology Act, 2009
and Schedule XI of The Legal Metrology (General) Rules, 2011.
"""

from __future__ import annotations

from datetime import date
from typing import Optional, Tuple
from dateutil.relativedelta import relativedelta


# Statutory validity period mappings (in months)
STATUTORY_VALIDITY_MAP = {
    # NAWI Commercial (Class III & IIII): 12 months (1 Year)
    ("NAWI", "CLASS_III"): 12,
    ("NAWI", "CLASS_IIII"): 12,
    # High Precision Balances (Class I & II): 12 months (1 Year)
    ("NAWI", "CLASS_I"): 12,
    ("NAWI", "CLASS_II"): 12,
    # Automatic Weighing Instruments: 12 months (1 Year)
    ("AWI", "AUTOMATIC_GRAVIMETRIC_FILLING"): 12,
    ("AWI", "CONTINUOUS_TOTALIZING"): 12,
    ("AWI", "DISCONTINUOUS_TOTALIZING"): 12,
    ("AWI", "RAIL_WEIGHBRIDGE"): 12,
    ("AWI", "ROAD_WEIGHBRIDGE"): 12,
    ("AWI", "CATCHWEIGHER"): 12,
    # Liquid Measuring & Storage
    ("LIQUID_MEASURE", "STORAGE_TANK"): 24,       # Biennial (2 Years)
    ("LIQUID_MEASURE", "FLOWMETER"): 12,
    ("WEIGHTS", "WORKING_STANDARD"): 12,
    ("WEIGHTS", "COMMERCIAL_WEIGHTS"): 24,         # Cast iron weights biennial in some state schedules
}


class StatutoryValidityCalculator:
    """Calculates statutory verification validity periods and expiration dates."""

    @staticmethod
    def get_validity_months(
        category: str,
        accuracy_class: str = "CLASS_III",
        is_biennial: bool = False,
        custom_validity_months: Optional[int] = None,
    ) -> int:
        """Determine statutory validity period in months."""
        if custom_validity_months is not None and custom_validity_months > 0:
            return custom_validity_months

        if is_biennial:
            return 24

        cat_upper = category.upper()
        acc_upper = accuracy_class.upper()

        # Check direct match in statutory map
        if (cat_upper, acc_upper) in STATUTORY_VALIDITY_MAP:
            return STATUTORY_VALIDITY_MAP[(cat_upper, acc_upper)]

        # Check category general rule
        for (cat_key, _), months in STATUTORY_VALIDITY_MAP.items():
            if cat_key == cat_upper:
                return months

        # Default fallback: 12 months (Annual verification cycle under Sec 24)
        return 12

    @classmethod
    def calculate_validity_dates(
        cls,
        issue_date: date,
        category: str = "NAWI",
        accuracy_class: str = "CLASS_III",
        is_biennial: bool = False,
        custom_validity_months: Optional[int] = None,
    ) -> Tuple[date, date, int]:
        """Compute issue date, valid_until date, and validity duration in months.
        
        Returns:
            Tuple of (issue_date, valid_until_date, validity_months)
        """
        months = cls.get_validity_months(
            category=category,
            accuracy_class=accuracy_class,
            is_biennial=is_biennial,
            custom_validity_months=custom_validity_months,
        )
        valid_until = issue_date + relativedelta(months=months)
        return issue_date, valid_until, months
