from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

from ..supabase_user import UserClient
from .catalog import load_catalog
from .limits import is_unlimited, plan_limit_value, seat_limit_key

METER_LABELS = {
    "seats_operator": "משתמשים במשרד",
    "seats_field": "משתמשים בשטח",
    "storage_gb": "אחסון",
}

BYTES_PER_GB = 1024**3

OccupantKind = Literal["member", "invite"]
OccupantStatus = Literal["active", "pending"]


@dataclass(frozen=True)
class SeatOccupant:
    kind: OccupantKind
    role_key: str
    email: str | None
    label: str
    status: OccupantStatus

    def as_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "role_key": self.role_key,
            "email": self.email,
            "label": self.label,
            "status": self.status,
        }


@dataclass(frozen=True)
class Occupancy:
    occupants: tuple[SeatOccupant, ...]
    active_members: int
    pending_invites: int

    @property
    def roles(self) -> list[str]:
        return [row.role_key for row in self.occupants]


def _norm_email(value: object) -> str:
    return str(value or "").strip().lower()


def _parse_ts(value: object) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _profile(row: dict[str, Any]) -> dict[str, Any]:
    profile = row.get("profiles") or {}
    if isinstance(profile, list):
        profile = profile[0] if profile else {}
    return profile if isinstance(profile, dict) else {}


def _invite_open(row: dict[str, Any], now: datetime) -> bool:
    if row.get("accepted_at"):
        return False
    expires = _parse_ts(row.get("expires_at"))
    return expires is None or expires > now


def occupancy_from_rows(
    *,
    members: Iterable[dict[str, Any]],
    invites: Iterable[dict[str, Any]],
    now: datetime | None = None,
) -> Occupancy:
    """One seat per active member, plus one reserved seat per unique open invite email.

    Duplicate pending invites to the same address do not occupy extra seats.
    Expired or accepted invitations do not occupy seats.
    An invite for an email that already has an active membership is ignored.
    """
    moment = now or datetime.now(UTC)
    occupants: list[SeatOccupant] = []
    member_emails: set[str] = set()
    active = 0
    for row in members:
        if str(row.get("status") or "active") != "active":
            continue
        role = str(row.get("role_key") or "").strip()
        if not role:
            continue
        profile = _profile(row)
        email = _norm_email(profile.get("email") or row.get("email"))
        name = str(profile.get("full_name") or "").strip()
        label = name or email or role
        occupants.append(
            SeatOccupant(
                kind="member",
                role_key=role,
                email=email or None,
                label=label,
                status="active",
            )
        )
        if email:
            member_emails.add(email)
        active += 1

    seen_invite_emails: set[str] = set()
    pending = 0
    ordered = sorted(
        invites,
        key=lambda row: str(row.get("created_at") or ""),
    )
    for row in ordered:
        if not _invite_open(row, moment):
            continue
        role = str(row.get("role_key") or "").strip()
        email = _norm_email(row.get("email"))
        if not role or not email:
            continue
        if email in member_emails or email in seen_invite_emails:
            continue
        seen_invite_emails.add(email)
        occupants.append(
            SeatOccupant(
                kind="invite",
                role_key=role,
                email=email,
                label=email,
                status="pending",
            )
        )
        pending += 1
    return Occupancy(occupants=tuple(occupants), active_members=active, pending_invites=pending)


def fetch_occupancy(client: UserClient, workspace_id: str) -> Occupancy:
    """Active memberships + unique open invitations. Counts are not a substitute for RLS."""
    members: list[dict[str, Any]] = []
    member_res = client.get(
        "workspace_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "status": "eq.active",
            "select": "role_key,status,profiles(full_name,email)",
        },
    )
    if member_res.status_code != 200:
        member_res = client.get(
            "workspace_memberships",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.active",
                "select": "role_key,status,profiles(full_name)",
            },
        )
    if member_res.status_code == 200:
        members = list(member_res.json() or [])

    invite_res = client.get(
        "invitations",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "accepted_at": "is.null",
            "select": "email,role_key,expires_at,accepted_at,created_at",
            "order": "created_at.asc",
        },
    )
    invites = list(invite_res.json() or []) if invite_res.status_code == 200 else []
    return occupancy_from_rows(members=members, invites=invites)


