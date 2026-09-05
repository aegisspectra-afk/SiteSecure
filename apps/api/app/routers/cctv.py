"""CCTV recommendation API — server-authoritative sizing + catalog resolution."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from ..authz.engine import authorize
from ..authz.guard import require
from ..cctv_recommend import (
    CAMERA_LEAF_KEYS,
    CABLE_LEAF_KEYS,
    HDD_LEAF_KEYS,
    LABOR_LEAF_KEYS,
    NVR_LEAF_KEYS,
    SWITCH_LEAF_KEYS,
    build_system_recommendation,
)
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..rest import as_list
from .catalog import PRODUCT_SELECT, _category_index, _load_categories, _strip_cost

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["cctv"])

CCTV_CATEGORY_KEYS = CAMERA_LEAF_KEYS | NVR_LEAF_KEYS | HDD_LEAF_KEYS | SWITCH_LEAF_KEYS | CABLE_LEAF_KEYS | LABOR_LEAF_KEYS


class CctvRecommendIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    camera_count: int = Field(ge=1, le=512)
    indoor_count: int | None = Field(default=None, ge=0)
    outdoor_count: int | None = Field(default=None, ge=0)
    resolution_mp: float | None = Field(default=None, gt=0)
    environment: str | None = None
    form_factor: str | None = None
    retention_days: float | None = Field(default=None, gt=0)
    recording_mode: str | None = None
    recording_hours_per_day: float | None = None
    motion_duty_cycle: float | None = None
    fps: float | None = None
    codec: str | None = None
    bitrate_mbps_override: float | None = Field(default=None, gt=0)
    bitrate_mbps: float | None = Field(default=None, gt=0)
    poe_required: bool | None = True
    architecture_intent: str | None = "unknown"
    expansion_headroom: float | None = Field(default=0, ge=0)
    cable_distance_meters: float | None = Field(default=None, gt=0)
    remote_viewing: bool | None = None
    ups_requested: bool | None = None
    installation_requested: bool | None = None
    commissioning_requested: bool | None = None
    testing_requested: bool | None = None
    camera_max_power_w: float | None = Field(default=None, ge=0)
    camera_max_power_source: str | None = None
    poe_headroom: float | None = Field(default=None, ge=0)
    storage_overhead: float | None = Field(default=None, ge=0)
    allow_engineering_power_default: bool | None = False
    manufacturer_preference: str | None = Field(default=None, max_length=120)
    recorder: dict[str, Any] | None = None
    available_hdd_capacities_tb: list[float] | None = None


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _load_cctv_catalog_products(client: UserClient, workspace_id: UUID) -> tuple[list[dict], dict[str, int]]:
    """Load active workspace products in CCTV-relevant categories only (not global limit=100)."""
    categories = _load_categories(client, workspace_id, include_archived=True)
    cat_index = _category_index(categories)
    relevant_ids = [
        str(c["id"])
        for c in categories
        if (c.get("key") or "") in CCTV_CATEGORY_KEYS and c.get("archived_at") is None
    ]
    stats = {"categories": len(relevant_ids), "fetched": 0}
    if not relevant_ids:
        return [], stats

    # PostgREST in.() — chunk to stay within URL limits
    rows: list[dict] = []
    chunk_size = 40
    for i in range(0, len(relevant_ids), chunk_size):
        chunk = relevant_ids[i : i + chunk_size]
        batch = as_list(
            client.get(
                "products",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "is_active": "eq.true",
                    "category_id": f"in.({','.join(chunk)})",
                    "select": PRODUCT_SELECT,
                    "order": "name.asc",
                    "limit": "1000",
                },
            )
        )
        rows.extend(batch)
    stats["fetched"] = len(rows)

    enriched = []
    for row in rows:
        enriched.append(_strip_cost(row, show_cost=False, categories_by_id=cat_index))
    return enriched, stats


@router.post("/cctv/recommend")
def recommend_cctv(
    workspace_id: UUID,
    body: CctvRecommendIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "catalog.view")
    if not (
        authorize(ctx=ctx, action="quotes.create").allowed
        or authorize(ctx=ctx, action="quotes.edit").allowed
    ):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה להמלצת מערכת להצעה")

    payload = body.model_dump(exclude_none=False)
    # normalize None lists
    if payload.get("available_hdd_capacities_tb") is None:
        payload["available_hdd_capacities_tb"] = []

    products, fetch_stats = _load_cctv_catalog_products(client, workspace_id)
    recommendation = build_system_recommendation(raw_input=payload, catalog_products=products)
    recommendation["catalog_stats"] = {
        **(recommendation.get("catalog_stats") or {}),
        "fetch": fetch_stats,
        "query_strategy": "category_scoped_active_products",
    }
    return recommendation
