"""Persist customer quote signatures as durable artifacts (documents + storage + snapshot)."""

from __future__ import annotations

import base64
import hashlib
import re
import uuid
from typing import Any

from .authz.limits import evaluate_storage_limit, raise_plan_limit
from .errors import ApiError
from .rest import as_list
from .supabase_service import ServiceClient

_DATA_URL_RE = re.compile(
    r"^data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$",
    re.IGNORECASE | re.DOTALL,
)


def parse_signature_data_url(data_url: str) -> tuple[bytes, str]:
    """Return (raw_bytes, mime_type) for a PNG/JPEG/WebP data URL."""
    raw = (data_url or "").strip()
    match = _DATA_URL_RE.match(raw)
    if not match:
        raise ApiError(400, "VALIDATION_ERROR", "יש לחתום דיגיטלית על ההצעה")
    mime = f"image/{match.group(1).lower()}"
    if mime == "image/jpg":
        mime = "image/jpeg"
    try:
        payload = base64.b64decode(re.sub(r"\s+", "", match.group(2)), validate=False)
    except Exception as exc:
        raise ApiError(400, "VALIDATION_ERROR", "קובץ החתימה אינו תקין") from exc
    if not payload:
        raise ApiError(400, "VALIDATION_ERROR", "קובץ החתימה אינו תקין")
    return payload, mime


def _storage_used_bytes_svc(svc: ServiceClient, workspace_id: str) -> int:
    res = svc.get(
        "documents",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "select": "byte_size,reserved_bytes,created_at",
        },
    )
    if res.status_code != 200:
        return 0
    from datetime import UTC, datetime

    now = datetime.now(UTC)
    total = 0
    for row in res.json() or []:
        if not isinstance(row, dict):
            continue
        if row.get("byte_size") is not None:
            try:
                total += max(0, int(row.get("byte_size") or 0))
            except (TypeError, ValueError):
                pass
            continue
        created_raw = str(row.get("created_at") or "")
        try:
            created = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
        except ValueError:
            continue
        if created.tzinfo is None:
            created = created.replace(tzinfo=UTC)
        if (now - created).total_seconds() > 24 * 3600:
            continue
        try:
            total += max(0, int(row.get("reserved_bytes") or 0))
        except (TypeError, ValueError):
            pass
    return total


def store_quote_signature_document(
    svc: ServiceClient,
    *,
    quote: dict[str, Any],
    version: int,
    signer_name: str,
    signed_at: str,
    signature_data_url: str,
    plan_key: str | None = None,
) -> dict[str, Any]:
    """Upload signature bytes and insert a documents row. Does not mutate quote_versions."""
    image_bytes, mime_type = parse_signature_data_url(signature_data_url)
    document_id = str(uuid.uuid4())
    workspace_id = str(quote["workspace_id"])
    quote_id = str(quote["id"])
    ext = "png" if mime_type == "image/png" else "jpg" if mime_type == "image/jpeg" else "webp"
    storage_bucket = "signatures"
    storage_path = f"{workspace_id}/quote/{quote_id}/{document_id}/signature-v{version}.{ext}"
    checksum = hashlib.sha256(image_bytes).hexdigest()

    resolved_plan = plan_key
    if not resolved_plan:
        sub = svc.get(
            "subscriptions",
            params={"workspace_id": f"eq.{workspace_id}", "select": "plan_key", "limit": "1"},
        )
        rows = sub.json() if sub.status_code == 200 else []
        if isinstance(rows, list) and rows:
            resolved_plan = str(rows[0].get("plan_key") or "solo")
        else:
            resolved_plan = "solo"

    used = _storage_used_bytes_svc(svc, workspace_id)
    raise_plan_limit(
        evaluate_storage_limit(
            plan_key=resolved_plan,
            used_bytes=used,
            requested_bytes=len(image_bytes),
        )
    )

    svc.storage_upload_bytes(storage_bucket, storage_path, image_bytes, mime_type)

    doc_res = svc.post(
        "documents",
        {
            "id": document_id,
            "workspace_id": workspace_id,
            "entity_type": "quote",
            "entity_id": quote_id,
            "kind": "signature",
            "storage_bucket": storage_bucket,
            "storage_path": storage_path,
            "mime_type": mime_type,
            "byte_size": len(image_bytes),
            "reserved_bytes": 0,
            "checksum": checksum,
            "original_filename": f"signature-v{version}.{ext}",
            "captured_at": signed_at,
        },
    )
    # PostgREST create returns 201; as_list() only accepts 200 and would raise BUSINESS_RULE.
    if doc_res.status_code not in {200, 201}:
        text = doc_res.text or ""
        if "PLAN_LIMIT_REACHED" in text:
            try:
                svc.storage_remove(storage_bucket, storage_path)
            except Exception:
                pass
            raise ApiError(
                403,
                "PLAN_LIMIT_REACHED",
                "אין מספיק שטח אחסון להעלאת הקובץ",
                {"resource": "storage"},
            )
        raise ApiError(503, "API_UNAVAILABLE", "לא ניתן לשמור את החתימה")
    raw = doc_res.json()
    docs = raw if isinstance(raw, list) else ([raw] if isinstance(raw, dict) and raw else [])
    if not docs:
        raise ApiError(503, "API_UNAVAILABLE", "לא ניתן לשמור את החתימה")

    return {
        "signer_name": signer_name,
        "signed_at": signed_at,
        "quote_id": quote_id,
        "quote_version": int(version),
        "document_id": document_id,
        "storage_bucket": storage_bucket,
        "storage_path": storage_path,
        "mime_type": mime_type,
        "byte_size": len(image_bytes),
        "checksum": checksum,
        "image_data_url": signature_data_url.strip(),
    }


def freeze_approval_on_version(
    svc: ServiceClient,
    *,
    workspace_id: str,
    quote_id: str,
    version: int,
    approved_at: str,
    approved_name: str,
    captured: dict[str, Any],
) -> None:
    """Lock the approved public snapshot (status + signature artifact) onto quote_versions."""
    rows = as_list(
        svc.get(
            "quote_versions",
            params={
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "version": f"eq.{version}",
                "select": "id,snapshot",
            },
        )
    )
    if not rows:
        raise ApiError(404, "NOT_FOUND", "גרסת ההצעה לא נמצאה")
    row = rows[0]
    snapshot = dict(row.get("snapshot") or {})
    public = dict(snapshot.get("public") or {})
    public["status"] = "approved"
    public["approved_at"] = approved_at
    public["approved_name"] = approved_name
    public["signature_captured"] = True
    signature = dict(public.get("signature") or {}) if isinstance(public.get("signature"), dict) else {}
    signature["captured"] = captured
    public["signature"] = signature
    snapshot["public"] = public
    patched = svc.patch(
        "quote_versions",
        {"snapshot": snapshot},
        params={"id": f"eq.{row['id']}", "workspace_id": f"eq.{workspace_id}"},
    )
    if patched.status_code not in {200, 204}:
        raise ApiError(503, "API_UNAVAILABLE", "לא ניתן לנעול את גרסת ההצעה החתומה")
