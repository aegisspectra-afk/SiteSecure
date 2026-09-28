"""INF-1C: directional Asset→Asset connections (manual topology edges)."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..ipam import is_unique_violation
from ..rest import as_list, created_or_403, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["connections"])

CONNECTION_TYPES = frozenset({"ethernet", "fiber", "poe", "wireless", "uplink", "wan", "other"})
CONNECTION_SELECT = (
    "id,workspace_id,site_id,source_equipment_id,target_equipment_id,connection_type,"
    "source_port,target_port,notes,created_at,updated_at"
)
EQUIPMENT_BRIEF = "id,site_id,name,asset_code,category,status,ip,mac"


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _text(value: object | None, *, max_len: int = 120) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    return raw[:max_len]


def _load_equipment(client: UserClient, workspace_id: UUID, equipment_id: str) -> dict:
    return one_or_404(
        client.get(
            "equipment",
            params={
                "id": f"eq.{equipment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": EQUIPMENT_BRIEF,
                "limit": "1",
            },
        )
    )


def _post_or_conflict(client: UserClient, payload: dict) -> dict:
    res = client.post("asset_connections", payload)
    if is_unique_violation(res):
        raise ApiError(409, "CONFLICT", "חיבור זהה כבר קיים")
    return created_or_403(res)


def _patch_or_conflict(client: UserClient, connection_id: str, workspace_id: UUID, patch: dict) -> dict:
    res = client.patch(
        "asset_connections",
        patch,
        params={"id": f"eq.{connection_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    if is_unique_violation(res):
        raise ApiError(409, "CONFLICT", "חיבור זהה כבר קיים")
    return patched_or_403(res)


def _enrich(client: UserClient, workspace_id: UUID, rows: list[dict]) -> list[dict]:
    ids = {
        str(r.get("source_equipment_id") or "")
        for r in rows
        if r.get("source_equipment_id")
    } | {str(r.get("target_equipment_id") or "") for r in rows if r.get("target_equipment_id")}
    equipment: dict[str, dict] = {}
    if ids:
        for row in as_list(
            client.get(
                "equipment",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(sorted(ids))})",
                    "select": EQUIPMENT_BRIEF,
                },
            )
        ):
            equipment[str(row["id"])] = row
    # Primary IPAM IP for nodes (optional enrichment)
    primary_ip: dict[str, str] = {}
    if ids:
        for row in as_list(
            client.get(
                "site_ip_addresses",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "equipment_id": f"in.({','.join(sorted(ids))})",
                    "status": "eq.assigned",
                    "select": "equipment_id,ip_address",
                    "limit": "2000",
                },
            )
        ):
            eid = str(row.get("equipment_id") or "")
            if eid and eid not in primary_ip and row.get("ip_address"):
                primary_ip[eid] = str(row["ip_address"])
    out = []
    for row in rows:
        item = dict(row)
        src = equipment.get(str(row.get("source_equipment_id") or ""))
        tgt = equipment.get(str(row.get("target_equipment_id") or ""))
        item["source_name"] = src.get("name") if src else None
        item["source_asset_code"] = src.get("asset_code") if src else None
        item["source_category"] = src.get("category") if src else None
        item["target_name"] = tgt.get("name") if tgt else None
        item["target_asset_code"] = tgt.get("asset_code") if tgt else None
        item["target_category"] = tgt.get("category") if tgt else None
        sid = str(row.get("source_equipment_id") or "")
        tid = str(row.get("target_equipment_id") or "")
        item["source_ip"] = primary_ip.get(sid) or (src.get("ip") if src else None)
        item["target_ip"] = primary_ip.get(tid) or (tgt.get("ip") if tgt else None)
        out.append(item)
    return out


class ConnectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    site_id: str
    source_equipment_id: str
    target_equipment_id: str
    connection_type: str = "ethernet"
    source_port: str | None = Field(default=None, max_length=64)
    target_port: str | None = Field(default=None, max_length=64)
    notes: str | None = Field(default=None, max_length=2000)


class ConnectionPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_equipment_id: str | None = None
    connection_type: str | None = None
    source_port: str | None = Field(default=None, max_length=64)
    target_port: str | None = Field(default=None, max_length=64)
    notes: str | None = Field(default=None, max_length=2000)


@router.get("/sites/{site_id}/asset-connections")
def list_site_connections(
    workspace_id: UUID,
    site_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view", resource=ResourceRef(type="site", site_id=str(site_id)))
    one_or_404(
        client.get(
            "sites",
            params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id", "limit": "1"},
        )
    )
    rows = as_list(
        client.get(
            "asset_connections",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": CONNECTION_SELECT,
                "order": "created_at.asc",
                "limit": "2000",
            },
        )
    )
    return {"items": _enrich(client, workspace_id, rows)}


@router.get("/equipment/{equipment_id}/asset-connections")
def list_equipment_connections(
    workspace_id: UUID,
    equipment_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    equipment = _load_equipment(client, workspace_id, str(equipment_id))
    require(ctx, "systems.view", resource=ResourceRef(type="site", site_id=str(equipment["site_id"])))
    outgoing = as_list(
        client.get(
            "asset_connections",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "source_equipment_id": f"eq.{equipment_id}",
                "select": CONNECTION_SELECT,
                "order": "created_at.asc",
                "limit": "500",
            },
        )
    )
    incoming = as_list(
        client.get(
            "asset_connections",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "target_equipment_id": f"eq.{equipment_id}",
                "select": CONNECTION_SELECT,
                "order": "created_at.asc",
                "limit": "500",
            },
        )
    )
    # Deduplicate by id
    by_id: dict[str, dict] = {}
    for row in outgoing + incoming:
        by_id[str(row["id"])] = row
    return {"items": _enrich(client, workspace_id, list(by_id.values()))}


@router.get("/sites/{site_id}/topology")
def get_site_topology(
    workspace_id: UUID,
    site_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    """Nodes = site equipment; edges = asset_connections only (no inferred links)."""
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view", resource=ResourceRef(type="site", site_id=str(site_id)))
    one_or_404(
        client.get(
            "sites",
            params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id", "limit": "1"},
        )
    )
    nodes = as_list(
        client.get(
            "equipment",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": EQUIPMENT_BRIEF + ",manufacturer,model",
                "order": "created_at.asc",
                "limit": "500",
            },
        )
    )
    edges = as_list(
        client.get(
            "asset_connections",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": CONNECTION_SELECT,
                "order": "created_at.asc",
                "limit": "2000",
            },
        )
    )
    enriched_edges = _enrich(client, workspace_id, edges)
    # Attach primary IP to nodes
    ids = [str(n["id"]) for n in nodes]
    primary_ip: dict[str, str] = {}
    if ids:
        for row in as_list(
            client.get(
                "site_ip_addresses",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "site_id": f"eq.{site_id}",
                    "status": "eq.assigned",
                    "select": "equipment_id,ip_address",
                    "limit": "2000",
                },
            )
        ):
            eid = str(row.get("equipment_id") or "")
            if eid and eid not in primary_ip and row.get("ip_address"):
                primary_ip[eid] = str(row["ip_address"])
    out_nodes = []
    for n in nodes:
        item = dict(n)
        item["primary_ip"] = primary_ip.get(str(n["id"])) or n.get("ip")
        out_nodes.append(item)
    return {
        "nodes": out_nodes,
        "edges": enriched_edges,
        "directional": True,
    }


@router.post("/asset-connections")
def create_connection(
    workspace_id: UUID,
    body: ConnectionCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=body.site_id))
    one_or_404(
        client.get(
            "sites",
            params={
                "id": f"eq.{body.site_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id",
                "limit": "1",
            },
        )
    )
    if body.source_equipment_id == body.target_equipment_id:
        raise ApiError(400, "VALIDATION_ERROR", "לא ניתן לחבר נכס לעצמו")
    ctype = body.connection_type if body.connection_type in CONNECTION_TYPES else None
    if not ctype:
        raise ApiError(400, "VALIDATION_ERROR", "סוג החיבור אינו תקין")
    source = _load_equipment(client, workspace_id, body.source_equipment_id)
    target = _load_equipment(client, workspace_id, body.target_equipment_id)
    if str(source.get("site_id")) != str(body.site_id) or str(target.get("site_id")) != str(body.site_id):
        raise ApiError(400, "VALIDATION_ERROR", "שני הנכסים חייבים להיות באותו אתר")
    payload = {
        "workspace_id": str(workspace_id),
        "site_id": body.site_id,
        "source_equipment_id": body.source_equipment_id,
        "target_equipment_id": body.target_equipment_id,
        "connection_type": ctype,
        "source_port": _text(body.source_port, max_len=64),
        "target_port": _text(body.target_port, max_len=64),
        "notes": _text(body.notes, max_len=2000),
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    row = _post_or_conflict(client, payload)
    write_audit(
        client,
        str(workspace_id),
        "connection.created",
        entity_type="equipment",
        entity_id=body.source_equipment_id,
        metadata={
            "connection_id": row.get("id"),
            "target_equipment_id": body.target_equipment_id,
            "connection_type": ctype,
            "site_id": body.site_id,
        },
    )
    return row


@router.patch("/asset-connections/{connection_id}")
def patch_connection(
    workspace_id: UUID,
    connection_id: UUID,
    body: ConnectionPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    existing = one_or_404(
        client.get(
            "asset_connections",
            params={
                "id": f"eq.{connection_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": CONNECTION_SELECT,
                "limit": "1",
            },
        )
    )
    site_id = str(existing["site_id"])
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=site_id))
    patch = body.model_dump(exclude_unset=True)
    if "connection_type" in patch:
        if patch["connection_type"] not in CONNECTION_TYPES:
            raise ApiError(400, "VALIDATION_ERROR", "סוג החיבור אינו תקין")
    if "target_equipment_id" in patch and patch["target_equipment_id"]:
        if str(patch["target_equipment_id"]) == str(existing["source_equipment_id"]):
            raise ApiError(400, "VALIDATION_ERROR", "לא ניתן לחבר נכס לעצמו")
        target = _load_equipment(client, workspace_id, str(patch["target_equipment_id"]))
        if str(target.get("site_id")) != site_id:
            raise ApiError(400, "VALIDATION_ERROR", "שני הנכסים חייבים להיות באותו אתר")
    if "source_port" in patch:
        patch["source_port"] = _text(patch["source_port"], max_len=64)
    if "target_port" in patch:
        patch["target_port"] = _text(patch["target_port"], max_len=64)
    if "notes" in patch:
        patch["notes"] = _text(patch["notes"], max_len=2000)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = _patch_or_conflict(client, str(connection_id), workspace_id, patch)
    write_audit(
        client,
        str(workspace_id),
        "connection.updated",
        entity_type="equipment",
        entity_id=str(existing["source_equipment_id"]),
        metadata={"connection_id": str(connection_id), "changes": patch, "site_id": site_id},
    )
    return row


@router.delete("/asset-connections/{connection_id}")
def delete_connection(
    workspace_id: UUID,
    connection_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    existing = one_or_404(
        client.get(
            "asset_connections",
            params={
                "id": f"eq.{connection_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,site_id,source_equipment_id",
                "limit": "1",
            },
        )
    )
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=str(existing["site_id"])))
    res = client.delete(
        "asset_connections",
        params={"id": f"eq.{connection_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    if res.status_code not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    write_audit(
        client,
        str(workspace_id),
        "connection.deleted",
        entity_type="equipment",
        entity_id=str(existing["source_equipment_id"]),
        metadata={"connection_id": str(connection_id), "site_id": existing.get("site_id")},
    )
    return {"ok": True}
