"""Pydantic schemas for GATC (Government Approved Test Centre) profiles and authorization.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema


class GATCProfileCreateRequest(BaseSchema):
    """Payload to register a new GATC authorization profile."""
    facility_id: str
    approval_order_number: str
    approved_scope: Dict[str, Any] = Field(
        default_factory=lambda: {
            "instrument_categories": ["NAWI"],
            "accuracy_classes": ["Class III", "Class IIII"],
            "max_capacity_kg": 50000,
        }
    )
    valid_from: datetime
    valid_to: datetime


class GATCProfileResponse(BaseSchema):
    """GATC profile response."""
    gatc_id: str
    tenant_id: str
    facility_id: str
    approval_order_number: str
    approved_scope: Dict[str, Any]
    valid_from: datetime
    valid_to: datetime
    status: str
    created_at: datetime


class GATCScopeCheckRequest(BaseSchema):
    """Payload to check if GATC is authorized for a specific instrument and test."""
    instrument_category: str
    accuracy_class: str
    capacity_kg: float
