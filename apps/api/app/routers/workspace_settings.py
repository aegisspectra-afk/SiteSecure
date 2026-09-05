"""Workspace settings, RBAC roles, and PDF document templates — production admin APIs."""

from __future__ import annotations

import re
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..audit import write_audit
from ..authz.engine import authorize
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import MESSAGES, ApiError
from ..supabase_service import ServiceClient
from ..workspace_rbac import (
    SYSTEM_ROLE_META,
    catalog_grant_list,
    ensure_workspace_roles,
    find_workspace_role,
    normalize_grants,
)

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["settings"])


def _raise(decision) -> None:
    if decision.allowed:
        return
    status = 401 if decision.code == "UNAUTHENTICATED" else 403
    raise ApiError(status, decision.code or "PERMISSION_DENIED", decision.message_he, decision.details)


# ── Workspace settings (JSON columns) ─────────────────────────────────────────


class WorkspaceSettingsOut(BaseModel):
    workspace_id: str
    branding: dict[str, Any] = Field(default_factory=dict)
    quotes: dict[str, Any] = Field(default_factory=dict)
    taxes: dict[str, Any] = Field(default_factory=dict)
    scheduling: dict[str, Any] = Field(default_factory=dict)
    notifications: dict[str, Any] = Field(default_factory=dict)
    localization: dict[str, Any] = Field(default_factory=dict)


class WorkspaceSettingsPatch(BaseModel):
    branding: dict[str, Any] | None = None
    quotes: dict[str, Any] | None = None
    taxes: dict[str, Any] | None = None
    scheduling: dict[str, Any] | None = None
    notifications: dict[str, Any] | None = None
    localization: dict[str, Any] | None = None


def _merge(base: dict, patch: dict) -> dict:
    out = dict(base or {})
    for key, value in patch.items():
        if value is None:
            continue
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = {**out[key], **value}
        else:
            out[key] = value
    return out


def _settings_row(client: UserClient, workspace_id: str) -> dict:
    res = client.get(
        "workspace_settings",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "select": "workspace_id,branding,quotes,taxes,scheduling,notifications,localization",
        },
    )
    if res.status_code != 200 or not res.json():
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return res.json()[0]


