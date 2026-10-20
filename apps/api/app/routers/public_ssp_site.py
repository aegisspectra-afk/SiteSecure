"""Public SSP site activation + field-device access. Not a user login. Service role after checks."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, ConfigDict, Field

from ..deps import service_client
from ..errors import ApiError, MESSAGES
from ..rest import as_list, created_or_403, one_or_404
from ..ssp.activation_codes import (
    DEVICE_SESSION_TTL,
    GENERIC_INVALID,
    device_access_allowed,
    enrollment_public_status,
    hash_activation_code,
    hash_secret,
    is_valid_activation_code_format,
    new_device_token,
    new_poll_token,
    normalize_activation_code,
    raise_uniform_invalid,
)
from ..ssp.forms_schema import validate_answers
from ..ssp.site_assignments import classify_assignment, duplicate_submit_blocked
from ..ssp.tokens import hash_public_token
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/public/ssp", tags=["public-ssp-site"])

_fail_window: dict[str, deque[float]] = defaultdict(deque)
_FAIL_WINDOW_SEC = 600
_FAIL_MAX = 8

SITE_SELECT = "id,workspace_id,company_pk,site_id,name,phone,is_active,description"
ASSIGN_SELECT = (
    "id,workspace_id,company_pk,form_id,form_version_id,site_pk,status,cadence,"
    "filler_mode,starts_at,due_at,department_id,definition_snapshot,created_at"
)
SUBMISSION_SELECT = (
    "id,workspace_id,form_id,form_version_id,site_assignment_id,status,answers,"
    "definition_snapshot,submitted_at,created_at,submitted_by,device_id"
)
DEVICE_DENIED = "אין הרשאת מכשיר לאתר זה"


class ActivateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=4, max_length=32)
    device_label: str | None = Field(default=None, max_length=80)


class DeviceSubmitIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: dict[str, Any] = Field(default_factory=dict)


def _ip_key(request: Request) -> str:
    # Peer address only. X-Forwarded-For is caller-controlled unless a trusted
    # proxy is configured, and must not mint extra activation-guess windows.
    ip = request.client.host if request.client else "unknown"
    return hash_public_token(ip)[:16]


def _created_or_duplicate(res, duplicate_message: str) -> dict[str, Any]:
    if res.status_code == 409:
        raise ApiError(409, "BUSINESS_RULE", duplicate_message)
    return created_or_403(res)


def _check_activate_rate(request: Request) -> None:
    key = _ip_key(request)
    now = time.time()
    window = _fail_window[key]
    while window and now - window[0] > _FAIL_WINDOW_SEC:
        window.popleft()
    if len(window) >= _FAIL_MAX:
        raise ApiError(429, "RATE_LIMITED", "יותר מדי ניסיונות. נסו שוב מאוחר יותר.")


def _record_activate_failure(request: Request) -> None:
    _fail_window[_ip_key(request)].append(time.time())


def _rpc_json(res) -> dict[str, Any]:
    if res.status_code not in {200, 201}:
        raise_uniform_invalid()
    data = res.json() if res.content else {}
    if isinstance(data, list) and data:
        data = data[0]
    return data if isinstance(data, dict) else {}


def _parse_dt(value: object) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt


def _load_device_context(
    svc: ServiceClient,
    device_token: str | None,
) -> dict[str, Any]:
    if not device_token or not device_token.strip():
        raise ApiError(401, "UNAUTHENTICATED", DEVICE_DENIED)
    digest = hash_secret(device_token.strip())
    sessions = as_list(
        svc.get(
            "ssp_site_device_sessions",
            params={
                "token_hash": f"eq.{digest}",
                "select": (
                    "id,workspace_id,company_pk,site_pk,device_id,status,expires_at,revoked_at"
                ),
                "limit": "1",
            },
        )
    )
    if not sessions:
        raise ApiError(401, "UNAUTHENTICATED", DEVICE_DENIED)
    session = sessions[0]
    devices = as_list(
        svc.get(
            "ssp_site_devices",
            params={
                "id": f"eq.{session['device_id']}",
                "workspace_id": f"eq.{session['workspace_id']}",
                "select": "id,workspace_id,company_pk,site_pk,status,device_label,last_seen_at",
                "limit": "1",
            },
        )
    )
    if not devices:
        raise ApiError(401, "UNAUTHENTICATED", DEVICE_DENIED)
    device = devices[0]
    site = one_or_404(
        svc.get(
            "ssp_sites",
            params={
                "id": f"eq.{session['site_pk']}",
                "workspace_id": f"eq.{session['workspace_id']}",
                "select": SITE_SELECT,
            },
        )
    )
    if not device_access_allowed(
        session_status=str(session.get("status") or ""),
        session_expires_at=_parse_dt(session.get("expires_at")),
        device_status=str(device.get("status") or ""),
        site_is_active=bool(site.get("is_active")),
    ):
        raise ApiError(401, "UNAUTHENTICATED", DEVICE_DENIED)
    if str(device.get("site_pk")) != str(session.get("site_pk")):
        raise ApiError(401, "UNAUTHENTICATED", DEVICE_DENIED)
    if str(device.get("company_pk")) != str(session.get("company_pk")):
        raise ApiError(401, "UNAUTHENTICATED", DEVICE_DENIED)
    if str(site.get("company_pk")) != str(session.get("company_pk")):
        raise ApiError(401, "UNAUTHENTICATED", DEVICE_DENIED)
    if str(site.get("id")) != str(session.get("site_pk")):
        raise ApiError(401, "UNAUTHENTICATED", DEVICE_DENIED)
    now_iso = datetime.now(UTC).isoformat()
    svc.patch(
        "ssp_site_device_sessions",
        json={"last_seen_at": now_iso},
        params={
            "id": f"eq.{session['id']}",
            "workspace_id": f"eq.{session['workspace_id']}",
            "status": "eq.active",
        },
    )
    svc.patch(
        "ssp_site_devices",
        json={"last_seen_at": now_iso},
        params={
            "id": f"eq.{device['id']}",
            "workspace_id": f"eq.{device['workspace_id']}",
            "status": "eq.active",
        },
    )
    return {"session": session, "device": device, "site": site}


@router.post("/site-activate")
def site_activate(
    body: ActivateIn,
    request: Request,
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    _check_activate_rate(request)
    code = normalize_activation_code(body.code)
    if not is_valid_activation_code_format(code):
        _record_activate_failure(request)
        raise_uniform_invalid()
    poll_token = new_poll_token()
    res = svc.rpc(
        "ssp_consume_activation_code",
        {
            "p_code_hash": hash_activation_code(code),
            "p_poll_token_hash": hash_secret(poll_token),
            "p_device_label": (body.device_label or "").strip() or None,
            "p_user_agent": (request.headers.get("user-agent") or "")[:240] or None,
        },
    )
    payload = _rpc_json(res)
    if not payload.get("ok"):
        _record_activate_failure(request)
        raise_uniform_invalid()
    site = one_or_404(
        svc.get(
            "ssp_sites",
            params={
                "id": f"eq.{payload['site_pk']}",
                "workspace_id": f"eq.{payload['workspace_id']}",
                "select": "id,name,phone,is_active",
            },
        )
    )
    if not site.get("is_active"):
        raise_uniform_invalid()
    return {
        "status": "pending",
        "poll_token": poll_token,
        "enrollment_id": payload.get("enrollment_id"),
        "site": {"name": site.get("name"), "phone": site.get("phone")},
        "message": "הבקשה נשלחה וממתינה לאישור מנהל",
    }


@router.get("/site-enrollments/{poll_token}")
def poll_enrollment(
    poll_token: str,
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    digest = hash_secret(poll_token.strip())
    rows = as_list(
        svc.get(
            "ssp_site_enrollments",
            params={
                "poll_token_hash": f"eq.{digest}",
                "select": "id,status,expires_at,site_pk,workspace_id,device_id",
                "limit": "1",
            },
        )
    )
    if not rows:
        raise_uniform_invalid()
    row = rows[0]
    status = enrollment_public_status(str(row.get("status") or ""), _parse_dt(row.get("expires_at")))
    out: dict[str, Any] = {"status": status, "enrollment_id": row["id"]}
    if status == "pending":
        out["message"] = "הבקשה נשלחה וממתינה לאישור מנהל"
    elif status == "approved":
        out["message"] = "האתר הופעל בהצלחה"
        out["claimable"] = True
    elif status == "denied":
        out["message"] = "הבקשה נדחתה"
    elif status == "expired":
        out["message"] = "פג תוקף הבקשה"
    else:
        out["message"] = GENERIC_INVALID
    return out


@router.post("/site-enrollments/{poll_token}/claim")
def claim_enrollment(
    poll_token: str,
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    digest = hash_secret(poll_token.strip())
    rows = as_list(
        svc.get(
            "ssp_site_enrollments",
            params={
                "poll_token_hash": f"eq.{digest}",
                "select": (
                    "id,status,expires_at,site_pk,workspace_id,company_pk,device_id,device_label"
                ),
                "limit": "1",
            },
        )
    )
    if not rows:
        raise_uniform_invalid()
    row = rows[0]
    status = enrollment_public_status(str(row.get("status") or ""), _parse_dt(row.get("expires_at")))
    if status != "approved" or not row.get("device_id"):
        if status == "pending":
            raise ApiError(409, "BUSINESS_RULE", "הבקשה עדיין ממתינה לאישור מנהל")
        raise ApiError(403, "PERMISSION_DENIED", DEVICE_DENIED)
    device = one_or_404(
        svc.get(
            "ssp_site_devices",
            params={
                "id": f"eq.{row['device_id']}",
                "workspace_id": f"eq.{row['workspace_id']}",
                "select": "id,status,site_pk,workspace_id,company_pk,device_label",
            },
        )
    )
    if device.get("status") != "active":
        raise ApiError(403, "PERMISSION_DENIED", DEVICE_DENIED)
    site = one_or_404(
        svc.get(
            "ssp_sites",
            params={
                "id": f"eq.{device['site_pk']}",
                "workspace_id": f"eq.{device['workspace_id']}",
                "select": SITE_SELECT,
            },
        )
    )
    if not site.get("is_active"):
        raise ApiError(403, "PERMISSION_DENIED", DEVICE_DENIED)
    now = datetime.now(UTC)
    svc.patch(
        "ssp_site_device_sessions",
        json={"status": "expired"},
        params={
            "device_id": f"eq.{device['id']}",
            "workspace_id": f"eq.{device['workspace_id']}",
            "status": "eq.active",
            "expires_at": f"lte.{now.isoformat()}",
        },
    )
    existing = as_list(
        svc.get(
            "ssp_site_device_sessions",
            params={
                "device_id": f"eq.{device['id']}",
                "workspace_id": f"eq.{device['workspace_id']}",
                "status": "eq.active",
                "select": "id,expires_at",
            },
        )
    )
    live = [s for s in existing if (_parse_dt(s.get("expires_at")) or now) > now]
    if live:
        raise ApiError(409, "BUSINESS_RULE", "המכשיר כבר הופעל במכשיר זה. התחברו מחדש עם קוד חדש רק אם נותקתם.")
    token = new_device_token()
    expires = now + DEVICE_SESSION_TTL
    session = _created_or_duplicate(
        svc.post(
            "ssp_site_device_sessions",
            json={
                "workspace_id": device["workspace_id"],
                "company_pk": device["company_pk"],
                "site_pk": device["site_pk"],
                "device_id": device["id"],
                "token_hash": hash_secret(token),
                "status": "active",
                "expires_at": expires.isoformat(),
                "last_seen_at": now.isoformat(),
            },
            params={"select": "id,expires_at,status"},
        ),
        "המכשיר כבר הופעל במכשיר זה. התחברו מחדש עם קוד חדש רק אם נותקתם.",
    )
    return {
        "status": "approved",
        "device_token": token,
        "expires_at": session.get("expires_at"),
        "site": {
            "id": site["id"],
            "name": site.get("name"),
            "phone": site.get("phone"),
            "site_id": site.get("site_id"),
        },
        "message": "האתר הופעל בהצלחה",
    }


def _ctx_from_header(
    svc: ServiceClient,
    x_ssp_device_token: str | None,
) -> dict[str, Any]:
    return _load_device_context(svc, x_ssp_device_token)


@router.get("/site-device/me")
def device_me(
    svc: Annotated[ServiceClient, Depends(service_client)],
    x_ssp_device_token: Annotated[str | None, Header()] = None,
):
    ctx = _ctx_from_header(svc, x_ssp_device_token)
    site = ctx["site"]
    return {
        "site": {
            "id": site["id"],
            "name": site.get("name"),
            "phone": site.get("phone"),
            "site_id": site.get("site_id"),
            "is_active": site.get("is_active"),
        },
        "device": {
            "id": ctx["device"]["id"],
            "status": ctx["device"]["status"],
            "device_label": ctx["device"].get("device_label"),
        },
        "session": {
            "id": ctx["session"]["id"],
            "expires_at": ctx["session"].get("expires_at"),
        },
        "identity": "site_device",
    }


@router.get("/site-device/ops")
def device_ops(
    svc: Annotated[ServiceClient, Depends(service_client)],
    x_ssp_device_token: Annotated[str | None, Header()] = None,
):
    ctx = _ctx_from_header(svc, x_ssp_device_token)
    site = ctx["site"]
    assignments = as_list(
        svc.get(
            "ssp_form_site_assignments",
            params={
                "workspace_id": f"eq.{site['workspace_id']}",
                "site_pk": f"eq.{site['id']}",
                "select": ASSIGN_SELECT,
                "order": "due_at.asc.nullslast,created_at.desc",
            },
        )
    )
    form_ids = list({str(a["form_id"]) for a in assignments if a.get("form_id")})
    forms_by_id: dict[str, dict[str, Any]] = {}
    if form_ids:
        forms = as_list(
            svc.get(
                "ssp_forms",
                params={
                    "workspace_id": f"eq.{site['workspace_id']}",
                    "id": f"in.({','.join(form_ids)})",
                    "select": "id,title,status,category",
                },
            )
        )
        forms_by_id = {str(f["id"]): f for f in forms}
    assign_ids = [str(a["id"]) for a in assignments]
    submissions: list[dict[str, Any]] = []
    if assign_ids:
        submissions = as_list(
            svc.get(
                "ssp_form_submissions",
                params={
                    "workspace_id": f"eq.{site['workspace_id']}",
                    "site_assignment_id": f"in.({','.join(assign_ids)})",
                    "select": SUBMISSION_SELECT,
                    "order": "submitted_at.desc",
                },
            )
        )
    by_assign: dict[str, list[dict[str, Any]]] = {}
    for sub in submissions:
        by_assign.setdefault(str(sub.get("site_assignment_id")), []).append(sub)
    now = datetime.now(UTC)
    cards = []
    buckets: dict[str, list[str]] = {
        "available": [],
        "unfilled": [],
        "submitted": [],
        "overdue": [],
    }
    for a in assignments:
        subs = by_assign.get(str(a["id"]), [])
        bucket = classify_assignment(
            status=str(a.get("status") or ""),
            starts_at=a.get("starts_at"),
            due_at=a.get("due_at"),
            has_submission=bool(subs),
            now=now,
        )
        form = forms_by_id.get(str(a.get("form_id"))) or {}
        cards.append(
            {
                "id": a["id"],
                "form_id": a.get("form_id"),
                "form_title": form.get("title"),
                "status": a.get("status"),
                "starts_at": a.get("starts_at"),
                "due_at": a.get("due_at"),
                "fill_status": bucket,
                "submission_count": len(subs),
                "latest_submission_at": subs[0].get("submitted_at") if subs else None,
            }
        )
        buckets.setdefault(bucket, []).append(str(a["id"]))
        if bucket in {"available", "overdue", "upcoming"}:
            buckets["unfilled"].append(str(a["id"]))
    history = [
        {
            "id": s.get("id"),
            "site_assignment_id": s.get("site_assignment_id"),
            "form_id": s.get("form_id"),
            "submitted_at": s.get("submitted_at"),
            "status": s.get("status"),
            "via": "site_device",
        }
        for s in submissions
    ]
    return {
        "site": {
            "id": site["id"],
            "name": site.get("name"),
            "phone": site.get("phone"),
            "site_id": site.get("site_id"),
        },
        "assignments": cards,
        "buckets": buckets,
        "submissions": history,
        "data_mode": "live" if (assignments or submissions) else "empty",
    }


@router.get("/site-device/assignments/{assignment_id}")
def device_assignment_detail(
    assignment_id: UUID,
    svc: Annotated[ServiceClient, Depends(service_client)],
    x_ssp_device_token: Annotated[str | None, Header()] = None,
):
    ctx = _ctx_from_header(svc, x_ssp_device_token)
    row = one_or_404(
        svc.get(
            "ssp_form_site_assignments",
            params={
                "id": f"eq.{assignment_id}",
                "workspace_id": f"eq.{ctx['site']['workspace_id']}",
                "select": ASSIGN_SELECT,
            },
        )
    )
    if str(row.get("site_pk")) != str(ctx["site"]["id"]):
        raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    form = one_or_404(
        svc.get(
            "ssp_forms",
            params={
                "id": f"eq.{row['form_id']}",
                "workspace_id": f"eq.{ctx['site']['workspace_id']}",
                "select": "id,title,description,status,category",
            },
        )
    )
    snapshot = row.get("definition_snapshot") or {"fields": []}
    hidden = {"definition_snapshot", "workspace_id", "company_pk"}
    return {
        "assignment": {k: v for k, v in row.items() if k not in hidden},
        "form": {
            "id": form.get("id"),
            "title": form.get("title"),
            "description": form.get("description"),
            "status": form.get("status"),
            "category": form.get("category"),
        },
        "definition": snapshot,
        "site": {"id": ctx["site"]["id"], "name": ctx["site"].get("name")},
    }


@router.post("/site-device/assignments/{assignment_id}/submit")
def device_submit(
    assignment_id: UUID,
    body: DeviceSubmitIn,
    svc: Annotated[ServiceClient, Depends(service_client)],
    x_ssp_device_token: Annotated[str | None, Header()] = None,
):
    ctx = _ctx_from_header(svc, x_ssp_device_token)
    row = one_or_404(
        svc.get(
            "ssp_form_site_assignments",
            params={
                "id": f"eq.{assignment_id}",
                "workspace_id": f"eq.{ctx['site']['workspace_id']}",
                "select": ASSIGN_SELECT,
            },
        )
    )
    if str(row.get("site_pk")) != str(ctx["site"]["id"]):
        raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    if row.get("status") != "active":
        raise ApiError(400, "BUSINESS_RULE", "ההקצאה אינה פעילה")
    start = _parse_dt(row.get("starts_at"))
    if start and start > datetime.now(UTC):
        raise ApiError(400, "BUSINESS_RULE", "ההקצאה טרם החלה")
    existing = as_list(
        svc.get(
            "ssp_form_submissions",
            params={
                "workspace_id": f"eq.{ctx['site']['workspace_id']}",
                "site_assignment_id": f"eq.{assignment_id}",
                "select": "id,device_id,submitted_by",
            },
        )
    )
    if duplicate_submit_blocked(
        filler_mode=str(row.get("filler_mode") or "site"),
        existing_for_assignment=bool(existing),
        existing_for_user=any(str(s.get("device_id")) == str(ctx["device"]["id"]) for s in existing),
    ):
        raise ApiError(409, "BUSINESS_RULE", "הטופס כבר הוגש להקצאה זו")
    snapshot = row.get("definition_snapshot") or {"fields": []}
    if not isinstance(snapshot, dict):
        snapshot = {"fields": []}
    answers, consent = validate_answers(snapshot, body.answers)
    created = _created_or_duplicate(
        svc.post(
            "ssp_form_submissions",
            json={
                "workspace_id": ctx["site"]["workspace_id"],
                "form_id": row["form_id"],
                "form_version_id": row["form_version_id"],
                "assignment_id": None,
                "site_assignment_id": str(assignment_id),
                "status": "submitted",
                "answers": answers,
                "consent": consent,
                "definition_snapshot": snapshot,
                "submitted_by": None,
                "device_id": ctx["device"]["id"],
                "device_session_id": ctx["session"]["id"],
            },
            params={"select": SUBMISSION_SELECT},
        ),
        "הטופס כבר הוגש להקצאה זו",
    )
    return created
