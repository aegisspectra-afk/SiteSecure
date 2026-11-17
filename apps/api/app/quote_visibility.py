"""Shared quote visibility for lists, dashboard, and reports.

Visible = not soft-deleted and not archived (unless explicitly requested).
"""

from __future__ import annotations

from typing import Literal


VisibilityMode = Literal["active", "archived", "all_alive"]


def quote_visibility_filters(mode: VisibilityMode = "active") -> dict[str, str]:
    """PostgREST filter params for quote visibility.

    - active: main list + dashboard (not deleted, not archived)
    - archived: archive tab only (not deleted, archived_at set)
    - all_alive: customer/site cards (not deleted; includes archived)
    """
    params: dict[str, str] = {"deleted_at": "is.null"}
    if mode == "active":
        params["archived_at"] = "is.null"
    elif mode == "archived":
        params["archived_at"] = "not.is.null"
    # all_alive: no archived_at constraint
    return params


def quote_is_visible_row(row: dict, *, mode: VisibilityMode = "active") -> bool:
    """In-memory mirror of quote_visibility_filters (dashboard pure builder)."""
    if row.get("deleted_at"):
        return False
    archived = bool(row.get("archived_at"))
    if mode == "active":
        return not archived
    if mode == "archived":
        return archived
    return True
