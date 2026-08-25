"""National Federated Registry API Endpoints.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.federated_service import FederatedNationalRegistryService

router = APIRouter(prefix="/national", tags=["National Federated Registry"])


@router.get(
    "/lookup",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="National Federated Certificate & Serial Lookup",
)
def national_lookup(
    q: str = Query(..., min_length=2, description="Certificate Number, QR token or Serial Number"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Search cross-state registry for instrument or certificate."""
    res = FederatedNationalRegistryService.national_certificate_lookup(db, q)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No matching certificate or instrument found across national registry for query: '{q}'.",
        )
    return res


@router.get(
    "/aggregates",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="National Performance & Revenue Aggregates",
)
def national_aggregates(
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve pan-India Legal Metrology performance metrics."""
    return FederatedNationalRegistryService.get_national_aggregates(db)
