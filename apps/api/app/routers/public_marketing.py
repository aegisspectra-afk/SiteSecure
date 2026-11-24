"""Public marketing — pricing catalog, beta signup, CCTV storage calculator (no prices)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..cctv_sizing import calculate_storage, pack_hdds, size_recorder
from ..deps import service_client
from ..errors import ApiError
from ..public_pricing import build_public_pricing_payload
from ..rest import created_or_403
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/public", tags=["public-marketing"])

_RATE: dict[str, list[float]] = {}
RATE_LIMIT = 30
RATE_WINDOW_SECONDS = 60.0


def clear_rate_limit_buckets() -> None:
    _RATE.clear()


def _rate_limit(request: Request, *, limit: int | None = None, window: float | None = None) -> None:
    lim = RATE_LIMIT if limit is None else limit
    win = RATE_WINDOW_SECONDS if window is None else window
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    ip = ip or (request.client.host if request.client else "unknown")
    now = datetime.now(UTC).timestamp()
    bucket = [t for t in _RATE.get(ip, []) if now - t < win]
    if len(bucket) >= lim:
        raise ApiError(429, "RATE_LIMITED", "יותר מדי בקשות")
    bucket.append(now)
    _RATE[ip] = bucket


@router.get("/pricing")
def get_public_pricing() -> dict[str, Any]:
    return build_public_pricing_payload()


class BetaSignupBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=7, max_length=32)
    # D1-V2 landing form: name + phone + technician count (optional extras kept for older clients).
    business_name: str = Field(default="", max_length=160)
    technician_count: str = Field(min_length=1, max_length=40)
    trade_focus: str = Field(default="", max_length=160)
    source: str = Field(default="landing", max_length=48)


@router.post("/beta-signups")
def create_beta_signup(
    body: BetaSignupBody,
    request: Request,
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict[str, Any]:
    _rate_limit(request, limit=10)
    payload = {
        "full_name": body.full_name.strip(),
        "phone": body.phone.strip(),
        "business_name": body.business_name.strip(),
        "technician_count": body.technician_count.strip(),
        "trade_focus": body.trade_focus.strip(),
        "source": body.source.strip() or "landing",
        "status": "new",
    }
    row = created_or_403(svc.post("marketing_beta_signups", payload))
    return {"ok": True, "id": row.get("id")}


class PublicStorageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    camera_count: int = Field(ge=1, le=64)
    resolution_mp: float = Field(ge=1, le=32)
    retention_days: int = Field(ge=1, le=365)
    recording_mode: Literal["continuous", "scheduled", "motion"] = "continuous"
    recording_hours_per_day: float | None = Field(default=None, ge=0.1, le=24)
    motion_duty_cycle: float | None = Field(default=None, ge=0.01, le=1)
    codec: str | None = Field(default="h265", max_length=16)


@router.post("/tools/cctv-storage/calculate")
def public_cctv_storage_calculate(body: PublicStorageBody, request: Request) -> dict[str, Any]:
    _rate_limit(request, limit=20)
    inp: dict[str, Any] = {
        "camera_count": body.camera_count,
        "resolution_mp": body.resolution_mp,
        "retention_days": body.retention_days,
        "recording_mode": body.recording_mode,
        "codec": body.codec or "h265",
    }
    if body.recording_hours_per_day is not None:
        inp["recording_hours_per_day"] = body.recording_hours_per_day
    if body.motion_duty_cycle is not None:
        inp["motion_duty_cycle"] = body.motion_duty_cycle

    storage = calculate_storage(inp)
    recorder = size_recorder(body.camera_count)
    hdd = None
    if storage.get("status") == "ok" and storage.get("requiredTbWithOverhead") is not None:
        hdd = pack_hdds(
            required_tb=float(storage["requiredTbWithOverhead"]),
            available_capacities_tb=[1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
            drive_bays=4,
            max_hdd_tb=20,
        )

    return {
        "storage": {
            "status": storage.get("status"),
            "required_tb": storage.get("requiredTbWithOverhead"),
            "required_gb": storage.get("requiredGbWithOverhead"),
            "bitrate_mbps": storage.get("bitrateMbps"),
        },
        "recorder": {
            "status": recorder.get("status"),
            "channels": recorder.get("selectedChannelTier"),
        },
        "hdd": {
            "status": (hdd or {}).get("status"),
            "recommended_tb_per_drive": (hdd or {}).get("driveCapacityTb"),
            "total_capacity_tb": (hdd or {}).get("totalCapacityTb"),
            "drive_count": (hdd or {}).get("driveCount"),
        },
        "input": body.model_dump(),
    }