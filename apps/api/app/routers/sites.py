from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import acked_or_403, as_list, created_or_403, one_or_404, patched_or_403
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["sites"])

SITE_SELECT = (
    "id,workspace_id,customer_id,code,name,address,installation_status,"
    "access_notes,created_at,updated_at"
)


class SiteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: str
    name: str = Field(min_length=1, max_length=200)
    address: dict | None = None
    installation_status: str = "planned"
    access_notes: str | None = None


class SitePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: dict | None = None
    installation_status: str | None = None
    access_notes: str | None = None


class SiteOut(BaseModel):
    id: str
    workspace_id: str
    customer_id: str
    code: str
    name: str
    address: dict = Field(default_factory=dict)
    installation_status: str
    access_notes: str | None = None
    created_at: str
    updated_at: str


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _out(row: dict) -> SiteOut:
    return SiteOut(
        id=row["id"],
        workspace_id=row["workspace_id"],
        customer_id=row["customer_id"],
        code=row["code"],
        name=row["name"],
        address=row.get("address") or {},
        installation_status=row["installation_status"],
        access_notes=row.get("access_notes"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _ref(row: dict) -> ResourceRef:
    return ResourceRef(type="site", id=row["id"], site_id=row["id"])


@router.get("/sites")
def list_sites(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "sites.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": SITE_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if customer_id:
        params["customer_id"] = f"eq.{customer_id}"
    if status:
        params["installation_status"] = f"eq.{status}"
    if q:
        needle = q.strip()
        params["or"] = (
            f"(name.ilike.*{needle}*,"
            f"address->>line.ilike.*{needle}*,address->>street.ilike.*{needle}*,"
            f"address->>city.ilike.*{needle}*,address->>formatted.ilike.*{needle}*)"
        )
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("sites", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": [_out(row).model_dump() for row in page.items], "next_cursor": page.next_cursor}


@router.post("/sites", response_model=SiteOut)
def create_site(
    workspace_id: UUID,
    body: SiteCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> SiteOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "sites.create", resource=ResourceRef(type="site"))
    one_or_404(
        client.get(
            "customers",
            params={"id": f"eq.{body.customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        "customer_id": body.customer_id,
        "name": body.name,
        "installation_status": body.installation_status,
        "address": body.address or {},
    }
    if body.access_notes is not None:
        payload["access_notes"] = body.access_notes
    row = created_or_403(client.post("sites", payload))
    return _out(row)


@router.get("/sites/{site_id}", response_model=SiteOut)
def get_site(
    workspace_id: UUID,
    site_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> SiteOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "sites.view")
    row = one_or_404(
        client.get(
            "sites",
            params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}", "select": SITE_SELECT},
        )
    )
    require(ctx, "sites.view", resource=_ref(row))
    return _out(row)


@router.patch("/sites/{site_id}", response_model=SiteOut)
def patch_site(
    workspace_id: UUID,
    site_id: UUID,
    body: SitePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> SiteOut:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "sites",
            params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "sites.edit", resource=_ref(existing))
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch("sites", patch, params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}"})
    )
    return _out(row)


@router.delete("/sites/{site_id}")
def delete_site(
    workspace_id: UUID,
    site_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "sites",
            params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "sites.delete", resource=_ref(existing))
    acked_or_403(
        svc.patch(
            "sites",
            {"deleted_at": datetime.now(UTC).isoformat()},
            params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}"},
            prefer="return=minimal",
        )
    )
    return {"ok": True}
