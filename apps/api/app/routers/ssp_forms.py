from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..rest import as_list, created_or_403, one_or_404, patched_or_403, schema_missing
from ..ssp.forms_schema import validate_definition
from ..ssp.tokens import hash_access_code, hash_public_token, new_public_token
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}/ssp", tags=["ssp"])

FORM_SELECT = (
    "id,workspace_id,title,description,status,latest_published_version,"
    "created_by,created_at,updated_at,archived_at,category,"
    "company_pk,org_unit_id,department_id"
)
VERSION_SELECT = (
    "id,workspace_id,form_id,version,status,definition,published_at,published_by,created_at"
)
ASSIGNMENT_SELECT = (
    "id,workspace_id,form_id,form_version_id,label,require_account,status,"
    "expires_at,max_submissions,submission_count,created_by,created_at,revoked_at,completed_at"
)
SUBMISSION_SELECT = (
    "id,workspace_id,form_id,form_version_id,assignment_id,site_assignment_id,status,answers,consent,"
    "definition_snapshot,submitted_at,created_at,submitted_by"
)


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _feature_gate(ctx) -> None:
    if "ssp" not in ctx.features:
        raise ApiError(403, "FEATURE_NOT_INCLUDED", MESSAGES["FEATURE_NOT_INCLUDED"], {"feature": "ssp"})


def _ssp_require(ctx, client: UserClient, catalog_action: str, product_action: str | None = None):
    """Workspace catalog grant OR SSP product-role grant (catalog.json unchanged)."""
    from ..ssp.product_authz import require_ssp_action

    return require_ssp_action(
        ctx,
        client,
        catalog_action=catalog_action,
        product_action=product_action or catalog_action,
    )


def _sees_all_submissions(ctx, membership: dict[str, Any] | None) -> bool:
    from ..ssp.product_authz import catalog_allows

    role = membership.get("product_role") if membership else None
    if role == "org_admin":
        return True
    if catalog_allows(ctx, "ssp.submissions.view") and role in {None, "org_admin"}:
        return True
    return False


def _visible_site_assignment_ids(
    client: UserClient, workspace_id: UUID, ctx, membership: dict[str, Any] | None
) -> set[str]:
    from ..ssp.product_authz import catalog_allows, filter_sites_for_membership, load_company, load_member_site_ids

    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        return set()
    sites = as_list(
        client.get(
            "ssp_sites",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "id,department_id,manager_user_id",
            },
        )
    )
    visible = filter_sites_for_membership(
        sites,
        membership,
        catalog_unscoped=catalog_allows(ctx, "ssp.forms.view"),
        member_site_ids=load_member_site_ids(client, workspace_id=str(workspace_id), user_id=ctx.user_id),
        actor_user_id=ctx.user_id,
    )
    ids = [str(s["id"]) for s in visible if s.get("id")]
    if not ids:
        return set()
    assigns = as_list(
        client.get(
            "ssp_form_site_assignments",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_pk": f"in.({','.join(ids)})",
                "select": "id",
            },
        )
    )
    return {str(a["id"]) for a in assigns if a.get("id")}


def _assigned_form_ids(
    client: UserClient, workspace_id: UUID, ctx, membership: dict[str, Any] | None
) -> set[str]:
    visible = _visible_site_assignment_ids(client, workspace_id, ctx, membership)
    if not visible:
        return set()
    assigns = as_list(
        client.get(
            "ssp_form_site_assignments",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "id": f"in.({','.join(visible)})",
                "select": "form_id,status",
            },
        )
    )
    return {
        str(a["form_id"])
        for a in assigns
        if a.get("form_id") and str(a.get("status") or "") in {"active", "paused"}
    }


class FormCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: str | None = Field(default=None, max_length=80)


class FormPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, max_length=80)


class DefinitionPut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    definition: dict[str, Any]


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    form_version_id: str | None = None
    label: str = Field(default="", max_length=200)
    access_code: str | None = Field(default=None, min_length=4, max_length=64)
    require_account: bool = False
    expires_at: str | None = None
    max_submissions: int | None = Field(default=None, ge=1, le=10_000)


# ── Forms ─────────────────────────────────────────────────────────────────────


