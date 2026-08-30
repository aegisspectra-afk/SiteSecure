from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..authz.guard import require
from ..authz.limits import evaluate_count_limit, raise_plan_limit
from ..authz.types import ResourceRef
from ..authz.usage import fetch_customers_count
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import acked_or_403, as_list, created_or_403, one_or_404, patched_or_403
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["customers"])

CUSTOMER_SELECT = (
    "id,workspace_id,display_name,type,status,legal_name,tax_id,email,phone,"
    "billing_address,notes,created_at,updated_at"
)


class CustomerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(min_length=1, max_length=200)
    type: str = "private"
    status: str = "active"
    legal_name: str | None = None
    tax_id: str | None = None
    email: str | None = None
    phone: str | None = None
    billing_address: dict | None = None
    notes: str | None = None


class CustomerPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    type: str | None = None
    status: str | None = None
    legal_name: str | None = None
    tax_id: str | None = None
    email: str | None = None
    phone: str | None = None
    billing_address: dict | None = None
    notes: str | None = None


class ContactCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=1, max_length=200)
    role_title: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool = False


class ContactOut(BaseModel):
    id: str
    customer_id: str
    full_name: str
    role_title: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool = False


class CustomerOut(BaseModel):
    id: str
    workspace_id: str
    display_name: str
    type: str
    status: str
    legal_name: str | None = None
    tax_id: str | None = None
    email: str | None = None
    phone: str | None = None
    billing_address: dict = Field(default_factory=dict)
    notes: str | None = None
    created_at: str
    updated_at: str


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _out(row: dict) -> CustomerOut:
    return CustomerOut(
        id=row["id"],
        workspace_id=row["workspace_id"],
        display_name=row["display_name"],
        type=row["type"],
        status=row["status"],
        legal_name=row.get("legal_name"),
        tax_id=row.get("tax_id"),
        email=row.get("email"),
        phone=row.get("phone"),
        billing_address=row.get("billing_address") or {},
        notes=row.get("notes"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("/customers")
def list_customers(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": CUSTOMER_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if status:
        params["status"] = f"eq.{status}"
    if q:
        needle = q.strip()
        params["or"] = (
            f"(display_name.ilike.*{needle}*,phone.ilike.*{needle}*,email.ilike.*{needle}*,"
            f"billing_address->>line.ilike.*{needle}*,billing_address->>street.ilike.*{needle}*,"
            f"billing_address->>city.ilike.*{needle}*,billing_address->>formatted.ilike.*{needle}*)"
        )
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("customers", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": [_out(row).model_dump() for row in page.items], "next_cursor": page.next_cursor}


@router.post("/customers", response_model=CustomerOut)
def create_customer(
    workspace_id: UUID,
    body: CustomerCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> CustomerOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.create", resource=ResourceRef(type="customer"))
    raise_plan_limit(
        evaluate_count_limit(
            plan_key=ctx.plan_key,
            limit_key="quota_clients",
            resource="customers",
            current=fetch_customers_count(client, str(workspace_id)),
        )
    )
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        **body.model_dump(exclude_none=True),
    }
    row = created_or_403(client.post("customers", payload))
    return _out(row)


@router.get("/customers/{customer_id}", response_model=CustomerOut)
def get_customer(
    workspace_id: UUID,
    customer_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> CustomerOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.view")
    row = one_or_404(
        client.get(
            "customers",
            params={
                "id": f"eq.{customer_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": CUSTOMER_SELECT,
            },
        )
    )
    return _out(row)


@router.patch("/customers/{customer_id}", response_model=CustomerOut)
def patch_customer(
    workspace_id: UUID,
    customer_id: UUID,
    body: CustomerPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> CustomerOut:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "customers",
            params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "crm.edit", resource=ResourceRef(type="customer", id=existing["id"]))
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch("customers", patch, params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}"})
    )
    return _out(row)


@router.delete("/customers/{customer_id}")
def delete_customer(
    workspace_id: UUID,
    customer_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "customers",
            params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "crm.delete", resource=ResourceRef(type="customer", id=existing["id"]))
    acked_or_403(
        svc.patch(
            "customers",
            {"deleted_at": datetime.now(UTC).isoformat()},
            params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}"},
            prefer="return=minimal",
        )
    )
    return {"ok": True}


@router.get("/customers/{customer_id}/contacts", response_model=list[ContactOut])
def list_contacts(
    workspace_id: UUID,
    customer_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> list[ContactOut]:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.view")
    one_or_404(
        client.get(
            "customers",
            params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    rows = as_list(
        client.get(
            "customer_contacts",
            params={
                "customer_id": f"eq.{customer_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,customer_id,full_name,role_title,email,phone,is_primary",
                "order": "created_at.asc",
            },
        )
    )
    return [ContactOut(**row) for row in rows]


@router.post("/customers/{customer_id}/contacts", response_model=ContactOut)
def create_contact(
    workspace_id: UUID,
    customer_id: UUID,
    body: ContactCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> ContactOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "crm.edit", resource=ResourceRef(type="customer", id=str(customer_id)))
    one_or_404(
        client.get(
            "customers",
            params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    row = created_or_403(
        client.post(
            "customer_contacts",
            {
                "workspace_id": str(workspace_id),
                "customer_id": str(customer_id),
                **body.model_dump(exclude_none=True),
            },
        )
    )
    return ContactOut(
        id=row["id"],
        customer_id=row["customer_id"],
        full_name=row["full_name"],
        role_title=row.get("role_title"),
        email=row.get("email"),
        phone=row.get("phone"),
        is_primary=bool(row.get("is_primary")),
    )
