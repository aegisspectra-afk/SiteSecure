from __future__ import annotations

import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..deps import service_client
from ..errors import ApiError, MESSAGES
from ..rest import as_list, one_or_404
from ..ssp.forms_schema import validate_answers
from ..ssp.tokens import hash_public_token, verify_access_code
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/public/ssp", tags=["public-ssp"])

# In-process rate limit for access-code attempts (token+IP).
# Limitation: not shared across API instances — see apps/api/app/ssp/RATE_LIMIT.md
_code_failures: dict[str, deque[float]] = defaultdict(deque)
_CODE_WINDOW_SEC = 300
_CODE_MAX_FAILS = 12

VERSION_SELECT = "id,workspace_id,form_id,version,status,definition,published_at"
ASSIGNMENT_SELECT = (
    "id,workspace_id,form_id,form_version_id,label,require_account,status,"
    "expires_at,max_submissions,submission_count,access_code_hash,revoked_at,completed_at"
)
FORM_SELECT = "id,workspace_id,title,description,status"

# Idempotency semantics (public submit):
# - Absent/blank idempotency_key: each successful call creates a new submission
#   (subject to max_submissions / assignment state).
# - Non-empty key scoped to the assignment: first success creates the row; later
#   calls with the same key return the original id/status/submitted_at with
#   replayed=true and do not increment submission_count again.
# - Concurrent identical keys: DB unique index + ssp_public_submit resolves to one row.


class UnlockIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_code: str = Field(min_length=1, max_length=64)


class SubmitIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_code: str | None = Field(default=None, max_length=64)
    answers: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, max_length=128)


def _client_key(request: Request, token: str) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    ip = forwarded or (request.client.host if request.client else "unknown")
    return f"{hash_public_token(token)[:16]}:{ip}"


def _check_code_rate(request: Request, token: str) -> None:
    key = _client_key(request, token)
    now = time.time()
    window = _code_failures[key]
    while window and now - window[0] > _CODE_WINDOW_SEC:
        window.popleft()
    if len(window) >= _CODE_MAX_FAILS:
        raise ApiError(429, "RATE_LIMITED", "יותר מדי ניסיונות. נסו שוב מאוחר יותר.")


def _record_code_failure(request: Request, token: str) -> None:
    _code_failures[_client_key(request, token)].append(time.time())


def _load_assignment(svc: ServiceClient, token: str) -> dict:
    digest = hash_public_token(token.strip())
    rows = as_list(
        svc.get(
            "ssp_form_assignments",
            params={"token_hash": f"eq.{digest}", "select": ASSIGNMENT_SELECT},
        )
    )
    if not rows:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return rows[0]


def _assignment_usable(assignment: dict) -> None:
    if assignment.get("status") == "revoked" or assignment.get("revoked_at"):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    if assignment.get("status") == "expired":
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    if assignment.get("status") == "completed":
        raise ApiError(400, "BUSINESS_RULE", "השיוך הושלם ולא מקבל הגשות נוספות")
    expires = assignment.get("expires_at")
    if expires:
        try:
            exp = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=UTC)
            if exp < datetime.now(UTC):
                raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
        except ApiError:
            raise
        except Exception:
            pass
    max_sub = assignment.get("max_submissions")
    count = int(assignment.get("submission_count") or 0)
    if max_sub is not None and count >= int(max_sub):
        raise ApiError(400, "BUSINESS_RULE", "הגעתם למגבלת ההגשות עבור קישור זה")


def _require_code_if_needed(
    request: Request,
    token: str,
    assignment: dict,
    access_code: str | None,
) -> None:
    stored = assignment.get("access_code_hash")
    if not stored:
        return
    _check_code_rate(request, token)
    if not access_code or not verify_access_code(access_code, stored):
        _record_code_failure(request, token)
        raise ApiError(403, "PERMISSION_DENIED", "קוד גישה שגוי או חסר")


def _public_form_payload(svc: ServiceClient, assignment: dict) -> dict:
    form = one_or_404(
        svc.get(
            "ssp_forms",
            params={
                "id": f"eq.{assignment['form_id']}",
                "workspace_id": f"eq.{assignment['workspace_id']}",
                "select": FORM_SELECT,
            },
        )
    )
    if form.get("status") == "archived":
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    version = one_or_404(
        svc.get(
            "ssp_form_versions",
            params={
                "id": f"eq.{assignment['form_version_id']}",
                "workspace_id": f"eq.{assignment['workspace_id']}",
                "select": VERSION_SELECT,
            },
        )
    )
    if version.get("status") != "published":
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    # Minimal public surface: no workspace_id, no assignment_id, no hashes.
    return {
        "form_title": form.get("title"),
        "form_description": form.get("description") or "",
        "version": version.get("version"),
        "definition": version.get("definition") or {"fields": []},
        "require_account": bool(assignment.get("require_account")),
    }


