"""Base declarative class, mixins, and common utility functions for models.

Provides timestamping, multi-tenant scoping, opaque token generation, and
dialect-agnostic column types.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Column,
    DateTime,
    JSON,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, declared_attr


def generate_uuid() -> str:
    """Generate a standard UUID string."""
    return str(uuid.uuid4())


def generate_opaque_token(prefix: str = "", nbytes: int = 32) -> str:
    """Generate an enumeration-resistant, high-entropy URL-safe token.

    Used for opaque QR tokens, public verification endpoints, and public instrument IDs.
    """
    token = secrets.token_urlsafe(nbytes)
    return f"{prefix}{token}" if prefix else token


def get_utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Authoritative base class for all relational domain models."""
    __allow_unmapped__ = True

    def __init__(self, **kwargs: Any) -> None:
        # Pre-populate defaults (like primary key UUIDs, timestamps, and tokens) at object instantiation
        if hasattr(self, "__table__") and self.__table__ is not None:
            for column in self.__table__.columns:
                if column.name not in kwargs and column.default is not None:
                    if callable(column.default.arg):
                        try:
                            kwargs[column.name] = column.default.arg(None)
                        except TypeError:
                            kwargs[column.name] = column.default.arg()
                    elif column.default.is_scalar:
                        kwargs[column.name] = column.default.arg
        for key, value in kwargs.items():
            setattr(self, key, value)



class TimestampMixin:
    """Mixin adding created_at and updated_at UTC timestamps."""
    __allow_unmapped__ = True

    created_at = Column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=get_utc_now,
        onupdate=get_utc_now,
        nullable=False,
    )


class TenantMixin:
    """Mixin enforcing State/UT multi-tenant isolation on private entities."""
    __allow_unmapped__ = True

    @declared_attr
    def tenant_id(cls):
        return Column(
            String(36),
            nullable=False,
            index=True,
        )


# Dialect-agnostic JSON type that uses JSONB on PostgreSQL and JSON elsewhere
JSONType = JSON().with_variant(JSONB, "postgresql")

# Exact metrological decimal type for loads, indications, errors, and MPE (up to 6-8 decimal places)
MetrologyDecimal = Numeric(precision=18, scale=6, asdecimal=True)

# Currency decimal type for statutory fees, payments, and receipts (2 decimal places)
CurrencyDecimal = Numeric(precision=12, scale=2, asdecimal=True)
