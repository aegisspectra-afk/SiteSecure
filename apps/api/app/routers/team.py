from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..audit import write_audit
from ..authz.catalog import load_catalog
from ..authz.engine import authorize
from ..authz.usage import fetch_occupancy, fetch_storage_used_bytes, workspace_meters
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import MESSAGES, ApiError

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["team"])

ASSIGNABLE_ROLES = frozenset(
    {"administrator", "manager", "sales", "technician", "founding_technician", "viewer", "owner"}
)


class MemberPatch(BaseModel):
    role_key: str | None = None
    status: Literal["active", "disabled"] | None = None


class MemberOut(BaseModel):
    id: str
    user_id: str
    full_name: str = ""
    email: str | None = None
    role_key: str
    status: str
    created_at: str | None = None


class AuditItemOut(BaseModel):
    id: str
    actor_user_id: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class SecuritySignalOut(BaseModel):
    key: str
    label_he: str
    status: Literal["healthy", "not_in_plan", "not_built"]
    detail_he: str


class SecurityCenterOut(BaseModel):
    workspace_id: str
    role_key: str
    plan_key: str
    signals: list[SecuritySignalOut]


class UsageOccupantOut(BaseModel):
    kind: Literal["member", "invite"]
    role_key: str
    email: str | None = None
    label: str
    status: Literal["active", "pending"]


class UsageMeterOut(BaseModel):
    key: str
    label_he: str
    current: int
    limit: int
    unlimited: bool
    unit: str
    at_limit: bool
    occupants: list[UsageOccupantOut] = Field(default_factory=list)


class WorkspaceUsageOut(BaseModel):
    workspace_id: str
    plan_key: str
    active_members: int
    pending_invites: int
    meters: list[UsageMeterOut]


def _raise_decision(decision, *, client: UserClient, workspace_id: str, action: str) -> None:
    if decision.allowed:
        return
    write_audit(
        client,
        workspace_id,
        action,
        metadata={"result": "denied", "code": decision.code},
    )
    status = 401 if decision.code == "UNAUTHENTICATED" else 403
    raise ApiError(status, decision.code or "PERMISSION_DENIED", decision.message_he, decision.details)


def _profile(row: dict) -> dict:
    profile = row.get("profiles") or {}
    if isinstance(profile, list):
        profile = profile[0] if profile else {}
    return profile if isinstance(profile, dict) else {}


@router.get("/members", response_model=list[MemberOut])
def list_members_directory(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> list[MemberOut]:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise_decision(authorize(ctx=ctx, action="users.view"), client=client, workspace_id=str(workspace_id), action="users.view")
    res = client.get(
        "workspace_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "select": "id,user_id,role_key,status,created_at,profiles(full_name,email)",
            "order": "created_at.asc",
        },
    )
    if res.status_code != 200:
        res = client.get(
            "workspace_memberships",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,user_id,role_key,status,created_at,profiles(full_name)",
                "order": "created_at.asc",
            },
        )
    if res.status_code != 200:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    out: list[MemberOut] = []
    for row in res.json():
        profile = _profile(row)
        out.append(
            MemberOut(
                id=row["id"],
                user_id=row["user_id"],
                full_name=profile.get("full_name") or "",
                email=profile.get("email"),
                role_key=row["role_key"],
                status=row["status"],
                created_at=row.get("created_at"),
            )
        )
    return out


