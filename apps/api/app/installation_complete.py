"""DEMO-5: complete installation job — checklist gates, assets, warranty, billing, handover."""

from __future__ import annotations

import time
from datetime import UTC, date, datetime, timedelta
from typing import Any

from .errors import ApiError
from .installed_assets_from_planned import (
    allocate_asset_code,
    build_create_plan,
    count_assets_by_planned_item,
    display_name_for_asset,
)
from .notify import emit_notification, in_app_allowed
from .quote_tokens import hash_public_token, new_public_token
from .rest import as_list, created_or_403
from .supabase_service import ServiceClient

HANDOVER_MIN_MONTHS = 12
HANDOVER_EXTRA_DAYS = 30


def _today() -> date:
    return datetime.now(UTC).date()


def _warranty_months(ws: dict[str, Any]) -> int | None:
    field_ops = ws.get("field_ops") if isinstance(ws.get("field_ops"), dict) else {}
    raw = field_ops.get("warranty_months")
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def handover_expires_at(*, warranty_ends: date | None, completed_on: date) -> datetime:
    """End of warranty + 30 days, minimum 12 months from completion."""
    min_end = completed_on + timedelta(days=HANDOVER_MIN_MONTHS * 30)
    if warranty_ends is not None:
        candidate = warranty_ends + timedelta(days=HANDOVER_EXTRA_DAYS)
        end = max(candidate, min_end)
    else:
        end = min_end
    return datetime(end.year, end.month, end.day, 23, 59, 59, tzinfo=UTC)


def validate_completion_gates(svc: ServiceClient, workspace_id: str, job: dict[str, Any]) -> list[str]:
    """Return Hebrew blockers; empty means ok to complete."""
    job_id = str(job["id"])
    blockers: list[str] = []
    items = as_list(
        svc.get(
            "job_checklist_items",
            params={
                "job_id": f"eq.{job_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,label_he,required,completed,not_applicable,photo_required,photo_document_id",
                "limit": "500",
            },
        )
    )
    for item in items:
        label = str(item.get("label_he") or "סעיף")
        done = bool(item.get("completed")) or bool(item.get("not_applicable"))
        if item.get("required") and not done:
            blockers.append(label)
            continue
        if item.get("photo_required") and done and not item.get("not_applicable"):
            doc_id = item.get("photo_document_id")
            if not doc_id:
                blockers.append(f"{label} — חסרה תמונה")
                continue
            docs = as_list(
                svc.get(
                    "documents",
                    params={
                        "id": f"eq.{doc_id}",
                        "workspace_id": f"eq.{workspace_id}",
                        "select": "id",
                        "limit": "1",
                    },
                )
            )
            if not docs:
                blockers.append(f"{label} — התמונה לא נמצאה")

    sig_id = job.get("customer_signature_document_id")
    if not sig_id:
        blockers.append("חתימת לקוח")
    else:
        docs = as_list(
            svc.get(
                "documents",
                params={
                    "id": f"eq.{sig_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "entity_type": "eq.job",
                    "entity_id": f"eq.{job_id}",
                    "kind": "eq.signature",
                    "select": "id",
                    "limit": "1",
                },
            )
        )
        if not docs:
            blockers.append("חתימת לקוח — המסמך אינו תקין")
    return blockers


def _roles_with_jobs_assign(svc: ServiceClient) -> set[str]:
    rows = as_list(
        svc.get(
            "role_permissions",
            params={"permission_key": "eq.jobs.assign", "select": "role_key", "limit": "100"},
        )
    )
    return {str(r.get("role_key")) for r in rows if r.get("role_key")}