def _map_submit_rpc_error(res) -> ApiError:
    text = (getattr(res, "text", None) or "")[:500]
    if "SSP_ASSIGNMENT_REVOKED" in text or "SSP_ASSIGNMENT_EXPIRED" in text or "SSP_ASSIGNMENT_NOT_FOUND" in text:
        return ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    if "SSP_ASSIGNMENT_LIMIT" in text or "SSP_ASSIGNMENT_COMPLETED" in text:
        return ApiError(400, "BUSINESS_RULE", "הגעתם למגבלת ההגשות עבור קישור זה")
    return ApiError(400, "BUSINESS_RULE", MESSAGES["BUSINESS_RULE"])


@router.get("/assignments/{token}")
def peek_assignment(
    token: str,
    request: Request,
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    assignment = _load_assignment(svc, token)
    _assignment_usable(assignment)
    needs_code = bool(assignment.get("access_code_hash"))
    form = one_or_404(
        svc.get(
            "ssp_forms",
            params={
                "id": f"eq.{assignment['form_id']}",
                "workspace_id": f"eq.{assignment['workspace_id']}",
                "select": "title,description,status",
            },
        )
    )
    if form.get("status") == "archived":
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    if assignment.get("require_account"):
        raise ApiError(400, "BUSINESS_RULE", "שיוך זה דורש התחברות — לא נתמך בגרסה זו")
    base = {
        "requires_access_code": needs_code,
        "form_title": form.get("title"),
        "form_description": form.get("description") or "",
        "status": "ready",
    }
    if needs_code:
        return base
    return {**base, **_public_form_payload(svc, assignment)}


@router.post("/assignments/{token}/unlock")
def unlock_assignment(
    token: str,
    body: UnlockIn,
    request: Request,
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    assignment = _load_assignment(svc, token)
    _assignment_usable(assignment)
    if assignment.get("require_account"):
        raise ApiError(400, "BUSINESS_RULE", "שיוך זה דורש התחברות — לא נתמך בגרסה זו")
    if not assignment.get("access_code_hash"):
        return _public_form_payload(svc, assignment)
    _require_code_if_needed(request, token, assignment, body.access_code)
    return _public_form_payload(svc, assignment)


@router.post("/assignments/{token}/submit", status_code=201)
def submit_assignment(
    token: str,
    body: SubmitIn,
    request: Request,
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    assignment = _load_assignment(svc, token)
    _assignment_usable(assignment)
    if assignment.get("require_account"):
        raise ApiError(400, "BUSINESS_RULE", "שיוך זה דורש התחברות — לא נתמך בגרסה זו")
    _require_code_if_needed(request, token, assignment, body.access_code)

    version = one_or_404(
        svc.get(
            "ssp_form_versions",
            params={
                "id": f"eq.{assignment['form_version_id']}",
                "workspace_id": f"eq.{assignment['workspace_id']}",
                "select": VERSION_SELECT,
            },
        )
    )
    if version.get("status") != "published":
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])

    definition = version.get("definition") or {"fields": []}
    answers, consent = validate_answers(definition, body.answers)

    res = svc.rpc(
        "ssp_public_submit",
        {
            "p_assignment_id": assignment["id"],
            "p_answers": answers,
            "p_consent": consent,
            "p_definition_snapshot": definition,
            "p_idempotency_key": (body.idempotency_key or "").strip() or None,
        },
    )
    if res.status_code not in {200, 201}:
        raise _map_submit_rpc_error(res)

    data = res.json() if res.content else {}
    if isinstance(data, list) and data:
        data = data[0]
    if not isinstance(data, dict) or not data.get("id"):
        raise ApiError(400, "BUSINESS_RULE", MESSAGES["BUSINESS_RULE"])

    # Best-effort audit; do not include answers or codes.
    try:
        svc.rpc(
            "write_audit_log",
            {
                "p_workspace_id": assignment["workspace_id"],
                "p_action": "ssp.submission.create",
                "p_entity_type": "ssp_submission",
                "p_entity_id": data["id"],
                "p_metadata": {
                    "form_id": assignment["form_id"],
                    "form_version_id": assignment["form_version_id"],
                    "replayed": bool(data.get("replayed")),
                },
            },
        )
    except Exception:
        pass

    return {
        "id": data["id"],
        "status": data.get("status") or "submitted",
        "submitted_at": data.get("submitted_at"),
        "replayed": bool(data.get("replayed")),
    }
