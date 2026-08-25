"""API v1 master router aggregating all domain sub-routers.
"""

from fastapi import APIRouter

from app.api.v1.applications import router as applications_router
from app.api.v1.certificates import (
    direct_certificates_router,
    router as certificates_router,
)
from app.api.v1.fees import router as fees_router
from app.api.v1.gatc import router as gatc_router
from app.api.v1.instruments import router as instruments_router
from app.api.v1.migration import router as migration_router
from app.api.v1.payments import router as payments_router
from app.api.v1.public import router as public_router
from app.api.v1.reference_standards import router as reference_standards_router
from app.api.v1.reminders import (
    global_reminders_router,
    tenant_reminders_router,
)
from app.api.v1.sessions import router as sessions_router
from app.api.v1.stamps import router as stamps_router
from app.api.v1.federated import router as federated_router
from app.api.v1.supervisor import router as supervisor_router
from app.api.v1.sync import router as sync_router

api_v1_router = APIRouter(prefix="/api/v1")

# Include domain routers under /api/v1
api_v1_router.include_router(instruments_router)
api_v1_router.include_router(applications_router)
api_v1_router.include_router(fees_router)
api_v1_router.include_router(payments_router)
api_v1_router.include_router(sessions_router)
api_v1_router.include_router(stamps_router)
api_v1_router.include_router(certificates_router)
api_v1_router.include_router(direct_certificates_router)
api_v1_router.include_router(tenant_reminders_router)
api_v1_router.include_router(global_reminders_router)
api_v1_router.include_router(reference_standards_router)
api_v1_router.include_router(gatc_router)
api_v1_router.include_router(sync_router)
api_v1_router.include_router(migration_router)
api_v1_router.include_router(supervisor_router)
api_v1_router.include_router(federated_router)
api_v1_router.include_router(public_router)
