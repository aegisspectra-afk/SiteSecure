from __future__ import annotations

import re
from typing import Any
from ..errors import ApiError, MESSAGES

FIELD_TYPES = frozenset(
    {
        "short_text",
        "long_text",
        "notes",
        "number",
        "time",
        "single_choice",
        "multi_choice",
        "date",
        "yes_no",
        "consent",
    }
)

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.I,
)


def _bad(details: dict[str, Any] | None = None) -> ApiError:
    return ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"], details or {})


def _as_str(value: object, *, max_len: int) -> str:
    if not isinstance(value, str):
        raise _bad({"reason": "expected_string"})
    text = value.strip()
    if len(text) > max_len:
        raise _bad({"reason": "too_long", "max": max_len})
    return text


def validate_definition(raw: object) -> dict[str, Any]:
    """Validate and normalize a form definition. Returns sanitized dict."""
    if not isinstance(raw, dict):
        raise _bad({"reason": "definition_must_be_object"})
    fields_in = raw.get("fields")
    if not isinstance(fields_in, list):
        raise _bad({"reason": "fields_must_be_array"})
    if len(fields_in) > 100:
        raise _bad({"reason": "too_many_fields"})

    seen_ids: set[str] = set()
    fields: list[dict[str, Any]] = []
    for idx, item in enumerate(fields_in):
        if not isinstance(item, dict):
            raise _bad({"reason": "field_must_be_object", "index": idx})
        field_id = _as_str(item.get("id", ""), max_len=64)
        if not field_id or not _UUID_RE.match(field_id):
            raise _bad({"reason": "field_id_invalid", "index": idx})
        if field_id in seen_ids:
            raise _bad({"reason": "duplicate_field_id", "index": idx})
        seen_ids.add(field_id)

        ftype = _as_str(item.get("type", ""), max_len=32)
        if ftype not in FIELD_TYPES:
            raise _bad({"reason": "unknown_field_type", "index": idx, "type": ftype})

        label = _as_str(item.get("label", ""), max_len=300)
        if not label:
            raise _bad({"reason": "label_required", "index": idx})

        help_text = _as_str(item.get("help_text") or "", max_len=1000)
        required = bool(item.get("required", False))

        field: dict[str, Any] = {
            "id": field_id,
            "type": ftype,
            "label": label,
            "help_text": help_text,
            "required": required,
            "order": idx,
        }

        if ftype in {"single_choice", "multi_choice"}:
            options_in = item.get("options")
            if not isinstance(options_in, list) or len(options_in) < 1:
                raise _bad({"reason": "options_required", "index": idx})
            if len(options_in) > 50:
                raise _bad({"reason": "too_many_options", "index": idx})
            options: list[dict[str, str]] = []
            opt_ids: set[str] = set()
            for oidx, opt in enumerate(options_in):
                if not isinstance(opt, dict):
                    raise _bad({"reason": "option_must_be_object", "index": idx, "option": oidx})
                oid = _as_str(opt.get("id", ""), max_len=64)
                if not oid or not _UUID_RE.match(oid):
                    raise _bad({"reason": "option_id_invalid", "index": idx, "option": oidx})
                if oid in opt_ids:
                    raise _bad({"reason": "duplicate_option_id", "index": idx})
                opt_ids.add(oid)
                olabel = _as_str(opt.get("label", ""), max_len=200)
                if not olabel:
                    raise _bad({"reason": "option_label_required", "index": idx})
                options.append({"id": oid, "label": olabel})
            field["options"] = options

        if ftype == "consent":
            wording = _as_str(item.get("consent_wording") or item.get("label", ""), max_len=4000)
            if not wording:
                raise _bad({"reason": "consent_wording_required", "index": idx})
            field["consent_wording"] = wording
            # Consent checkbox is always mandatory when present as a consent field type
            # unless explicitly optional (product allows configurable mandatory flag).
            field["required"] = bool(item.get("required", True))

        fields.append(field)

    return {"fields": fields}


