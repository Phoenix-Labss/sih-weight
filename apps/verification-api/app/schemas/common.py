"""Common response wrappers, pagination, and shared schema primitives.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class BaseSchema(BaseModel):
    """Base Pydantic schema with standard serialization configurations."""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class PaginatedResponse(BaseSchema, Generic[T]):
    """Standard paginated list container."""
    items: List[T]
    total: int = Field(..., ge=0, description="Total count of matching records")
    page: int = Field(1, ge=1, description="Current page index (1-based)")
    page_size: int = Field(50, ge=1, le=500, description="Items per page")
    pages: int = Field(1, ge=0, description="Total number of pages")


class ErrorDetail(BaseModel):
    """Itemized error detail for field-level validation."""
    field: Optional[str] = None
    message: str
    type: Optional[str] = None
    details: Optional[dict] = None


class RFC7807ProblemDetails(BaseModel):
    """RFC 7807 Problem Details response schema."""
    type: str = Field(..., description="URI reference identifying the problem type")
    title: str = Field(..., description="Short, human-readable summary of problem")
    status: int = Field(..., description="HTTP status code")
    detail: str = Field(..., description="Human-readable explanation specific to this occurrence")
    instance: str = Field(..., description="URI reference identifying the specific occurrence")
    error_code: str = Field(..., description="Machine-readable legal metrology error code")
    correlation_id: str = Field(..., description="Unique request tracing correlation ID")
    tenant_id: str = Field(..., description="State/UT tenant identifier or N/A")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp of occurrence")
    errors: List[ErrorDetail] = Field(default_factory=list, description="Itemized field or rule errors")
