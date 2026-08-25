"""Pydantic schemas for Supervisor and Controller metrics, pendency, and audit trails.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema


class PendencyTier(BaseSchema):
    """Pendency count by age bucket."""
    tier_label: str  # "< 7 Days", "7 - 15 Days", "15 - 30 Days", "> 30 Days"
    count: int
    percentage: float


class OfficerPerformanceMetric(BaseSchema):
    """Performance & workload summary per officer."""
    officer_user_id: str
    officer_name: str
    jurisdiction_name: str
    applications_scrutinized: int
    sessions_conducted: int
    certificates_issued: int
    rejections_count: int
    average_turnaround_days: float


class SupervisorOverviewMetrics(BaseSchema):
    """High-level supervisor summary dashboard metrics."""
    tenant_id: str
    total_applications: int
    pending_scrutiny: int
    pending_verification: int
    completed_verifications: int
    total_revenue_collected: Decimal
    pendency_by_age: List[PendencyTier] = Field(default_factory=list)
    officer_metrics: List[OfficerPerformanceMetric] = Field(default_factory=list)
    stamping_inventory_summary: Dict[str, int] = Field(default_factory=dict)
