from __future__ import annotations

import csv
import io
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..authz.guard import require
from ..authz.limits import evaluate_count_limit, raise_plan_limit
from ..authz.scope import apply_assigned_column_filter, empty_assigned_page
from ..authz.types import ResourceRef
from ..authz.usage import fetch_customers_count
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..csv_export import CUSTOMER_STATUS_HE, EXPORT_MAX, EXPORT_PAGE, build_csv, csv_response
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import acked_or_403, as_list, created_or_403, one_or_404, patched_or_403
from ..search_query import sanitize_search_q
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["customers"])

CUSTOMER_SELECT = (
    "id,workspace_id,display_name,type,status,legal_name,tax_id,email,phone,"
    "billing_address,notes,created_at,updated_at"
)


class CustomerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(min_length=1, max_length=200)
    type: str = "private"
    status: str = "active"
    legal_name: str | None = None
    tax_id: str | None = None
    email: str | None = None
    phone: str | None = None
    billing_address: dict | None = None
    notes: str | None = None


class CustomerPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    type: str | None = None
    status: str | None = None
    legal_name: str | None = None
    tax_id: str | None = None
    email: str | None = None
    phone: str | None = None
    billing_address: dict | None = None
    notes: str | None = None


class ContactCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=1, max_length=200)
    role_title: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool = False


class ContactPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    role_title: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool | None = None


class ContactOut(BaseModel):
    id: str
    customer_id: str
    full_name: str
    role_title: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool = False


class CustomerOut(BaseModel):
    id: str
    workspace_id: str
    display_name: str
    type: str
    status: str
    legal_name: str | None = None
    tax_id: str | None = None
    email: str | None = None
    phone: str | None = None
    billing_address: dict = Field(default_factory=dict)
    notes: str | None = None
    created_at: str
    updated_at: str


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


CONTACT_SELECT = "id,customer_id,full_name,role_title,email,phone,is_primary"


def _contact_out(row: dict) -> ContactOut:
    return ContactOut(
        id=row["id"],
        customer_id=row["customer_id"],
        full_name=row["full_name"],
        role_title=row.get("role_title"),
        email=row.get("email"),
        phone=row.get("phone"),
        is_primary=bool(row.get("is_primary")),
    )


