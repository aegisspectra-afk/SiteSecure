"""SSP manager-provisioned user: Auth Admin + workspace + product role + office.

Passwords are accepted in-memory only and sent to GoTrue Admin. They are never
written to business tables, audit metadata, or exception details.
Auth users created in this request are never deleted on a later failure.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from ..authz.limits import evaluate_seat_limit, raise_plan_limit
from ..errors import ApiError, MESSAGES
from ..rest import schema_missing
from ..user_archive import raise_if_email_archived

PRODUCT_ROLES = frozenset({"org_admin", "patrol_manager", "patrol_officer"})
ProductRole = Literal["org_admin", "patrol_manager", "patrol_officer"]

WORKSPACE_ROLE_FOR_PRODUCT: dict[str, str] = {
    "org_admin": "manager",
    "patrol_manager": "manager",
    "patrol_officer": "technician",
}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SspStore(Protocol):
    def get(self, path: str, params: dict | None = None) -> Any: ...
    def post(self, path: str, json: dict | list | None = None, params: dict | None = None) -> Any: ...
    def patch(self, path: str, json: dict, params: dict | None = None, *, prefer: str | None = None) -> Any: ...
    def auth_admin_create_user(self, body: dict) -> Any: ...
    def auth_admin_get_user_by_email(self, email: str) -> Any: ...
    def auth_admin_get_user(self, user_id: str) -> Any: ...


@dataclass
class CreateSspUserInput:
    full_name: str
    email: str
    password: str
    product_role: ProductRole = "patrol_officer"
    phone: str | None = None
    site_pk: str | None = None
    org_unit_id: str | None = None
    department_id: str | None = None
    manager_user_id: str | None = None

    def __repr__(self) -> str:
        return (
            f"CreateSspUserInput(full_name={self.full_name!r}, email={self.email!r}, "
            f"product_role={self.product_role!r}, site_pk={self.site_pk!r}, password='***')"
        )


def _conflict(message: str | None = None) -> ApiError:
    return ApiError(409, "SSP_ACCOUNT_CONFLICT", message or MESSAGES["SSP_ACCOUNT_CONFLICT"])


def _validation(message: str, **details: object) -> ApiError:
    clean = {k: v for k, v in details.items() if k != "password"}
    return ApiError(400, "VALIDATION_ERROR", message, clean or None)


def _partial(message: str | None = None, **details: object) -> ApiError:
    clean = {k: v for k, v in details.items() if k != "password"}
    return ApiError(503, "SSP_PARTIAL_RECOVERY", message or MESSAGES["SSP_PARTIAL_RECOVERY"], clean or None)


def _norm_email(value: str) -> str:
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
        raise ApiError(503, "SSP_SCHEMA_UNAVAILABLE", MESSAGES["SSP_SCHEMA_UNAVAILABLE"])
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


def _get_one(store: SspStore, table: str, params: dict[str, str]) -> dict | None:
    rows = _rows(store.get(table, params=params))
    return rows[0] if rows else None


def validate_create_input(raw: CreateSspUserInput) -> CreateSspUserInput:
    name = (raw.full_name or "").strip()
    if len(name) < 2:
        raise _validation("יש למלא שם מלא")
    email = _norm_email(raw.email or "")
    if not _EMAIL_RE.match(email) or len(email) < 5:
        raise _validation("כתובת דוא״ל אינה תקינה")
    password = raw.password or ""
    if len(password) < 8 or len(password) > 128:
        raise _validation("הסיסמה חייבת להיות בין 8 ל־128 תווים")
    if password.lower() in {email, name.lower()}:
        raise _validation("הסיסמה אינה יכולה להיות זהה לדוא״ל או לשם")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise _validation("הסיסמה חייבת לכלול אות ומספר")
    role = (raw.product_role or "patrol_officer").strip()
    if role not in PRODUCT_ROLES:
        raise _validation("תפקיד SSP אינו תקין")
    return CreateSspUserInput(
        full_name=name,
        email=email,
        password=password,
        product_role=role,  # type: ignore[arg-type]
        phone=_optional(raw.phone),
        site_pk=_optional(raw.site_pk),
        org_unit_id=_optional(raw.org_unit_id),
        department_id=_optional(raw.department_id),
        manager_user_id=_optional(raw.manager_user_id),
    )


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


def _create_auth_user(store: SspStore, payload: CreateSspUserInput) -> str | None:
    created = store.auth_admin_create_user(
        {
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {"full_name": payload.full_name},
            "app_metadata": {"provisioned_via": "ssp"},
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


def _lookup_auth_by_email(store: SspStore, email: str) -> str | None:
    body = _auth_user_payload(store.auth_admin_get_user_by_email(email), email=email)
    uid = str(body.get("id") or "")
    return uid or None


def _ensure_profile(store: SspStore, user_id: str, *, full_name: str, email: str, phone: str | None) -> None:
    row = _get_one(store, "profiles", {"id": f"eq.{user_id}", "select": "id,email,full_name,phone"})
    if not row:
        created = store.post(
            "profiles",
            {"id": user_id, "full_name": full_name, "email": email, "phone": phone, "locale": "he"},
        )
        if getattr(created, "status_code", None) in {200, 201} or _unique_violation(created):
            return
        raise _partial("נוצר חשבון אך הפרופיל חסר", user_id=user_id)
    patch = {"full_name": full_name, "email": email}
    if phone is not None:
        patch["phone"] = phone
    store.patch("profiles", patch, params={"id": f"eq.{user_id}"})


def _memberships_for_user(store: SspStore, user_id: str | None) -> list[dict]:
    if not user_id:
        return []
    return _rows(
        store.get(
            "workspace_memberships",
            params={"user_id": f"eq.{user_id}", "select": "id,workspace_id,user_id,role_key,status"},
        )
    )


def _insert_workspace_membership(store: SspStore, workspace_id: str, user_id: str, role_key: str) -> str:
    row = _created(
        store.post(
            "workspace_memberships",
            {
                "workspace_id": workspace_id,
                "user_id": user_id,
                "role_key": role_key,
                "workspace_role_key": role_key,
                "status": "active",
            },
        )
    )
    if not row:
        raise _partial("החשבון נוצר אך השיוך לסביבה נכשל", user_id=user_id)
    mid = str(row.get("id") or "")
    if not mid:
        raise _partial("החשבון נוצר אך השיוך לסביבה נכשל", user_id=user_id)
    return mid


def _upsert_ssp_membership(
    store: SspStore,
    *,
    workspace_id: str,
    company_pk: str,
    user_id: str,
    actor_user_id: str,
    payload: CreateSspUserInput,
) -> dict[str, Any]:
    existing = _get_one(
        store,
        "ssp_memberships",
        {
            "workspace_id": f"eq.{workspace_id}",
            "company_pk": f"eq.{company_pk}",
            "user_id": f"eq.{user_id}",
            "select": "id,workspace_id,company_pk,user_id,org_unit_id,department_id,product_role,manager_user_id,status",
        },
    )
    body: dict[str, Any] = {
        "org_unit_id": payload.org_unit_id,
        "department_id": payload.department_id,
        "product_role": payload.product_role,
        "manager_user_id": payload.manager_user_id,
        "status": "active",
    }
    if existing:
        patched = store.patch(
            "ssp_memberships",
            body,
            params={"id": f"eq.{existing['id']}", "workspace_id": f"eq.{workspace_id}"},
        )
        rows = _rows(patched) if getattr(patched, "status_code", None) in {200, 204} else []
        if rows:
            return rows[0]
        if getattr(patched, "status_code", None) in {200, 204}:
            return {**existing, **body}
        raise _partial("החשבון נוצר אך שיוך SSP נכשל", user_id=user_id)
    created = _created(
        store.post(
            "ssp_memberships",
            {
                "workspace_id": workspace_id,
                "company_pk": company_pk,
                "user_id": user_id,
                "created_by": actor_user_id,
                **body,
            },
        )
    )
    if not created:
        raise _partial("החשבון נוצר אך שיוך SSP נכשל", user_id=user_id)
    return created


def _ensure_site_member(store: SspStore, *, workspace_id: str, site_pk: str, user_id: str) -> None:
    existing = _get_one(
        store,
        "ssp_site_members",
        {
            "workspace_id": f"eq.{workspace_id}",
            "site_pk": f"eq.{site_pk}",
            "user_id": f"eq.{user_id}",
            "select": "id",
        },
    )
    if existing:
        return
    created = store.post(
        "ssp_site_members",
        {"workspace_id": workspace_id, "site_pk": site_pk, "user_id": user_id},
    )
    if getattr(created, "status_code", None) in {200, 201} or _unique_violation(created):
        return
    raise _partial("החשבון נוצר אך השיוך למשרד נכשל", user_id=user_id, site_pk=site_pk)


def person_out(
    *,
    membership: dict[str, Any],
    profile: dict[str, Any] | None,
    workspace_role_key: str | None,
    sites: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "user_id": str(membership.get("user_id") or ""),
        "full_name": (profile or {}).get("full_name"),
        "email": (profile or {}).get("email"),
        "phone": (profile or {}).get("phone"),
        "product_role": membership.get("product_role"),
        "status": membership.get("status") or "active",
        "workspace_role_key": workspace_role_key,
        "org_unit_id": membership.get("org_unit_id"),
        "department_id": membership.get("department_id"),
        "manager_user_id": membership.get("manager_user_id"),
        "sites": sites,
        "created_at": membership.get("created_at"),
        "ssp_membership_id": membership.get("id"),
    }


def provision_ssp_user(
    store: SspStore,
    *,
    workspace_id: str,
    company_pk: str,
    actor_user_id: str,
    payload: CreateSspUserInput,
    occupied_roles: list[str],
    plan_key: str,
    extra_seats: int = 0,
) -> dict[str, Any]:
    data = validate_create_input(payload)
    raise_if_email_archived(store, data.email)  # type: ignore[arg-type]

    profile = _get_one(store, "profiles", {"email": f"eq.{data.email}", "select": "id,email,full_name,archived_at"})
    existing_user_id = str(profile["id"]) if profile else None
    memberships = _memberships_for_user(store, existing_user_id)
    this_membership = next((row for row in memberships if str(row.get("workspace_id")) == workspace_id), None)
    other_memberships = [row for row in memberships if str(row.get("workspace_id")) != workspace_id]
    if other_memberships:
        raise _conflict("החשבון כבר משויך לסביבת עבודה אחרת")

    created_new_auth = False
    user_id: str | None = None
    resume_membership_id: str | None = None

    if this_membership:
        user_id = existing_user_id
        resume_membership_id = str(this_membership.get("id") or "") or None
        ssp_existing = _get_one(
            store,
            "ssp_memberships",
            {
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company_pk}",
                "user_id": f"eq.{user_id}",
                "select": "id,status,product_role",
            },
        )
        if ssp_existing and ssp_existing.get("status") == "active":
            shown = (profile or {}).get("full_name") or data.email
            raise _conflict(f"החשבון {data.email} כבר מופיע ברשימת המשתמשים בשם {shown}")
    elif existing_user_id:
        user_id = existing_user_id
    else:
        created_id = _create_auth_user(store, data)
        if created_id:
            user_id = created_id
            created_new_auth = True
        else:
            user_id = _lookup_auth_by_email(store, data.email)
            if not user_id:
                raise _conflict()
            leftover = _memberships_for_user(store, user_id)
            if any(str(row.get("workspace_id")) != workspace_id for row in leftover):
                raise _conflict("החשבון כבר משויך לסביבת עבודה אחרת")
            this_membership = next(
                (row for row in leftover if str(row.get("workspace_id")) == workspace_id),
                None,
            )
            if this_membership:
                resume_membership_id = str(this_membership.get("id") or "") or None

    if not user_id:
        raise _conflict()

    role_key = WORKSPACE_ROLE_FOR_PRODUCT[data.product_role]
    if this_membership:
        existing_role = str(this_membership.get("role_key") or "")
        if existing_role in {"owner", "administrator"}:
            role_key = existing_role

    if not resume_membership_id:
        limit = evaluate_seat_limit(
            plan_key=plan_key,
            invite_role=role_key,
            occupied_roles=occupied_roles,
            extra_seats=extra_seats,
        )
        raise_plan_limit(limit)

    try:
        _ensure_profile(
            store,
            user_id,
            full_name=data.full_name,
            email=data.email,
            phone=data.phone,
        )
        if not resume_membership_id:
            _insert_workspace_membership(store, workspace_id, user_id, role_key)
        ssp_row = _upsert_ssp_membership(
            store,
            workspace_id=workspace_id,
            company_pk=company_pk,
            user_id=user_id,
            actor_user_id=actor_user_id,
            payload=data,
        )
        if data.site_pk:
            _ensure_site_member(store, workspace_id=workspace_id, site_pk=data.site_pk, user_id=user_id)
    except ApiError:
        raise
    except Exception:
        raise _partial("היצירה נכשלה באמצע. החשבון ב־Auth לא נמחק", user_id=user_id)

    sites: list[dict[str, Any]] = []
    if data.site_pk:
        site = _get_one(
            store,
            "ssp_sites",
            {"id": f"eq.{data.site_pk}", "workspace_id": f"eq.{workspace_id}", "select": "id,name,kind,is_active"},
        )
        if site:
            sites = [{"id": site["id"], "name": site.get("name"), "kind": site.get("kind")}]

    profile_out = _get_one(
        store,
        "profiles",
        {"id": f"eq.{user_id}", "select": "id,full_name,email,phone"},
    )
    result = person_out(
        membership=ssp_row,
        profile=profile_out,
        workspace_role_key=role_key,
        sites=sites,
    )
    result["created_auth"] = created_new_auth
    result["resumed"] = not created_new_auth
    return result
