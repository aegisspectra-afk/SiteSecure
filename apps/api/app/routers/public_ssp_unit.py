"""Public SSP unit-code login + scoped operational session. Not a GoTrue JWT."""

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
from ..ssp.forms_schema import validate_answers
from ..ssp.site_assignments import classify_assignment, duplicate_submit_blocked, parse_dt
from ..ssp.tokens import hash_public_token
from ..ssp.unit_login import (
    hash_unit_code,
    hash_unit_session_token,
    is_valid_unit_code_format,
    new_unit_session_token,
    normalize_unit_code,
    raise_uniform_unit_invalid,
    unit_session_allows,
    unit_session_expires_at,
)
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/public/ssp", tags=["public-ssp-unit"])

_fail_window: dict[str, deque[float]] = defaultdict(deque)
_FAIL_WINDOW_SEC = 600
_FAIL_MAX = 8

SITE_SELECT = "id,workspace_id,company_pk,site_id,name,phone,is_active,kind,description"
ASSIGN_SELECT = (
    "id,workspace_id,company_pk,form_id,form_version_id,site_pk,status,cadence,"
    "filler_mode,starts_at,due_at,department_id,definition_snapshot,created_at"
)
SUBMISSION_SELECT = (
    "id,workspace_id,form_id,form_version_id,site_assignment_id,status,answers,"
    "definition_snapshot,submitted_at,created_at,submitted_by,unit_session_id"
)
UNIT_DENIED = "אין הרשאת יחידה"


class UnitLoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=4, max_length=32)


class UnitSubmitIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: dict[str, Any] = Field(default_factory=dict)


def _ip_key(request: Request) -> str:
    # Peer address only. X-Forwarded-For is caller-controlled.
    ip = request.client.host if request.client else "unknown"
    return hash_public_token(ip)[:16]


def _check_login_rate(request: Request) -> None:
    key = _ip_key(request)
    now = time.time()
    window = _fail_window[key]
    while window and now - window[0] > _FAIL_WINDOW_SEC:
        window.popleft()
    if len(window) >= _FAIL_MAX:
        raise ApiError(429, "RATE_LIMITED", "יותר מדי ניסיונות. נסו שוב מאוחר יותר.")


def _record_login_failure(request: Request) -> None:
    _fail_window[_ip_key(request)].append(time.time())


def _created_or_duplicate(res, duplicate_message: str) -> dict[str, Any]:
    if res.status_code == 409:
        raise ApiError(409, "BUSINESS_RULE", duplicate_message)
    return created_or_403(res)


def _rpc_json(res) -> dict[str, Any]:
    if res.status_code not in {200, 201}:
        raise_uniform_unit_invalid()
    data = res.json() if res.content else {}
    if isinstance(data, list) and data:
        data = data[0]
    return data if isinstance(data, dict) else {}


