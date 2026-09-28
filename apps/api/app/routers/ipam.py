"""INF-1B: Site Network / VLAN / IPAM API (manual documentation only)."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..ipam import (
    assert_dhcp_range,
    assert_ip_in_network,
    derive_status,
    is_unique_violation,
    normalize_cidr,
    optional_ip,
    optional_mac,
    validate_vlan_number,
)
from ..rest import as_list, created_or_403, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["ipam"])

VLAN_SELECT = "id,workspace_id,site_id,vlan_number,name,purpose,description,created_at,updated_at"
NETWORK_SELECT = (
    "id,workspace_id,site_id,vlan_id,name,cidr,gateway,dhcp_enabled,dhcp_start,dhcp_end,"
    "dns_primary,dns_secondary,purpose,notes,created_at,updated_at"
)
IP_SELECT = (
    "id,workspace_id,site_id,network_id,vlan_id,equipment_id,ip_address,hostname,mac_address,"
    "assignment_type,status,notes,created_at,updated_at"
)


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _require_site(client: UserClient, workspace_id: UUID, site_id: str) -> dict:
    return one_or_404(
        client.get(
            "sites",
            params={
                "id": f"eq.{site_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,workspace_id,name",
                "limit": "1",
            },
        )
    )


def _load_vlan(client: UserClient, workspace_id: UUID, vlan_id: str, *, site_id: str | None = None) -> dict:
    params: dict[str, str] = {
        "id": f"eq.{vlan_id}",
        "workspace_id": f"eq.{workspace_id}",
        "select": VLAN_SELECT,
        "limit": "1",
    }
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    return one_or_404(client.get("site_vlans", params=params))


def _load_network(client: UserClient, workspace_id: UUID, network_id: str, *, site_id: str | None = None) -> dict:
    params: dict[str, str] = {
        "id": f"eq.{network_id}",
        "workspace_id": f"eq.{workspace_id}",
        "select": NETWORK_SELECT,
        "limit": "1",
    }
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    return one_or_404(client.get("site_networks", params=params))


def _assert_equipment_same_site(client: UserClient, workspace_id: UUID, site_id: str, equipment_id: str) -> dict:
    row = one_or_404(
        client.get(
            "equipment",
            params={
                "id": f"eq.{equipment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,site_id,name,asset_code,mac,ip",
                "limit": "1",
            },
        )
    )
    if str(row.get("site_id") or "") != str(site_id):
        raise ApiError(400, "VALIDATION_ERROR", "הציוד אינו שייך לאתר שנבחר")
    return row


def _post_or_conflict(client: UserClient, table: str, payload: dict, *, conflict_message: str) -> dict:
    res = client.post(table, payload)
    if is_unique_violation(res):
        raise ApiError(409, "CONFLICT", conflict_message)
    return created_or_403(res)


def _patch_or_conflict(
    client: UserClient,
    table: str,
    payload: dict,
    params: dict,
    *,
    conflict_message: str,
) -> dict:
    res = client.patch(table, payload, params=params)
    if is_unique_violation(res):
        raise ApiError(409, "CONFLICT", conflict_message)
    return patched_or_403(res)


# ── Models ───────────────────────────────────────────────────────────────────


class VlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    site_id: str
    vlan_number: int
    name: str = Field(min_length=1, max_length=120)
    purpose: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class VlanPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vlan_number: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    purpose: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class NetworkCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    site_id: str
    name: str = Field(min_length=1, max_length=120)
    cidr: str = Field(min_length=3, max_length=64)
    vlan_id: str | None = None
    gateway: str | None = None
    dhcp_enabled: bool = False
    dhcp_start: str | None = None
    dhcp_end: str | None = None
    dns_primary: str | None = None
    dns_secondary: str | None = None
    purpose: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)


class NetworkPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=120)
    cidr: str | None = Field(default=None, min_length=3, max_length=64)
    vlan_id: str | None = None
    gateway: str | None = None
    dhcp_enabled: bool | None = None
    dhcp_start: str | None = None
    dhcp_end: str | None = None
    dns_primary: str | None = None
    dns_secondary: str | None = None
    purpose: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)


class IpCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    site_id: str
    network_id: str
    ip_address: str = Field(min_length=1, max_length=64)
    vlan_id: str | None = None
    equipment_id: str | None = None
    hostname: str | None = Field(default=None, max_length=120)
    mac_address: str | None = Field(default=None, max_length=32)
    assignment_type: str = "static"
    status: str | None = None
    notes: str | None = Field(default=None, max_length=2000)


class IpPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    network_id: str | None = None
    ip_address: str | None = Field(default=None, min_length=1, max_length=64)
    vlan_id: str | None = None
    equipment_id: str | None = None
    hostname: str | None = Field(default=None, max_length=120)
    mac_address: str | None = Field(default=None, max_length=32)
    assignment_type: str | None = None
    status: str | None = None
    notes: str | None = Field(default=None, max_length=2000)
    clear_equipment: bool | None = None


# ── Overview ─────────────────────────────────────────────────────────────────


@router.get("/sites/{site_id}/network-overview")
def network_overview(
    workspace_id: UUID,
    site_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view", resource=ResourceRef(type="site", site_id=str(site_id)))
    _require_site(client, workspace_id, str(site_id))

    vlans = as_list(
        client.get(
            "site_vlans",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": "id",
                "limit": "500",
            },
        )
    )
    networks = as_list(
        client.get(
            "site_networks",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": "id",
                "limit": "500",
            },
        )
    )
    ips = as_list(
        client.get(
            "site_ip_addresses",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": "id,status",
                "limit": "2000",
            },
        )
    )
    counts = {"available": 0, "assigned": 0, "reserved": 0}
    for row in ips:
        st = str(row.get("status") or "")
        if st in counts:
            counts[st] += 1
    return {
        "networks": len(networks),
        "vlans": len(vlans),
        "ips": len(ips),
        "assigned": counts["assigned"],
        "available": counts["available"],
        "reserved": counts["reserved"],
    }


# ── VLANs ────────────────────────────────────────────────────────────────────


@router.get("/sites/{site_id}/vlans")
def list_vlans(
    workspace_id: UUID,
    site_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view", resource=ResourceRef(type="site", site_id=str(site_id)))
    _require_site(client, workspace_id, str(site_id))
    rows = as_list(
        client.get(
            "site_vlans",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": VLAN_SELECT,
                "order": "vlan_number.asc",
                "limit": "500",
            },
        )
    )
    return {"items": rows}


@router.post("/vlans")
def create_vlan(
    workspace_id: UUID,
    body: VlanCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=body.site_id))
    _require_site(client, workspace_id, body.site_id)
    number = validate_vlan_number(body.vlan_number)
    payload = {
        "workspace_id": str(workspace_id),
        "site_id": body.site_id,
        "vlan_number": number,
        "name": body.name.strip(),
        "purpose": (body.purpose or "").strip() or None,
        "description": (body.description or "").strip() or None,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    return _post_or_conflict(client, "site_vlans", payload, conflict_message="מספר VLAN כבר קיים באתר")


@router.patch("/vlans/{vlan_id}")
def patch_vlan(
    workspace_id: UUID,
    vlan_id: UUID,
    body: VlanPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    existing = _load_vlan(client, workspace_id, str(vlan_id))
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=str(existing["site_id"])))
    patch = body.model_dump(exclude_unset=True)
    if "vlan_number" in patch and patch["vlan_number"] is not None:
        patch["vlan_number"] = validate_vlan_number(int(patch["vlan_number"]))
    if "name" in patch and patch["name"] is not None:
        patch["name"] = str(patch["name"]).strip()
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    return _patch_or_conflict(
        client,
        "site_vlans",
        patch,
        {"id": f"eq.{vlan_id}", "workspace_id": f"eq.{workspace_id}"},
        conflict_message="מספר VLAN כבר קיים באתר",
    )


# ── Networks ─────────────────────────────────────────────────────────────────


@router.get("/sites/{site_id}/networks")
def list_networks(
    workspace_id: UUID,
    site_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view", resource=ResourceRef(type="site", site_id=str(site_id)))
    _require_site(client, workspace_id, str(site_id))
    rows = as_list(
        client.get(
            "site_networks",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": NETWORK_SELECT,
                "order": "name.asc",
                "limit": "500",
            },
        )
    )
    ips = as_list(
        client.get(
            "site_ip_addresses",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": "id,network_id,status",
                "limit": "2000",
            },
        )
    )
    counts: dict[str, dict[str, int]] = {}
    for ip in ips:
        nid = str(ip.get("network_id") or "")
        bucket = counts.setdefault(nid, {"total": 0, "assigned": 0})
        bucket["total"] += 1
        if ip.get("status") == "assigned":
            bucket["assigned"] += 1
    out = []
    for row in rows:
        item = dict(row)
        c = counts.get(str(row["id"]), {"total": 0, "assigned": 0})
        item["ip_count"] = c["total"]
        item["assigned_count"] = c["assigned"]
        out.append(item)
    return {"items": out}


@router.post("/networks")
def create_network(
    workspace_id: UUID,
    body: NetworkCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=body.site_id))
    _require_site(client, workspace_id, body.site_id)
    cidr = normalize_cidr(body.cidr)
    vlan_id = body.vlan_id
    if vlan_id:
        _load_vlan(client, workspace_id, vlan_id, site_id=body.site_id)
    dhcp_start, dhcp_end = (None, None)
    if body.dhcp_enabled:
        dhcp_start, dhcp_end = assert_dhcp_range(cidr, body.dhcp_start, body.dhcp_end)
    elif body.dhcp_start or body.dhcp_end:
        dhcp_start, dhcp_end = assert_dhcp_range(cidr, body.dhcp_start, body.dhcp_end)
    payload = {
        "workspace_id": str(workspace_id),
        "site_id": body.site_id,
        "name": body.name.strip(),
        "cidr": cidr,
        "vlan_id": vlan_id,
        "gateway": optional_ip(body.gateway),
        "dhcp_enabled": bool(body.dhcp_enabled),
        "dhcp_start": dhcp_start,
        "dhcp_end": dhcp_end,
        "dns_primary": optional_ip(body.dns_primary),
        "dns_secondary": optional_ip(body.dns_secondary),
        "purpose": (body.purpose or "").strip() or None,
        "notes": (body.notes or "").strip() or None,
    }
    payload = {k: v for k, v in payload.items() if v is not None or k in {"dhcp_enabled", "vlan_id"}}
    return created_or_403(client.post("site_networks", payload))


@router.patch("/networks/{network_id}")
def patch_network(
    workspace_id: UUID,
    network_id: UUID,
    body: NetworkPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    existing = _load_network(client, workspace_id, str(network_id))
    site_id = str(existing["site_id"])
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=site_id))
    patch = body.model_dump(exclude_unset=True)
    cidr = normalize_cidr(patch["cidr"]) if "cidr" in patch and patch["cidr"] else str(existing["cidr"])
    if "cidr" in patch and patch["cidr"]:
        patch["cidr"] = cidr
    if "vlan_id" in patch and patch["vlan_id"]:
        _load_vlan(client, workspace_id, str(patch["vlan_id"]), site_id=site_id)
    if "gateway" in patch:
        patch["gateway"] = optional_ip(patch["gateway"])
    if "dns_primary" in patch:
        patch["dns_primary"] = optional_ip(patch["dns_primary"])
    if "dns_secondary" in patch:
        patch["dns_secondary"] = optional_ip(patch["dns_secondary"])
    dhcp_enabled = patch.get("dhcp_enabled", existing.get("dhcp_enabled"))
    dhcp_start = patch["dhcp_start"] if "dhcp_start" in patch else existing.get("dhcp_start")
    dhcp_end = patch["dhcp_end"] if "dhcp_end" in patch else existing.get("dhcp_end")
    if dhcp_enabled or dhcp_start or dhcp_end:
        s, e = assert_dhcp_range(cidr, dhcp_start, dhcp_end)
        if "dhcp_start" in patch or "dhcp_end" in patch or "cidr" in patch or "dhcp_enabled" in patch:
            patch["dhcp_start"] = s
            patch["dhcp_end"] = e
    if "name" in patch and patch["name"]:
        patch["name"] = str(patch["name"]).strip()
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    return patched_or_403(
        client.patch(
            "site_networks",
            patch,
            params={"id": f"eq.{network_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )


# ── IP Addresses ─────────────────────────────────────────────────────────────


def _enrich_ips(
    client: UserClient,
    workspace_id: UUID,
    rows: list[dict],
) -> list[dict]:
    equipment_ids = {str(r["equipment_id"]) for r in rows if r.get("equipment_id")}
    network_ids = {str(r["network_id"]) for r in rows if r.get("network_id")}
    vlan_ids = {str(r["vlan_id"]) for r in rows if r.get("vlan_id")}
    equipment: dict[str, dict] = {}
    networks: dict[str, dict] = {}
    vlans: dict[str, dict] = {}
    if equipment_ids:
        for row in as_list(
            client.get(
                "equipment",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(sorted(equipment_ids))})",
                    "select": "id,name,asset_code,mac",
                },
            )
        ):
            equipment[str(row["id"])] = row
    if network_ids:
        for row in as_list(
            client.get(
                "site_networks",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(sorted(network_ids))})",
                    "select": "id,name,cidr",
                },
            )
        ):
            networks[str(row["id"])] = row
    if vlan_ids:
        for row in as_list(
            client.get(
                "site_vlans",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(sorted(vlan_ids))})",
                    "select": "id,vlan_number,name",
                },
            )
        ):
            vlans[str(row["id"])] = row
    out = []
    for row in rows:
        item = dict(row)
        eq = equipment.get(str(row["equipment_id"])) if row.get("equipment_id") else None
        net = networks.get(str(row["network_id"])) if row.get("network_id") else None
        vlan = vlans.get(str(row["vlan_id"])) if row.get("vlan_id") else None
        item["equipment_name"] = eq.get("name") if eq else None
        item["equipment_asset_code"] = eq.get("asset_code") if eq else None
        item["network_name"] = net.get("name") if net else None
        item["network_cidr"] = net.get("cidr") if net else None
        item["vlan_number"] = vlan.get("vlan_number") if vlan else None
        item["vlan_name"] = vlan.get("name") if vlan else None
        out.append(item)
    return out


@router.get("/sites/{site_id}/ip-addresses")
def list_ip_addresses(
    workspace_id: UUID,
    site_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    network_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view", resource=ResourceRef(type="site", site_id=str(site_id)))
    _require_site(client, workspace_id, str(site_id))
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "site_id": f"eq.{site_id}",
        "select": IP_SELECT,
        "order": "ip_address.asc",
        "limit": "2000",
    }
    if network_id:
        params["network_id"] = f"eq.{network_id}"
    if status:
        params["status"] = f"eq.{status}"
    rows = as_list(client.get("site_ip_addresses", params=params))
    enriched = _enrich_ips(client, workspace_id, rows)
    needle = (q or "").strip().lower()
    if needle:
        filtered = []
        for row in enriched:
            hay = " ".join(
                str(row.get(k) or "")
                for k in (
                    "ip_address",
                    "hostname",
                    "mac_address",
                    "equipment_name",
                    "equipment_asset_code",
                    "network_name",
                    "vlan_number",
                    "vlan_name",
                )
            ).lower()
            if needle in hay:
                filtered.append(row)
        enriched = filtered
    return {"items": enriched}


@router.get("/equipment/{equipment_id}/ip-addresses")
def list_equipment_ip_addresses(
    workspace_id: UUID,
    equipment_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view")
    equipment = one_or_404(
        client.get(
            "equipment",
            params={
                "id": f"eq.{equipment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,site_id,ip,mac",
                "limit": "1",
            },
        )
    )
    require(ctx, "systems.view", resource=ResourceRef(type="site", site_id=str(equipment["site_id"])))
    rows = as_list(
        client.get(
            "site_ip_addresses",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "equipment_id": f"eq.{equipment_id}",
                "select": IP_SELECT,
                "order": "ip_address.asc",
                "limit": "100",
            },
        )
    )
    return {
        "items": _enrich_ips(client, workspace_id, rows),
        "legacy_ip": equipment.get("ip"),
        "legacy_mac": equipment.get("mac"),
    }


@router.post("/ip-addresses")
def create_ip_address(
    workspace_id: UUID,
    body: IpCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=body.site_id))
    _require_site(client, workspace_id, body.site_id)
    network = _load_network(client, workspace_id, body.network_id, site_id=body.site_id)
    ip = assert_ip_in_network(body.ip_address, str(network["cidr"]))
    vlan_id = body.vlan_id or network.get("vlan_id")
    if vlan_id:
        _load_vlan(client, workspace_id, str(vlan_id), site_id=body.site_id)
    equipment_id = body.equipment_id
    if equipment_id:
        _assert_equipment_same_site(client, workspace_id, body.site_id, equipment_id)
    assignment_type = body.assignment_type if body.assignment_type in {"static", "dhcp", "reserved"} else "static"
    status = derive_status(assignment_type=assignment_type, equipment_id=equipment_id, explicit=body.status)
    if status not in {"available", "assigned", "reserved"}:
        raise ApiError(400, "VALIDATION_ERROR", "סטטוס IP אינו תקין")
    payload = {
        "workspace_id": str(workspace_id),
        "site_id": body.site_id,
        "network_id": body.network_id,
        "vlan_id": vlan_id,
        "equipment_id": equipment_id,
        "ip_address": ip,
        "hostname": (body.hostname or "").strip() or None,
        "mac_address": optional_mac(body.mac_address),
        "assignment_type": assignment_type,
        "status": status,
        "notes": (body.notes or "").strip() or None,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    return _post_or_conflict(
        client,
        "site_ip_addresses",
        payload,
        conflict_message="כתובת IP כבר קיימת באתר",
    )


@router.patch("/ip-addresses/{ip_id}")
def patch_ip_address(
    workspace_id: UUID,
    ip_id: UUID,
    body: IpPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    existing = one_or_404(
        client.get(
            "site_ip_addresses",
            params={
                "id": f"eq.{ip_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": IP_SELECT,
                "limit": "1",
            },
        )
    )
    site_id = str(existing["site_id"])
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=site_id))
    patch = body.model_dump(exclude_unset=True)
    clear_equipment = bool(patch.pop("clear_equipment", False))
    network_id = str(patch.get("network_id") or existing["network_id"])
    network = _load_network(client, workspace_id, network_id, site_id=site_id)
    if "network_id" in patch:
        patch["network_id"] = network_id
    if "ip_address" in patch and patch["ip_address"]:
        patch["ip_address"] = assert_ip_in_network(str(patch["ip_address"]), str(network["cidr"]))
    elif "network_id" in patch:
        # Ensure current IP still belongs after network change.
        assert_ip_in_network(str(existing["ip_address"]), str(network["cidr"]))
    if "vlan_id" in patch and patch["vlan_id"]:
        _load_vlan(client, workspace_id, str(patch["vlan_id"]), site_id=site_id)
    elif "network_id" in patch and network.get("vlan_id") and "vlan_id" not in patch:
        patch["vlan_id"] = network.get("vlan_id")
    if clear_equipment:
        patch["equipment_id"] = None
        if "status" not in patch:
            at = patch.get("assignment_type") or existing.get("assignment_type") or "static"
            patch["status"] = "reserved" if at == "reserved" else "available"
    elif "equipment_id" in patch and patch["equipment_id"]:
        _assert_equipment_same_site(client, workspace_id, site_id, str(patch["equipment_id"]))
        if "status" not in patch:
            patch["status"] = "assigned"
    if "mac_address" in patch:
        patch["mac_address"] = optional_mac(patch["mac_address"])
    if "assignment_type" in patch and patch["assignment_type"] not in {None, "static", "dhcp", "reserved"}:
        raise ApiError(400, "VALIDATION_ERROR", "סוג הקצאה אינו תקין")
    if "status" in patch and patch["status"] not in {None, "available", "assigned", "reserved"}:
        raise ApiError(400, "VALIDATION_ERROR", "סטטוס IP אינו תקין")
    if "hostname" in patch and patch["hostname"] is not None:
        patch["hostname"] = str(patch["hostname"]).strip() or None
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    return _patch_or_conflict(
        client,
        "site_ip_addresses",
        patch,
        {"id": f"eq.{ip_id}", "workspace_id": f"eq.{workspace_id}"},
        conflict_message="כתובת IP כבר קיימת באתר",
    )


@router.delete("/ip-addresses/{ip_id}")
def delete_ip_address(
    workspace_id: UUID,
    ip_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    existing = one_or_404(
        client.get(
            "site_ip_addresses",
            params={
                "id": f"eq.{ip_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,site_id",
                "limit": "1",
            },
        )
    )
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=str(existing["site_id"])))
    res = client.delete(
        "site_ip_addresses",
        params={"id": f"eq.{ip_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    if res.status_code not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    return {"ok": True}
