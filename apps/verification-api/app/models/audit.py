"""Tamper-evident system audit log model.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Integer,
    String,
    Text,
)

from app.models.base import (
    Base,
    JSONType,
    get_utc_now,
)


class AuditLog(Base):
    """Append-only audit log for privileged operations, transitions, and evidence custody."""

    __tablename__ = "audit_logs"

    audit_id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    tenant_id = Column(String(36), nullable=False, index=True)
    actor_id = Column(String(36), nullable=False, index=True)
    actor_role = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(String(36), nullable=False, index=True)
    correlation_id = Column(String(64), nullable=False, index=True)
    causation_id = Column(String(64), nullable=True)
    before_state = Column(JSONType, nullable=True)
    after_state = Column(JSONType, nullable=True)
    client_ip = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False, index=True)