def _write_unit_audit(
    svc: ServiceClient,
    *,
    workspace_id: str,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    payload: dict[str, Any] = {
        "workspace_id": workspace_id,
        "actor_user_id": None,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "metadata": {"identity": "unit", **(metadata or {})},
    }
    if request and request.client:
        payload["ip"] = request.client.host
        payload["user_agent"] = (request.headers.get("user-agent") or "")[:240] or None
    try:
        svc.post("audit_logs", json=payload)
    except Exception:
        return


def _load_unit_context(svc: ServiceClient, unit_token: str | None) -> dict[str, Any]:
    if not unit_token or not unit_token.strip():
        raise ApiError(401, "UNAUTHENTICATED", UNIT_DENIED)
    digest = hash_unit_session_token(unit_token)
    sessions = as_list(
        svc.get(
            "ssp_unit_sessions",
            params={
                "token_hash": f"eq.{digest}",
                "select": "id,workspace_id,company_pk,site_pk,code_id,status,expires_at,revoked_at",
                "limit": "1",
            },
        )
    )
    if not sessions:
        raise ApiError(401, "UNAUTHENTICATED", UNIT_DENIED)
    session = sessions[0]
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
    if not unit_session_allows(
        session_status=str(session.get("status") or ""),
        session_expires_at=parse_dt(session.get("expires_at")),
        site_is_active=bool(site.get("is_active")),
    ):
        raise ApiError(401, "UNAUTHENTICATED", UNIT_DENIED)
    if str(site.get("company_pk")) != str(session.get("company_pk")):
        raise ApiError(401, "UNAUTHENTICATED", UNIT_DENIED)
    if str(site.get("id")) != str(session.get("site_pk")):
        raise ApiError(401, "UNAUTHENTICATED", UNIT_DENIED)
    if str(site.get("kind") or "") not in {"office", "ops_center"}:
        raise ApiError(401, "UNAUTHENTICATED", UNIT_DENIED)
    svc.patch(
        "ssp_unit_sessions",
        json={"last_seen_at": datetime.now(UTC).isoformat()},
        params={
            "id": f"eq.{session['id']}",
            "workspace_id": f"eq.{session['workspace_id']}",
            "status": "eq.active",
        },
    )
    return {"session": session, "site": site}


@router.post("/unit-login")
def unit_login(
    body: UnitLoginIn,
    request: Request,
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    _check_login_rate(request)
    code = normalize_unit_code(body.code)
    if not is_valid_unit_code_format(code):
        _record_login_failure(request)
        raise_uniform_unit_invalid()
    token = new_unit_session_token()
    expires = unit_session_expires_at()
    res = svc.rpc(
        "ssp_redeem_unit_login_code",
        {
            "p_code_hash": hash_unit_code(code),
            "p_token_hash": hash_unit_session_token(token),
            "p_session_expires_at": expires.isoformat(),
        },
    )
    payload = _rpc_json(res)
    if not payload.get("ok"):
        _record_login_failure(request)
        raise_uniform_unit_invalid()
    site = one_or_404(
        svc.get(
            "ssp_sites",
            params={
                "id": f"eq.{payload['site_pk']}",
                "workspace_id": f"eq.{payload['workspace_id']}",
                "select": SITE_SELECT,
            },
        )
    )
    _write_unit_audit(
        svc,
        workspace_id=str(payload["workspace_id"]),
        action="ssp.unit_login.ok",
        entity_type="ssp_site",
        entity_id=str(payload["site_pk"]),
        metadata={"session_id": payload.get("session_id"), "code_id": payload.get("code_id")},
        request=request,
    )
    return {
        "unit_token": token,
        "expires_at": payload.get("expires_at") or expires.isoformat(),
        "identity": "unit",
        "workspace_id": payload["workspace_id"],
        "site": {
            "id": site["id"],
            "name": site.get("name"),
            "kind": site.get("kind"),
            "site_id": site.get("site_id"),
        },
    }


@router.get("/unit/me")
def unit_me(
    svc: Annotated[ServiceClient, Depends(service_client)],
    x_ssp_unit_token: Annotated[str | None, Header()] = None,
):
    ctx = _load_unit_context(svc, x_ssp_unit_token)
    site = ctx["site"]
    return {
        "identity": "unit",
        "workspace_id": site["workspace_id"],
        "site": {
            "id": site["id"],
            "name": site.get("name"),
            "kind": site.get("kind"),
            "is_active": site.get("is_active"),
        },
        "session": {
            "id": ctx["session"]["id"],
            "expires_at": ctx["session"].get("expires_at"),
        },
        "permissions": ["ssp.forms.view", "ssp.forms.submit", "ssp.submissions.view_own"],
    }


@router.post("/unit/logout")
def unit_logout(
    request: Request,
    svc: Annotated[ServiceClient, Depends(service_client)],
    x_ssp_unit_token: Annotated[str | None, Header()] = None,
):
    ctx = _load_unit_context(svc, x_ssp_unit_token)
    svc.patch(
        "ssp_unit_sessions",
        json={"status": "revoked", "revoked_at": datetime.now(UTC).isoformat()},
        params={
            "id": f"eq.{ctx['session']['id']}",
            "workspace_id": f"eq.{ctx['session']['workspace_id']}",
            "status": "eq.active",
        },
    )
    _write_unit_audit(
        svc,
        workspace_id=str(ctx["session"]["workspace_id"]),
        action="ssp.unit_session.logout",
        entity_type="ssp_unit_session",
        entity_id=str(ctx["session"]["id"]),
        metadata={"site_pk": str(ctx["site"]["id"])},
        request=request,
    )
    return {"ok": True}


@router.get("/unit/forms")
def unit_forms(
    svc: Annotated[ServiceClient, Depends(service_client)],
    x_ssp_unit_token: Annotated[str | None, Header()] = None,
):
    ctx = _load_unit_context(svc, x_ssp_unit_token)
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
    items = []
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
        items.append(
            {
                "assignment_id": a["id"],
                "form_id": a.get("form_id"),
                "form_title": form.get("title"),
                "site_id": site["id"],
                "site_name": site.get("name"),
                "status": a.get("status"),
                "starts_at": a.get("starts_at"),
                "due_at": a.get("due_at"),
                "fill_status": bucket,
                "submission_id": subs[0].get("id") if subs else None,
            }
        )
    return {"items": items, "data_mode": "live" if items else "empty", "identity": "unit"}


@router.get("/unit/assignments/{assignment_id}")
def unit_assignment_detail(
    assignment_id: UUID,
    svc: Annotated[ServiceClient, Depends(service_client)],
    x_ssp_unit_token: Annotated[str | None, Header()] = None,
):
    ctx = _load_unit_context(svc, x_ssp_unit_token)
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
        "definition_snapshot": snapshot,
        "site": {"id": ctx["site"]["id"], "name": ctx["site"].get("name")},
        "identity": "unit",
    }


@router.post("/unit/assignments/{assignment_id}/submit")
def unit_submit(
    assignment_id: UUID,
    body: UnitSubmitIn,
    request: Request,
    svc: Annotated[ServiceClient, Depends(service_client)],
    x_ssp_unit_token: Annotated[str | None, Header()] = None,
):
    ctx = _load_unit_context(svc, x_ssp_unit_token)
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
    start = parse_dt(row.get("starts_at"))
    if start and start > datetime.now(UTC):
        raise ApiError(400, "BUSINESS_RULE", "ההקצאה טרם החלה")
    existing = as_list(
        svc.get(
            "ssp_form_submissions",
            params={
                "workspace_id": f"eq.{ctx['site']['workspace_id']}",
                "site_assignment_id": f"eq.{assignment_id}",
                "select": "id,submitted_by,unit_session_id,device_id",
            },
        )
    )
    if duplicate_submit_blocked(
        filler_mode=str(row.get("filler_mode") or "site"),
        existing_for_assignment=bool(existing),
        existing_for_user=any(str(s.get("unit_session_id")) == str(ctx["session"]["id"]) for s in existing),
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
                "unit_session_id": ctx["session"]["id"],
            },
            params={"select": SUBMISSION_SELECT},
        ),
        "הטופס כבר הוגש להקצאה זו",
    )
    _write_unit_audit(
        svc,
        workspace_id=str(ctx["site"]["workspace_id"]),
        action="ssp.unit_form.submit",
        entity_type="ssp_form_submission",
        entity_id=str(created.get("id")),
        metadata={
            "site_pk": str(ctx["site"]["id"]),
            "site_assignment_id": str(assignment_id),
            "session_id": ctx["session"]["id"],
        },
        request=request,
    )
    return created