def users_with_jobs_manage(svc: ServiceClient, workspace_id: str) -> list[str]:
    """Active members whose role grants jobs.assign (job management)."""
    assign_roles = _roles_with_jobs_assign(svc) | {"owner"}
    members = as_list(
        svc.get(
            "workspace_memberships",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.active",
                "select": "user_id,role_key,workspace_role_key",
                "limit": "500",
            },
        )
    )
    out: list[str] = []
    for m in members:
        role = str(m.get("workspace_role_key") or m.get("role_key") or "")
        if role == "founding_technician":
            role = "technician"
        if role == "owner" or role in assign_roles:
            uid = str(m.get("user_id") or "")
            if uid:
                out.append(uid)
    return list(dict.fromkeys(out))


def workspace_missing_warranty_months(svc: ServiceClient, workspace_id: str) -> bool:
    rows = as_list(
        svc.get(
            "workspaces",
            params={"id": f"eq.{workspace_id}", "select": "id,field_ops", "limit": "1"},
        )
    )
    if not rows:
        return True
    return _warranty_months(rows[0]) is None


def _install_equipment(
    svc: ServiceClient,
    *,
    workspace_id: str,
    project_id: str,
    site_id: str,
    customer_id: str | None,
) -> list[str]:
    planned = as_list(
        svc.get(
            "project_planned_items",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "project_id": f"eq.{project_id}",
                "select": "*",
                "limit": "2000",
            },
        )
    )
    planned = [p for p in planned if not p.get("is_optional")]
    counts = count_assets_by_planned_item(svc, workspace_id, project_id)
    plan = build_create_plan(planned, counts)
    created_ids: list[str] = []
    reserved: set[str] = set()
    today = _today().isoformat()
    for entry in plan:
        remaining = int(entry.get("remaining") or 0)
        if remaining <= 0:
            continue
        item = entry["planned_item"]
        category = str(entry["category"])
        total = int(entry.get("qty") or remaining)
        existing = int(entry.get("existing") or 0)
        for i in range(remaining):
            code = allocate_asset_code(
                svc,
                workspace_id=workspace_id,
                site_id=site_id,
                category=category,
                reserved=reserved,
            )
            reserved.add(code)
            payload = {
                "workspace_id": workspace_id,
                "site_id": site_id,
                "project_id": project_id,
                "project_planned_item_id": entry["planned_item_id"],
                "category": category,
                "status": "installed",
                "name": display_name_for_asset(item, index=existing + i + 1, total=total),
                "asset_code": code,
                "manufacturer": item.get("manufacturer"),
                "model": item.get("model"),
                "installed_at": today,
            }
            row = created_or_403(svc.post("equipment", payload))
            created_ids.append(str(row["id"]))
    return created_ids


