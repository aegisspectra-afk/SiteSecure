"""Workspace-scoped RBAC: roles + grants persisted per tenant."""

from __future__ import annotations

from typing import Any

from .authz.catalog import load_catalog
from .deps import UserClient
from .errors import ApiError


SYSTEM_ROLE_META = {
    "owner": {"label_he": "בעלים", "description": "בעלים — גישה מלאה. לא ניתן לצמצם.", "locked": True},
    "administrator": {"label_he": "מנהל מערכת", "description": "ניהול סביבה, משתמשים והגדרות.", "locked": False},
    "manager": {"label_he": "תפעול", "description": "תפעול שטח, פרויקטים ותיקי אתר.", "locked": False},
    "sales": {"label_he": "מכירות", "description": "מכירות, לידים והצעות מחיר.", "locked": False},
    "technician": {"label_he": "טכנאי", "description": "עבודות שטח ושירות.", "locked": False},
    "viewer": {"label_he": "צפייה בלבד", "description": "צפייה בלבד בכל המודולים הפתוחים.", "locked": False},
}


def catalog_grant_list(role_key: str) -> list[str]:
    catalog = load_catalog()
    raw = catalog.get("grants", {}).get(role_key)
    if raw == ["*"] or role_key == "owner":
        return ["*"]
    if isinstance(raw, list):
        return list(raw)
    grants = catalog.get("_grants", {}).get(role_key)
    if grants:
        return sorted(grants)
    return []


def normalize_grants(raw: Any) -> list[str]:
    if raw == ["*"] or raw == "*":
        return ["*"]
    if isinstance(raw, list):
        out = [str(x) for x in raw if isinstance(x, str) and x]
        if "*" in out:
            return ["*"]
        return sorted(set(out))
    return []


def grants_allow(grants: frozenset[str] | list[str], action: str) -> bool:
    g = frozenset(grants)
    return "*" in g or action in g


def ensure_workspace_roles(client: UserClient, workspace_id: str) -> list[dict]:
    """Ensure system roles exist and empty grant arrays are filled from catalog."""
    client.rpc("seed_workspace_roles", {"p_workspace_id": workspace_id})
    res = client.get(
        "workspace_roles",
        params={"workspace_id": f"eq.{workspace_id}", "select": "*", "order": "is_system.desc,key.asc"},
    )
    if res.status_code != 200:
        raise ApiError(403, "PERMISSION_DENIED", "לא ניתן לטעון תפקידים")
    rows = res.json() or []
    if not rows:
        # RPC may be unavailable under user JWT; insert via PostgREST
        for key, meta in SYSTEM_ROLE_META.items():
            client.post(
                "workspace_roles",
                {
                    "workspace_id": workspace_id,
                    "key": key,
                    "label_he": meta["label_he"],
                    "description": meta["description"],
                    "is_system": True,
                    "is_locked": meta["locked"],
                    "base_role_key": key,
                    "grants": catalog_grant_list(key),
                },
            )
        res = client.get(
            "workspace_roles",
            params={"workspace_id": f"eq.{workspace_id}", "select": "*", "order": "is_system.desc,key.asc"},
        )
        rows = res.json() or []

    updated: list[dict] = []
    for row in rows:
        grants = normalize_grants(row.get("grants"))
        if not grants and row.get("is_system") and row.get("base_role_key"):
            grants = catalog_grant_list(str(row["base_role_key"]))
            patch = client.patch(
                "workspace_roles",
                {"grants": grants},
                params={"id": f"eq.{row['id']}", "workspace_id": f"eq.{workspace_id}"},
            )
            if patch.status_code in {200, 204} and patch.json():
                row = patch.json()[0]
            else:
                row = {**row, "grants": grants}
        updated.append(row)
    return updated


def resolve_role_grants(client: UserClient, workspace_id: str, workspace_role_key: str | None, role_key: str) -> frozenset[str]:
    effective_key = (workspace_role_key or role_key or "").strip()
    if role_key == "owner" or effective_key == "owner":
        catalog = load_catalog()
        return frozenset(catalog["_grants"].get("owner") or catalog["_grants"].get(role_key) or ())

    rows = ensure_workspace_roles(client, workspace_id)
    match = next((r for r in rows if r.get("key") == effective_key), None)
    if match is None and effective_key != role_key:
        match = next((r for r in rows if r.get("key") == role_key), None)
    if match is not None:
        grants = normalize_grants(match.get("grants"))
        if grants == ["*"]:
            catalog = load_catalog()
            return frozenset(catalog["_grants"].get("owner") or ())
        if grants:
            return frozenset(grants)
    catalog = load_catalog()
    return frozenset(catalog["_grants"].get(role_key) or ())


def find_workspace_role(client: UserClient, workspace_id: str, key: str) -> dict | None:
    rows = ensure_workspace_roles(client, workspace_id)
    return next((r for r in rows if r.get("key") == key), None)
