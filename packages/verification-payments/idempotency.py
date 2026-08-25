"""Idempotency Key Manager for Payment and Financial Operations.

Guarantees at-most-once execution for payment checkout initiation and reconciliation.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Dict, Optional, Tuple

from .errors import IdempotencyConflictError


class IdempotencyRecord:
    """Represents a cached idempotency operation state."""

    def __init__(self, key: str, tenant_id: str, status: str = "PROCESSING"):
        self.key = key
        self.tenant_id = tenant_id
        self.status = status  # 'PROCESSING', 'COMPLETED', 'FAILED'
        self.response_data: Optional[Any] = None
        self.created_at = time.time()
        self.updated_at = time.time()


class IdempotencyManager:
    """Thread-safe idempotency token registry."""

    def __init__(self, ttl_seconds: int = 86400):
        self._records: Dict[str, IdempotencyRecord] = {}
        self._lock = threading.RLock()
        self.ttl_seconds = ttl_seconds

    def _composite_key(self, key: str, tenant_id: str) -> str:
        return f"{tenant_id}:{key}"

    def acquire(self, idempotency_key: str, tenant_id: str) -> Tuple[bool, Optional[Any]]:
        """Attempt to acquire execution lock for an idempotency key.

        Returns:
            (is_new, cached_response)
            - If is_new is True: caller may proceed with operation.
            - If is_new is False: operation already completed, return cached_response.
        Raises:
            IdempotencyConflictError: If a concurrent request is currently in flight.
        """
        c_key = self._composite_key(idempotency_key, tenant_id)
        now = time.time()

        with self._lock:
            record = self._records.get(c_key)
            if record is not None:
                # Check TTL expiration
                if now - record.created_at > self.ttl_seconds:
                    del self._records[c_key]
                    record = None

            if record is not None:
                if record.status == "COMPLETED":
                    return False, record.response_data
                elif record.status == "PROCESSING":
                    # Check if processing lock is stale (> 60 seconds)
                    if now - record.updated_at < 60:
                        raise IdempotencyConflictError(
                            f"Payment request with idempotency key '{idempotency_key}' is currently being processed."
                        )
                    # Reset stale lock
                    record.updated_at = now
                    return True, None
                else:
                    # Failed previous attempt - allow retry
                    record.status = "PROCESSING"
                    record.updated_at = now
                    return True, None

            # New record
            self._records[c_key] = IdempotencyRecord(idempotency_key, tenant_id, "PROCESSING")
            return True, None

    def record_success(self, idempotency_key: str, tenant_id: str, response_data: Any) -> None:
        """Mark idempotency record as completed with cached response payload."""
        c_key = self._composite_key(idempotency_key, tenant_id)
        with self._lock:
            if c_key in self._records:
                self._records[c_key].status = "COMPLETED"
                self._records[c_key].response_data = response_data
                self._records[c_key].updated_at = time.time()

    def record_failure(self, idempotency_key: str, tenant_id: str) -> None:
        """Mark idempotency record as failed or remove to allow retry."""
        c_key = self._composite_key(idempotency_key, tenant_id)
        with self._lock:
            if c_key in self._records:
                self._records[c_key].status = "FAILED"
                self._records[c_key].updated_at = time.time()


# Global default manager
default_idempotency_manager = IdempotencyManager()
