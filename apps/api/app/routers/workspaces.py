from __future__ import annotations

import hashlib
import secrets
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..audit import write_audit
from ..authz.catalog import default_plan_key
from ..authz.engine import authorize
from ..authz.limits import evaluate_seat_limit
from ..authz.usage import fetch_occupancy, occupant_for_email
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import MESSAGES, ApiError

router = APIRouter(prefix="/api/v1", tags=["workspaces"])


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    plan_key: str | None = None


class WorkspaceOut(BaseModel):
    id: str
    name: str
    status: str
    timezone: str | None = None
    vat_percent: float | None = None


class WorkspacePatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    timezone: str | None = None
    vat_percent: float | None = Field(default=None, ge=0, le=100)


class InviteCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role_key: str | None = None


class InviteOut(BaseModel):
    id: str
    email: str
    role_key: str
    expires_at: str
    token: str | None = None


class InviteAccept(BaseModel):
    token: str = Field(min_length=16)


def _raise_decision(decision) -> None:
    if not decision.allowed:
        status = 401 if decision.code == "UNAUTHENTICATED" else 403
        raise ApiError(status, decision.code or "PERMISSION_DENIED", decision.message_he, decision.details)


@router.post("/workspaces", response_model=WorkspaceOut)
def create_workspace(
    body: WorkspaceCreate,
    client: Annotated[UserClient, Depends(user_client)],
    _: Annotated[dict, Depends(current_user)],
) -> WorkspaceOut:
    plan_key = default_plan_key()
    res = client.rpc(
        "create_workspace",
        {"p_name": body.name.strip(), "p_plan_key": plan_key},
    )
    if res.status_code != 200:
        detail = res.text
        if "INVALID_NAME" in detail:
            raise ApiError(400, "INVALID_NAME", MESSAGES["INVALID_NAME"])
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן ליצור סביבת עבודה")
    workspace_id = res.json()
    ws = client.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "*"})
    if ws.status_code != 200 or not ws.json():
        raise ApiError(500, "BUSINESS_RULE", "הסביבה נוצרה אך לא ניתן לטעון אותה")
    row = ws.json()[0]
    write_audit(
        client,
        str(workspace_id),
        "workspace.create",
        entity_type="workspace",
        entity_id=str(workspace_id),
        metadata={"result": "success", "name": row["name"], "role_key": "owner"},
    )
    return WorkspaceOut(
        id=row["id"],
        name=row["name"],
        status=row["status"],
        timezone=row.get("timezone"),
        vat_percent=float(row["vat_percent"]) if row.get("vat_percent") is not None else None,
    )


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> WorkspaceOut:
    load_authz_context(client, user["id"], str(workspace_id))
    ws = client.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "*"})
    if ws.status_code != 200 or not ws.json():
        raise ApiError(404, "NOT_FOUND", "לא נמצא")
    row = ws.json()[0]
    return WorkspaceOut(
        id=row["id"],
        name=row["name"],
        status=row["status"],
        timezone=row.get("timezone"),
        vat_percent=float(row["vat_percent"]) if row.get("vat_percent") is not None else None,
    )


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceOut)
def patch_workspace(
    workspace_id: UUID,
    body: WorkspacePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> WorkspaceOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise_decision(authorize(ctx=ctx, action="workspace.edit"))
    patch = body.model_dump(exclude_none=True)
    res = client.patch("workspaces", patch, params={"id": f"eq.{workspace_id}"})
    if res.status_code not in {200, 204} or not res.json():
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    row = res.json()[0]
    write_audit(
        client,
        str(workspace_id),
        "workspace.edit",
        entity_type="workspace",
        entity_id=str(workspace_id),
        metadata={"result": "success", "fields": sorted(patch.keys())},
    )
    return WorkspaceOut(
        id=row["id"],
        name=row["name"],
        status=row["status"],
        timezone=row.get("timezone"),
        vat_percent=float(row["vat_percent"]) if row.get("vat_percent") is not None else None,
    )


@router.post("/workspaces/{workspace_id}/invitations", response_model=InviteOut)
def create_invitation(
    workspace_id: UUID,
    body: InviteCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> InviteOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    role_key = (body.role_key or "technician").strip() or "technician"
    if role_key == "owner":
        write_audit(
            client,
            str(workspace_id),
            "users.invite",
            metadata={"result": "denied", "code": "OWNER_INVITE_RESTRICTED", "role_key": role_key},
        )
        raise ApiError(403, "BUSINESS_RULE", "לא ניתן להזמין בעלים. מינוי בעלים נעשה מחברי הסביבה.")
    decision = authorize(ctx=ctx, action="users.invite", invite_role=role_key)
    if not decision.allowed:
        write_audit(
            client,
            str(workspace_id),
            "users.invite",
            metadata={"result": "denied", "code": decision.code, "role_key": role_key},
        )
        _raise_decision(decision)
    occupancy = fetch_occupancy(client, str(workspace_id))
    email = str(body.email).strip().lower()
    existing = occupant_for_email(occupancy, email)
    if existing is not None:
        code = "INVITE_USER_EXISTS" if existing.kind == "member" else "INVITE_ALREADY_PENDING"
        write_audit(
            client,
            str(workspace_id),
            "users.invite",
            metadata={"result": "denied", "code": code, "email": email, "role_key": role_key},
        )
        raise ApiError(403, code, MESSAGES[code])
    limit = evaluate_seat_limit(
        plan_key=ctx.plan_key,
        invite_role=role_key,
        occupied_roles=occupancy.roles,
    )
    if not limit.allowed:
        write_audit(
            client,
            str(workspace_id),
            "users.invite",
            metadata={"result": "denied", "code": limit.code, "role_key": role_key},
        )
        _raise_decision(limit)
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    res = client.post(
        "invitations",
        {
            "workspace_id": str(workspace_id),
            "email": email,
            "role_key": role_key,
            "token_hash": token_hash,
            "invited_by": user["id"],
        },
    )
    if res.status_code not in {200, 201} or not res.json():
        raise ApiError(403, "PERMISSION_DENIED", "לא ניתן ליצור הזמנה")
    row = res.json()[0]
    write_audit(
        client,
        str(workspace_id),
        "users.invite",
        entity_type="invitation",
        entity_id=row["id"],
        metadata={"result": "success", "email": row["email"], "role_key": row["role_key"]},
    )
    return InviteOut(
        id=row["id"],
        email=row["email"],
        role_key=row["role_key"],
        expires_at=row["expires_at"],
        token=token,
    )


@router.get("/workspaces/{workspace_id}/invitations")
def list_invitations(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> list[dict]:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise_decision(authorize(ctx=ctx, action="users.invite"))
    res = client.get(
        "invitations",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "select": "id,email,role_key,expires_at,accepted_at,created_at",
            "order": "created_at.desc",
        },
    )
    if res.status_code != 200:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    return res.json()


@router.post("/invitations/accept")
def accept_invitation(
    body: InviteAccept,
    client: Annotated[UserClient, Depends(user_client)],
    _: Annotated[dict, Depends(current_user)],
) -> dict:
    res = client.rpc("accept_invitation", {"p_token": body.token})
    if res.status_code != 200:
        text = res.text
        if "INVITE_EMAIL_MISMATCH" in text:
            raise ApiError(403, "INVITE_EMAIL_MISMATCH", MESSAGES["INVITE_EMAIL_MISMATCH"])
        raise ApiError(400, "INVITE_INVALID", MESSAGES["INVITE_INVALID"])
    return {"workspace_id": res.json()}
