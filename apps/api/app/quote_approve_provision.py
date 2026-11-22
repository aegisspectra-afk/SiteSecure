"""D2: after public quote approval, provision project + installation job when site is known."""

from __future__ import annotations

import logging
from typing import Any

from .project_from_quote import plan_project_from_quote, project_name_from_quote
from .rest import as_list, created_or_403

logger = logging.getLogger("site-secure")

AWAITING_DISPATCH_STATUS = "awaiting_dispatch"

_QUOTE_SELECT = (
    "id,workspace_id,number,status,customer_id,site_id,lead_id,title,project_name,version,deleted_at"
)

_PROJECT_SELECT = "id,workspace_id,name,status,customer_id,site_id,source_quote_id,source_quote_version"
_JOB_SELECT = "id,workspace_id,number,title,kind,status,project_id,customer_id,site_id"


def _existing_project(svc: Any, workspace_id: str, quote_id: str) -> dict | None:
    rows = as_list(
        svc.get(
            "projects",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "source_quote_id": f"eq.{quote_id}",
                "select": _PROJECT_SELECT,
                "limit": "1",
            },
        )
    )
    return rows[0] if rows else None


def _installation_job_for_project(svc: Any, workspace_id: str, project_id: str) -> dict | None:
    rows = as_list(
        svc.get(
            "jobs",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "project_id": f"eq.{project_id}",
                "kind": "eq.installation",
                "select": _JOB_SELECT,
                "order": "created_at.asc",
                "limit": "1",
            },
        )
    )
    return rows[0] if rows else None


def _reload_quote(svc: Any, workspace_id: str, quote_id: str) -> dict | None:
    rows = as_list(
        svc.get(
            "quotes",
            params={
                "id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "deleted_at": "is.null",
                "select": _QUOTE_SELECT,
                "limit": "1",
            },
        )
    )
    return rows[0] if rows else None


def _job_idempotency_key(quote_id: str) -> str:
    return f"d2quote-{quote_id}"[:100]


def _installation_job_title(quote: dict[str, Any], plan_name: str) -> str:
    title = project_name_from_quote(quote)
    if title and title != plan_name:
        return f"התקנה — {title}"[:200]
    return f"התקנה — {plan_name}"[:200]


def provision_project_and_job_after_quote_approve(svc: Any, quote: dict[str, Any]) -> dict[str, Any] | None:
    """Create or reuse project + installation job. Returns None when provisioning is not applicable."""
    workspace_id = str(quote.get("workspace_id") or "")
    quote_id = str(quote.get("id") or "")
    if not workspace_id or not quote_id:
        return None

    try:
        needs_reload = (
            "customer_id" not in quote
            or "site_id" not in quote
            or quote.get("status") != "approved"
        )
        full = quote
        if needs_reload:
            full = _reload_quote(svc, workspace_id, quote_id) or quote
        if not full.get("site_id") or not full.get("customer_id"):
            return None
        if str(full.get("status") or "") != "approved":
            return None

        existing_project = _existing_project(svc, workspace_id, quote_id)
        created_project = False
        project: dict[str, Any]

        if existing_project:
            project = existing_project
        else:
            plan = plan_project_from_quote(
                quote=full,
                workspace_id=workspace_id,
                existing_project=None,
            )
            payload = {
                "workspace_id": workspace_id,
                "name": plan.name,
                "customer_id": plan.customer_id,
                "site_id": plan.site_id,
                "source_quote_id": plan.source_quote_id,
                "source_quote_version": plan.source_quote_version,
                "status": plan.status,
            }
            project = created_or_403(svc.post("projects", payload))
            created_project = True
            lead_id = full.get("lead_id")
            if lead_id:
                try:
                    svc.patch(
                        "leads",
                        {"status": "won"},
                        params={"id": f"eq.{lead_id}", "workspace_id": f"eq.{workspace_id}"},
                    )
                except Exception:
                    logger.exception("d2 lead won patch failed quote_id=%s", quote_id)

        project_id = str(project["id"])
        existing_job = _installation_job_for_project(svc, workspace_id, project_id)
        if existing_job:
            return {
                "project_id": project_id,
                "job_id": str(existing_job["id"]),
                "created_project": created_project,
                "created_job": False,
            }

        plan_name = str(project.get("name") or project_name_from_quote(full))
        job_payload = {
            "workspace_id": workspace_id,
            "title": _installation_job_title(full, plan_name),
            "customer_id": str(full["customer_id"]),
            "site_id": str(full["site_id"]),
            "kind": "installation",
            "status": AWAITING_DISPATCH_STATUS,
            "project_id": project_id,
            "idempotency_key": _job_idempotency_key(quote_id),
        }
        res = svc.post("jobs", job_payload)
        if res.status_code == 409:
            dup = _installation_job_for_project(svc, workspace_id, project_id)
            if dup:
                return {
                    "project_id": project_id,
                    "job_id": str(dup["id"]),
                    "created_project": created_project,
                    "created_job": False,
                }
        job = created_or_403(res)
        return {
            "project_id": project_id,
            "job_id": str(job["id"]),
            "created_project": created_project,
            "created_job": True,
        }
    except Exception:
        logger.exception("d2 provision after quote approve failed quote_id=%s", quote_id)
        return None