"""Public installation handover certificate — token access + PDF."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from ..deps import service_client
from ..errors import ApiError, MESSAGES
from ..handover_pdf import render_handover_pdf
from ..installation_complete import assemble_handover_document
from ..pdf_response import pdf_response
from ..quote_tokens import hash_public_token
from ..rest import as_list
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/public/handover", tags=["public-handover"])

_RATE: dict[str, list[float]] = {}


def _rate_limit(request: Request, *, limit: int = 60, window: float = 60.0) -> None:
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    ip = ip or (request.client.host if request.client else "unknown")
    now = datetime.now(UTC).timestamp()
    bucket = [t for t in _RATE.get(ip, []) if now - t < window]
    if len(bucket) >= limit:
        raise ApiError(429, "RATE_LIMITED", "יותר מדי בקשות")
    bucket.append(now)
    _RATE[ip] = bucket


def _load_access(svc: ServiceClient, token: str) -> dict:
    digest = hash_public_token(token.strip())
    rows = as_list(
        svc.get(
            "handover_public_access",
            params={
                "token_hash": f"eq.{digest}",
                "select": "id,workspace_id,job_id,expires_at,revoked_at",
                "limit": "1",
            },
        )
    )
    if not rows:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    access = rows[0]
    if access.get("revoked_at"):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    try:
        exp = datetime.fromisoformat(str(access.get("expires_at") or "").replace("Z", "+00:00"))
    except ValueError as exc:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"]) from exc
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=UTC)
    if exp < datetime.now(UTC):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return access


@router.get("/{token}")
def get_public_handover(
    token: str,
    request: Request,
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict[str, Any]:
    _rate_limit(request)
    access = _load_access(svc, token)
    return assemble_handover_document(svc, access)


@router.get("/{token}/pdf")
def get_public_handover_pdf(
    token: str,
    request: Request,
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> Response:
    _rate_limit(request)
    access = _load_access(svc, token)
    document = assemble_handover_document(svc, access)
    raw, filename = render_handover_pdf(document)
    return pdf_response(raw, filename)