def _update_project_status(svc: ServiceClient, workspace_id: str, project_id: str) -> str | None:
    proj_rows = as_list(
        svc.get(
            "projects",
            params={
                "id": f"eq.{project_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,status",
                "limit": "1",
            },
        )
    )
    if not proj_rows:
        return None
    jobs = as_list(
        svc.get(
            "jobs",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "project_id": f"eq.{project_id}",
                "select": "id,status",
                "limit": "500",
            },
        )
    )
    statuses = [str(j.get("status") or "") for j in jobs]
    if not statuses:
        return None
    all_done = all(s in {"completed", "cancelled"} for s in statuses)
    any_completed = any(s == "completed" for s in statuses)
    current = str(proj_rows[0].get("status") or "")
    target = None
    if all_done and any_completed:
        target = "completed"
    elif current == "planned":
        target = "in_progress"
    if target and target != current:
        svc.patch(
            "projects",
            {"status": target},
            params={"id": f"eq.{project_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    return target


def _create_warranty(
    svc: ServiceClient,
    *,
    workspace_id: str,
    job: dict[str, Any],
    months: int | None,
    actor: str,
) -> dict[str, Any]:
    job_id = str(job["id"])
    existing = as_list(
        svc.get(
            "warranties",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "job_id": f"eq.{job_id}",
                "select": "id,number,status,starts_on,ends_on,job_id",
                "limit": "1",
            },
        )
    )
    if existing:
        return existing[0]

    starts = _today()
    if months:
        # approximate month add
        year = starts.year + (starts.month - 1 + months) // 12
        month = (starts.month - 1 + months) % 12 + 1
        day = min(starts.day, 28)
        ends = date(year, month, day)
        status = "active"
        title = "אחריות התקנה"
    else:
        ends = None
        status = "draft"
        title = "ממתין להגדרת תקופה"

    payload: dict[str, Any] = {
        "workspace_id": workspace_id,
        "type": "installation",
        "status": status,
        "customer_id": job["customer_id"],
        "site_id": job["site_id"],
        "starts_on": starts.isoformat(),
        "ends_on": ends.isoformat() if ends else None,
        "job_id": job_id,
        "title": title,
        "policy": {"source": "installation_complete", "warranty_months": months},
    }
    row = created_or_403(svc.post("warranties", payload))
    return row


def _maybe_billing_item(
    svc: ServiceClient,
    *,
    workspace_id: str,
    job: dict[str, Any],
    project_completed: bool,
) -> str | None:
    project_id = job.get("project_id")
    quote_id = None
    amount = None
    currency = "ILS"

    if project_id:
        proj = as_list(
            svc.get(
                "projects",
                params={
                    "id": f"eq.{project_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "id,source_quote_id",
                    "limit": "1",
                },
            )
        )
        if proj and proj[0].get("source_quote_id"):
            quote_id = proj[0]["source_quote_id"]
        # One item per project when last job closes
        if not project_completed:
            return None
        existing = as_list(
            svc.get(
                "billing_pending_items",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "project_id": f"eq.{project_id}",
                    "status": "eq.pending",
                    "select": "id",
                    "limit": "1",
                },
            )
        )
        if existing:
            return str(existing[0]["id"])
    else:
        existing = as_list(
            svc.get(
                "billing_pending_items",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "job_id": f"eq.{job['id']}",
                    "select": "id",
                    "limit": "1",
                },
            )
        )
        if existing:
            return str(existing[0]["id"])

    if quote_id:
        q = as_list(
            svc.get(
                "quotes",
                params={
                    "id": f"eq.{quote_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "id,total_gross,currency",
                    "limit": "1",
                },
            )
        )
        if q:
            amount = q[0].get("total_gross")
            currency = str(q[0].get("currency") or "ILS")

    payload = {
        "workspace_id": workspace_id,
        "job_id": None if project_id else job["id"],
        "project_id": project_id,
        "quote_id": quote_id,
        "amount_gross": amount,
        "currency": currency,
        "status": "pending",
    }
    row = created_or_403(svc.post("billing_pending_items", payload))
    return str(row["id"])


def mint_handover_link(
    svc: ServiceClient,
    *,
    workspace_id: str,
    job_id: str,
    actor: str | None,
    warranty: dict[str, Any] | None,
) -> tuple[str, str, datetime]:
    """Revoke prior links and mint a new token. Returns (token, access_id, expires_at)."""
    now = datetime.now(UTC).isoformat()
    svc.patch(
        "handover_public_access",
        {"revoked_at": now},
        params={
            "workspace_id": f"eq.{workspace_id}",
            "job_id": f"eq.{job_id}",
            "revoked_at": "is.null",
        },
    )
    completed_on = _today()
    ends = None
    if warranty and warranty.get("ends_on"):
        try:
            ends = date.fromisoformat(str(warranty["ends_on"])[:10])
        except ValueError:
            ends = None
    expires = handover_expires_at(warranty_ends=ends, completed_on=completed_on)
    token = new_public_token()
    row = created_or_403(
        svc.post(
            "handover_public_access",
            {
                "workspace_id": workspace_id,
                "job_id": job_id,
                "token_hash": hash_public_token(token),
                "expires_at": expires.isoformat(),
                "created_by": actor,
            },
        )
    )
    return token, str(row["id"]), expires


def _load_job_row(svc: ServiceClient, workspace_id: str, job_id: str) -> dict[str, Any] | None:
    rows = as_list(
        svc.get(
            "jobs",
            params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}", "select": "*", "limit": "1"},
        )
    )
    return rows[0] if rows else None