@router.get("/settings", response_model=WorkspaceSettingsOut)
def get_workspace_settings(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> WorkspaceSettingsOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise(authorize(ctx=ctx, action="workspace.edit"))
    row = _settings_row(client, str(workspace_id))
    return WorkspaceSettingsOut(
        workspace_id=str(workspace_id),
        branding=row.get("branding") or {},
        quotes=row.get("quotes") or {},
        taxes=row.get("taxes") or {},
        scheduling=row.get("scheduling") or {},
        notifications=row.get("notifications") or {},
        localization=row.get("localization") or {},
    )


@router.patch("/settings", response_model=WorkspaceSettingsOut)
def patch_workspace_settings(
    workspace_id: UUID,
    body: WorkspaceSettingsPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> WorkspaceSettingsOut:
    from ..documents.company_profile import validate_branding_values

    ctx = load_authz_context(client, user["id"], str(workspace_id))
    # Branding may be edited with settings.branding; other settings need workspace.edit
    if body.branding is not None and all(
        getattr(body, f) is None
        for f in ("quotes", "taxes", "scheduling", "notifications", "localization")
    ):
        decision = authorize(ctx=ctx, action="settings.branding")
        if not decision.allowed:
            decision = authorize(ctx=ctx, action="workspace.edit")
        _raise(decision)
    else:
        _raise(authorize(ctx=ctx, action="workspace.edit"))
    current = _settings_row(client, str(workspace_id))
    patch: dict[str, Any] = {}
    for field in ("branding", "quotes", "taxes", "scheduling", "notifications", "localization"):
        value = getattr(body, field)
        if value is None:
            continue
        if field == "branding":
            errors = validate_branding_values(value)
            if errors:
                raise ApiError(400, "VALIDATION_ERROR", "פרטי מיתוג לא תקינים", {"fields": errors})
        merged = _merge(current.get(field) or {}, value)
        if field == "localization":
            merged["currency"] = "ILS"
            if "quote_prefix" in value and not str(value.get("quote_prefix") or "").strip():
                merged["quote_prefix"] = "Q-"
        patch[field] = merged
    if not patch:
        return WorkspaceSettingsOut(
            workspace_id=str(workspace_id),
            branding=current.get("branding") or {},
            quotes=current.get("quotes") or {},
            taxes=current.get("taxes") or {},
            scheduling=current.get("scheduling") or {},
            notifications=current.get("notifications") or {},
            localization=current.get("localization") or {},
        )
    res = client.patch(
        "workspace_settings",
        patch,
        params={"workspace_id": f"eq.{workspace_id}"},
    )
    if res.status_code not in {200, 204} or not res.json():
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    row = res.json()[0]
    audit_meta: dict[str, Any] = {"result": "success", "fields": sorted(patch.keys())}
    if "branding" in patch:
        prev_b = current.get("branding") or {}
        next_b = patch["branding"]
        identity_keys = (
            "legalName",
            "legal_name",
            "businessNumber",
            "business_number",
            "logoUrl",
            "logo_url",
            "logoStoragePath",
            "bankAccount",
            "bank_account",
        )
        changed = [k for k in identity_keys if prev_b.get(k) != next_b.get(k) and (k in next_b or k in prev_b)]
        if changed:
            audit_meta["identity_fields"] = changed
            write_audit(
                client,
                str(workspace_id),
                "company.identity_changed",
                entity_type="workspace_settings",
                entity_id=str(workspace_id),
                metadata={"result": "success", "fields": changed},
            )
    write_audit(
        client,
        str(workspace_id),
        "workspace.edit",
        entity_type="workspace_settings",
        entity_id=str(workspace_id),
        metadata=audit_meta,
    )
    return WorkspaceSettingsOut(
        workspace_id=str(workspace_id),
        branding=row.get("branding") or {},
        quotes=row.get("quotes") or {},
        taxes=row.get("taxes") or {},
        scheduling=row.get("scheduling") or {},
        notifications=row.get("notifications") or {},
        localization=row.get("localization") or {},
    )


class CompanyProfileOut(BaseModel):
    workspace_id: str
    profile: dict[str, Any]
    missing_for_quote: list[str] = Field(default_factory=list)


@router.get("/company-profile", response_model=CompanyProfileOut)
def get_company_profile(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> CompanyProfileOut:
    from ..documents.company_profile import missing_quote_company_fields, normalize_company_profile

    ctx = load_authz_context(client, user["id"], str(workspace_id))
    decision = authorize(ctx=ctx, action="settings.branding")
    if not decision.allowed:
        decision = authorize(ctx=ctx, action="workspace.edit")
    _raise(decision)
    row = _settings_row(client, str(workspace_id))
    ws = client.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "name,country_code"})
    workspace = ws.json()[0] if ws.status_code == 200 and ws.json() else {"name": ""}
    profile = normalize_company_profile(workspace, row.get("branding") or {})
    return CompanyProfileOut(
        workspace_id=str(workspace_id),
        profile=dict(profile),
        missing_for_quote=missing_quote_company_fields(profile),
    )


class CompanyLogoUploadIn(BaseModel):
    original_filename: str | None = None
    mime_type: str
    byte_size: int = Field(ge=1, le=2 * 1024 * 1024)


@router.post("/company-profile/logo-upload")
def create_company_logo_upload(
    workspace_id: UUID,
    body: CompanyLogoUploadIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """Signed upload into branding bucket — unique path so historical snapshots stay valid."""
    import uuid as uuid_mod

    ctx = load_authz_context(client, user["id"], str(workspace_id))
    decision = authorize(ctx=ctx, action="settings.branding")
    if not decision.allowed:
        decision = authorize(ctx=ctx, action="workspace.edit")
    _raise(decision)
    mime = (body.mime_type or "").lower().strip()
    allowed = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
    if mime not in allowed:
        raise ApiError(400, "VALIDATION_ERROR", "סוג קובץ לוגו לא נתמך (PNG/JPEG/WebP)")
    ext = {"image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp"}[mime]
    asset_id = str(uuid_mod.uuid4())
    path = f"{workspace_id}/company/logo/{asset_id}.{ext}"
    signed = client.storage_sign_upload("branding", path)
    return {
        "logo_asset_id": asset_id,
        "logo_bucket": "branding",
        "logo_storage_path": path,
        "upload_url": signed["upload_url"],
        "expires_in": 7200,
        "mime_type": mime,
        "max_bytes": body.byte_size,
    }


class CompanyLogoCompleteIn(BaseModel):
    logo_asset_id: str
    logo_storage_path: str
    logo_bucket: str = "branding"
    mime_type: str | None = None


@router.post("/company-profile/logo-complete", response_model=CompanyProfileOut)
def complete_company_logo(
    workspace_id: UUID,
    body: CompanyLogoCompleteIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> CompanyProfileOut:
    from ..documents.company_profile import (
        missing_quote_company_fields,
        normalize_company_profile,
    )

    ctx = load_authz_context(client, user["id"], str(workspace_id))
    decision = authorize(ctx=ctx, action="settings.branding")
    if not decision.allowed:
        decision = authorize(ctx=ctx, action="workspace.edit")
    _raise(decision)
    if not str(body.logo_storage_path).startswith(f"{workspace_id}/"):
        raise ApiError(400, "VALIDATION_ERROR", "נתיב לוגו לא תקין")
    current = _settings_row(client, str(workspace_id))
    branding = dict(current.get("branding") or {})
    branding.update(
        {
            "logoAssetId": body.logo_asset_id,
            "logoStoragePath": body.logo_storage_path,
            "logoBucket": body.logo_bucket or "branding",
            "logo_url": None,
        }
    )
    res = client.patch(
        "workspace_settings",
        {"branding": branding},
        params={"workspace_id": f"eq.{workspace_id}"},
    )
    if res.status_code not in {200, 204} or not res.json():
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    write_audit(
        client,
        str(workspace_id),
        "company.identity_changed",
        entity_type="workspace_settings",
        entity_id=str(workspace_id),
        metadata={"result": "success", "fields": ["logo"]},
    )
    ws = client.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "name,country_code"})
    workspace = ws.json()[0] if ws.status_code == 200 and ws.json() else {"name": ""}
    profile = normalize_company_profile(workspace, res.json()[0].get("branding") or {})
    return CompanyProfileOut(
        workspace_id=str(workspace_id),
        profile=dict(profile),
        missing_for_quote=missing_quote_company_fields(profile),
    )


@router.post("/company-profile/document-preview")
def preview_company_document(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    document_type: Literal["quote", "tax_invoice"] = "quote",
    inline: bool = True,
):
    """Live branding preview PDF with safe demo content (invoice = preview banner only)."""
    from ..documents.accounting import refuse_statutory_pdf_without_issuance
    from ..documents.company_profile import company_block_from_profile, normalize_company_profile
    from ..documents.invoice_foundation import build_invoice_preview_context
    from ..pdf_response import pdf_response
    from ..pdf_template_sample import build_sample_quote_document
    from ..quote_pdf import render_quote_pdf

    ctx = load_authz_context(client, user["id"], str(workspace_id))
    decision = authorize(ctx=ctx, action="settings.branding")
    if not decision.allowed:
        decision = authorize(ctx=ctx, action="workspace.edit")
    _raise(decision)

    if document_type == "tax_invoice":
        # Visual foundation only — never claim legal issuance
        err = refuse_statutory_pdf_without_issuance("tax_invoice")
        row = _settings_row(client, str(workspace_id))
        ws = client.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "name,country_code"})
        workspace = ws.json()[0] if ws.status_code == 200 and ws.json() else {"name": ""}
        profile = normalize_company_profile(workspace, row.get("branding") or {})
        company = company_block_from_profile(profile)
        preview_ctx = build_invoice_preview_context(
            company=company,
            customer={"display_name": "לקוח לדוגמה בע״מ"},
            lines=[],
            totals={"subtotal_net": 1000, "vat_amount": 180, "total_gross": 1180, "vat_percent": 18},
            mark_preview=True,
        )
        # Render via quote PDF path with invoice title override for visual hierarchy demo
        document = build_sample_quote_document(
            branding=row.get("branding") or {},
            workspace_name=workspace.get("name") or "—",
        )
        document["company"] = company
        document["title"] = preview_ctx["preview_banner_he"]
        document["number"] = "INV-PREVIEW"
        document["summary"] = err["message_he"] if err else preview_ctx["preview_banner_he"]
        pdf_bytes, filename = render_quote_pdf(document)
        return pdf_response(pdf_bytes, f"PREVIEW-INVOICE-{filename}", inline=inline)

    row = _settings_row(client, str(workspace_id))
    ws = client.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "name"})
    workspace_name = ws.json()[0].get("name") if ws.status_code == 200 and ws.json() else "—"
    document = build_sample_quote_document(
        branding=row.get("branding") or {},
        workspace_name=workspace_name or "—",
    )
    from ..documents.company_profile import company_block_from_profile, normalize_company_profile

    profile = normalize_company_profile({"name": workspace_name}, row.get("branding") or {})
    document["company"] = company_block_from_profile(profile)
    pdf_bytes, filename = render_quote_pdf(document)
    return pdf_response(pdf_bytes, f"PREVIEW-{filename}", inline=inline)


