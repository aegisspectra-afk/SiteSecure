from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any


def resolve_catalog_path(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit)
    env = os.environ.get("AUTHZ_CATALOG_PATH")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "packages" / "authz" / "catalog.json"
        if candidate.is_file():
            return candidate
    return here.parents[4] / "packages" / "authz" / "catalog.json"


def _expand_grants(catalog: dict[str, Any]) -> dict[str, frozenset[str]]:
    all_perms = {p["key"] for p in catalog["permissions"]}
    out: dict[str, frozenset[str]] = {}
    for role, keys in catalog["grants"].items():
        if keys == ["*"]:
            out[role] = frozenset(all_perms)
        else:
            out[role] = frozenset(keys)
    return out


@lru_cache
def load_catalog(path: str | None = None) -> dict[str, Any]:
    catalog_path = resolve_catalog_path(path)
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    data["_grants"] = _expand_grants(data)
    data["_role_scope"] = {r["key"]: r["default_scope"] for r in data["roles"]}
    data["_plan_features"] = {p["key"]: frozenset(p["features"]) for p in data["plans"]}
    data["_plan_limits"] = {p["key"]: p.get("limits", {}) for p in data["plans"]}
    return data