def _replay_if_ready(
    svc: ServiceClient,
    workspace_id: str,
    job_id: str,
    idempotency_key: str,
    *,
    waits: int = 20,
) -> dict[str, Any] | None:
    """Return a replay payload when another worker finished the same idempotency key."""
    for _ in range(max(waits, 1)):
        row = _load_job_row(svc, workspace_id, job_id)
        if not row:
            return None
        if row.get("status") == "completed" and row.get("completion_idempotency_key") == idempotency_key:
            result = row.get("completion_result") if isinstance(row.get("completion_result"), dict) else {}
            if result.get("handover_url") or result.get("warranty_id") is not None:
                return {"job": row, "replay": True, **result}
        elif row.get("status") == "completed":
            raise ApiError(409, "JOB_ALREADY_COMPLETED", "העבודה כבר הושלמה")
        time.sleep(0.05)
    row = _load_job_row(svc, workspace_id, job_id) or {}
    if row.get("status") == "completed" and row.get("completion_idempotency_key") == idempotency_key:
        result = row.get("completion_result") if isinstance(row.get("completion_result"), dict) else {}
        return {"job": row, "replay": True, **result}
    return None


def _rollback_partial_completion(
    svc: ServiceClient,
    *,
    workspace_id: str,
    job_id: str,
    previous_status: str,
    equipment_ids: list[str],
) -> None:
    """Undo side effects when the completion chain fails after claiming the job."""
    svc.delete(
        "outbound_messages",
        params={"workspace_id": f"eq.{workspace_id}", "job_id": f"eq.{job_id}"},
    )
    svc.delete(
        "notifications",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "entity_type": "eq.job",
            "entity_id": f"eq.{job_id}",
            "type": "eq.job.completed",
        },
    )
    svc.patch(
        "handover_public_access",
        {"revoked_at": datetime.now(UTC).isoformat()},
        params={
            "workspace_id": f"eq.{workspace_id}",
            "job_id": f"eq.{job_id}",
            "revoked_at": "is.null",
        },
    )
    svc.delete(
        "billing_pending_items",
        params={"workspace_id": f"eq.{workspace_id}", "job_id": f"eq.{job_id}"},
    )
    svc.delete(
        "warranties",
        params={"workspace_id": f"eq.{workspace_id}", "job_id": f"eq.{job_id}"},
    )
    for eid in equipment_ids:
        svc.delete(
            "equipment",
            params={"workspace_id": f"eq.{workspace_id}", "id": f"eq.{eid}"},
        )
    svc.patch(
        "jobs",
        {
            "status": previous_status or "in_progress",
            "completed_at": None,
            "completed_by": None,
            "completion_idempotency_key": None,
            "completion_result": None,
            "completion_notes": None,
        },
        params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"},
    )