# ── RBAC roles ────────────────────────────────────────────────────────────────


class WorkspaceRoleOut(BaseModel):
    id: str
    key: str
    label_he: str
    description: str = ""
    is_system: bool
    is_locked: bool
    base_role_key: str
    grants: list[str]
    users_count: int = 0


class WorkspaceRoleCreate(BaseModel):
    label_he: str = Field(min_length=2, max_length=80)
    description: str = ""
    base_role_key: str = "viewer"
    grants: list[str] | None = None


class WorkspaceRolePatch(BaseModel):
    label_he: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None
    grants: list[str] | None = None


def _slug_key(label: str) -> str:
    ascii_ish = re.sub(r"[^a-z0-9]+", "_", label.lower())
    ascii_ish = ascii_ish.strip("_") or "custom"
    return f"custom_{ascii_ish[:40]}"


def _member_role_counts(client: UserClient, workspace_id: str) -> dict[str, int]:
    res = client.get(
        "workspace_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "status": "eq.active",
            "select": "role_key,workspace_role_key",
        },
    )
    counts: dict[str, int] = {}
    if res.status_code != 200:
        return counts
    for row in res.json() or []:
        key = row.get("workspace_role_key") or row.get("role_key")
        if not key:
            continue
        counts[key] = counts.get(key, 0) + 1
    return counts