def validate_answers(
    definition: dict[str, Any],
    answers: object,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Validate answers against a published definition snapshot.

    Returns (normalized_answers, consent_records).
    """
    if not isinstance(answers, dict):
        raise _bad({"reason": "answers_must_be_object"})

    fields = definition.get("fields") if isinstance(definition, dict) else None
    if not isinstance(fields, list):
        raise _bad({"reason": "invalid_definition"})

    field_by_id = {str(f["id"]): f for f in fields if isinstance(f, dict) and f.get("id")}
    unknown = set(str(k) for k in answers.keys()) - set(field_by_id.keys())
    if unknown:
        raise _bad({"reason": "unknown_answer_fields", "fields": sorted(unknown)[:20]})

    normalized: dict[str, Any] = {}
    consent_records: list[dict[str, Any]] = []

    for field_id, field in field_by_id.items():
        ftype = field.get("type")
        required = bool(field.get("required"))
        raw = answers.get(field_id, None)
        present = raw is not None and raw != "" and raw != []

        if required and not present and ftype != "consent":
            raise _bad({"reason": "required_missing", "field_id": field_id})

        if ftype == "consent":
            accepted = raw is True or raw == "true" or raw == 1
            if required and not accepted:
                raise _bad({"reason": "consent_required", "field_id": field_id})
            wording = str(field.get("consent_wording") or field.get("label") or "")
            consent_records.append(
                {
                    "field_id": field_id,
                    "accepted": bool(accepted),
                    "consent_wording": wording,
                }
            )
            normalized[field_id] = bool(accepted)
            continue

        if not present:
            continue

        if ftype == "short_text":
            text = _as_str(raw, max_len=500)
            if required and not text:
                raise _bad({"reason": "required_missing", "field_id": field_id})
            normalized[field_id] = text
        elif ftype in {"long_text", "notes"}:
            text = _as_str(raw, max_len=5000)
            if required and not text:
                raise _bad({"reason": "required_missing", "field_id": field_id})
            normalized[field_id] = text
        elif ftype == "number":
            if isinstance(raw, bool) or not isinstance(raw, (int, float, str)):
                raise _bad({"reason": "invalid_number", "field_id": field_id})
            if isinstance(raw, str):
                text = raw.strip()
                if not re.match(r"^-?\d+(\.\d+)?$", text):
                    raise _bad({"reason": "invalid_number", "field_id": field_id})
                normalized[field_id] = float(text) if "." in text else int(text)
            else:
                normalized[field_id] = raw
        elif ftype == "time":
            text = _as_str(raw, max_len=8)
            if not re.match(r"^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$", text):
                raise _bad({"reason": "invalid_time", "field_id": field_id})
            normalized[field_id] = text[:5]
        elif ftype == "date":
            text = _as_str(raw, max_len=32)
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", text):
                raise _bad({"reason": "invalid_date", "field_id": field_id})
            normalized[field_id] = text
        elif ftype == "yes_no":
            if raw is True or raw == "yes" or raw == "true":
                normalized[field_id] = True
            elif raw is False or raw == "no" or raw == "false":
                normalized[field_id] = False
            else:
                raise _bad({"reason": "invalid_yes_no", "field_id": field_id})
        elif ftype == "single_choice":
            oid = _as_str(raw, max_len=64)
            allowed = {str(o["id"]) for o in field.get("options") or []}
            if oid not in allowed:
                raise _bad({"reason": "invalid_choice", "field_id": field_id})
            normalized[field_id] = oid
        elif ftype == "multi_choice":
            if not isinstance(raw, list):
                raise _bad({"reason": "multi_choice_must_be_array", "field_id": field_id})
            allowed = {str(o["id"]) for o in field.get("options") or []}
            chosen: list[str] = []
            for item in raw:
                oid = _as_str(item, max_len=64)
                if oid not in allowed:
                    raise _bad({"reason": "invalid_choice", "field_id": field_id})
                if oid not in chosen:
                    chosen.append(oid)
            if required and not chosen:
                raise _bad({"reason": "required_missing", "field_id": field_id})
            normalized[field_id] = chosen
        else:
            raise _bad({"reason": "unknown_field_type", "field_id": field_id})

    return normalized, consent_records