def complete_installation(
    svc: ServiceClient,
    *,
    workspace_id: str,
    job: dict[str, Any],
    actor: str,
    completion_notes: str | None,
    idempotency_key: str,
    web_public_url: str,
) -> dict[str, Any]:
    """Run the DEMO-5 completion chain. Caller already authorized jobs.complete."""
    job_id = str(job["id"])
    previous_status = str(job.get("status") or "in_progress")

    # Idempotent replay
    if job.get("status") == "completed" and job.get("completion_idempotency_key") == idempotency_key:
        result = job.get("completion_result") if isinstance(job.get("completion_result"), dict) else {}
        if result.get("handover_url") or result.get("warranty_id") is not None:
            return {"job": job, "replay": True, **result}
        replay = _replay_if_ready(svc, workspace_id, job_id, idempotency_key)
        if replay:
            return replay

    if job.get("status") == "completed":
        raise ApiError(409, "JOB_ALREADY_COMPLETED", "העבודה כבר הושלמה")

    blockers = validate_completion_gates(svc, workspace_id, job)
    if blockers:
        raise ApiError(
            409,
            "COMPLETION_BLOCKED",
            "לא ניתן לסיים — חסרים פריטים",
            details={"missing": blockers},
        )

    ws_rows = as_list(
        svc.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "id,field_ops,name", "limit": "1"})
    )
    ws = ws_rows[0] if ws_rows else {}
    months = _warranty_months(ws)

    now = datetime.now(UTC).isoformat()
    patch = {
        "status": "completed",
        "completed_at": now,
        "completed_by": actor,
        "completion_idempotency_key": idempotency_key,
    }
    if completion_notes is not None:
        patch["completion_notes"] = completion_notes

    # Claim the job only while still in_progress — parallel callers lose and replay.
    patched = as_list(
        svc.patch(
            "jobs",
            patch,
            params={
                "id": f"eq.{job_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.in_progress",
                "select": "*",
            },
            prefer="return=representation",
        )
    )
    if not patched:
        replay = _replay_if_ready(svc, workspace_id, job_id, idempotency_key)
        if replay:
            return replay
        raise ApiError(409, "RESOURCE_STATE", "לא ניתן לעדכן את העבודה")
    job_row = patched[0]

    equipment_ids: list[str] = []
    project_status = None
    warranty: dict[str, Any] = {}
    billing_id = None
    token = ""
    handover_url = ""
    notification_ids: list[str] = []
    outbound: dict[str, Any] = {}

    try:
        project_id = job.get("project_id")
        if project_id and job.get("site_id"):
            equipment_ids = _install_equipment(
                svc,
                workspace_id=workspace_id,
                project_id=str(project_id),
                site_id=str(job["site_id"]),
                customer_id=str(job["customer_id"]) if job.get("customer_id") else None,
            )
            project_status = _update_project_status(svc, workspace_id, str(project_id))

        warranty = _create_warranty(svc, workspace_id=workspace_id, job=job_row, months=months, actor=actor)

        if project_id:
            if project_status == "completed":
                billing_id = _maybe_billing_item(
                    svc, workspace_id=workspace_id, job=job_row, project_completed=True
                )
        else:
            billing_id = _maybe_billing_item(
                svc, workspace_id=workspace_id, job=job_row, project_completed=True
            )

        token, _access_id, _expires = mint_handover_link(
            svc,
            workspace_id=workspace_id,
            job_id=job_id,
            actor=actor,
            warranty=warranty,
        )
        base = web_public_url.rstrip("/")
        handover_url = f"{base}/h/{token}"

        recipients = users_with_jobs_manage(svc, workspace_id)
        title = "עבודה הושלמה"
        body = f"העבודה {job_row.get('number') or ''} הושלמה"
        if months is None:
            body += " · האחריות ממתינה להגדרת תקופה"
        for uid in recipients:
            if uid == actor:
                continue
            if not in_app_allowed(svc, workspace_id, uid, "job.completed"):
                continue
            try:
                rows = as_list(
                    svc.post(
                        "notifications",
                        {
                            "workspace_id": workspace_id,
                            "recipient_user_id": uid,
                            "type": "job.completed",
                            "title": title,
                            "body": body,
                            "entity_type": "job",
                            "entity_id": job_id,
                            "payload": {
                                "job_id": job_id,
                                "warranty_pending_period": months is None,
                                "handover_url": handover_url,
                            },
                        },
                    )
                )
                if rows:
                    notification_ids.append(str(rows[0].get("id") or ""))
            except Exception:
                existing = as_list(
                    svc.get(
                        "notifications",
                        params={
                            "workspace_id": f"eq.{workspace_id}",
                            "recipient_user_id": f"eq.{uid}",
                            "type": "eq.job.completed",
                            "entity_id": f"eq.{job_id}",
                            "select": "id",
                            "limit": "1",
                        },
                    )
                )
                if existing:
                    notification_ids.append(str(existing[0]["id"]))

        if months is None:
            for uid in recipients:
                if uid == actor:
                    continue
                emit_notification(
                    svc,
                    workspace_id=workspace_id,
                    recipient_user_id=uid,
                    event_type="job.completed",
                    title="אחריות ממתינה להגדרת תקופה",
                    body=(
                        f"לעבודה {job_row.get('number') or ''} נוצרה אחריות ללא תקופה — "
                        "יש להגדיר חודשי אחריות בסביבה"
                    ),
                    entity_type="warranty",
                    entity_id=str(warranty.get("id") or ""),
                    actor_user_id=actor,
                )

        customer_email = None
        cname = ""
        if job.get("customer_id"):
            cust = as_list(
                svc.get(
                    "customers",
                    params={
                        "id": f"eq.{job['customer_id']}",
                        "workspace_id": f"eq.{workspace_id}",
                        "select": "email,display_name",
                        "limit": "1",
                    },
                )
            )
            if cust:
                customer_email = cust[0].get("email")
                cname = cust[0].get("display_name") or ""

        try:
            outbound = created_or_403(
                svc.post(
                    "outbound_messages",
                    {
                        "workspace_id": workspace_id,
                        "job_id": job_id,
                        "channel": "email",
                        "status": "preview",
                        "recipient": customer_email,
                        "subject": "תעודת מסירה",
                        "body": (
                            f"שלום{(' ' + cname) if cname else ''},\n"
                            f"ההתקנה הושלמה. תעודת המסירה:\n{handover_url}"
                        ),
                    },
                )
            )
        except ApiError:
            existing_out = as_list(
                svc.get(
                    "outbound_messages",
                    params={
                        "workspace_id": f"eq.{workspace_id}",
                        "job_id": f"eq.{job_id}",
                        "select": "id",
                        "limit": "1",
                    },
                )
            )
            outbound = existing_out[0] if existing_out else {}

        result = {
            "warranty_id": str(warranty.get("id") or ""),
            "equipment_ids": equipment_ids,
            "billing_item_id": billing_id,
            "notification_ids": [n for n in notification_ids if n],
            "outbound_message_id": str(outbound.get("id") or ""),
            "handover_url": handover_url,
            "handover_token": token,
            "project_status": project_status,
            "warranty_pending_period": months is None,
        }
        svc.patch(
            "jobs",
            {"completion_result": {k: v for k, v in result.items() if k != "handover_token"}},
            params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"},
        )
        refreshed = _load_job_row(svc, workspace_id, job_id)
        return {"job": refreshed if refreshed else job_row, "replay": False, **result}
    except Exception:
        _rollback_partial_completion(
            svc,
            workspace_id=workspace_id,
            job_id=job_id,
            previous_status=previous_status,
            equipment_ids=equipment_ids,
        )
        raise