def _require_customer(
    client: UserClient,
    workspace_id: UUID,
    customer_id: UUID,
) -> dict:
    return one_or_404(
        client.get(
            "customers",
            params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )


def _require_contact(
    client: UserClient,
    workspace_id: UUID,
    customer_id: UUID,
    contact_id: UUID,
) -> dict:
    return one_or_404(
        client.get(
            "customer_contacts",
            params={
                "id": f"eq.{contact_id}",
                "customer_id": f"eq.{customer_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": CONTACT_SELECT,
            },
        )
    )


def _out(row: dict) -> CustomerOut:
    return CustomerOut(
        id=row["id"],
        workspace_id=row["workspace_id"],
        display_name=row["display_name"],
        type=row["type"],
        status=row["status"],
        legal_name=row.get("legal_name"),
        tax_id=row.get("tax_id"),
        email=row.get("email"),
        phone=row.get("phone"),
        billing_address=row.get("billing_address") or {},
        notes=row.get("notes"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("/customers")
def list_customers(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.view")
    empty = empty_assigned_page(ctx)
    if empty is not None:
        return empty
    page_size = parse_limit(limit)
    params = _customer_list_filter_params(workspace_id=workspace_id, q=q, status=status)
    params["limit"] = str(page_size + 1)
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    apply_assigned_column_filter(ctx, params, column="id")
    rows = as_list(client.get("customers", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": [_out(row).model_dump() for row in page.items], "next_cursor": page.next_cursor}


def _customer_list_filter_params(*, workspace_id: UUID, q: str | None, status: str | None) -> dict[str, str]:
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": CUSTOMER_SELECT,
        "order": "created_at.desc",
    }
    if status:
        params["status"] = f"eq.{status}"
    needle = sanitize_search_q(q)
    if needle:
        params["or"] = (
            f"(display_name.ilike.*{needle}*,phone.ilike.*{needle}*,email.ilike.*{needle}*,"
            f"billing_address->>line.ilike.*{needle}*,billing_address->>street.ilike.*{needle}*,"
            f"billing_address->>city.ilike.*{needle}*,billing_address->>formatted.ilike.*{needle}*)"
        )
    return params


@router.get("/customers/export")
def export_customers_csv(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.export")
    empty = empty_assigned_page(ctx)
    params = _customer_list_filter_params(workspace_id=workspace_id, q=q, status=status)
    apply_assigned_column_filter(ctx, params, column="id")
    collected: list[dict] = []
    truncated = False
    if empty is None:
        cursor: str | None = None
        while len(collected) < EXPORT_MAX:
            page_params = dict(params)
            page_params["limit"] = str(EXPORT_PAGE + 1)
            if cursor:
                page_params["created_at"] = f"lt.{cursor}"
            rows = as_list(client.get("customers", params=page_params))
            page = page_from_rows(rows, EXPORT_PAGE)
            collected.extend(page.items)
            if not page.next_cursor:
                break
            if len(collected) >= EXPORT_MAX:
                truncated = True
                break
            cursor = page.next_cursor
    headers = ["שם", "סוג", "סטטוס", "טלפון", "דוא״ל", "עיר", "נוצר"]
    csv_rows: list[list[object]] = []
    for row in collected:
        address = row.get("billing_address") if isinstance(row.get("billing_address"), dict) else {}
        csv_rows.append(
            [
                row.get("display_name"),
                row.get("type"),
                CUSTOMER_STATUS_HE.get(str(row.get("status") or ""), row.get("status")),
                row.get("phone"),
                row.get("email"),
                (address or {}).get("city") or (address or {}).get("formatted"),
                row.get("created_at"),
            ]
        )
    write_audit(
        client,
        str(workspace_id),
        "customers.export",
        entity_type="customer",
        metadata={"row_count": len(csv_rows), "truncated": truncated, "max_rows": EXPORT_MAX},
    )
    return csv_response(
        build_csv(headers, csv_rows),
        "לקוחות.csv",
        row_count=len(csv_rows),
        truncated=truncated,
    )


CUSTOMER_IMPORT_MAX = 2_000
CUSTOMER_IMPORT_MAX_CHARS = 2_000_000
_CSV_INJECTION_PREFIXES = frozenset("=+-@\t\r")
_CUSTOMER_IMPORT_KEYS = {
    "display_name": "display_name",
    "name": "display_name",
    "שם": "display_name",
    "phone": "phone",
    "טלפון": "phone",
    "email": "email",
    "דואל": "email",
    'דוא"ל': "email",
    "דוא״ל": "email",
    "type": "type",
    "סוג": "type",
    "status": "status",
    "סטטוס": "status",
}


def normalize_import_phone(value: str | None) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    return digits[-9:] if len(digits) >= 9 else digits


def normalize_import_email(value: str | None) -> str:
    return (value or "").strip().casefold()


def is_csv_injection(value: str | None) -> bool:
    text = (value or "").lstrip()
    return bool(text) and text[0] in _CSV_INJECTION_PREFIXES


def _map_import_header(key: str | None) -> str | None:
    raw = (key or "").strip()
    return _CUSTOMER_IMPORT_KEYS.get(raw.casefold()) or _CUSTOMER_IMPORT_KEYS.get(raw)


def _existing_customer_keys(client: UserClient, workspace_id: UUID) -> tuple[set[str], set[str]]:
    rows = as_list(
        client.get(
            "customers",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": "phone,email",
                "limit": "1000",
            },
        )
    )
    phones = {normalize_import_phone(row.get("phone")) for row in rows}
    phones.discard("")
    emails = {normalize_import_email(row.get("email")) for row in rows}
    emails.discard("")
    return phones, emails


class CustomerImportIssue(BaseModel):
    row: int
    message: str
    field: str | None = None


class CustomerImportPreviewRow(BaseModel):
    row: int
    display_name: str
    phone: str | None = None
    email: str | None = None
    type: str = "private"
    status: str = "active"
    issues: list[str] = Field(default_factory=list)
    importable: bool = True


class CustomerImportPreview(BaseModel):
    rows: list[CustomerImportPreviewRow]
    valid_count: int
    error_count: int
    errors: list[str]
    too_large: bool = False


class CustomerImportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    csv_text: str = Field(min_length=1, max_length=CUSTOMER_IMPORT_MAX_CHARS)


class CustomerImportResult(BaseModel):
    created: int
    skipped: int
    errors: list[str] = Field(default_factory=list)


def analyze_customer_import(
    csv_text: str,
    *,
    existing_phones: set[str] | None = None,
    existing_emails: set[str] | None = None,
) -> CustomerImportPreview:
    if len(csv_text or "") > CUSTOMER_IMPORT_MAX_CHARS:
        raise ApiError(400, "VALIDATION_ERROR", f"קובץ הייבוא חורג מ־{CUSTOMER_IMPORT_MAX_CHARS:,} תווים")
    text = (csv_text or "").lstrip("\ufeff").strip()
    if not text:
        raise ApiError(400, "VALIDATION_ERROR", "קובץ הייבוא ריק")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ApiError(400, "VALIDATION_ERROR", "חסרה שורת כותרות בייבוא")
    seen_phones: set[str] = set(existing_phones or ())
    seen_emails: set[str] = set(existing_emails or ())
    preview_rows: list[CustomerImportPreviewRow] = []
    errors: list[str] = []
    raw_count = 0
    for index, raw in enumerate(reader, start=2):
        raw_count += 1
        if raw_count > CUSTOMER_IMPORT_MAX:
            errors.append(f"ניתן לייבא עד {CUSTOMER_IMPORT_MAX:,} לקוחות בבת אחת")
            break
        mapped: dict[str, str] = {}
        injection = False
        for key, value in raw.items():
            dest = _map_import_header(key)
            if not dest or value is None:
                continue
            cell = str(value).strip()
            if not cell:
                continue
            if is_csv_injection(cell):
                injection = True
            mapped[dest] = cell
        issues: list[str] = []
        if injection:
            issues.append("השורה נחסמה — תוכן שנראה כמו נוסחת CSV")
        name = mapped.get("display_name") or ""
        if not name:
            issues.append("חסר שם להצגה")
        phone = mapped.get("phone")
        email = mapped.get("email")
        phone_key = normalize_import_phone(phone)
        email_key = normalize_import_email(email)
        if phone_key and phone_key in seen_phones:
            issues.append("טלפון כפול")
        if email_key and email_key in seen_emails:
            issues.append("דוא״ל כפול")
        if phone_key and "טלפון כפול" not in issues:
            seen_phones.add(phone_key)
        if email_key and "דוא״ל כפול" not in issues:
            seen_emails.add(email_key)
        importable = not issues
        if issues:
            errors.append(f"שורה {index}: {' · '.join(issues)}")
        preview_rows.append(
            CustomerImportPreviewRow(
                row=index,
                display_name=name[:200],
                phone=(phone[:40] if phone else None),
                email=(email[:200] if email else None),
                type=mapped.get("type") or "private",
                status=mapped.get("status") or "active",
                issues=issues,
                importable=importable,
            )
        )
    if not preview_rows:
        raise ApiError(400, "VALIDATION_ERROR", "לא נמצאו לקוחות עם שם להצגה")
    valid_count = sum(1 for row in preview_rows if row.importable)
    return CustomerImportPreview(
        rows=preview_rows,
        valid_count=valid_count,
        error_count=len(preview_rows) - valid_count,
        errors=errors[:50],
        too_large=raw_count > CUSTOMER_IMPORT_MAX,
    )


def parse_customer_import_rows(csv_text: str) -> list[dict[str, str]]:
    preview = analyze_customer_import(csv_text)
    rows = [
        {
            "display_name": row.display_name,
            **({"phone": row.phone} if row.phone else {}),
            **({"email": row.email} if row.email else {}),
            **({"type": row.type} if row.type else {}),
            **({"status": row.status} if row.status else {}),
        }
        for row in preview.rows
        if row.importable
    ]
    if not rows:
        raise ApiError(400, "VALIDATION_ERROR", preview.errors[0] if preview.errors else "לא נמצאו לקוחות עם שם להצגה")
    return rows


@router.post("/customers/import/preview", response_model=CustomerImportPreview)
def preview_customers_csv(
    workspace_id: UUID,
    body: CustomerImportIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> CustomerImportPreview:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.create", resource=ResourceRef(type="customer"))
    phones, emails = _existing_customer_keys(client, workspace_id)
    return analyze_customer_import(body.csv_text, existing_phones=phones, existing_emails=emails)


@router.post("/customers/import", response_model=CustomerImportResult)
def import_customers_csv(
    workspace_id: UUID,
    body: CustomerImportIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> CustomerImportResult:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.create", resource=ResourceRef(type="customer"))
    phones, emails = _existing_customer_keys(client, workspace_id)
    preview = analyze_customer_import(body.csv_text, existing_phones=phones, existing_emails=emails)
    actor = actor_id(user)
    created = 0
    skipped = preview.error_count
    errors = list(preview.errors)
    current = fetch_customers_count(client, str(workspace_id))
    for row in preview.rows:
        if not row.importable:
            continue
        decision = evaluate_count_limit(
            plan_key=ctx.plan_key,
            limit_key="quota_clients",
            resource="customers",
            current=current,
        )
        if not decision.allowed:
            remaining = preview.valid_count - created
            skipped += remaining
            errors.append("הגעתם למכסת הלקוחות בתוכנית")
            break
        payload = {
            "workspace_id": str(workspace_id),
            "created_by": actor,
            "display_name": row.display_name[:200],
            "type": row.type or "private",
            "status": row.status or "active",
        }
        if row.phone:
            payload["phone"] = row.phone[:40]
        if row.email:
            payload["email"] = row.email[:200]
        try:
            created_or_403(client.post("customers", payload))
            created += 1
            current += 1
        except ApiError as err:
            skipped += 1
            errors.append(f"שורה {row.row}: {err.message}")
    write_audit(
        client,
        str(workspace_id),
        "customers.import",
        entity_type="customer",
        metadata={"created": created, "skipped": skipped},
    )
    return CustomerImportResult(created=created, skipped=skipped, errors=errors[:50])


@router.post("/customers", response_model=CustomerOut)
def create_customer(
    workspace_id: UUID,
    body: CustomerCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> CustomerOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.create", resource=ResourceRef(type="customer"))
    raise_plan_limit(
        evaluate_count_limit(
            plan_key=ctx.plan_key,
            limit_key="quota_clients",
            resource="customers",
            current=fetch_customers_count(client, str(workspace_id)),
        )
    )
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        **body.model_dump(exclude_none=True),
    }
    row = created_or_403(client.post("customers", payload))
    return _out(row)


@router.get("/customers/{customer_id}", response_model=CustomerOut)
def get_customer(
    workspace_id: UUID,
    customer_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> CustomerOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.view")
    row = one_or_404(
        client.get(
            "customers",
            params={
                "id": f"eq.{customer_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": CUSTOMER_SELECT,
            },
        )
    )
    require(ctx, "crm.view", resource=ResourceRef(type="customer", id=row["id"]))
    return _out(row)


@router.patch("/customers/{customer_id}", response_model=CustomerOut)
def patch_customer(
    workspace_id: UUID,
    customer_id: UUID,
    body: CustomerPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> CustomerOut:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "customers",
            params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "crm.edit", resource=ResourceRef(type="customer", id=existing["id"]))
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch("customers", patch, params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}"})
    )
    return _out(row)


@router.delete("/customers/{customer_id}")
def delete_customer(
    workspace_id: UUID,
    customer_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "customers",
            params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "crm.delete", resource=ResourceRef(type="customer", id=existing["id"]))
    acked_or_403(
        svc.patch(
            "customers",
            {"deleted_at": datetime.now(UTC).isoformat()},
            params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}"},
            prefer="return=minimal",
        )
    )
    return {"ok": True}


@router.get("/customers/{customer_id}/contacts", response_model=list[ContactOut])
def list_contacts(
    workspace_id: UUID,
    customer_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> list[ContactOut]:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.view")
    _require_customer(client, workspace_id, customer_id)
    rows = as_list(
        client.get(
            "customer_contacts",
            params={
                "customer_id": f"eq.{customer_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": CONTACT_SELECT,
                "order": "created_at.asc",
            },
        )
    )
    return [_contact_out(row) for row in rows]


@router.post("/customers/{customer_id}/contacts", response_model=ContactOut)
def create_contact(
    workspace_id: UUID,
    customer_id: UUID,
    body: ContactCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> ContactOut:
    ctx = _ctx(client, user, workspace_id)
    customer = _require_customer(client, workspace_id, customer_id)
    require(ctx, "crm.edit", resource=ResourceRef(type="customer", id=customer["id"]))
    row = created_or_403(
        client.post(
            "customer_contacts",
            {
                "workspace_id": str(workspace_id),
                "customer_id": str(customer_id),
                **body.model_dump(exclude_none=True),
            },
        )
    )
    return _contact_out(row)


@router.patch("/customers/{customer_id}/contacts/{contact_id}", response_model=ContactOut)
def patch_contact(
    workspace_id: UUID,
    customer_id: UUID,
    contact_id: UUID,
    body: ContactPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> ContactOut:
    ctx = _ctx(client, user, workspace_id)
    customer = _require_customer(client, workspace_id, customer_id)
    existing = _require_contact(client, workspace_id, customer_id, contact_id)
    require(ctx, "crm.edit", resource=ResourceRef(type="customer", id=customer["id"]))
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch(
            "customer_contacts",
            patch,
            params={
                "id": f"eq.{existing['id']}",
                "customer_id": f"eq.{customer_id}",
                "workspace_id": f"eq.{workspace_id}",
            },
        )
    )
    return _contact_out(row)


@router.delete("/customers/{customer_id}/contacts/{contact_id}")
def delete_contact(
    workspace_id: UUID,
    customer_id: UUID,
    contact_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    customer = _require_customer(client, workspace_id, customer_id)
    existing = _require_contact(client, workspace_id, customer_id, contact_id)
    require(ctx, "crm.delete", resource=ResourceRef(type="customer", id=customer["id"]))
    # RLS DELETE is owner/administrator only; catalog also grants crm.delete to managers.
    acked_or_403(
        svc.delete(
            "customer_contacts",
            params={
                "id": f"eq.{existing['id']}",
                "customer_id": f"eq.{customer_id}",
                "workspace_id": f"eq.{workspace_id}",
            },
        )
    )
    return {"ok": True}