def fetch_occupied_roles(client: UserClient, workspace_id: str) -> tuple[list[str], int, int]:
    occupancy = fetch_occupancy(client, workspace_id)
    return occupancy.roles, occupancy.active_members, occupancy.pending_invites


def occupant_for_email(occupancy: Occupancy, email: str) -> SeatOccupant | None:
    target = _norm_email(email)
    if not target:
        return None
    return next((row for row in occupancy.occupants if row.email == target), None)


def seat_meters(
    *,
    plan_key: str,
    occupied_roles: Iterable[str] | None = None,
    occupants: Iterable[SeatOccupant] | None = None,
) -> list[dict[str, Any]]:
    catalog = load_catalog()
    buckets = catalog.get("seat_buckets") or {}
    occupant_rows = list(occupants or [])
    roles = [row.role_key for row in occupant_rows] if occupant_rows else list(occupied_roles or [])
    meters: list[dict[str, Any]] = []
    for limit_key in ("seats_operator", "seats_field"):
        bucket_roles = set(buckets.get(limit_key) or [])
        bucket_occupants = [row for row in occupant_rows if row.role_key in bucket_roles]
        current = len(bucket_occupants) if occupant_rows else sum(1 for role in roles if role in bucket_roles)
        limit = plan_limit_value(plan_key, limit_key)
        unlimited = is_unlimited(limit)
        meters.append(
            {
                "key": limit_key,
                "label_he": METER_LABELS[limit_key],
                "current": current,
                "limit": limit,
                "unlimited": unlimited,
                "unit": "seats",
                "at_limit": (not unlimited) and current >= limit,
                "occupants": [row.as_dict() for row in bucket_occupants],
            }
        )
    return meters


def meter_for_invite_role(meters: list[dict[str, Any]], invite_role: str) -> dict[str, Any] | None:
    bucket = seat_limit_key(invite_role)
    if bucket is None:
        return None
    return next((row for row in meters if row["key"] == bucket), None)


def fetch_storage_used_bytes(client: UserClient, workspace_id: str) -> int:
    """Sum of documents.byte_size for the workspace. Missing/null sizes count as 0."""
    res = client.get(
        "documents",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "select": "byte_size.sum()",
        },
    )
    if res.status_code != 200:
        return 0
    rows = res.json() or []
    if not rows:
        return 0
    raw = rows[0].get("sum") if isinstance(rows[0], dict) else None
    try:
        return max(0, int(raw or 0))
    except (TypeError, ValueError):
        return 0


def storage_meter(*, plan_key: str, used_bytes: int) -> dict[str, Any]:
    limit_gb = plan_limit_value(plan_key, "storage_gb")
    unlimited = is_unlimited(limit_gb)
    limit_bytes = 0 if unlimited else limit_gb * BYTES_PER_GB
    current = max(0, int(used_bytes or 0))
    return {
        "key": "storage_gb",
        "label_he": METER_LABELS["storage_gb"],
        "current": current,
        "limit": limit_bytes,
        "unlimited": unlimited,
        "unit": "bytes",
        "at_limit": (not unlimited) and current >= limit_bytes,
        "occupants": [],
    }


def workspace_meters(
    *,
    plan_key: str,
    occupants: Iterable[SeatOccupant] | None = None,
    occupied_roles: Iterable[str] | None = None,
    used_bytes: int = 0,
) -> list[dict[str, Any]]:
    meters = seat_meters(plan_key=plan_key, occupants=occupants, occupied_roles=occupied_roles)
    meters.append(storage_meter(plan_key=plan_key, used_bytes=used_bytes))
    return meters