def _role_out(row: dict, counts: dict[str, int]) -> WorkspaceRoleOut:
    return WorkspaceRoleOut(
        id=str(row["id"]),
        key=row["key"],
        label_he=row.get("label_he") or row["key"],
        description=row.get("description") or "",
        is_system=bool(row.get("is_system")),
        is_locked=bool(row.get("is_locked")),
        base_role_key=row.get("base_role_key") or row["key"],
        grants=normalize_grants(row.get("grants")),
        users_count=counts.get(row["key"], 0),
    )


def _plan_allows_custom_rbac(ctx) -> bool:
    """FREE/solo = fixed roles; PRO+ (team feature) = custom roles + editable matrix."""
    return "team" in (ctx.features or frozenset())


@router.get("/roles", response_model=list[WorkspaceRoleOut])
def list_workspace_roles(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> list[WorkspaceRoleOut]:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    # Team (assign) needs the list; Roles settings page needs roles.manage (gated separately in UI).
    manage = authorize(ctx=ctx, action="roles.manage")
    team = authorize(ctx=ctx, action="users.view")
    if not manage.allowed and not team.allowed:
        _raise(team)
    rows = ensure_workspace_roles(client, str(workspace_id))
    counts = _member_role_counts(client, str(workspace_id))
    return [_role_out(row, counts) for row in rows]


@router.post("/roles", response_model=WorkspaceRoleOut)
def create_workspace_role(
    workspace_id: UUID,
    body: WorkspaceRoleCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> WorkspaceRoleOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise(authorize(ctx=ctx, action="roles.manage"))
    if not _plan_allows_custom_rbac(ctx):
        raise ApiError(403, "FEATURE_NOT_INCLUDED", "תפקידים מותאמים זמינים בתוכנית Business ומעלה")
    ensure_workspace_roles(client, str(workspace_id))
    base = body.base_role_key if body.base_role_key in SYSTEM_ROLE_META else "viewer"
    if base == "owner":
        raise ApiError(400, "VALIDATION_ERROR", "לא ניתן ליצור תפקיד על בסיס בעלים")
    key = _slug_key(body.label_he)
    existing = find_workspace_role(client, str(workspace_id), key)
    if existing:
        key = f"{key}_{str(workspace_id).replace('-', '')[:6]}"
    grants = normalize_grants(body.grants) if body.grants is not None else catalog_grant_list("viewer")
    res = client.post(
        "workspace_roles",
        {
            "workspace_id": str(workspace_id),
            "key": key,
            "label_he": body.label_he.strip(),
            "description": (body.description or "").strip(),
            "is_system": False,
            "is_locked": False,
            "base_role_key": base,
            "grants": grants,
        },
    )
    if res.status_code not in {200, 201} or not res.json():
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן ליצור תפקיד")
    row = res.json()[0] if isinstance(res.json(), list) else res.json()
    write_audit(
        client,
        str(workspace_id),
        "roles.manage",
        entity_type="workspace_role",
        entity_id=str(row["id"]),
        metadata={"result": "success", "action": "create", "key": key},
    )
    return _role_out(row, {})


@router.patch("/roles/{role_id}", response_model=WorkspaceRoleOut)
def patch_workspace_role(
    workspace_id: UUID,
    role_id: UUID,
    body: WorkspaceRolePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> WorkspaceRoleOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise(authorize(ctx=ctx, action="roles.manage"))
    if not _plan_allows_custom_rbac(ctx):
        raise ApiError(403, "FEATURE_NOT_INCLUDED", "עריכת הרשאות זמינה בתוכנית Business ומעלה")
    current = client.get(
        "workspace_roles",
        params={"id": f"eq.{role_id}", "workspace_id": f"eq.{workspace_id}", "select": "*"},
    )
    if current.status_code != 200 or not current.json():
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    row = current.json()[0]
    if row.get("is_locked") or row.get("key") == "owner":
        raise ApiError(403, "BUSINESS_RULE", "תפקיד הבעלים נעול לגישה מלאה")
    patch: dict[str, Any] = {}
    if body.label_he is not None and not row.get("is_system"):
        patch["label_he"] = body.label_he.strip()
    if body.description is not None:
        patch["description"] = body.description.strip()
    if body.grants is not None:
        patch["grants"] = normalize_grants(body.grants)
    if not patch:
        return _role_out(row, _member_role_counts(client, str(workspace_id)))
    res = client.patch(
        "workspace_roles",
        patch,
        params={"id": f"eq.{role_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    if res.status_code not in {200, 204} or not res.json():
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    write_audit(
        client,
        str(workspace_id),
        "roles.manage",
        entity_type="workspace_role",
        entity_id=str(role_id),
        metadata={"result": "success", "action": "patch", "fields": sorted(patch.keys())},
    )
    return _role_out(res.json()[0], _member_role_counts(client, str(workspace_id)))


# ── PDF document templates ────────────────────────────────────────────────────


class PdfTemplateOut(BaseModel):
    id: str
    name: str
    doc_type: Literal["quote", "service", "project"]
    status: Literal["active", "draft", "archived"]
    is_default: bool
    config: dict[str, Any] = Field(default_factory=dict)
    updated_at: str | None = None
    created_at: str | None = None


class PdfTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    doc_type: Literal["quote", "service", "project"] = "quote"
    status: Literal["active", "draft", "archived"] = "draft"
    is_default: bool = False
    config: dict[str, Any] = Field(default_factory=dict)


class PdfTemplatePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    status: Literal["active", "draft", "archived"] | None = None
    is_default: bool | None = None
    config: dict[str, Any] | None = None


def _pdf_out(row: dict) -> PdfTemplateOut:
    return PdfTemplateOut(
        id=str(row["id"]),
        name=row["name"],
        doc_type=row["doc_type"],
        status=row["status"],
        is_default=bool(row.get("is_default")),
        config=row.get("config") or {},
        updated_at=str(row["updated_at"]) if row.get("updated_at") else None,
        created_at=str(row["created_at"]) if row.get("created_at") else None,
    )


def _ensure_pdf_seed(client: UserClient, workspace_id: str) -> None:
    client.rpc("seed_workspace_pdf_templates", {"p_workspace_id": workspace_id})


@router.get("/pdf-templates", response_model=list[PdfTemplateOut])
def list_pdf_templates(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> list[PdfTemplateOut]:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise(authorize(ctx=ctx, action="workspace.edit"))
    _ensure_pdf_seed(client, str(workspace_id))
    res = client.get(
        "pdf_document_templates",
        params={"workspace_id": f"eq.{workspace_id}", "select": "*", "order": "created_at.asc"},
    )
    if res.status_code != 200:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    return [_pdf_out(row) for row in res.json() or []]


@router.post("/pdf-templates", response_model=PdfTemplateOut)
def create_pdf_template(
    workspace_id: UUID,
    body: PdfTemplateCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> PdfTemplateOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise(authorize(ctx=ctx, action="workspace.edit"))
    is_default = bool(body.is_default and body.doc_type == "quote")
    if is_default:
        client.patch(
            "pdf_document_templates",
            {"is_default": False},
            params={"workspace_id": f"eq.{workspace_id}", "doc_type": "eq.quote", "is_default": "eq.true"},
        )
    res = client.post(
        "pdf_document_templates",
        {
            "workspace_id": str(workspace_id),
            "name": body.name.strip(),
            "doc_type": body.doc_type,
            "status": "active" if is_default else body.status,
            "is_default": is_default,
            "config": body.config or {},
        },
    )
    if res.status_code not in {200, 201} or not res.json():
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן ליצור תבנית")
    row = res.json()[0] if isinstance(res.json(), list) else res.json()
    return _pdf_out(row)


@router.patch("/pdf-templates/{template_id}", response_model=PdfTemplateOut)
def patch_pdf_template(
    workspace_id: UUID,
    template_id: UUID,
    body: PdfTemplatePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> PdfTemplateOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise(authorize(ctx=ctx, action="workspace.edit"))
    current = client.get(
        "pdf_document_templates",
        params={"id": f"eq.{template_id}", "workspace_id": f"eq.{workspace_id}", "select": "*"},
    )
    if current.status_code != 200 or not current.json():
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    row = current.json()[0]
    patch: dict[str, Any] = {}
    if body.name is not None:
        patch["name"] = body.name.strip()
    if body.status is not None:
        patch["status"] = body.status
        if body.status == "archived" and row.get("is_default"):
            patch["is_default"] = False
    if body.config is not None:
        patch["config"] = {**(row.get("config") or {}), **body.config}
    if body.is_default is True:
        if row["doc_type"] != "quote":
            raise ApiError(400, "VALIDATION_ERROR", "רק תבנית הצעת מחיר יכולה להיות ברירת מחדל")
        if (body.status or row.get("status")) == "archived":
            raise ApiError(400, "BUSINESS_RULE", "לא ניתן להגדיר תבנית בארכיון כברירת מחדל")
        client.patch(
            "pdf_document_templates",
            {"is_default": False},
            params={"workspace_id": f"eq.{workspace_id}", "doc_type": "eq.quote", "is_default": "eq.true"},
        )
        patch["is_default"] = True
        patch["status"] = "active"
    elif body.is_default is False and row.get("is_default"):
        raise ApiError(400, "BUSINESS_RULE", "חייב להישאר תבנית הצעה אחת כברירת מחדל")
    if not patch:
        return _pdf_out(row)
    res = client.patch(
        "pdf_document_templates",
        patch,
        params={"id": f"eq.{template_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    if res.status_code not in {200, 204} or not res.json():
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    return _pdf_out(res.json()[0])


@router.post("/pdf-templates/{template_id}/duplicate", response_model=PdfTemplateOut)
def duplicate_pdf_template(
    workspace_id: UUID,
    template_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> PdfTemplateOut:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise(authorize(ctx=ctx, action="workspace.edit"))
    current = client.get(
        "pdf_document_templates",
        params={"id": f"eq.{template_id}", "workspace_id": f"eq.{workspace_id}", "select": "*"},
    )
    if current.status_code != 200 or not current.json():
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    src = current.json()[0]
    res = client.post(
        "pdf_document_templates",
        {
            "workspace_id": str(workspace_id),
            "name": f"{src['name']} (עותק)",
            "doc_type": src["doc_type"],
            "status": "draft",
            "is_default": False,
            "config": src.get("config") or {},
        },
    )
    if res.status_code not in {200, 201} or not res.json():
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן לשכפל תבנית")
    row = res.json()[0] if isinstance(res.json(), list) else res.json()
    return _pdf_out(row)


class PdfTemplatePreviewBody(BaseModel):
    """Optional draft overrides so Preview reflects unsaved editor state."""

    name: str | None = None
    config: dict[str, Any] | None = None


@router.post("/pdf-templates/{template_id}/preview")
def preview_pdf_template(
    workspace_id: UUID,
    template_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
    body: PdfTemplatePreviewBody | None = None,
    inline: bool = True,
):
    """Real sample PDF via the same render_quote_pdf path used by Quotes."""
    from ..documents.company_profile import company_block_from_profile, normalize_company_profile
    from ..documents.logo import attach_logo_bytes, resolve_logo_bytes
    from ..pdf_response import pdf_response
    from ..pdf_template_sample import build_sample_quote_document
    from ..quote_pdf import render_quote_pdf

    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise(authorize(ctx=ctx, action="workspace.edit"))
    current = client.get(
        "pdf_document_templates",
        params={"id": f"eq.{template_id}", "workspace_id": f"eq.{workspace_id}", "select": "*"},
    )
    if current.status_code != 200 or not current.json():
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    row = dict(current.json()[0])
    patch = body or PdfTemplatePreviewBody()
    if patch.name:
        row["name"] = patch.name.strip()
    if patch.config is not None:
        row["config"] = {**(row.get("config") or {}), **patch.config}

    settings = client.get(
        "workspace_settings",
        params={"workspace_id": f"eq.{workspace_id}", "select": "branding"},
    )
    branding: dict[str, Any] = {}
    if settings.status_code == 200 and settings.json():
        raw = settings.json()[0].get("branding") or {}
        if isinstance(raw, dict):
            branding = raw
    ws = client.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "name,country_code"})
    workspace = ws.json()[0] if ws.status_code == 200 and ws.json() else {"name": ""}
    workspace_name = workspace.get("name") or "—"

    document = build_sample_quote_document(
        template=row,
        branding=branding,
        workspace_name=workspace_name,
    )
    # Always prefer live Company Profile identity (never invent issuer brand)
    profile = normalize_company_profile(workspace, branding)
    document["company"] = company_block_from_profile(profile)
    document["preview_demo"] = True
    logo = resolve_logo_bytes(
        company=document.get("company") if isinstance(document.get("company"), dict) else None,
        download_fn=svc.storage_download_bytes,
    )
    document = attach_logo_bytes(document, logo)
    pdf_bytes, filename = render_quote_pdf(document)
    return pdf_response(pdf_bytes, f"SAMPLE-{filename}", inline=inline)
