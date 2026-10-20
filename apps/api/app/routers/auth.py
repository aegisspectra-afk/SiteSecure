from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..authz.catalog import default_plan_key, load_catalog
from ..deps import UserClient, current_user, user_client
from ..errors import ApiError
from ..platform import platform_role_for

router = APIRouter(prefix="/api/v1", tags=["auth"])


class ProfileOut(BaseModel):
    id: str
    full_name: str = ""
    phone: str | None = None
    locale: str = "he"
    last_workspace_id: str | None = None
    recognition_badges: list[str] = Field(default_factory=list)


class MembershipOut(BaseModel):
    workspace_id: str
    workspace_name: str
    workspace_status: str
    role_key: str
    workspace_role_key: str | None = None
    technician_code: str | None = None
    program_type: str | None = None
    plan_key: str
    features: list[str]
    permissions: list[str] = Field(default_factory=list)
    is_beta: bool = False
    beta_program: str | None = None


class SessionOut(BaseModel):
    user_id: str
    email: str | None = None
    profile: ProfileOut | None = None
    memberships: list[MembershipOut]
    has_workspace: bool
    is_platform_admin: bool = False
    # V1: true ⇒ platform_super_admin. Never derived from workspace role or badges.
    platform_role: str | None = None


class ProfilePatch(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = None
    locale: str | None = None


class ActiveWorkspaceIn(BaseModel):
    workspace_id: str = Field(min_length=1, max_length=64)


class ActiveWorkspaceOut(BaseModel):
    workspace_id: str
    last_workspace_id: str


@router.get("/auth/session", response_model=SessionOut)
def get_session(
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> SessionOut:
    user_id = user["id"]
    profile_res = client.get("profiles", params={"id": f"eq.{user_id}", "select": "*"})
    profile_row = (profile_res.json() or [None])[0] if profile_res.status_code == 200 else None

    members_res = client.get(
        "workspace_memberships",
        params={
            "user_id": f"eq.{user_id}",
            "status": "eq.active",
            "select": "workspace_id,role_key,workspace_role_key,technician_code,program_type,workspaces(id,name,status,is_beta,beta_program)",
            # Important for UI stability: the frontend uses `memberships[0]` as the active workspace.
            # Make the ordering deterministic.
            "order": "created_at.desc",
        },
    )
    memberships: list[MembershipOut] = []
    if members_res.status_code == 200:
        for row in members_res.json():
            ws_id = row["workspace_id"]
            nested = row.get("workspaces")
            if isinstance(nested, list):
                nested = nested[0] if nested else None
            if not isinstance(nested, dict):
                continue
            # Hide disposable / suspended workspaces from the active session list.
            if str(nested.get("status") or "") != "active":
                continue
            ent_res = client.rpc("my_workspace_entitlements", {"p_workspace_id": ws_id})
            # Fail closed for UX: never invent catalog base-plan features on resolver failure.
            # Empty features keep nav/actions gated; plan_key stays conservative default.
            plan_key = default_plan_key()
            features: list[str] = []
            if ent_res.status_code == 200:
                payload = ent_res.json()
                if isinstance(payload, dict) and "features" in payload:
                    plan_key = payload.get("plan_key") or default_plan_key()
                    features = list(payload.get("features") or [])
            role_key = row["role_key"]
            workspace_role_key = row.get("workspace_role_key") or role_key
            permissions: list[str] = []
            try:
                from ..workspace_rbac import resolve_role_grants

                permissions = sorted(resolve_role_grants(client, ws_id, workspace_role_key, role_key))
            except Exception:
                catalog = load_catalog()
                permissions = sorted(catalog.get("_grants", {}).get(role_key) or [])
            memberships.append(
                MembershipOut(
                    workspace_id=ws_id,
                    workspace_name=nested["name"],
                    workspace_status=nested["status"],
                    role_key=role_key,
                    workspace_role_key=workspace_role_key,
                    technician_code=row.get("technician_code"),
                    program_type=row.get("program_type"),
                    plan_key=plan_key,
                    features=features,
                    permissions=permissions,
                    is_beta=bool(nested.get("is_beta")),
                    beta_program=nested.get("beta_program"),
                )
            )

    profile = None
    last_workspace_id = None
    if profile_row:
        last_workspace_id = profile_row.get("last_workspace_id")
        profile = ProfileOut(
            id=profile_row["id"],
            full_name=profile_row.get("full_name") or "",
            phone=profile_row.get("phone"),
            locale=profile_row.get("locale") or "he",
            last_workspace_id=last_workspace_id,
            recognition_badges=list(profile_row.get("recognition_badges") or []),
        )

    # Prefer last_workspace_id when present and still a valid active membership.
    # Invalid / inaccessible preference falls back to created_at.desc without elevating access.
    member_ids = {m.workspace_id for m in memberships}
    if last_workspace_id and str(last_workspace_id) in member_ids:
        preferred = str(last_workspace_id)
        memberships.sort(key=lambda m: 0 if m.workspace_id == preferred else 1)
    elif last_workspace_id and profile is not None:
        # Stale preference: report a valid fallback id in the session payload only.
        profile.last_workspace_id = memberships[0].workspace_id if memberships else None

    is_admin = bool(profile_row.get("is_platform_admin")) if profile_row else False
    return SessionOut(
        user_id=user_id,
        email=user.get("email"),
        profile=profile,
        memberships=memberships,
        has_workspace=len(memberships) > 0,
        is_platform_admin=is_admin,
        platform_role=platform_role_for(is_admin),
    )


@router.put("/me/active-workspace", response_model=ActiveWorkspaceOut)
def set_active_workspace(
    body: ActiveWorkspaceIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> ActiveWorkspaceOut:
    """Persist active workspace preference after verifying active membership."""
    workspace_id = body.workspace_id.strip()
    if not workspace_id:
        raise ApiError(400, "VALIDATION_ERROR", "נתונים לא תקינים")

    members_res = client.get(
        "workspace_memberships",
        params={
            "user_id": f"eq.{user['id']}",
            "workspace_id": f"eq.{workspace_id}",
            "status": "eq.active",
            "select": "workspace_id,workspaces(id,status)",
        },
    )
    if members_res.status_code != 200 or not members_res.json():
        raise ApiError(403, "PERMISSION_DENIED", "אין גישה לסביבת עבודה זו")
    nested = members_res.json()[0].get("workspaces")
    if isinstance(nested, list):
        nested = nested[0] if nested else None
    if not isinstance(nested, dict) or str(nested.get("status") or "") != "active":
        raise ApiError(403, "TENANT_INACTIVE", "הסביבה אינה פעילה")

    res = client.patch(
        "profiles",
        {"last_workspace_id": workspace_id},
        params={"id": f"eq.{user['id']}", "select": "id,last_workspace_id"},
    )
    if res.status_code not in {200, 204} or not res.json():
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן לעדכן את סביבת העבודה הפעילה")
    row = res.json()[0]
    return ActiveWorkspaceOut(
        workspace_id=workspace_id,
        last_workspace_id=str(row.get("last_workspace_id") or workspace_id),
    )


@router.patch("/me", response_model=ProfileOut)
def patch_me(
    body: ProfilePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> ProfileOut:
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "INVALID_NAME", "אין מה לעדכן")
    res = client.patch("profiles", patch, params={"id": f"eq.{user['id']}"})
    if res.status_code not in {200, 204} or not res.json():
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן לעדכן את הפרופיל")
    row = res.json()[0]
    return ProfileOut(
        id=row["id"],
        full_name=row.get("full_name") or "",
        phone=row.get("phone"),
        locale=row.get("locale") or "he",
        last_workspace_id=row.get("last_workspace_id"),
        recognition_badges=list(row.get("recognition_badges") or []),
    )


@router.get("/authz/catalog")
def authz_catalog(_: Annotated[dict, Depends(current_user)]) -> dict:
    catalog = load_catalog()
    return {
        "roles": catalog["roles"],
        "permissions": catalog["permissions"],
        "grants": {k: sorted(v) for k, v in catalog["_grants"].items()},
        "plans": catalog["plans"],
    }