def assemble_handover_document(svc: ServiceClient, access: dict) -> dict[str, Any]:
    """Public certificate payload for /h/{token} and PDF."""
    workspace_id = str(access["workspace_id"])
    job_id = str(access["job_id"])
    jobs = as_list(
        svc.get(
            "jobs",
            params={
                "id": f"eq.{job_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "*",
                "limit": "1",
            },
        )
    )
    if not jobs or jobs[0].get("status") != "completed":
        raise ApiError(404, "NOT_FOUND", "לא נמצא")
    job = jobs[0]

    ws = as_list(
        svc.get(
            "workspaces",
            params={"id": f"eq.{workspace_id}", "select": "id,name,field_ops", "limit": "1"},
        )
    )
    settings_rows = as_list(
        svc.get(
            "workspace_settings",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": "branding",
                "limit": "1",
            },
        )
    )
    branding = (settings_rows[0].get("branding") if settings_rows else None) or {}
    if not isinstance(branding, dict):
        branding = {}

    customer = {}
    if job.get("customer_id"):
        rows = as_list(
            svc.get(
                "customers",
                params={
                    "id": f"eq.{job['customer_id']}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "display_name,phone,email",
                    "limit": "1",
                },
            )
        )
        customer = rows[0] if rows else {}

    site = {}
    if job.get("site_id"):
        rows = as_list(
            svc.get(
                "sites",
                params={
                    "id": f"eq.{job['site_id']}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "name,address",
                    "limit": "1",
                },
            )
        )
        site = rows[0] if rows else {}

    tech_name = None
    assignees = as_list(
        svc.get(
            "assignments",
            params={
                "resource_type": "eq.job",
                "resource_id": f"eq.{job_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "user_id",
                "limit": "5",
            },
        )
    )
    if assignees:
        # profiles table
        profiles = as_list(
            svc.get(
                "profiles",
                params={
                    "id": f"eq.{assignees[0]['user_id']}",
                    "select": "full_name",
                    "limit": "1",
                },
            )
        )
        if profiles:
            tech_name = profiles[0].get("full_name")

    equipment: list[dict[str, Any]] = []
    if job.get("project_id"):
        equipment = as_list(
            svc.get(
                "equipment",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "project_id": f"eq.{job['project_id']}",
                    "select": "name,manufacturer,model,asset_code,category",
                    "limit": "200",
                },
            )
        )
    elif job.get("site_id"):
        equipment = as_list(
            svc.get(
                "equipment",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "site_id": f"eq.{job['site_id']}",
                    "select": "name,manufacturer,model,asset_code,category",
                    "limit": "200",
                },
            )
        )

    warranties = as_list(
        svc.get(
            "warranties",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "job_id": f"eq.{job_id}",
                "select": "id,number,status,starts_on,ends_on,title,type",
                "limit": "1",
            },
        )
    )
    warranty = warranties[0] if warranties else None
    warranty_label = None
    if warranty:
        if warranty.get("status") == "draft":
            warranty_label = "ממתין להגדרת תקופה"
        else:
            warranty_label = (
                f"{warranty.get('number') or ''} · "
                f"{warranty.get('starts_on') or ''}–{warranty.get('ends_on') or ''}"
            ).strip(" ·")

    checklist = as_list(
        svc.get(
            "job_checklist_items",
            params={
                "job_id": f"eq.{job_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "label_he,completed,not_applicable,required",
                "order": "sort_order.asc",
                "limit": "200",
            },
        )
    )
    done = sum(1 for c in checklist if c.get("completed"))
    na = sum(1 for c in checklist if c.get("not_applicable"))
    total = len(checklist)

    site_address = ""
    raw_addr = site.get("address")
    if isinstance(raw_addr, dict):
        addr_parts = [
            raw_addr.get("line") or raw_addr.get("street") or raw_addr.get("formatted"),
            raw_addr.get("city"),
        ]
        site_address = ", ".join(str(p).strip() for p in addr_parts if p)
    elif isinstance(raw_addr, str):
        site_address = raw_addr.strip()

    company = {
        "brand_name": branding.get("display_name") or branding.get("brand_name") or (ws[0].get("name") if ws else None),
        "name": ws[0].get("name") if ws else None,
        "logo_url": branding.get("logo_url"),
        "brand_primary": branding.get("brand_primary") or branding.get("primary_color"),
        "phone": branding.get("phone"),
    }

    return {
        "number": job.get("number"),
        "company": company,
        "customer": {"display_name": customer.get("display_name")},
        "site": {"name": site.get("name"), "address": site_address},
        "technician_name": tech_name,
        "completed_at": job.get("completed_at"),
        "warranty_label": warranty_label,
        "warranty": warranty,
        "equipment": [
            {
                "name": e.get("name"),
                "manufacturer": e.get("manufacturer"),
                "model": e.get("model"),
                "asset_code": e.get("asset_code"),
                "qty": 1,
            }
            for e in equipment
        ],
        "checklist_summary": {"done": done, "not_applicable": na, "total": total},
        "checklist": [
            {
                "label": c.get("label_he"),
                "done": bool(c.get("completed")),
                "not_applicable": bool(c.get("not_applicable")),
            }
            for c in checklist
        ],
        "signer_name": job.get("customer_signer_name"),
        "signed_at": job.get("customer_signed_at"),
    }
