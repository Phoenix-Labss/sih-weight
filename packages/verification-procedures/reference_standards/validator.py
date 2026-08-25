"""Reference standard integrity and fail-closed validation engine.

Implements strict validation under The Legal Metrology Act, 2009, The Legal Metrology
(National Standards) Rules, 2011, and OIML R 76-1 §3.7.1.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union

from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from packages.measurement.units import Quantity
from ..base import (
    AccuracyClassEnum,
    InstrumentParameters,
    ReferenceStandardItem,
    VerificationTypeEnum,
)
from ..nawi.mpe import calculate_nawi_mpe
from .hierarchy import is_standard_class_compatible


@dataclass(frozen=True)
class StandardValidationResult:
    """Outcome of reference standards validation."""
    is_valid: bool
    errors: List[str]
    details: List[Dict[str, Any]] = field(default_factory=list)


def parse_date(d: Union[date, datetime, str]) -> date:
    """Parse various date formats into a standard date object."""
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    if isinstance(d, str):
        clean = d.split("T")[0].split(" ")[0].strip()
        return datetime.strptime(clean, "%Y-%m-%d").date()
    raise ValueError(f"Cannot parse date from {type(d).__name__}: {d!r}")


class ReferenceStandardValidator:
    """Validator ensuring reference standards satisfy legal traceability and accuracy requirements."""

    @classmethod
    def validate_standards(
        cls,
        standards: List[ReferenceStandardItem],
        instrument: InstrumentParameters,
        test_timestamp: Union[datetime, str],
        verification_type: VerificationTypeEnum = VerificationTypeEnum.INITIAL,
    ) -> StandardValidationResult:
        """Execute fail-closed verification of all reference standards used in the session.

        Enforces:
        1. Calibration expiry vs test timestamp.
        2. Quarantine and active state check.
        3. Accuracy class compatibility for NAWI class.
        4. Standard expanded uncertainty ratio: U(k=2) <= 1/3 MPE(L).
        """
        if not standards:
            return StandardValidationResult(
                is_valid=False,
                errors=["NO_REFERENCE_STANDARDS_PROVIDED: Verification requires at least one certified reference standard."],
            )

        test_dt = parse_date(test_timestamp)
        errors: List[str] = []
        details: List[Dict[str, Any]] = []

        for std in standards:
            std_errors: List[str] = []
            cal_start = parse_date(std.calibration_date)
            cal_expiry = parse_date(std.expiry_date)

            # 1. State / Quarantine check
            if std.is_quarantined or std.status.upper() != "ACTIVE":
                std_errors.append(
                    f"QUARANTINED_REFERENCE_STANDARD: Standard '{std.standard_id}' is quarantined or not active (status={std.status})."
                )

            # 2. Calibration Expiry check
            if test_dt > cal_expiry:
                std_errors.append(
                    f"EXPIRED_REFERENCE_STANDARD: Standard '{std.standard_id}' expired on {cal_expiry} (test date: {test_dt})."
                )
            elif test_dt < cal_start:
                std_errors.append(
                    f"CALIBRATION_NOT_EFFECTIVE: Standard '{std.standard_id}' calibration effective date is {cal_start} (test date: {test_dt})."
                )

            # 3. Accuracy Class compatibility check
            if not is_standard_class_compatible(instrument.accuracy_class, std.accuracy_class):
                std_errors.append(
                    f"INCOMPATIBLE_STANDARD_CLASS: Standard class '{std.accuracy_class.value}' is prohibited "
                    f"for instrument class '{instrument.accuracy_class.value}'."
                )

            # 4. Uncertainty ratio check U <= 1/3 MPE
            uncertainty_passed = True
            if std.uncertainty_k2 is not None:
                mpe = calculate_nawi_mpe(
                    load=std.nominal_mass,
                    e=instrument.verification_scale_interval_e,
                    accuracy_class=instrument.accuracy_class,
                    verification_type=verification_type,
                )
                u_in_mpe_unit = std.uncertainty_k2.to_unit(mpe.unit)
                max_allowable_u = ExactDecimal(mpe.value / ExactDecimal("3"))
                if u_in_mpe_unit.value > max_allowable_u:
                    uncertainty_passed = False
                    std_errors.append(
                        f"STANDARD_UNCERTAINTY_EXCEEDED: Standard '{std.standard_id}' uncertainty "
                        f"U={u_in_mpe_unit.value} {u_in_mpe_unit.unit} exceeds 1/3 MPE ({max_allowable_u} {mpe.unit})."
                    )

            details.append({
                "standard_id": std.standard_id,
                "standard_name": std.standard_name,
                "accuracy_class": std.accuracy_class.value,
                "nominal_mass": std.nominal_mass.to_dict(),
                "calibration_date": str(cal_start),
                "expiry_date": str(cal_expiry),
                "status": std.status,
                "is_quarantined": std.is_quarantined,
                "uncertainty_passed": uncertainty_passed,
                "errors": std_errors,
            })

            errors.extend(std_errors)

        is_valid = len(errors) == 0
        return StandardValidationResult(
            is_valid=is_valid,
            errors=errors,
            details=details,
        )
