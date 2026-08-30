from __future__ import annotations

import re
import uuid
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..authz.guard import require
from ..authz.limits import evaluate_storage_limit, raise_plan_limit
from ..authz.types import ResourceRef
from ..authz.usage import fetch_storage_used_bytes
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import as_list, created_or_403, one_or_404, patched_or_403
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["documents"])

KIND_BUCKET = {
    "document": "documents",
    "photo": "photos",
    "signature": "signatures",
    "pdf_export": "exports",
}

SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


class UploadIntent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_type: str
    entity_id: str
    kind: str = "document"
    mime_type: str | None = None
    original_filename: str | None = None
    # Authoritative reservation size for quota. Client may still upload a larger
    # object; complete re-checks against remaining capacity / Storage metadata.
    byte_size: int = Field(ge=1, le=5 * 1024**3)


class CompleteUpload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    byte_size: int | None = Field(default=None, ge=0)
    checksum: str | None = None
    mime_type: str | None = None


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _filename(name: str | None) -> str:
    raw = (name or "file").split("/")[-1][:80]
    cleaned = SAFE_NAME.sub("_", raw).strip("._") or "file"
    return cleaned


def _entity_resource(entity_type: str, entity_id: str) -> ResourceRef:
    site_id = entity_id if entity_type == "site" else None
    return ResourceRef(type=entity_type, id=entity_id, site_id=site_id)


def _cleanup_failed_upload(
    svc: ServiceClient | None,
    client: UserClient,
    *,
    workspace_id: UUID,
    document_id: str,
    bucket: str,
    path: str,
) -> None:
    try:
        client.delete(
            "documents",
            params={"id": f"eq.{document_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    except Exception:
        pass
    if svc is not None:
        try:
            svc.storage_remove(bucket, path)
        except Exception:
            pass


@router.get("/documents")
def list_documents(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    entity_type: str | None = Query(default=None),
    entity_id: str | None = Query(default=None),
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "documents.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": "id,workspace_id,entity_type,entity_id,kind,storage_bucket,mime_type,byte_size,original_filename,created_at",
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if entity_type:
        params["entity_type"] = f"eq.{entity_type}"
    if entity_id:
        params["entity_id"] = f"eq.{entity_id}"
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("documents", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": page.items, "next_cursor": page.next_cursor}


@router.post("/documents/uploads")
def create_upload(
    workspace_id: UUID,
    body: UploadIntent,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "documents.upload", resource=_entity_resource(body.entity_type, body.entity_id))
    bucket = KIND_BUCKET.get(body.kind)
    if not bucket:
        raise ApiError(400, "VALIDATION_ERROR", "סוג מסמך לא תקין")
    used = fetch_storage_used_bytes(client, str(workspace_id))
    raise_plan_limit(
        evaluate_storage_limit(
            plan_key=ctx.plan_key,
            used_bytes=used,
            requested_bytes=body.byte_size,
        )
    )
    document_id = str(uuid.uuid4())
    filename = _filename(body.original_filename)
    storage_path = f"{workspace_id}/{body.entity_type}/{body.entity_id}/{document_id}/{filename}"
    row = created_or_403(
        client.post(
            "documents",
            {
                "id": document_id,
                "workspace_id": str(workspace_id),
                "entity_type": body.entity_type,
                "entity_id": body.entity_id,
                "kind": body.kind,
                "storage_bucket": bucket,
                "storage_path": storage_path,
                "mime_type": body.mime_type,
                "original_filename": body.original_filename,
                "reserved_bytes": body.byte_size,
                "created_by": actor_id(user),
            },
        )
    )
    signed = client.storage_sign_upload(bucket, storage_path)
    return {
        "document_id": row["id"],
        "storage_path": storage_path,
        "storage_bucket": bucket,
        "upload_url": signed["upload_url"],
        "expires_in": 7200,
        "reserved_bytes": body.byte_size,
    }


@router.post("/documents/{document_id}/complete")
def complete_upload(
    workspace_id: UUID,
    document_id: UUID,
    body: CompleteUpload,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "documents",
            params={
                "id": f"eq.{document_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,entity_type,entity_id,created_by,reserved_bytes,storage_bucket,storage_path,byte_size",
            },
        )
    )
    require(
        ctx,
        "documents.upload",
        resource=_entity_resource(existing["entity_type"], existing["entity_id"]),
    )
    reserved = max(0, int(existing.get("reserved_bytes") or 0))
    reported = body.byte_size
    storage_size = None
    try:
        storage_size = svc.storage_object_size(
            str(existing["storage_bucket"]),
            str(existing["storage_path"]),
        )
    except Exception:
        storage_size = None

    # Prefer Storage metadata when available; never trust a client size below it.
    final_size = reserved
    if storage_size is not None:
        final_size = max(storage_size, reported or 0, reserved)
    elif reported is not None:
        final_size = max(reported, reserved)

    if final_size > reserved:
        # Charge only the growth beyond the reservation (reservation already counted).
        used = fetch_storage_used_bytes(client, str(workspace_id))
        # used includes this row's reserved_bytes; replace reserved with final when checking.
        used_without_reserved = max(0, used - reserved)
        raise_plan_limit(
            evaluate_storage_limit(
                plan_key=ctx.plan_key,
                used_bytes=used_without_reserved,
                requested_bytes=final_size,
            )
        )

    patch = {
        "byte_size": final_size,
        "reserved_bytes": 0,
    }
    if body.checksum is not None:
        patch["checksum"] = body.checksum
    if body.mime_type is not None:
        patch["mime_type"] = body.mime_type
    try:
        row = patched_or_403(
            client.patch(
                "documents",
                patch,
                params={"id": f"eq.{document_id}", "workspace_id": f"eq.{workspace_id}"},
            )
        )
    except ApiError as exc:
        if exc.code == "PLAN_LIMIT_REACHED":
            _cleanup_failed_upload(
                svc,
                client,
                workspace_id=workspace_id,
                document_id=str(document_id),
                bucket=str(existing["storage_bucket"]),
                path=str(existing["storage_path"]),
            )
        raise
    return {
        "id": row["id"],
        "byte_size": row.get("byte_size"),
        "checksum": row.get("checksum"),
        "mime_type": row.get("mime_type"),
    }


@router.get("/documents/{document_id}/url")
def document_url(
    workspace_id: UUID,
    document_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "documents.view")
    row = one_or_404(
        client.get(
            "documents",
            params={
                "id": f"eq.{document_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,storage_bucket,storage_path,entity_type,entity_id",
            },
        )
    )
    require(ctx, "documents.view", resource=_entity_resource(row["entity_type"], row["entity_id"]))
    url = client.storage_sign_download(row["storage_bucket"], row["storage_path"], expires_in=60)
    return {"url": url, "expires_in": 60}
