"""Stepped Maximum Permissible Error (MPE) calculation engine for NAWI.

Implements statutory MPE stepped functions under The Legal Metrology (General) Rules, 2011
(Seventh Schedule, Part II, Table 4) and OIML R 76-1 Table 6.
"""

from __future__ import annotations

from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from packages.measurement.units import Quantity
from ..base import AccuracyClassEnum, VerificationTypeEnum


def get_nawi_mpe_factor_in_e(
    m_intervals: ExactDecimal,
    accuracy_class: AccuracyClassEnum,
    verification_type: VerificationTypeEnum,
) -> ExactDecimal:
    """Determine the stepped MPE factor in units of verification scale interval e.

    Args:
        m_intervals: Load expressed in scale intervals (m = L / e).
        accuracy_class: Metrological accuracy class (Class I, II, III, IIII).
        verification_type: INITIAL or RE_VERIFICATION.

    Returns:
        ExactDecimal factor (e.g. 0.5, 1.0, 1.5 for initial or 1.0, 2.0, 3.0 for in-service).
    """
    m = exact_decimal(m_intervals)
    if m < ExactDecimal("0"):
        m = ExactDecimal(abs(m))

    multiplier = ExactDecimal("2") if verification_type == VerificationTypeEnum.RE_VERIFICATION else ExactDecimal("1")

    if accuracy_class == AccuracyClassEnum.CLASS_III:
        # Class III stepped boundaries: 500e, 2000e, 10000e
        if m <= ExactDecimal("500"):
            base_factor = ExactDecimal("0.5")
        elif m <= ExactDecimal("2000"):
            base_factor = ExactDecimal("1.0")
        else:
            base_factor = ExactDecimal("1.5")

    elif accuracy_class == AccuracyClassEnum.CLASS_IIII:
        # Class IIII stepped boundaries: 50e, 200e, 1000e
        if m <= ExactDecimal("50"):
            base_factor = ExactDecimal("0.5")
        elif m <= ExactDecimal("200"):
            base_factor = ExactDecimal("1.0")
        else:
            base_factor = ExactDecimal("1.5")

    elif accuracy_class == AccuracyClassEnum.CLASS_II:
        # Class II stepped boundaries: 5000e, 20000e, 100000e
        if m <= ExactDecimal("5000"):
            base_factor = ExactDecimal("0.5")
        elif m <= ExactDecimal("20000"):
            base_factor = ExactDecimal("1.0")
        else:
            base_factor = ExactDecimal("1.5")

    elif accuracy_class == AccuracyClassEnum.CLASS_I:
        # Class I stepped boundaries: 50000e, 200000e
        if m <= ExactDecimal("50000"):
            base_factor = ExactDecimal("0.5")
        elif m <= ExactDecimal("200000"):
            base_factor = ExactDecimal("1.0")
        else:
            base_factor = ExactDecimal("1.5")

    else:
        raise ValueError(f"Unsupported accuracy class: {accuracy_class}")

    return ExactDecimal(base_factor * multiplier)


def calculate_nawi_mpe(
    load: Quantity,
    e: Quantity,
    accuracy_class: AccuracyClassEnum,
    verification_type: VerificationTypeEnum,
) -> Quantity:
    """Calculate the statutory MPE as a physical quantity in the unit of e.

    Args:
        load: Applied nominal load Quantity.
        e: Verification scale interval Quantity.
        accuracy_class: Accuracy class of instrument.
        verification_type: INITIAL or RE_VERIFICATION.

    Returns:
        MPE as a Quantity matching the unit of e.
    """
    load_in_e_unit = load.to_unit(e.unit)
    m_intervals = ExactDecimal(load_in_e_unit.value / e.value)
    mpe_factor = get_nawi_mpe_factor_in_e(m_intervals, accuracy_class, verification_type)
    mpe_mass_value = ExactDecimal(mpe_factor * e.value)
    return Quantity(mpe_mass_value, e.unit)
