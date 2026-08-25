"""Data models and observation structures for Liquid Fuel Dispensers (Petrol/Diesel Pumps).

Statutory references:
- The Legal Metrology Act, 2009
- The Legal Metrology (General) Rules, 2011 (Schedule IX - Measuring Systems for Liquids Other than Water)
- OIML R 117-1 (Dynamic measuring systems for liquids other than water)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from packages.measurement.decimal_math import ExactDecimal, exact_decimal
from packages.measurement.units import Quantity
from verification_procedures.base import (
    ReferenceStandardItem,
    VerificationOutcomeEnum,
    VerificationTypeEnum,
)


class FuelTypeEnum(str, Enum):
    """Statutory liquid fuel categories dispensed at retail outlets."""
    PETROL = "PETROL"                    # Motor Spirit (MS / Gasoline)
    DIESEL = "DIESEL"                    # High Speed Diesel (HSD)
    PREMIUM_PETROL = "PREMIUM_PETROL"    # High Octane Petrol (XP95, Speed)
    ETHANOL_BLEND_E20 = "ETHANOL_BLEND_E20"
    CNG = "CNG"
    AUTO_LPG = "AUTO_LPG"


class FlowRateModeEnum(str, Enum):
    """Delivery flow rate operating mode."""
    FAST_FLOW = "FAST_FLOW"   # High/Normal speed dispensing (>= 30 L/min)
    SLOW_FLOW = "SLOW_FLOW"   # Trickle/Slow delivery test (>= 5 L/min to <= 15 L/min)


@dataclass(frozen=True)
class FuelDispenserParameters:
    """Metrological specifications of the retail liquid fuel dispenser unit."""
    dispenser_serial_number: str
    nozzle_identifier: str  # e.g., 'NZ-01', 'NZ-02'
    fuel_type: FuelTypeEnum
    min_flow_rate_L_per_min: ExactDecimal = field(default_factory=lambda: exact_decimal("5.000"))
    max_flow_rate_L_per_min: ExactDecimal = field(default_factory=lambda: exact_decimal("60.000"))
    minimum_measured_quantity_mmq_L: ExactDecimal = field(default_factory=lambda: exact_decimal("2.000"))
    electronic_pulser_type: str = "OPTICAL_INCREMENTAL_ENCODER"
    pulser_resolution_pulses_per_L: int = 1000
    has_automatic_temperature_compensation: bool = False


@dataclass(frozen=True)
class FuelDeliveryTestObservation:
    """Volumetric test observation for a single delivery run into a certified prover measure."""
    run_number: int
    target_preset_volume_L: ExactDecimal       # e.g. 5.000 L, 10.000 L, 20.000 L
    dispenser_indicated_volume_L: ExactDecimal # Value displayed on fuel dispenser DU
    prover_standard_reading_L: ExactDecimal    # Certified conical volumetric measure reading
    flow_mode: FlowRateModeEnum = FlowRateModeEnum.FAST_FLOW
    delivery_duration_seconds: ExactDecimal = field(default_factory=lambda: exact_decimal("15.0"))
    fuel_temperature_celsius: Optional[ExactDecimal] = None
    prover_temperature_celsius: Optional[ExactDecimal] = None


@dataclass(frozen=True)
class TotalizerAuditObservation:
    """Electromechanical / electronic totalizer ledger check."""
    start_totalizer_reading_L: ExactDecimal
    end_totalizer_reading_L: ExactDecimal
    actual_test_liters_delivered: ExactDecimal


@dataclass(frozen=True)
class SecuritySealAudit:
    """Physical anti-tampering seal inspection checklist."""
    metering_unit_calibration_seal_intact: bool = True
    electronic_pulser_enclosure_seal_intact: bool = True
    totalizer_and_motherboard_lock_intact: bool = True
    delivery_hose_anti_kink_and_nozzle_valve_intact: bool = True


@dataclass(frozen=True)
class FuelDispenserEvaluationInput:
    """Complete verification session input payload for liquid fuel dispenser testing."""
    session_id: str
    dispenser: FuelDispenserParameters
    verification_type: VerificationTypeEnum
    evaluation_timestamp: datetime
    reference_provers: List[ReferenceStandardItem]
    delivery_tests: List[FuelDeliveryTestObservation]
    totalizer_audit: TotalizerAuditObservation
    security_seals: SecuritySealAudit
