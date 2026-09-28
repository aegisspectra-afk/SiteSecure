"""Customer portal projections. Portal users are not workspace members."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

PORTAL_VIEW_CAPABILITIES = (
    "portal.profile.view",
    "portal.sites.view",
    "portal.installations.view",
    "portal.equipment.view",
    "portal.warranties.view",
    "portal.quotes.view",
    "portal.documents.view",
    "portal.service.view",
)

INVITE_TTL = timedelta(days=7)
LOGIN_TOUCH_AFTER = timedelta(minutes=30)
PORTAL_DOCUMENT_BUCKETS = frozenset({"documents", "photos"})
QUOTE_PORTAL_STATUSES = frozenset({"sent", "viewed", "approved", "rejected"})

FORBIDDEN_PORTAL_KEYS = frozenset(
    {
        "cost",
        "cost_total",
        "margin_amount",
        "margin_percent",
        "margin_override_reason",
        "margin_override_by",
        "margin_override_at",
        "internal_notes",
        "revise_reason",
        "notes",
        "tax_id",
        "legal_name",
        "access_notes",
        "public_token",
        "token_hash",
        "ip",
        "mac",
        "panel_id",
        "metadata",
        "completion_notes",
        "description",
        "billing_address",
        "storage_path",
        "provider_payload",
        "catalog_snapshot",
    }
)

_ADDRESS_KEYS = (
    "street",
    "house_number",
    "city",
    "postal_code",
    "apartment",
    "floor",
    "entrance",
    "line",
    "formatted",
)


def normalize_portal_email(value: str) -> str:
    email = (value or "").strip().lower()
    if " " in email or "@" not in email or email.startswith("@") or len(email) > 320:
        raise ValueError("invalid email")
    return email


def portal_ui_status(access: dict[str, Any] | None, invite: dict[str, Any] | None, *, now: datetime | None = None) -> str:
    if access is None:
        return "not_enabled"
    status = str(access.get("status") or "")
    if status == "revoked":
        return "revoked"
    if status == "active":
        return "active"
    if status != "invited":
        return "not_enabled"
    if invite is None or invite.get("revoked_at") or invite.get("consumed_at"):
        return "expired"
    expires = _parse_dt(invite.get("expires_at"))
    current = now or datetime.now(UTC)
    if expires is None or expires <= current:
        return "expired"
    return "invited"


def project_address(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for key in _ADDRESS_KEYS:
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            out[key] = value.strip()
    return out


def project_profile(customer: dict[str, Any], grant_email: str) -> dict[str, Any]:
    return {
        "display_name": customer.get("display_name") or "",
        "type": customer.get("type") or "private",
        "phone": customer.get("phone") or None,
        "email": grant_email,
    }


def project_site(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "name": row.get("name") or "",
        "code": row.get("code") or "",
        "installation_status": row.get("installation_status") or "",
        "address": project_address(row.get("address")),
    }


def project_installation(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "number": row.get("number") or "",
        "title": row.get("title") or "",
        "status": row.get("status") or "",
        "completed_at": row.get("completed_at"),
        "site_id": row.get("site_id"),
    }


def project_equipment(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "site_id": row.get("site_id"),
        "name": row.get("name") or "",
        "category": row.get("category") or "",
        "manufacturer": row.get("manufacturer"),
        "model": row.get("model"),
        "serial": row.get("serial"),
        "installed_at": row.get("installed_at"),
        "status": row.get("status") or "",
    }


def project_warranty(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "number": row.get("number") or "",
        "type": row.get("type") or "",
        "status": row.get("status") or "",
        "starts_on": row.get("starts_on"),
        "ends_on": row.get("ends_on"),
        "site_id": row.get("site_id"),
    }


def project_quote(row: dict[str, Any]) -> dict[str, Any]:
    status = str(row.get("status") or "")
    if status not in QUOTE_PORTAL_STATUSES:
        return {}
    return {
        "id": row.get("id"),
        "number": row.get("number") or "",
        "status": status,
        "total_gross": row.get("total_gross"),
        "sent_at": row.get("sent_at"),
        "valid_until": row.get("valid_until"),
    }


def project_service_call(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "number": row.get("number"),
        "title": row.get("title") or "",
        "status": row.get("status") or "",
        "created_at": row.get("created_at"),
        "site_id": row.get("site_id"),
    }


def project_document(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "filename": row.get("original_filename") or "",
        "mime_type": row.get("mime_type"),
        "created_at": row.get("created_at"),
    }


def document_visible(
    doc: dict[str, Any],
    *,
    customer_id: str,
    site_ids: set[str],
    job_ids: set[str],
    quote_ids: set[str],
    warranty_ids: set[str],
    project_ids: set[str],
    system_ids: set[str],
) -> bool:
    if doc.get("visibility") != "customer":
        return False
    if doc.get("kind") == "signature":
        return False
    if doc.get("storage_bucket") not in PORTAL_DOCUMENT_BUCKETS:
        return False
    entity_type = str(doc.get("entity_type") or "")
    entity_id = str(doc.get("entity_id") or "")
    if entity_type == "customer":
        return entity_id == customer_id
    if entity_type == "site":
        return entity_id in site_ids
    if entity_type == "job":
        return entity_id in job_ids
    if entity_type == "quote":
        return entity_id in quote_ids
    if entity_type == "warranty":
        return entity_id in warranty_ids
    if entity_type == "project":
        return entity_id in project_ids
    if entity_type == "system":
        return entity_id in system_ids
    return False


def has_capability(grant: dict[str, Any], capability: str) -> bool:
    raw = grant.get("capabilities") or []
    if isinstance(raw, str):
        return raw == capability
    return capability in raw


def should_touch_login(last_login_at: Any, *, now: datetime | None = None) -> bool:
    parsed = _parse_dt(last_login_at)
    if parsed is None:
        return True
    current = now or datetime.now(UTC)
    return current - parsed >= LOGIN_TOUCH_AFTER


def _parse_dt(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
