"""Top-level API routing aggregator.
"""

from fastapi import APIRouter

from app.api.v1.public import router as root_public_router
from app.api.v1.router import api_v1_router

main_api_router = APIRouter()
main_api_router.include_router(api_v1_router)
main_api_router.include_router(root_public_router)
