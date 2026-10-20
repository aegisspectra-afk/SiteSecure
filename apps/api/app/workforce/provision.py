"""Manager-provisioned employee + Auth user (Stage 2).

Passwords are accepted in-memory only and sent to GoTrue Admin. They are never
written to business tables, audit metadata, or exception details.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import uuid4

from ..authz.limits import evaluate_seat_limit, raise_plan_limit
from ..errors import ApiError, MESSAGES
from ..identity import is_workforce_only_principal
from ..rest import schema_missing
from ..user_archive import AUTH_BAN_DURATION, raise_if_email_archived
from ..workspace_rbac import WORKFORCE_MEMBER_ROLE

USERNAME_RE = re.compile(r"^[a-z][a-z0-9._-]{2,62}$")
PRODUCT_ROLES = frozenset(
    {
        "org_admin",
        "national_manager",
        "regional_manager",
        "site_manager",
        "scheduler",
        "employee",
        "payroll",
        "auditor",
    }
)
EMPLOYEE_SELECT = (
    "id,workspace_id,user_id,membership_id,employee_number,first_name,last_name,"
    "phone,email,username,employment_status,position_id,region_id,site_id,"
    "hire_date,must_change_password,created_at,updated_at"
)


class WorkforceStore(Protocol):
    def get(self, path: str, params: dict | None = None) -> Any: ...
    def post(self, path: str, json: dict | list | None = None, params: dict | None = None) -> Any: ...
    def patch(self, path: str, json: dict, params: dict | None = None, *, prefer: str | None = None) -> Any: ...
    def delete(self, path: str, params: dict | None = None) -> Any: ...
    def auth_admin_create_user(self, body: dict) -> Any: ...
    def auth_admin_delete_user(self, user_id: str) -> Any: ...
    def auth_admin_update_user(self, user_id: str, body: dict) -> Any: ...
    def auth_admin_get_user(self, user_id: str) -> Any: ...
    def auth_admin_get_user_by_email(self, email: str) -> Any: ...


@dataclass
class CreateEmployeeInput:
    first_name: str
    last_name: str
    email: str
    username: str
    password: str
    phone: str | None = None
    employee_number: str | None = None
    product_role: str = "employee"
    position_id: str | None = None
    region_id: str | None = None
    site_id: str | None = None
    hire_date: str | None = None

    def __repr__(self) -> str:
        return (
            f"CreateEmployeeInput(first_name={self.first_name!r}, last_name={self.last_name!r}, "
            f"email={self.email!r}, username={self.username!r}, password='***')"
        )


@dataclass
class _Trace:
    created_auth_id: str | None = None
    created_membership_id: str | None = None
    created_employee_id: str | None = None
    created_wf_membership_id: str | None = None
    linked_employee_id: str | None = None
    notes: list[str] = field(default_factory=list)


def _conflict(code: str = "WORKFORCE_ACCOUNT_CONFLICT") -> ApiError:
    return ApiError(409, code, MESSAGES.get(code, MESSAGES["WORKFORCE_ACCOUNT_CONFLICT"]))


def _validation(message: str, **details: object) -> ApiError:
    clean = {k: v for k, v in details.items() if k != "password"}
    return ApiError(400, "VALIDATION_ERROR", message, clean or None)


def _norm_email(value: str) -> str:
    return value.strip().lower()


def _norm_username(value: str) -> str:
    return value.strip().lower()


def _optional(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


def _rows(res: Any) -> list[dict]:
    status = getattr(res, "status_code", None)
    if status == 200:
        data = res.json() if callable(getattr(res, "json", None)) else None
        return data if isinstance(data, list) else []
    if schema_missing(res):
        raise ApiError(503, "WORKFORCE_SCHEMA_UNAVAILABLE", MESSAGES["WORKFORCE_SCHEMA_UNAVAILABLE"])
    return []


def _json_obj(res: Any) -> dict:
    if getattr(res, "status_code", None) not in {200, 201}:
        return {}
    data = res.json() if callable(getattr(res, "json", None)) else None
    return data if isinstance(data, dict) else {}


def _created(res: Any) -> dict | None:
    status = getattr(res, "status_code", None)
    if status not in {200, 201}:
        return None
    data = res.json() if callable(getattr(res, "json", None)) else None
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict) and data:
        return data
    return None


def _unique_violation(res: Any) -> bool:
    text = (getattr(res, "text", None) or "").lower()
    code = ""
    try:
        body = res.json() if callable(getattr(res, "json", None)) else None
        if isinstance(body, dict):
            code = str(body.get("code") or "")
            text = f"{text} {body.get('message') or ''}".lower()
    except Exception:
        pass
    return code == "23505" or "duplicate" in text or "unique" in text


def validate_create_input(raw: CreateEmployeeInput) -> CreateEmployeeInput:
    first = (raw.first_name or "").strip()
    last = (raw.last_name or "").strip()
    if len(first) < 1 or len(last) < 1:
        raise _validation("יש למלא שם פרטי ושם משפחה")
    email = _norm_email(raw.email or "")
    if "@" not in email or "." not in email.split("@")[-1] or len(email) < 5:
        raise _validation("כתובת דוא״ל אינה תקינה")
    username = _norm_username(raw.username or "")
    if not USERNAME_RE.match(username):
        raise _validation("שם משתמש תפעולי: 3–63 תווים, אות לטינית תחילה, ואז אותיות מספרים . _ -")
    password = raw.password or ""
    if len(password) < 8 or len(password) > 128:
        raise _validation("הסיסמה חייבת להיות בין 8 ל־128 תווים")
    if password.lower() in {email, username}:
        raise _validation("הסיסמה אינה יכולה להיות זהה לדוא״ל או לשם המשתמש")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise _validation("הסיסמה חייבת לכלול אות ומספר")
    product_role = (raw.product_role or "employee").strip() or "employee"
    if product_role not in PRODUCT_ROLES:
        raise _validation("תפקיד Workforce אינו תקין")
    hire_date = _optional(raw.hire_date)
    if hire_date and not re.match(r"^\d{4}-\d{2}-\d{2}$", hire_date):
        raise _validation("תאריך תחילה חייב להיות YYYY-MM-DD")
    return CreateEmployeeInput(
        first_name=first,
        last_name=last,
        email=email,
        username=username,
        password=password,
        phone=_optional(raw.phone),
        employee_number=_optional(raw.employee_number),
        product_role=product_role,
        position_id=_optional(raw.position_id),
        region_id=_optional(raw.region_id),
        site_id=_optional(raw.site_id),
        hire_date=hire_date,
    )


def employee_out(row: dict) -> dict[str, Any]:
    return {
        "id": str(row.get("id") or ""),
        "workspace_id": str(row.get("workspace_id") or ""),
        "user_id": str(row["user_id"]) if row.get("user_id") else None,
        "membership_id": str(row["membership_id"]) if row.get("membership_id") else None,
        "employee_number": row.get("employee_number"),
        "first_name": row.get("first_name") or "",
        "last_name": row.get("last_name") or "",
        "phone": row.get("phone"),
        "email": row.get("email"),
        "username": row.get("username"),
        "employment_status": row.get("employment_status") or "active",
        "position_id": str(row["position_id"]) if row.get("position_id") else None,
        "region_id": str(row["region_id"]) if row.get("region_id") else None,
        "site_id": str(row["site_id"]) if row.get("site_id") else None,
        "hire_date": row.get("hire_date"),
        "must_change_password": bool(row.get("must_change_password", True)),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "account_status": "linked" if row.get("user_id") else "no_account",
    }


def _get_one(service: WorkforceStore, table: str, params: dict[str, str]) -> dict | None:
    query = dict(params)
    query.setdefault("select", "*")
    query.setdefault("limit", "1")
    rows = _rows(service.get(table, params=query))
    return rows[0] if rows else None


def _assert_ref(service: WorkforceStore, table: str, workspace_id: str, ref_id: str | None, label: str) -> None:
    if not ref_id:
        return
    row = _get_one(
        service,
        table,
        {"id": f"eq.{ref_id}", "workspace_id": f"eq.{workspace_id}", "select": "id,workspace_id"},
    )
    if not row:
        raise _validation(f"{label} אינו שייך לסביבה זו")


def _memberships_for_user(service: WorkforceStore, user_id: str) -> list[dict]:
    if not user_id:
        return []
    return _rows(
        service.get(
            "workspace_memberships",
            params={
                "user_id": f"eq.{user_id}",
                "select": "id,user_id,workspace_id,role_key,workspace_role_key,status",
                "limit": "500",
            },
        )
    )


def _memberships_or_unknown(service: WorkforceStore, user_id: str) -> list[dict] | None:
    """None means lookup failed — callers must not delete or ban Auth."""
    try:
        return _memberships_for_user(service, user_id)
    except Exception:
        return None


def _compensate(service: WorkforceStore, workspace_id: str, trace: _Trace) -> None:
    """Best-effort rollback. Never deletes Auth if the user belongs to another workspace."""
    if trace.created_wf_membership_id:
        service.delete("workforce_memberships", params={"id": f"eq.{trace.created_wf_membership_id}"})
    if trace.created_employee_id:
        service.delete("workforce_employees", params={"id": f"eq.{trace.created_employee_id}"})
    if trace.linked_employee_id:
        service.patch(
            "workforce_employees",
            {"user_id": None, "membership_id": None},
            params={"id": f"eq.{trace.linked_employee_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    if trace.created_membership_id:
        service.delete("workspace_memberships", params={"id": f"eq.{trace.created_membership_id}"})

    auth_id = trace.created_auth_id
    if not auth_id:
        return
    remaining = _memberships_or_unknown(service, auth_id)
    if remaining is None or remaining:
        return
    deleted = service.auth_admin_delete_user(auth_id)
    status = getattr(deleted, "status_code", None)
    if status in {200, 204, 404}:
        return
    service.auth_admin_update_user(auth_id, {"ban_duration": AUTH_BAN_DURATION})


def _ensure_profile(service: WorkforceStore, user_id: str, *, full_name: str, email: str, phone: str | None) -> None:
    row = _get_one(service, "profiles", {"id": f"eq.{user_id}", "select": "id,email,full_name,phone"})
    if not row:
        created = service.post(
            "profiles",
            {"id": user_id, "full_name": full_name, "email": email, "phone": phone, "locale": "he"},
        )
        if getattr(created, "status_code", None) in {200, 201} or _unique_violation(created):
            return
        raise ApiError(503, "API_UNAVAILABLE", "נוצר חשבון אך הפרופיל חסר")
    patch = {"full_name": full_name, "email": email}
    if phone is not None:
        patch["phone"] = phone
    service.patch("profiles", patch, params={"id": f"eq.{user_id}"})


def _auth_user_payload(res: Any, *, email: str | None = None) -> dict:
    body = _json_obj(res)
    candidates: list[dict] = []
    if body.get("id"):
        candidates.append(body)
    users = body.get("users")
    if isinstance(users, list):
        candidates.extend(item for item in users if isinstance(item, dict) and item.get("id"))
    if email:
        needle = email.strip().lower()
        for item in candidates:
            if str(item.get("email") or "").strip().lower() == needle:
                return item
        return {}
    return candidates[0] if candidates else {}


def _is_workforce_auth_user(body: dict) -> bool:
    return is_workforce_only_principal(body)


def _lookup_workforce_orphan_auth(
    service: WorkforceStore,
    *,
    email: str,
    profile_id: str | None,
) -> str | None:
    """Resume only manager-provisioned workforce Auth with no other-product identity."""
    body: dict = {}
    if profile_id:
        body = _auth_user_payload(service.auth_admin_get_user(profile_id), email=email)
        if not body.get("id"):
            body = _auth_user_payload(service.auth_admin_get_user(profile_id))
    if not body.get("id"):
        body = _auth_user_payload(service.auth_admin_get_user_by_email(email), email=email)
    if not body.get("id") or not _is_workforce_auth_user(body):
        return None
    return str(body["id"])


def _create_auth_user(service: WorkforceStore, payload: CreateEmployeeInput) -> str | None:
    created = service.auth_admin_create_user(
        {
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {"full_name": f"{payload.first_name} {payload.last_name}".strip()},
            "app_metadata": {"workforce_only": True, "provisioned_via": "workforce"},
        }
    )
    status = getattr(created, "status_code", None)
    if status in {200, 201}:
        body = created.json() if callable(getattr(created, "json", None)) else {}
        uid = str((body or {}).get("id") or "")
        if not uid:
            raise ApiError(503, "API_UNAVAILABLE", "יצירת המשתמש ב־Auth לא החזירה מזהה")
        return uid
    text = (getattr(created, "text", None) or "").lower()
    if "already" in text or "registered" in text or "duplicate" in text or status in {409, 422}:
        return None
    raise ApiError(503, "API_UNAVAILABLE", "לא ניתן ליצור את המשתמש ב־Auth")


def _refresh_workforce_password(service: WorkforceStore, user_id: str, password: str) -> None:
    service.auth_admin_update_user(user_id, {"password": password, "ban_duration": "none"})


def _insert_membership(service: WorkforceStore, workspace_id: str, user_id: str) -> str:
    membership_row = _created(
        service.post(
            "workspace_memberships",
            {
                "workspace_id": workspace_id,
                "user_id": user_id,
                "role_key": WORKFORCE_MEMBER_ROLE,
                "workspace_role_key": WORKFORCE_MEMBER_ROLE,
                "status": "active",
            },
        )
    )
    if not membership_row:
        raise ApiError(503, "WORKFORCE_PARTIAL_RECOVERY", MESSAGES["WORKFORCE_PARTIAL_RECOVERY"])
    membership_id = str(membership_row.get("id") or "")
    if not membership_id:
        raise ApiError(503, "WORKFORCE_PARTIAL_RECOVERY", MESSAGES["WORKFORCE_PARTIAL_RECOVERY"])
    return membership_id


def provision_employee_user(
    service: WorkforceStore,
    *,
    workspace_id: str,
    actor_user_id: str,
    payload: CreateEmployeeInput,
    occupied_roles: list[str],
    plan_key: str,
) -> dict[str, Any]:
    data = validate_create_input(payload)
    raise_if_email_archived(service, data.email)  # type: ignore[arg-type]

    _assert_ref(service, "workforce_regions", workspace_id, data.region_id, "האזור")
    _assert_ref(service, "workforce_sites", workspace_id, data.site_id, "האתר")
    _assert_ref(service, "workforce_positions", workspace_id, data.position_id, "התפקיד")
    if data.site_id and data.region_id:
        site = _get_one(
            service,
            "workforce_sites",
            {"id": f"eq.{data.site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id,region_id"},
        )
        if site and site.get("region_id") and str(site["region_id"]) != data.region_id:
            raise _validation("האתר אינו שייך לאזור שנבחר")

    username_hit = _get_one(
        service,
        "workforce_employees",
        {
            "workspace_id": f"eq.{workspace_id}",
            "username": f"eq.{data.username}",
            "select": "id,user_id,username,email",
        },
    )
    if username_hit and username_hit.get("user_id"):
        raise ApiError(409, "WORKFORCE_USERNAME_TAKEN", MESSAGES["WORKFORCE_USERNAME_TAKEN"])

    email_hit = _get_one(
        service,
        "workforce_employees",
        {
            "workspace_id": f"eq.{workspace_id}",
            "email": f"eq.{data.email}",
            "select": "id,user_id,email,username",
        },
    )
    if email_hit and username_hit and str(email_hit.get("id")) != str(username_hit.get("id")):
        raise _conflict()
    if email_hit and email_hit.get("user_id"):
        raise _conflict()
    if data.employee_number:
        number_hit = _get_one(
            service,
            "workforce_employees",
            {
                "workspace_id": f"eq.{workspace_id}",
                "employee_number": f"eq.{data.employee_number}",
                "select": "id,employee_number,user_id",
            },
        )
        resume_id = str((username_hit or email_hit or {}).get("id") or "")
        if number_hit and str(number_hit.get("id")) != resume_id:
            raise ApiError(409, "WORKFORCE_USERNAME_TAKEN", "מספר עובד כבר בשימוש בסביבה זו")

    profile = _get_one(service, "profiles", {"email": f"eq.{data.email}", "select": "id,email,archived_at"})
    existing_user_id = str(profile["id"]) if profile else None
    memberships = _memberships_for_user(service, existing_user_id) if existing_user_id else []
    this_membership = next(
        (row for row in memberships if str(row.get("workspace_id")) == workspace_id),
        None,
    )
    other_memberships = [row for row in memberships if str(row.get("workspace_id")) != workspace_id]
    if other_memberships:
        raise ApiError(409, "WORKFORCE_CROSS_TENANT", MESSAGES["WORKFORCE_ACCOUNT_CONFLICT"])

    resume_membership_id: str | None = None
    resume_user_id: str | None = None
    created_new_auth = False

    if this_membership:
        role_key = str(this_membership.get("role_key") or "")
        workspace_role_key = str(this_membership.get("workspace_role_key") or role_key)
        if WORKFORCE_MEMBER_ROLE not in {role_key, workspace_role_key}:
            raise _conflict()
        emp_for_user = _get_one(
            service,
            "workforce_employees",
            {
                "workspace_id": f"eq.{workspace_id}",
                "user_id": f"eq.{existing_user_id}",
                "select": EMPLOYEE_SELECT,
            },
        )
        if emp_for_user:
            raise _conflict()
        resume_user_id = existing_user_id
        resume_membership_id = str(this_membership.get("id") or "")
        if not resume_membership_id:
            raise _conflict()
    elif existing_user_id:
        orphan_id = _lookup_workforce_orphan_auth(
            service, email=data.email, profile_id=existing_user_id
        )
        if not orphan_id or orphan_id != existing_user_id:
            raise _conflict()
        resume_user_id = orphan_id
    else:
        created_id = _create_auth_user(service, data)
        if created_id:
            resume_user_id = created_id
            created_new_auth = True
        else:
            orphan_id = _lookup_workforce_orphan_auth(service, email=data.email, profile_id=None)
            if not orphan_id:
                raise _conflict()
            leftover = _memberships_for_user(service, orphan_id)
            if leftover:
                raise _conflict()
            resume_user_id = orphan_id

    if not resume_user_id:
        raise _conflict()

    if not resume_membership_id:
        limit = evaluate_seat_limit(
            plan_key=plan_key,
            invite_role=WORKFORCE_MEMBER_ROLE,
            occupied_roles=occupied_roles,
        )
        raise_plan_limit(limit)

    resume_employee = username_hit or email_hit
    trace = _Trace(created_auth_id=resume_user_id if created_new_auth else None)

    try:
        user_id = resume_user_id
        if not created_new_auth:
            _refresh_workforce_password(service, user_id, data.password)
        _ensure_profile(
            service,
            user_id,
            full_name=f"{data.first_name} {data.last_name}".strip(),
            email=data.email,
            phone=data.phone,
        )
        if resume_membership_id:
            membership_id = resume_membership_id
        else:
            membership_id = _insert_membership(service, workspace_id, user_id)
            trace.created_membership_id = membership_id

        employee_body: dict[str, Any] = {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "membership_id": membership_id or None,
            "employee_number": data.employee_number,
            "first_name": data.first_name,
            "last_name": data.last_name,
            "phone": data.phone,
            "email": data.email,
            "username": data.username,
            "employment_status": "active",
            "position_id": data.position_id,
            "region_id": data.region_id,
            "site_id": data.site_id,
            "hire_date": data.hire_date,
            "must_change_password": True,
            "created_by": actor_user_id,
        }
        employee_row: dict | None = None
        if resume_employee and not resume_employee.get("user_id"):
            patched = service.patch(
                "workforce_employees",
                {k: v for k, v in employee_body.items() if k != "workspace_id"},
                params={"id": f"eq.{resume_employee['id']}", "workspace_id": f"eq.{workspace_id}"},
            )
            employee_row = _created(patched) or _get_one(
                service,
                "workforce_employees",
                {"id": f"eq.{resume_employee['id']}", "select": EMPLOYEE_SELECT},
            )
            trace.linked_employee_id = str(resume_employee["id"])
        else:
            posted = service.post("workforce_employees", employee_body)
            if _unique_violation(posted):
                raise ApiError(409, "WORKFORCE_USERNAME_TAKEN", MESSAGES["WORKFORCE_USERNAME_TAKEN"])
            if schema_missing(posted) and "must_change_password" in (getattr(posted, "text", "") or ""):
                fallback = dict(employee_body)
                fallback.pop("must_change_password", None)
                posted = service.post("workforce_employees", fallback)
            employee_row = _created(posted)
            if employee_row and employee_row.get("id"):
                trace.created_employee_id = str(employee_row["id"])
        if not employee_row:
            raise ApiError(503, "WORKFORCE_PARTIAL_RECOVERY", MESSAGES["WORKFORCE_PARTIAL_RECOVERY"])

        wf_existing = _get_one(
            service,
            "workforce_memberships",
            {"workspace_id": f"eq.{workspace_id}", "user_id": f"eq.{user_id}", "select": "id"},
        )
        if not wf_existing:
            wf_row = _created(
                service.post(
                    "workforce_memberships",
                    {
                        "workspace_id": workspace_id,
                        "user_id": user_id,
                        "employee_id": employee_row.get("id"),
                        "product_role": data.product_role,
                        "region_id": data.region_id,
                        "site_id": data.site_id,
                        "status": "active",
                    },
                )
            )
            if wf_row and wf_row.get("id"):
                trace.created_wf_membership_id = str(wf_row["id"])
            elif not wf_row:
                raise ApiError(503, "WORKFORCE_PARTIAL_RECOVERY", MESSAGES["WORKFORCE_PARTIAL_RECOVERY"])

        if not employee_row.get("must_change_password") and "must_change_password" not in employee_row:
            employee_row["must_change_password"] = True
        return employee_out(employee_row)
    except ApiError:
        _compensate(service, workspace_id, trace)
        raise
    except Exception as exc:
        _compensate(service, workspace_id, trace)
        raise ApiError(503, "WORKFORCE_PARTIAL_RECOVERY", MESSAGES["WORKFORCE_PARTIAL_RECOVERY"]) from exc


def disable_employee_user(
    service: WorkforceStore,
    *,
    workspace_id: str,
    employee_id: str,
    actor_user_id: str,
) -> dict[str, Any]:
    row = _get_one(
        service,
        "workforce_employees",
        {"id": f"eq.{employee_id}", "workspace_id": f"eq.{workspace_id}", "select": EMPLOYEE_SELECT},
    )
    if not row:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    user_id = str(row["user_id"]) if row.get("user_id") else None
    if user_id and user_id == actor_user_id:
        raise ApiError(403, "WORKFORCE_SELF_DISABLE", MESSAGES["WORKFORCE_SELF_DISABLE"])

    patched = service.patch(
        "workforce_employees",
        {"employment_status": "inactive"},
        params={"id": f"eq.{employee_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    updated = _created(patched) or {**row, "employment_status": "inactive"}
    service.patch(
        "workforce_memberships",
        {"status": "disabled"},
        params={"workspace_id": f"eq.{workspace_id}", "employee_id": f"eq.{employee_id}"},
    )
    if user_id:
        service.patch(
            "workspace_memberships",
            {"status": "disabled"},
            params={"workspace_id": f"eq.{workspace_id}", "user_id": f"eq.{user_id}"},
        )
        remaining = _memberships_or_unknown(service, user_id)
        if remaining is None:
            return employee_out(updated)
        others = [
            m
            for m in remaining
            if str(m.get("workspace_id")) != workspace_id and str(m.get("status") or "") == "active"
        ]
        if others:
            return employee_out(updated)
        service.auth_admin_update_user(user_id, {"ban_duration": AUTH_BAN_DURATION})
    return employee_out(updated)


def new_request_id() -> str:
    return str(uuid4())