@router.get("/usage", response_model=WorkspaceUsageOut)
def workspace_usage(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> WorkspaceUsageOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    view = authorize(ctx=ctx, action="users.view")
    billing = authorize(ctx=ctx, action="workspace.billing")
    if not view.allowed and not billing.allowed:
        _raise_decision(view, client=client, workspace_id=str(workspace_id), action="users.view")
    occupancy = fetch_occupancy(client, str(workspace_id))
    used_bytes = fetch_storage_used_bytes(client, str(workspace_id))
    meters = [
        UsageMeterOut(**row)
        for row in workspace_meters(
            plan_key=ctx.plan_key,
            occupants=occupancy.occupants,
            used_bytes=used_bytes,
        )
    ]
    return WorkspaceUsageOut(
        workspace_id=str(workspace_id),
        plan_key=ctx.plan_key,
        active_members=occupancy.active_members,
        pending_invites=occupancy.pending_invites,
        meters=meters,
    )


@router.patch("/members/{member_id}", response_model=MemberOut)
def patch_member(
    workspace_id: UUID,
    member_id: UUID,
    body: MemberPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> MemberOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise_decision(
        authorize(ctx=ctx, action="users.manage"),
        client=client,
        workspace_id=str(workspace_id),
        action="users.manage",
    )
    current = client.get(
        "workspace_memberships",
        params={
            "id": f"eq.{member_id}",
            "workspace_id": f"eq.{workspace_id}",
            "select": "id,user_id,role_key,status,created_at,profiles(full_name,email)",
        },
    )
    if current.status_code != 200 or not current.json():
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    row = current.json()[0]
    if row["user_id"] == ctx.user_id:
        write_audit(
            client,
            str(workspace_id),
            "users.manage",
            entity_type="membership",
            entity_id=str(member_id),
            metadata={"result": "denied", "code": "SELF_ROLE_CHANGE"},
        )
        raise ApiError(403, "BUSINESS_RULE", "לא ניתן לשנות את התפקיד של עצמכם")
    patch: dict[str, str] = {}
    if body.role_key is not None:
        if body.role_key not in ASSIGNABLE_ROLES:
            raise ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"])
        if body.role_key == "owner" and ctx.role_key != "owner":
            write_audit(
                client,
                str(workspace_id),
                "users.manage",
                entity_type="membership",
                entity_id=str(member_id),
                metadata={"result": "denied", "code": "OWNER_ASSIGN_RESTRICTED"},
            )
            raise ApiError(403, "BUSINESS_RULE", "רק בעלים יכול למנות בעלים")
        patch["role_key"] = body.role_key
    if body.status is not None:
        patch["status"] = body.status
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"])
    res = client.patch(
        "workspace_memberships",
        patch,
        params={"id": f"eq.{member_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    if res.status_code not in {200, 204} or not res.json():
        text = res.text
        if "LAST_OWNER" in text:
            raise ApiError(403, "BUSINESS_RULE", "לא ניתן להסיר את הבעלים האחרון")
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    updated = res.json()[0]
    write_audit(
        client,
        str(workspace_id),
        "users.manage",
        entity_type="membership",
        entity_id=str(member_id),
        metadata={
            "result": "success",
            "from_role": row["role_key"],
            "to_role": updated.get("role_key", row["role_key"]),
            "status": updated.get("status", row["status"]),
        },
    )
    profile = _profile(updated) if "profiles" in updated else _profile(row)
    return MemberOut(
        id=updated["id"],
        user_id=updated["user_id"],
        full_name=profile.get("full_name") or "",
        email=profile.get("email"),
        role_key=updated["role_key"],
        status=updated["status"],
        created_at=updated.get("created_at"),
    )


@router.get("/audit", response_model=list[AuditItemOut])
def list_audit(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> list[AuditItemOut]:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise_decision(authorize(ctx=ctx, action="audit.view"), client=client, workspace_id=str(workspace_id), action="audit.view")
    res = client.get(
        "audit_logs",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "select": "id,actor_user_id,action,entity_type,entity_id,metadata,created_at",
            "order": "created_at.desc",
            "limit": "100",
        },
    )
    if res.status_code != 200:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    return [
        AuditItemOut(
            id=row["id"],
            actor_user_id=row.get("actor_user_id"),
            action=row["action"],
            entity_type=row.get("entity_type"),
            entity_id=row.get("entity_id"),
            metadata=row.get("metadata") or {},
            created_at=row["created_at"],
        )
        for row in res.json()
    ]


@router.get("/security", response_model=SecurityCenterOut)
def security_center(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> SecurityCenterOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise_decision(
        authorize(ctx=ctx, action="settings.view"),
        client=client,
        workspace_id=str(workspace_id),
        action="settings.view",
    )
    catalog = load_catalog()
    audit_feature = catalog.get("permission_feature", {}).get("audit.view")
    audit_in_plan = not audit_feature or audit_feature in ctx.features
    signals = [
        SecuritySignalOut(
            key="authentication",
            label_he="Authentication",
            status="healthy",
            detail_he="Supabase Auth עם JWT על הבקשה הנוכחית",
        ),
        SecuritySignalOut(
            key="rbac",
            label_he="RBAC",
            status="healthy",
            detail_he=f"תפקיד פעיל: {ctx.role_key}",
        ),
        SecuritySignalOut(
            key="tenant_isolation",
            label_he="Tenant Isolation",
            status="healthy",
            detail_he="הבקשה מוגבלת ל־workspace של החברות",
        ),
        SecuritySignalOut(
            key="audit_logging",
            label_he="Audit Logging",
            status="healthy" if audit_in_plan else "not_in_plan",
            detail_he="צפייה ביומן כלולה בתוכנית" if audit_in_plan else "צפייה ביומן כלולה בתוכנית Business",
        ),
        SecuritySignalOut(
            key="api_security",
            label_he="API Security",
            status="healthy",
            detail_he="authorize() ואז RLS. הסתרת כפתור אינה אבטחה",
        ),
        SecuritySignalOut(
            key="sessions",
            label_he="Sessions",
            status="not_built",
            detail_he="ניהול סשנים מפורט עדיין לא נבנה",
        ),
    ]
    return SecurityCenterOut(
        workspace_id=str(workspace_id),
        role_key=ctx.role_key,
        plan_key=ctx.plan_key,
        signals=signals,
    )
