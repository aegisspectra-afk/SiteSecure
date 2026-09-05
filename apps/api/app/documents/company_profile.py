"""Canonical Workspace Company Profile — single source of truth for customer documents."""

from __future__ import annotations

import re
from typing import Any, TypedDict

BUSINESS_NUMBER_TYPES = (
    "company_number",
    "authorized_dealer",
    "exempt_dealer",
    "association",
    "other",
)

BUSINESS_NUMBER_LABELS: dict[str, str] = {
    "company_number": "ח.פ.",
    "authorized_dealer": "ע.מ.",
    "exempt_dealer": "ע.מ.",
    "association": "ע\"ר",
    "other": "מס׳ עוסק",
}

TAX_STATUSES = (
    "vat_registered",
    "exempt",
    "zero_rated",
    "unknown",
)

_HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class CompanyProfile(TypedDict, total=False):
    displayName: str
    legalName: str
    businessNumber: str
    businessNumberType: str
    taxStatus: str
    addressLine1: str
    addressLine2: str
    city: str
    postalCode: str
    countryCode: str
    phone: str
    email: str
    website: str
    logoAssetId: str
    logoStoragePath: str
    logoBucket: str
    logoUrl: str
    brandPrimary: str
    brandAccent: str
    documentLocale: str
    documentCurrency: str
    bankName: str
    bankBranch: str
    bankAccount: str
    bankAccountHolder: str
    paymentInstructions: str
    showBankOnDocuments: bool


def _text(value: object) -> str:
    return str(value or "").strip()


def _pick(brand: dict, *keys: str) -> str:
    for key in keys:
        val = _text(brand.get(key))
        if val:
            return val
    return ""


def normalize_company_profile(
    workspace: dict | None,
    branding: dict | None = None,
) -> CompanyProfile:
    """Map workspaces.name + workspace_settings.branding → canonical CompanyProfile.

    Never invents registration numbers, addresses, or bank details.
    Backfills display/legal name from workspace.name when branding is empty.
    """
    ws = workspace if isinstance(workspace, dict) else {}
    brand = branding if isinstance(branding, dict) else {}
    ws_name = _text(ws.get("name"))

    display = _pick(brand, "displayName", "display_name", "brand_name", "name") or ws_name
    legal = _pick(brand, "legalName", "legal_name") or display

    bn_type = _text(brand.get("businessNumberType") or brand.get("business_number_type"))
    if bn_type not in BUSINESS_NUMBER_TYPES:
        bn_type = "company_number" if _pick(brand, "businessNumber", "business_number", "tax_id", "company_number") else "other"

    tax = _text(brand.get("taxStatus") or brand.get("tax_status"))
    if tax not in TAX_STATUSES:
        tax = "unknown"

    address_line1 = _pick(brand, "addressLine1", "address_line1", "address")
    # Legacy: address may be a single string already consumed as addressLine1
    if not address_line1 and isinstance(brand.get("address"), dict):
        addr = brand["address"]
        address_line1 = _pick(addr, "line", "formatted", "street", "line1")

    primary = _pick(brand, "brandPrimary", "brand_primary", "primaryColor", "primary_color")
    if primary and not _HEX.match(primary):
        primary = ""
    accent = _pick(brand, "brandAccent", "brand_accent", "accentColor")
    if accent and not _HEX.match(accent):
        accent = ""

    profile: CompanyProfile = {
        "displayName": display,
        "legalName": legal,
        "businessNumberType": bn_type,
        "taxStatus": tax,
        "countryCode": _pick(brand, "countryCode", "country_code") or _text(ws.get("country_code")) or "IL",
        "documentLocale": _pick(brand, "documentLocale", "document_locale") or "he-IL",
        "documentCurrency": _pick(brand, "documentCurrency", "document_currency") or "ILS",
        "showBankOnDocuments": bool(brand.get("showBankOnDocuments", brand.get("show_bank_on_documents", False))),
    }

    optional_map = {
        "businessNumber": ("businessNumber", "business_number", "tax_id", "company_number"),
        "addressLine1": (),
        "addressLine2": ("addressLine2", "address_line2"),
        "city": ("city",),
        "postalCode": ("postalCode", "postal_code", "zip"),
        "phone": ("phone",),
        "email": ("email",),
        "website": ("website", "url"),
        "logoAssetId": ("logoAssetId", "logo_asset_id"),
        "logoStoragePath": ("logoStoragePath", "logo_storage_path"),
        "logoBucket": ("logoBucket", "logo_bucket"),
        "logoUrl": ("logoUrl", "logo_url"),
        "bankName": ("bankName", "bank_name"),
        "bankBranch": ("bankBranch", "bank_branch"),
        "bankAccount": ("bankAccount", "bank_account"),
        "bankAccountHolder": ("bankAccountHolder", "bank_account_holder"),
        "paymentInstructions": ("paymentInstructions", "payment_instructions"),
    }
    if address_line1:
        profile["addressLine1"] = address_line1
    for dest, keys in optional_map.items():
        if dest == "addressLine1":
            continue
        val = _pick(brand, *keys) if keys else ""
        if val:
            profile[dest] = val  # type: ignore[literal-required]
    if primary:
        profile["brandPrimary"] = primary
    if accent:
        profile["brandAccent"] = accent
    if not profile.get("logoBucket") and profile.get("logoStoragePath"):
        profile["logoBucket"] = "branding"

    return profile


