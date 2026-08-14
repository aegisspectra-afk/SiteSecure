from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

DenyCode = Literal[
    "UNAUTHENTICATED",
    "TENANT_INACTIVE",
    "SUBSCRIPTION_INVALID",
    "FEATURE_NOT_INCLUDED",
    "PERMISSION_DENIED",
    "SCOPE_DENIED",
    "RESOURCE_STATE",
    "BUSINESS_RULE",
]


@dataclass(frozen=True)
class ResourceRef:
    type: str | None = None
    id: str | None = None
    owner_user_id: str | None = None
    site_id: str | None = None
    assignee_ids: tuple[str, ...] = ()
    site_assigned: bool = False
    state: str | None = None


@dataclass(frozen=True)
class AuthzContext:
    user_id: str
    workspace_id: str
    role_key: str
    workspace_status: str
    subscription_status: str
    plan_key: str
    features: frozenset[str]
    assigned_resource_ids: frozenset[str] = field(default_factory=frozenset)


@dataclass(frozen=True)
class Decision:
    allowed: bool
    code: str | None = None
    message_he: str = ""
    details: dict[str, Any] = field(default_factory=dict)
