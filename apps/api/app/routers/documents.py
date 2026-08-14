from __future__ import annotations

import re
import uuid
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import as_list, created_or_403, one_or_404, patched_or_403

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
    }


@router.post("/documents/{document_id}/complete")
def complete_upload(
    workspace_id: UUID,
    document_id: UUID,
    body: CompleteUpload,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "documents",
            params={
                "id": f"eq.{document_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,entity_type,entity_id,created_by",
            },
        )
    )
    require(
        ctx,
        "documents.upload",
        resource=_entity_resource(existing["entity_type"], existing["entity_id"]),
    )
    patch = body.model_dump(exclude_none=True)
    if not patch:
        return existing
    row = patched_or_403(
        client.patch(
            "documents",
            patch,
            params={"id": f"eq.{document_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
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