@router.get("/forms")
def list_forms(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    status: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=80),
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.forms.view")
    from ..ssp.product_authz import catalog_allows, filter_forms_for_membership

    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": FORM_SELECT,
        "order": "updated_at.desc",
    }
    if status:
        params["status"] = f"eq.{status}"
    if category:
        params["category"] = f"eq.{category}"
    items = as_list(client.get("ssp_forms", params=params))
    needle = (q or "").strip().lower()
    if needle:
        items = [
            f
            for f in items
            if needle in str(f.get("title") or "").lower()
            or needle in str(f.get("description") or "").lower()
            or needle in str(f.get("category") or "").lower()
        ]
    items = filter_forms_for_membership(
        items,
        membership,
        catalog_unscoped=catalog_allows(ctx, "ssp.forms.view"),
    )
    # Officers only see published forms assigned to their office(s).
    if membership and membership.get("product_role") == "patrol_officer":
        assigned = _assigned_form_ids(client, workspace_id, ctx, membership)
        items = [f for f in items if f.get("status") == "published" and str(f.get("id")) in assigned]
    return {"items": items}


@router.post("/forms", status_code=201)
def create_form(
    workspace_id: UUID,
    body: FormCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.forms.edit")
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    uid = actor_id(user)
    payload: dict[str, Any] = {
        "workspace_id": str(workspace_id),
        "title": body.title.strip(),
        "description": (body.description or "").strip(),
        "status": "draft",
        "created_by": uid,
        "category": (body.category or "").strip() or None,
    }
    if membership:
        if membership.get("company_pk"):
            payload["company_pk"] = membership["company_pk"]
        if membership.get("org_unit_id"):
            payload["org_unit_id"] = membership["org_unit_id"]
        if membership.get("department_id"):
            payload["department_id"] = membership["department_id"]
    form = created_or_403(
        client.post(
            "ssp_forms",
            json=payload,
            params={"select": FORM_SELECT},
        )
    )
    created_or_403(
        client.post(
            "ssp_form_versions",
            json={
                "workspace_id": str(workspace_id),
                "form_id": form["id"],
                "version": 1,
                "status": "draft",
                "definition": {"fields": []},
            },
            params={"select": VERSION_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.form.create",
        entity_type="ssp_form",
        entity_id=form["id"],
        metadata={"title": form.get("title")},
    )
    return form


@router.get("/forms/{form_id}")
def get_form(
    workspace_id: UUID,
    form_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.forms.view")
    form = one_or_404(
        client.get(
            "ssp_forms",
            params={
                "id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": FORM_SELECT,
            },
        )
    )
    from ..ssp.product_authz import assert_form_in_scope, catalog_allows

    assert_form_in_scope(
        membership,
        form,
        catalog_unscoped=catalog_allows(ctx, "ssp.forms.view"),
    )
    if membership and membership.get("product_role") == "patrol_officer":
        assigned = _assigned_form_ids(client, workspace_id, ctx, membership)
        if str(form.get("id")) not in assigned:
            raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    versions = as_list(
        client.get(
            "ssp_form_versions",
            params={
                "form_id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": VERSION_SELECT,
                "order": "version.desc",
            },
        )
    )
    draft = next((v for v in versions if v.get("status") == "draft"), None)
    published = next((v for v in versions if v.get("status") == "published"), None)
    return {"form": form, "draft_version": draft, "latest_published": published, "versions": versions}


@router.patch("/forms/{form_id}")
def patch_form(
    workspace_id: UUID,
    form_id: UUID,
    body: FormPatch,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.forms.edit")
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    form = one_or_404(
        client.get(
            "ssp_forms",
            params={"id": f"eq.{form_id}", "workspace_id": f"eq.{workspace_id}", "select": FORM_SELECT},
        )
    )
    from ..ssp.product_authz import assert_form_in_scope, catalog_allows

    assert_form_in_scope(
        membership,
        form,
        catalog_unscoped=catalog_allows(ctx, "ssp.forms.edit"),
    )
    if form.get("status") == "archived":
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן לערוך טופס בארכיון")
    patch: dict[str, Any] = {}
    if body.title is not None:
        patch["title"] = body.title.strip()
    if body.description is not None:
        patch["description"] = body.description.strip()
    if body.category is not None:
        patch["category"] = body.category.strip() or None
    if not patch:
        return form
    updated = patched_or_403(
        client.patch(
            "ssp_forms",
            json=patch,
            params={
                "id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": FORM_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.form.update",
        entity_type="ssp_form",
        entity_id=str(form_id),
        metadata={"fields": list(patch.keys())},
    )
    return updated


@router.put("/forms/{form_id}/definition")
def put_definition(
    workspace_id: UUID,
    form_id: UUID,
    body: DefinitionPut,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.forms.edit")
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    form = one_or_404(
        client.get(
            "ssp_forms",
            params={"id": f"eq.{form_id}", "workspace_id": f"eq.{workspace_id}", "select": FORM_SELECT},
        )
    )
    if form.get("status") == "archived":
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן לערוך טופס בארכיון")

    definition = validate_definition(body.definition)
    draft = _ensure_draft_version(client, workspace_id, form_id, form)
    updated = patched_or_403(
        client.patch(
            "ssp_form_versions",
            json={"definition": definition},
            params={
                "id": f"eq.{draft['id']}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.draft",
                "select": VERSION_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.form.definition_update",
        entity_type="ssp_form",
        entity_id=str(form_id),
        metadata={"version": updated.get("version"), "field_count": len(definition["fields"])},
    )
    return updated


def _ensure_draft_version(
    client: UserClient,
    workspace_id: UUID,
    form_id: UUID,
    form: dict,
) -> dict:
    drafts = as_list(
        client.get(
            "ssp_form_versions",
            params={
                "form_id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.draft",
                "select": VERSION_SELECT,
                "limit": "1",
            },
        )
    )
    if drafts:
        return drafts[0]

    # Create new draft from latest published (or version 1 empty)
    published = as_list(
        client.get(
            "ssp_form_versions",
            params={
                "form_id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.published",
                "select": VERSION_SELECT,
                "order": "version.desc",
                "limit": "1",
            },
        )
    )
    if published:
        next_version = int(published[0]["version"]) + 1
        definition = published[0].get("definition") or {"fields": []}
    else:
        next_version = 1
        definition = {"fields": []}

    if form.get("status") == "published":
        patched_or_403(
            client.patch(
                "ssp_forms",
                json={"status": "draft"},
                params={"id": f"eq.{form_id}", "workspace_id": f"eq.{workspace_id}", "select": FORM_SELECT},
            )
        )

    return created_or_403(
        client.post(
            "ssp_form_versions",
            json={
                "workspace_id": str(workspace_id),
                "form_id": str(form_id),
                "version": next_version,
                "status": "draft",
                "definition": definition,
            },
            params={"select": VERSION_SELECT},
        )
    )


@router.post("/forms/{form_id}/publish")
def publish_form(
    workspace_id: UUID,
    form_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.forms.publish")
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    form = one_or_404(
        client.get(
            "ssp_forms",
            params={"id": f"eq.{form_id}", "workspace_id": f"eq.{workspace_id}", "select": FORM_SELECT},
        )
    )
    if form.get("status") == "archived":
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן לפרסם טופס בארכיון")

    draft = _ensure_draft_version(client, workspace_id, form_id, form)
    definition = validate_definition(draft.get("definition") or {"fields": []})
    if not definition["fields"]:
        raise ApiError(400, "VALIDATION_ERROR", "לא ניתן לפרסם טופס ללא שדות")

    from datetime import UTC, datetime

    uid = actor_id(user)
    published_at = datetime.now(UTC).isoformat()
    # Service role: allow draft → published (authenticated UPDATE policy only permits draft rows)
    published = patched_or_403(
        svc.patch(
            "ssp_form_versions",
            json={
                "status": "published",
                "definition": definition,
                "published_at": published_at,
                "published_by": uid,
            },
            params={
                "id": f"eq.{draft['id']}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.draft",
                "select": VERSION_SELECT,
            },
        )
    )

    form_out = patched_or_403(
        svc.patch(
            "ssp_forms",
            json={
                "status": "published",
                "latest_published_version": published["version"],
                "archived_at": None,
            },
            params={"id": f"eq.{form_id}", "workspace_id": f"eq.{workspace_id}", "select": FORM_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.form.publish",
        entity_type="ssp_form",
        entity_id=str(form_id),
        metadata={"version": published.get("version")},
    )
    return {"form": form_out, "version": published}


@router.post("/forms/{form_id}/duplicate", status_code=201)
def duplicate_form(
    workspace_id: UUID,
    form_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.forms.edit")
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    form = one_or_404(
        client.get(
            "ssp_forms",
            params={"id": f"eq.{form_id}", "workspace_id": f"eq.{workspace_id}", "select": FORM_SELECT},
        )
    )
    versions = as_list(
        client.get(
            "ssp_form_versions",
            params={
                "form_id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": VERSION_SELECT,
                "order": "version.desc",
                "limit": "1",
            },
        )
    )
    source_def = (versions[0].get("definition") if versions else None) or {"fields": []}
    uid = actor_id(user)
    new_form = created_or_403(
        client.post(
            "ssp_forms",
            json={
                "workspace_id": str(workspace_id),
                "title": f"{form['title']} (עותק)"[:200],
                "description": form.get("description") or "",
                "category": form.get("category"),
                "status": "draft",
                "created_by": uid,
            },
            params={"select": FORM_SELECT},
        )
    )
    created_or_403(
        client.post(
            "ssp_form_versions",
            json={
                "workspace_id": str(workspace_id),
                "form_id": new_form["id"],
                "version": 1,
                "status": "draft",
                "definition": source_def,
            },
            params={"select": VERSION_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.form.duplicate",
        entity_type="ssp_form",
        entity_id=new_form["id"],
        metadata={"source_form_id": str(form_id)},
    )
    return new_form


@router.post("/forms/{form_id}/archive")
def archive_form(
    workspace_id: UUID,
    form_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.forms.edit")
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    from datetime import UTC, datetime

    updated = patched_or_403(
        client.patch(
            "ssp_forms",
            json={"status": "archived", "archived_at": datetime.now(UTC).isoformat()},
            params={"id": f"eq.{form_id}", "workspace_id": f"eq.{workspace_id}", "select": FORM_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.form.archive",
        entity_type="ssp_form",
        entity_id=str(form_id),
    )
    return updated


# ── Assignments ───────────────────────────────────────────────────────────────


@router.get("/forms/{form_id}/assignments")
def list_assignments(
    workspace_id: UUID,
    form_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.assignments.manage")
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    one_or_404(
        client.get(
            "ssp_forms",
            params={"id": f"eq.{form_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    items = as_list(
        client.get(
            "ssp_form_assignments",
            params={
                "form_id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ASSIGNMENT_SELECT,
                "order": "created_at.desc",
            },
        )
    )
    return {"items": items}


@router.post("/forms/{form_id}/assignments", status_code=201)
def create_assignment(
    workspace_id: UUID,
    form_id: UUID,
    body: AssignmentCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.assignments.manage")
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    form = one_or_404(
        client.get(
            "ssp_forms",
            params={"id": f"eq.{form_id}", "workspace_id": f"eq.{workspace_id}", "select": FORM_SELECT},
        )
    )
    if form.get("status") == "archived":
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן ליצור שיוך לטופס בארכיון")

    version_id = body.form_version_id
    if version_id:
        version = one_or_404(
            client.get(
                "ssp_form_versions",
                params={
                    "id": f"eq.{version_id}",
                    "form_id": f"eq.{form_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": VERSION_SELECT,
                },
            )
        )
    else:
        rows = as_list(
            client.get(
                "ssp_form_versions",
                params={
                    "form_id": f"eq.{form_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "status": "eq.published",
                    "select": VERSION_SELECT,
                    "order": "version.desc",
                    "limit": "1",
                },
            )
        )
        if not rows:
            raise ApiError(400, "BUSINESS_RULE", "יש לפרסם את הטופס לפני יצירת קישור לטאבלט")
        version = rows[0]

    if version.get("status") != "published":
        raise ApiError(400, "BUSINESS_RULE", "ניתן לשייך רק גרסה מפורסמת")

    if body.require_account:
        raise ApiError(
            400,
            "BUSINESS_RULE",
            "שיוך הדורש חשבון משתמש ייתמך בגרסה הבאה; כרגע מותר רק מילוי ללא חשבון",
        )

    token = new_public_token()
    payload: dict[str, Any] = {
        "workspace_id": str(workspace_id),
        "form_id": str(form_id),
        "form_version_id": version["id"],
        "label": (body.label or "").strip(),
        "token_hash": hash_public_token(token),
        "require_account": False,
        "status": "active",
        "created_by": actor_id(user),
        "max_submissions": body.max_submissions,
        "expires_at": body.expires_at,
    }
    if body.access_code:
        payload["access_code_hash"] = hash_access_code(body.access_code)

    # Prefer service client so token row is always writable even if RLS drifts
    row = created_or_403(
        svc.post(
            "ssp_form_assignments",
            json=payload,
            params={"select": ASSIGNMENT_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.assignment.create",
        entity_type="ssp_assignment",
        entity_id=row["id"],
        metadata={
            "form_id": str(form_id),
            "form_version_id": version["id"],
            "has_access_code": bool(body.access_code),
            "max_submissions": body.max_submissions,
        },
    )
    return {**row, "public_token": token, "public_path": f"/ssp/{token}"}


@router.post("/assignments/{assignment_id}/revoke")
def revoke_assignment(
    workspace_id: UUID,
    assignment_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _ssp_require(ctx, client, "ssp.assignments.manage")
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    from datetime import UTC, datetime

    updated = patched_or_403(
        client.patch(
            "ssp_form_assignments",
            json={"status": "revoked", "revoked_at": datetime.now(UTC).isoformat()},
            params={
                "id": f"eq.{assignment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ASSIGNMENT_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.assignment.revoke",
        entity_type="ssp_assignment",
        entity_id=str(assignment_id),
    )
    return updated


# ── Submissions ───────────────────────────────────────────────────────────────


@router.get("/submissions")
def list_submissions(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    form_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    from ..ssp.product_authz import feature_gate, load_ssp_membership, product_grants

    feature_gate(ctx)
    membership = load_ssp_membership(client, workspace_id=str(workspace_id), user_id=ctx.user_id)
    role = membership.get("product_role") if membership else None
    if role == "patrol_officer":
        if "ssp.submissions.view_own" not in product_grants(role):
            raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    else:
        membership = _ssp_require(ctx, client, "ssp.submissions.view")
        role = membership.get("product_role") if membership else None
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": SUBMISSION_SELECT,
        "order": "submitted_at.desc",
        "limit": "100",
    }
    if form_id:
        params["form_id"] = f"eq.{form_id}"
    if status:
        params["status"] = f"eq.{status}"
    if from_date:
        params["submitted_at"] = f"gte.{from_date}"
    if to_date:
        # PostgREST single filter overwrite — combine if both; keep simple for V1
        if "submitted_at" in params:
            params["and"] = f"(submitted_at.gte.{from_date},submitted_at.lte.{to_date})"
            del params["submitted_at"]
        else:
            params["submitted_at"] = f"lte.{to_date}"
    if role == "patrol_officer":
        params["submitted_by"] = f"eq.{ctx.user_id}"
    submissions_res = client.get("ssp_form_submissions", params=params)
    if schema_missing(submissions_res):
        return {"items": [], "data_mode": "unavailable"}
    items = as_list(submissions_res)
    if not _sees_all_submissions(ctx, membership):
        visible = _visible_site_assignment_ids(client, workspace_id, ctx, membership)
        items = [i for i in items if str(i.get("site_assignment_id") or "") in visible]
    # Strip full answers from list for less PII in list payloads
    summary = [
        {
            "id": i["id"],
            "form_id": i["form_id"],
            "form_version_id": i["form_version_id"],
            "assignment_id": i.get("assignment_id"),
            "site_assignment_id": i.get("site_assignment_id"),
            "status": i["status"],
            "submitted_at": i["submitted_at"],
            "has_consent": bool(i.get("consent")),
            "submitted_by": i.get("submitted_by"),
        }
        for i in items
    ]
    return {"items": summary}


@router.get("/submissions/{submission_id}")
def get_submission(
    workspace_id: UUID,
    submission_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    from ..ssp.product_authz import feature_gate, load_ssp_membership, product_grants

    feature_gate(ctx)
    membership = load_ssp_membership(client, workspace_id=str(workspace_id), user_id=ctx.user_id)
    role = membership.get("product_role") if membership else None
    if role != "patrol_officer":
        _ssp_require(ctx, client, "ssp.submissions.view")
    elif "ssp.submissions.view_own" not in product_grants(role):
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    row = one_or_404(
        client.get(
            "ssp_form_submissions",
            params={
                "id": f"eq.{submission_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": SUBMISSION_SELECT,
            },
        )
    )
    if role == "patrol_officer" and str(row.get("submitted_by") or "") != str(ctx.user_id):
        raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    if not _sees_all_submissions(ctx, membership):
        visible = _visible_site_assignment_ids(client, workspace_id, ctx, membership)
        if str(row.get("site_assignment_id") or "") not in visible:
            raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    write_audit(
        client,
        str(workspace_id),
        "ssp.submission.view",
        entity_type="ssp_submission",
        entity_id=str(submission_id),
        metadata={},  # do not log answers
    )
    return row


class OfficerSubmitIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: dict[str, Any] = Field(default_factory=dict)
    site_assignment_id: str | None = None


@router.post("/forms/{form_id}/officer-submit", status_code=201)
def officer_submit_form(
    workspace_id: UUID,
    form_id: UUID,
    body: OfficerSubmitIn,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    """Authenticated Patrol Officer fill — not public_ssp; no form editor rights."""
    ctx = _ctx(client, user, workspace_id)
    from ..ssp.forms_schema import validate_answers
    from ..ssp.product_authz import (
        assert_form_in_scope,
        feature_gate,
        load_ssp_membership,
        product_grants,
    )

    feature_gate(ctx)
    membership = load_ssp_membership(client, workspace_id=str(workspace_id), user_id=ctx.user_id)
    role = membership.get("product_role") if membership else None
    if role != "patrol_officer" or "ssp.forms.submit" not in product_grants(role):
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])

    form = one_or_404(
        client.get(
            "ssp_forms",
            params={
                "id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": FORM_SELECT,
            },
        )
    )
    if form.get("status") != "published":
        raise ApiError(400, "BUSINESS_RULE", "ניתן למלא רק טפסים מפורסמים")
    assert_form_in_scope(membership, form, catalog_unscoped=False)

    versions = as_list(
        client.get(
            "ssp_form_versions",
            params={
                "form_id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.published",
                "select": VERSION_SELECT,
                "order": "version.desc",
                "limit": "1",
            },
        )
    )
    if not versions:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    version = versions[0]
    definition = version.get("definition") or {"fields": []}
    answers, consent = validate_answers(definition, body.answers)

    visible_assign_ids = _visible_site_assignment_ids(client, workspace_id, ctx, membership)
    site_assigns = as_list(
        client.get(
            "ssp_form_site_assignments",
            params={
                "form_id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.active",
                "select": "id,form_id,form_version_id,site_pk",
            },
        )
    )
    site_assigns = [a for a in site_assigns if str(a.get("id")) in visible_assign_ids]
    chosen = None
    if body.site_assignment_id:
        chosen = next((a for a in site_assigns if str(a["id"]) == str(body.site_assignment_id)), None)
        if not chosen:
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    elif len(site_assigns) == 1:
        chosen = site_assigns[0]
    elif len(site_assigns) > 1:
        raise ApiError(400, "BUSINESS_RULE", "יש לבחור הקצאה למשרד לפני מילוי הטופס")
    if not chosen:
        raise ApiError(
            400,
            "BUSINESS_RULE",
            "אין הקצאה פעילה למשרד שלך — מנהל צריך להקצות את הטופס למשרד לפני מילוי",
        )
    row = created_or_403(
        client.post(
            "ssp_form_submissions",
            json={
                "workspace_id": str(workspace_id),
                "form_id": str(form_id),
                "form_version_id": version["id"],
                "assignment_id": None,
                "site_assignment_id": str(chosen["id"]),
                "status": "submitted",
                "answers": answers,
                "consent": consent,
                "definition_snapshot": definition,
                "submitted_by": ctx.user_id,
            },
            params={"select": SUBMISSION_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.officer.submit",
        entity_type="ssp_submission",
        entity_id=row["id"],
        metadata={"form_id": str(form_id), "site_assignment_id": str(chosen["id"])},
    )
    return row

