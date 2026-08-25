"""Standard weights hierarchy and NAWI instrument compatibility rules.

Implements statutory standard classifications under The Legal Metrology (General) Rules, 2011
(Seventh Schedule, Heading A) and OIML R 111-1.
"""

from __future__ import annotations

from typing import Dict, Set

from ..base import (
    AccuracyClassEnum,
    StandardAccuracyClassEnum,
)

# Standard accuracy hierarchy ranking (lower number = higher metrological precision)
STANDARD_CLASS_RANK: Dict[StandardAccuracyClassEnum, int] = {
    StandardAccuracyClassEnum.E1: 1,
    StandardAccuracyClassEnum.E2: 2,
    StandardAccuracyClassEnum.F1: 3,
    StandardAccuracyClassEnum.F2: 4,
    StandardAccuracyClassEnum.M1: 5,
    StandardAccuracyClassEnum.M2: 6,
    StandardAccuracyClassEnum.M3: 7,
}

# Permitted standard weight classes per NAWI accuracy class
PERMITTED_STANDARD_CLASSES: Dict[AccuracyClassEnum, Set[StandardAccuracyClassEnum]] = {
    AccuracyClassEnum.CLASS_I: {
        StandardAccuracyClassEnum.E1,
        StandardAccuracyClassEnum.E2,
    },
    AccuracyClassEnum.CLASS_II: {
        StandardAccuracyClassEnum.E1,
        StandardAccuracyClassEnum.E2,
        StandardAccuracyClassEnum.F1,
        StandardAccuracyClassEnum.F2,
    },
    AccuracyClassEnum.CLASS_III: {
        StandardAccuracyClassEnum.E1,
        StandardAccuracyClassEnum.E2,
        StandardAccuracyClassEnum.F1,
        StandardAccuracyClassEnum.F2,
        StandardAccuracyClassEnum.M1,
    },
    AccuracyClassEnum.CLASS_IIII: {
        StandardAccuracyClassEnum.E1,
        StandardAccuracyClassEnum.E2,
        StandardAccuracyClassEnum.F1,
        StandardAccuracyClassEnum.F2,
        StandardAccuracyClassEnum.M1,
        StandardAccuracyClassEnum.M2,
        StandardAccuracyClassEnum.M3,
    },
}


def is_standard_class_compatible(
    instrument_class: AccuracyClassEnum,
    standard_class: StandardAccuracyClassEnum,
) -> bool:
    """Check whether a reference standard class meets the minimum requirement for the instrument class."""
    permitted = PERMITTED_STANDARD_CLASSES.get(instrument_class, set())
    return standard_class in permitted
