"""Phase 3 Test Suite: Supervisor Overview Metrics & Audit Logs.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.stakeholder import RoleEnum


class TestSupervisorIntelligence:
    """Supervisor overview and audit tests."""

    def test_supervisor_overview_metrics_and_audit_logs(
        self, client: TestClient, db_session: Session, seed_data: dict, auth_headers
    ):
        tenant_id = seed_data["tenant_id"]
        supervisor_user_id = seed_data["lmo_user_id"]
        headers_sup = auth_headers(user_id=supervisor_user_id, tenant_id=tenant_id, role=RoleEnum.SUPERVISOR)

        # 1. Fetch overview metrics
        resp_overview = client.get(
            f"/api/v1/tenants/{tenant_id}/supervisor/overview",
            headers=headers_sup,
        )
        assert resp_overview.status_code == 200, resp_overview.text
        data = resp_overview.json()
        assert data["tenant_id"] == tenant_id
        assert "total_applications" in data
        assert "pendency_by_age" in data
        assert len(data["pendency_by_age"]) == 4

        # 2. Fetch privileged audit logs
        resp_audit = client.get(
            f"/api/v1/tenants/{tenant_id}/supervisor/audit-logs",
            headers=headers_sup,
        )
        assert resp_audit.status_code == 200, resp_audit.text
        assert isinstance(resp_audit.json(), list)
