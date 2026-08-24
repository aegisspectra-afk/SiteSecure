from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..authz.catalog import default_plan_key, load_catalog
from ..deps import UserClient, current_user, user_client
from ..errors import ApiError

router = APIRouter(prefix="/api/v1", tags=["auth"])


class ProfileOut(BaseModel):
    id: str
    full_name: str = ""
    phone: str | None = None
    locale: str = "he"
    last_workspace_id: str | None = None


class MembershipOut(BaseModel):
    workspace_id: str
    workspace_name: str
    workspace_status: str
    role_key: str
    technician_code: str | None = None
    program_type: str | None = None
    plan_key: str
    features: list[str]
    is_beta: bool = False
    beta_program: str | None = None


class SessionOut(BaseModel):
    user_id: str
    email: str | None = None
    profile: ProfileOut | None = None
    memberships: list[MembershipOut]
    has_workspace: bool
    is_platform_admin: bool = False


class ProfilePatch(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = None
    locale: str | None = None


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
            "select": "workspace_id,role_key,technician_code,program_type,workspaces(id,name,status,is_beta,beta_program)",
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
            ent_res = client.rpc("my_workspace_entitlements", {"p_workspace_id": ws_id})
            plan_key = default_plan_key()
            features: list[str] = []
            if ent_res.status_code == 200 and ent_res.json():
                payload = ent_res.json()
                plan_key = payload.get("plan_key") or default_plan_key()
                features = list(payload.get("features") or [])
            memberships.append(
                MembershipOut(
                    workspace_id=ws_id,
                    workspace_name=nested["name"],
                    workspace_status=nested["status"],
                    role_key=row["role_key"],
                    technician_code=row.get("technician_code"),
                    program_type=row.get("program_type"),
                    plan_key=plan_key,
                    features=features,
                    is_beta=bool(nested.get("is_beta")),
                    beta_program=nested.get("beta_program"),
                )
            )

    profile = None
    if profile_row:
        profile = ProfileOut(
            id=profile_row["id"],
            full_name=profile_row.get("full_name") or "",
            phone=profile_row.get("phone"),
            locale=profile_row.get("locale") or "he",
            last_workspace_id=profile_row.get("last_workspace_id"),
        )

    return SessionOut(
        user_id=user_id,
        email=user.get("email"),
        profile=profile,
        memberships=memberships,
        has_workspace=len(memberships) > 0,
        is_platform_admin=bool(profile_row.get("is_platform_admin")) if profile_row else False,
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
