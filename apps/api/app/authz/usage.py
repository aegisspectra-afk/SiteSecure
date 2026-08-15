from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from ..supabase_user import UserClient
from .catalog import load_catalog
from .limits import is_unlimited, plan_limit_value, seat_limit_key

METER_LABELS = {
    "seats_operator": "משתמשים במשרד",
    "seats_field": "משתמשים בשטח",
}


def fetch_occupied_roles(client: UserClient, workspace_id: str) -> tuple[list[str], int, int]:
    """Active memberships + pending invitations. Counts are not a substitute for RLS."""
    roles: list[str] = []
    active = 0
    pending = 0
    members = client.get(
        "workspace_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "status": "eq.active",
            "select": "role_key",
        },
    )
    if members.status_code == 200:
        for row in members.json() or []:
            role = str(row.get("role_key") or "")
            if role:
                roles.append(role)
                active += 1
    invites = client.get(
        "invitations",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "accepted_at": "is.null",
            "select": "role_key",
        },
    )
    if invites.status_code == 200:
        for row in invites.json() or []:
            role = str(row.get("role_key") or "")
            if role:
                roles.append(role)
                pending += 1
    return roles, active, pending


def seat_meters(*, plan_key: str, occupied_roles: Iterable[str]) -> list[dict[str, Any]]:
    catalog = load_catalog()
    buckets = catalog.get("seat_buckets") or {}
    meters: list[dict[str, Any]] = []
    for limit_key in ("seats_operator", "seats_field"):
        bucket_roles = set(buckets.get(limit_key) or [])
        current = sum(1 for role in occupied_roles if role in bucket_roles)
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
            }
        )
    return meters


def meter_for_invite_role(meters: list[dict[str, Any]], invite_role: str) -> dict[str, Any] | None:
    bucket = seat_limit_key(invite_role)
    if bucket is None:
        return None
    return next((row for row in meters if row["key"] == bucket), None)
