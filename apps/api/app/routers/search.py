from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..authz.guard import require
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..rest import as_list

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["search"])

SearchEntity = Literal[
    "customer",
    "site",
    "lead",
    "quote",
    "project",
    "service",
    "equipment",
]


class SearchHit(BaseModel):
    entity_type: SearchEntity
    id: str
    title: str
    subtitle: str | None = None
    href: str


class SearchResponse(BaseModel):
    q: str
    items: list[SearchHit] = Field(default_factory=list)


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _safe_list(client: UserClient, table: str, params: dict[str, str]) -> list[dict]:
    try:
        return as_list(client.get(table, params=params))
    except Exception:
        return []


@router.get("/search", response_model=SearchResponse)
def global_search(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    q: str = Query(min_length=1, max_length=120),
    limit: int = Query(default=8, ge=1, le=20),
) -> SearchResponse:
    """Fan-out search across live CRM / ops entities. Permission-aware per resource."""
    ctx = _ctx(client, user, workspace_id)
    needle = q.strip()
    if len(needle) < 1:
        return SearchResponse(q=needle, items=[])

    hits: list[SearchHit] = []
    per = max(3, min(limit, 10))
    ws = f"eq.{workspace_id}"

    try:
        require(ctx, "crm.view")
        rows = _safe_list(
            client,
            "customers",
            {
                "workspace_id": ws,
                "select": "id,display_name,phone,email",
                "or": f"(display_name.ilike.*{needle}*,phone.ilike.*{needle}*,email.ilike.*{needle}*)",
                "limit": str(per),
                "order": "updated_at.desc",
            },
        )
        for row in rows:
            sub = " · ".join(x for x in [row.get("phone"), row.get("email")] if x)
            hits.append(
                SearchHit(
                    entity_type="customer",
                    id=row["id"],
                    title=row["display_name"],
                    subtitle=sub or None,
                    href=f"/app/customers/{row['id']}",
                )
            )
    except ApiError:
        pass

    try:
        require(ctx, "sites.view")
        rows = _safe_list(
            client,
            "sites",
            {
                "workspace_id": ws,
                "select": "id,name,code,address",
                "or": (
                    f"(name.ilike.*{needle}*,code.ilike.*{needle}*,"
                    f"address->>line.ilike.*{needle}*,address->>city.ilike.*{needle}*,"
                    f"address->>formatted.ilike.*{needle}*)"
                ),
                "limit": str(per),
                "order": "updated_at.desc",
            },
        )
        for row in rows:
            addr = row.get("address") or {}
            sub = addr.get("formatted") or addr.get("line") or addr.get("city") or row.get("code")
            hits.append(
                SearchHit(
                    entity_type="site",
                    id=row["id"],
                    title=row["name"],
                    subtitle=sub,
                    href=f"/app/sites/{row['id']}",
                )
            )
    except ApiError:
        pass

    try:
        require(ctx, "leads.view")
        rows = _safe_list(
            client,
            "leads",
            {
                "workspace_id": ws,
                "select": "id,title,contact_name,contact_phone",
                "or": (
                    f"(title.ilike.*{needle}*,contact_name.ilike.*{needle}*,"
                    f"contact_phone.ilike.*{needle}*,contact_email.ilike.*{needle}*)"
                ),
                "limit": str(per),
                "order": "updated_at.desc",
            },
        )
        for row in rows:
            hits.append(
                SearchHit(
                    entity_type="lead",
                    id=row["id"],
                    title=row["title"],
                    subtitle=row.get("contact_name") or row.get("contact_phone"),
                    href=f"/app/leads/{row['id']}",
                )
            )
    except ApiError:
        pass

    try:
        require(ctx, "quotes.view")
        rows = _safe_list(
            client,
            "quotes",
            {
                "workspace_id": ws,
                "deleted_at": "is.null",
                "select": "id,number,title,project_name",
                "or": f"(number.ilike.*{needle}*,title.ilike.*{needle}*,project_name.ilike.*{needle}*)",
                "limit": str(per),
                "order": "updated_at.desc",
            },
        )
        for row in rows:
            hits.append(
                SearchHit(
                    entity_type="quote",
                    id=row["id"],
                    title=row.get("number") or row.get("title") or "הצעה",
                    subtitle=row.get("title") or row.get("project_name"),
                    href=f"/app/quotes/{row['id']}",
                )
            )
    except ApiError:
        pass

    try:
        require(ctx, "projects.view")
        rows = _safe_list(
            client,
            "projects",
            {
                "workspace_id": ws,
                "select": "id,name,status",
                "name": f"ilike.*{needle}*",
                "limit": str(per),
                "order": "updated_at.desc",
            },
        )
        for row in rows:
            hits.append(
                SearchHit(
                    entity_type="project",
                    id=row["id"],
                    title=row["name"],
                    subtitle=row.get("status"),
                    href=f"/app/projects/{row['id']}",
                )
            )
    except ApiError:
        pass

    try:
        require(ctx, "service.view")
        rows = _safe_list(
            client,
            "service_calls",
            {
                "workspace_id": ws,
                "select": "id,title,status,number",
                "or": f"(title.ilike.*{needle}*,number.ilike.*{needle}*)",
                "limit": str(per),
                "order": "updated_at.desc",
            },
        )
        for row in rows:
            hits.append(
                SearchHit(
                    entity_type="service",
                    id=row["id"],
                    title=row.get("number") or row["title"],
                    subtitle=row.get("title") if row.get("number") else row.get("status"),
                    href="/app/service",
                )
            )
    except ApiError:
        pass

    try:
        require(ctx, "systems.view")
        rows = _safe_list(
            client,
            "equipment",
            {
                "workspace_id": ws,
                "select": "id,name,serial,model,site_id",
                "or": f"(name.ilike.*{needle}*,serial.ilike.*{needle}*,model.ilike.*{needle}*,ip.ilike.*{needle}*)",
                "limit": str(per),
                "order": "updated_at.desc",
            },
        )
        for row in rows:
            hits.append(
                SearchHit(
                    entity_type="equipment",
                    id=row["id"],
                    title=row["name"],
                    subtitle=row.get("serial") or row.get("model"),
                    href=f"/app/sites/{row['site_id']}",
                )
            )
    except ApiError:
        pass

    # Prefer diversity: round-robin by entity type up to limit
    by_type: dict[str, list[SearchHit]] = {}
    for hit in hits:
        by_type.setdefault(hit.entity_type, []).append(hit)
    ordered: list[SearchHit] = []
    while len(ordered) < limit and any(by_type.values()):
        for key in list(by_type.keys()):
            bucket = by_type.get(key) or []
            if not bucket:
                by_type.pop(key, None)
                continue
            ordered.append(bucket.pop(0))
            if len(ordered) >= limit:
                break
            if not bucket:
                by_type.pop(key, None)

    return SearchResponse(q=needle, items=ordered)
