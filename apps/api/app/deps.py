from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends, Header, Request

from .authz.catalog import default_plan_key
from .authz.types import AuthzContext
from .config import Settings, get_settings
from .errors import MESSAGES, ApiError
from .supabase_service import ServiceClient
from .supabase_user import UserClient

logger = logging.getLogger("site-secure")


def request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "") or str(uuid.uuid4())


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "UNAUTHENTICATED", "נדרשת התחברות")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise ApiError(401, "UNAUTHENTICATED", "נדרשת התחברות")
    return token


def user_client(
    token: Annotated[str, Depends(bearer_token)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> UserClient:
    return UserClient(settings, token)


def service_client(settings: Annotated[Settings, Depends(get_settings)]) -> ServiceClient:
    return ServiceClient(settings)


def current_user(client: Annotated[UserClient, Depends(user_client)]) -> dict:
    return client.get_user()


def parse_entitlements_rpc(response: Any, *, workspace_id: str) -> tuple[str, str, frozenset[str]]:
    """Authoritative effective entitlements from my_workspace_entitlements.

    Fail closed: never substitute catalog base-plan features (would ignore disable overrides).
    Empty ``features`` on HTTP 200 is a valid entitlement set, not a failure.
    """
    status = getattr(response, "status_code", None)
    if status != 200:
        logger.warning("entitlements_rpc_failed workspace_id=%s status=%s", workspace_id, status)
        raise ApiError(
            503,
            "ENTITLEMENTS_UNAVAILABLE",
            MESSAGES["ENTITLEMENTS_UNAVAILABLE"],
            details={"reason": "rpc_http_status"},
        )
    try:
        payload = response.json()
    except Exception:
        logger.warning("entitlements_rpc_invalid_json workspace_id=%s", workspace_id)
        raise ApiError(
            503,
            "ENTITLEMENTS_UNAVAILABLE",
            MESSAGES["ENTITLEMENTS_UNAVAILABLE"],
            details={"reason": "rpc_invalid_body"},
        ) from None
    # Non-member RPC returns null; after membership check this is still unsafe to invent features.
    if payload is None:
        logger.warning("entitlements_rpc_null workspace_id=%s", workspace_id)
        raise ApiError(
            503,
            "ENTITLEMENTS_UNAVAILABLE",
            MESSAGES["ENTITLEMENTS_UNAVAILABLE"],
            details={"reason": "rpc_null"},
        )
    if not isinstance(payload, dict) or "features" not in payload:
        logger.warning("entitlements_rpc_malformed workspace_id=%s", workspace_id)
        raise ApiError(
            503,
            "ENTITLEMENTS_UNAVAILABLE",
            MESSAGES["ENTITLEMENTS_UNAVAILABLE"],
            details={"reason": "rpc_malformed"},
        )
    plan_key = payload.get("plan_key") or default_plan_key()
    sub_status = payload.get("status") or "active"
    features = frozenset(payload.get("features") or [])
    return str(plan_key), str(sub_status), features


def load_authz_context(
    client: UserClient,
    user_id: str,
    workspace_id: str,
) -> AuthzContext:
    memberships = client.get(
        "workspace_memberships",
        params={
            "user_id": f"eq.{user_id}",
            "workspace_id": f"eq.{workspace_id}",
            "status": "eq.active",
            "select": "role_key,technician_code,program_type,status",
        },
    )
    if memberships.status_code != 200 or not memberships.json():
        raise ApiError(404, "NOT_FOUND", "לא נמצא")

    role_key = memberships.json()[0]["role_key"]

    workspace = client.get(
        "workspaces",
        params={"id": f"eq.{workspace_id}", "select": "id,status,name"},
    )
    if workspace.status_code != 200 or not workspace.json():
        raise ApiError(404, "NOT_FOUND", "לא נמצא")
    ws = workspace.json()[0]

    ent = client.rpc("my_workspace_entitlements", {"p_workspace_id": workspace_id})
    plan_key, sub_status, features = parse_entitlements_rpc(ent, workspace_id=workspace_id)

    assigned = client.get(
        "assignments",
        params={"user_id": f"eq.{user_id}", "workspace_id": f"eq.{workspace_id}", "select": "resource_id"},
    )
    assigned_ids = frozenset()
    if assigned.status_code == 200:
        assigned_ids = frozenset(row["resource_id"] for row in assigned.json())

    return AuthzContext(
        user_id=user_id,
        workspace_id=workspace_id,
        role_key=role_key,
        workspace_status=ws["status"],
        subscription_status=sub_status,
        plan_key=plan_key,
        features=features,
        assigned_resource_ids=assigned_ids,
    )


def workspace_authz(workspace_id: str) -> Callable:
    def _dep(
        client: Annotated[UserClient, Depends(user_client)],
        user: Annotated[dict, Depends(current_user)],
    ) -> tuple[UserClient, dict, AuthzContext]:
        ctx = load_authz_context(client, user["id"], workspace_id)
        return client, user, ctx

    return _dep
