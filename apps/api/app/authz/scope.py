"""Assigned-scope list filtering — API defense in depth (RLS remains authoritative)."""

from __future__ import annotations

from typing import Any

from .catalog import load_catalog
from .types import AuthzContext

# Force empty PostgREST match when assigned scope has no resources.
_EMPTY_UUID = "00000000-0000-0000-0000-000000000000"


def expand_assigned_resource_ids(
    client: Any,
    workspace_id: str,
    assignment_rows: list[dict[str, Any]],
) -> frozenset[str]:
    """Union assignment ids with related site/customer ids (mirrors RLS site visibility paths).

    Also adds the project and service call of each assigned job (DEMO-1): those are the
    only projects / service calls a technician reaches through a job.
    """
    ids: set[str] = set()
    by_type: dict[str, list[str]] = {}
    for row in assignment_rows:
        rid = row.get("resource_id")
        rtype = str(row.get("resource_type") or "")
        if not rid:
            continue
        ids.add(str(rid))
        by_type.setdefault(rtype, []).append(str(rid))

    def _in(values: list[str]) -> str:
        return f"in.({','.join(sorted(set(values)))})"

    site_ids: set[str] = set(by_type.get("site") or [])
    customer_ids: set[str] = set(by_type.get("customer") or [])

    for rtype, table, select_cols in (
        ("job", "jobs", "id,site_id,customer_id,project_id,service_call_id"),
        ("project", "projects", "id,site_id,customer_id"),
        ("service_call", "service_calls", "id,site_id"),
    ):
        resource_ids = by_type.get(rtype) or []
        if not resource_ids:
            continue
        res = client.get(
            table,
            params={
                "workspace_id": f"eq.{workspace_id}",
                "id": _in(resource_ids),
                "select": select_cols,
            },
        )
        if res.status_code != 200:
            continue
        for row in res.json() or []:
            for linked in ("project_id", "service_call_id"):
                if rtype == "job" and row.get(linked):
                    ids.add(str(row[linked]))
            site_id = row.get("site_id")
            if site_id:
                site_ids.add(str(site_id))
                ids.add(str(site_id))
            cust = row.get("customer_id")
            if cust:
                customer_ids.add(str(cust))
                ids.add(str(cust))

    if site_ids:
        sites = client.get(
            "sites",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "id": _in(list(site_ids)),
                "select": "id,customer_id",
            },
        )
        if sites.status_code == 200:
            for row in sites.json() or []:
                cust = row.get("customer_id")
                if cust:
                    customer_ids.add(str(cust))
                    ids.add(str(cust))

    ids.update(site_ids)
    ids.update(customer_ids)
    return frozenset(ids)


def role_default_scope(role_key: str) -> str:
    return load_catalog().get("_role_scope", {}).get(role_key, "all")


def is_assigned_scope(ctx: AuthzContext) -> bool:
    return role_default_scope(ctx.role_key) == "assigned"


def postgrest_in(ids: frozenset[str] | set[str] | list[str]) -> str:
    cleaned = sorted({str(i) for i in ids if i})
    if not cleaned:
        return f"eq.{_EMPTY_UUID}"
    return f"in.({','.join(cleaned)})"


def _and_clause(params: dict[str, str], clause: str) -> None:
    """AND a filter clause into params, preserving an existing ``or`` search filter."""
    parts: list[str] = [clause]
    existing_or = params.pop("or", None)
    if existing_or:
        parts.append(f"or{existing_or}" if existing_or.startswith("(") else f"or({existing_or})")
    existing_and = params.pop("and", None)
    if existing_and:
        inner = existing_and[1:-1] if existing_and.startswith("(") and existing_and.endswith(")") else existing_and
        parts.append(inner)
    params["and"] = f"({','.join(parts)})"


def apply_assigned_column_filter(
    ctx: AuthzContext,
    params: dict[str, str],
    *,
    column: str = "id",
) -> dict[str, str]:
    if not is_assigned_scope(ctx):
        return params
    _and_clause(params, f"{column}.{postgrest_in(ctx.assigned_resource_ids)}")
    return params


def apply_assigned_job_list_filter(ctx: AuthzContext, params: dict[str, str]) -> dict[str, str]:
    """Jobs: only jobs assigned to the actor. A shared site is not enough (DEMO-1)."""
    return apply_assigned_column_filter(ctx, params, column="id")


def apply_assigned_project_list_filter(ctx: AuthzContext, params: dict[str, str]) -> dict[str, str]:
    """Projects: assigned to the actor, or the project of a job assigned to the actor."""
    return apply_assigned_column_filter(ctx, params, column="id")


def apply_assigned_service_call_list_filter(ctx: AuthzContext, params: dict[str, str]) -> dict[str, str]:
    """Service calls: assigned to the actor, or the call of a job assigned to the actor."""
    return apply_assigned_column_filter(ctx, params, column="id")


def apply_assigned_task_list_filter(ctx: AuthzContext, params: dict[str, str]) -> dict[str, str]:
    """Tasks: assigned-scope actors see only rows they are assigned to.

    Assigned site/customer ids must not leak other technicians' tasks.
    """
    if not is_assigned_scope(ctx):
        return params
    _and_clause(params, f"assignee_id.eq.{ctx.user_id}")
    return params


def apply_assigned_document_list_filter(ctx: AuthzContext, params: dict[str, str]) -> dict[str, str]:
    """Documents: entity_id must be an assigned resource (site/job/customer/…)."""
    if not is_assigned_scope(ctx):
        return params
    return apply_assigned_column_filter(ctx, params, column="entity_id")


def empty_assigned_page(ctx: AuthzContext) -> dict[str, Any] | None:
    """Return an empty list page when assigned-scope actor has zero assignments."""
    if is_assigned_scope(ctx) and not ctx.assigned_resource_ids:
        return {"items": [], "next_cursor": None}
    return None