def company_snapshot_from_profile(profile: CompanyProfile) -> dict[str, Any]:
    """Immutable-friendly subset frozen into issued/sent document snapshots."""
    keys = (
        "displayName",
        "legalName",
        "businessNumber",
        "businessNumberType",
        "taxStatus",
        "addressLine1",
        "addressLine2",
        "city",
        "postalCode",
        "countryCode",
        "phone",
        "email",
        "website",
        "logoAssetId",
        "logoStoragePath",
        "logoBucket",
        "logoUrl",
        "brandPrimary",
        "brandAccent",
        "documentLocale",
        "documentCurrency",
        "bankName",
        "bankBranch",
        "bankAccount",
        "bankAccountHolder",
        "paymentInstructions",
        "showBankOnDocuments",
    )
    return {k: profile[k] for k in keys if k in profile and profile.get(k) not in (None, "")}  # type: ignore[literal-required]


def company_block_from_profile(profile: CompanyProfile) -> dict[str, Any]:
    """Public document `company` object (compatible with existing PDF + web viewers)."""
    display = _text(profile.get("displayName"))
    legal = _text(profile.get("legalName")) or display
    bn = _text(profile.get("businessNumber"))
    bn_type = _text(profile.get("businessNumberType")) or "other"
    label = BUSINESS_NUMBER_LABELS.get(bn_type, BUSINESS_NUMBER_LABELS["other"])

    address_parts = [
        _text(profile.get("addressLine1")),
        _text(profile.get("addressLine2")),
        " ".join(p for p in (_text(profile.get("city")), _text(profile.get("postalCode"))) if p),
    ]
    address_line = ", ".join(p for p in address_parts if p)

    company: dict[str, Any] = {
        "name": display or None,
        "brand_name": display or None,
        "display_name": display or None,
        "legal_name": legal or None,
        "business_number": bn or None,
        "business_number_type": bn_type,
        "business_number_label": label if bn else None,
        "tax_status": profile.get("taxStatus") or "unknown",
        "logo_url": profile.get("logoUrl") or None,
        "logo_asset_id": profile.get("logoAssetId") or None,
        "logo_storage_path": profile.get("logoStoragePath") or None,
        "logo_bucket": profile.get("logoBucket") or None,
        "brand_primary": profile.get("brandPrimary") or None,
        "brand_accent": profile.get("brandAccent") or None,
        "country_code": profile.get("countryCode") or "IL",
        "document_locale": profile.get("documentLocale") or "he-IL",
        "document_currency": profile.get("documentCurrency") or "ILS",
    }
    for key, src in (
        ("phone", "phone"),
        ("email", "email"),
        ("website", "website"),
    ):
        val = _text(profile.get(src))  # type: ignore[arg-type]
        if val:
            company[key] = val
    if address_line:
        company["address"] = address_line
        company["address_line"] = address_line
    if profile.get("showBankOnDocuments"):
        bank = {
            "bank_name": _text(profile.get("bankName")) or None,
            "bank_branch": _text(profile.get("bankBranch")) or None,
            "bank_account": _text(profile.get("bankAccount")) or None,
            "account_holder": _text(profile.get("bankAccountHolder")) or None,
            "instructions": _text(profile.get("paymentInstructions")) or None,
        }
        if any(bank.values()):
            company["payment"] = {k: v for k, v in bank.items() if v}
            company["show_bank"] = True
    return {k: v for k, v in company.items() if v is not None}


def branding_patch_from_profile(profile: CompanyProfile) -> dict[str, Any]:
    """Serialize profile fields into workspace_settings.branding storage shape."""
    out: dict[str, Any] = {}
    for key in CompanyProfile.__annotations__:
        if key in profile and profile.get(key) is not None:  # type: ignore[literal-required]
            out[key] = profile[key]  # type: ignore[literal-required]
    # Keep legacy aliases for older readers during migration window
    if out.get("displayName"):
        out["name"] = out["displayName"]
        out["brand_name"] = out["displayName"]
    if out.get("legalName"):
        out["legal_name"] = out["legalName"]
    if out.get("logoUrl"):
        out["logo_url"] = out["logoUrl"]
    if out.get("addressLine1"):
        out["address"] = out["addressLine1"]
    return out


def missing_quote_company_fields(profile: CompanyProfile) -> list[str]:
    """Minimum fields required to generate a non-embarrassing quote PDF."""
    missing: list[str] = []
    if not _text(profile.get("displayName")):
        missing.append("displayName")
    return missing


def validate_branding_values(brand: dict[str, Any]) -> list[str]:
    """Soft validation errors (shape only — not legal proof of registration)."""
    errors: list[str] = []
    email = _pick(brand, "email")
    if email and not _EMAIL.match(email):
        errors.append("email")
    for color_key in ("brandPrimary", "brand_primary", "brandAccent", "brand_accent"):
        raw = _text(brand.get(color_key))
        if raw and not _HEX.match(raw):
            errors.append(color_key)
    website = _pick(brand, "website", "url")
    if website and not (website.startswith("http://") or website.startswith("https://") or "." in website):
        errors.append("website")
    bn_type = _text(brand.get("businessNumberType") or brand.get("business_number_type"))
    if bn_type and bn_type not in BUSINESS_NUMBER_TYPES:
        errors.append("businessNumberType")
    return errors
