from __future__ import annotations

import pytest

from app.errors import ApiError
from app.ssp.forms_schema import validate_answers, validate_definition
from app.ssp.tokens import hash_access_code, hash_public_token, verify_access_code


def _field(fid: str, ftype: str, **kwargs):
    base = {
        "id": fid,
        "type": ftype,
        "label": "שאלה",
        "help_text": "",
        "required": False,
    }
    base.update(kwargs)
    return base


def test_validate_definition_ok():
    fid = "11111111-1111-4111-8111-111111111111"
    oid = "22222222-2222-4222-8222-222222222222"
    definition = validate_definition(
        {
            "fields": [
                _field(fid, "single_choice", required=True, options=[{"id": oid, "label": "א"}]),
            ]
        }
    )
    assert len(definition["fields"]) == 1
    assert definition["fields"][0]["options"][0]["id"] == oid


def test_validate_definition_rejects_unknown_type():
    fid = "11111111-1111-4111-8111-111111111111"
    with pytest.raises(ApiError) as exc:
        validate_definition({"fields": [_field(fid, "file_upload")]})
    assert exc.value.status_code == 400


def test_validate_answers_required_and_consent():
    fid = "11111111-1111-4111-8111-111111111111"
    cid = "33333333-3333-4333-8333-333333333333"
    definition = {
        "fields": [
            _field(fid, "short_text", required=True, label="שם"),
            _field(
                cid,
                "consent",
                required=True,
                label="הסכמה",
                consent_wording="מאשר/ת עיבוד מידע",
            ),
        ]
    }
    with pytest.raises(ApiError):
        validate_answers(definition, {})
    answers, consent = validate_answers(definition, {fid: "דנה", cid: True})
    assert answers[fid] == "דנה"
    assert consent[0]["accepted"] is True
    assert "מאשר" in consent[0]["consent_wording"]


def test_access_code_hash_roundtrip():
    stored = hash_access_code("secret-99")
    assert "$" in stored
    assert verify_access_code("secret-99", stored) is True
    assert verify_access_code("wrong", stored) is False
    assert hash_public_token("a") != hash_public_token("b")


def test_authorize_ssp_feature_gate():
    from app.authz.engine import authorize
    from app.authz.types import AuthzContext
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    features = catalog["_plan_features"]["business"]
    assert "ssp" in features
    ctx = AuthzContext(
        user_id="u1",
        workspace_id="w1",
        role_key="manager",
        workspace_status="active",
        subscription_status="active",
        plan_key="business",
        features=features,
    )
    assert authorize(ctx=ctx, action="ssp.forms.edit").allowed is True
    ctx_tech = AuthzContext(
        user_id="u2",
        workspace_id="w1",
        role_key="technician",
        workspace_status="active",
        subscription_status="active",
        plan_key="business",
        features=features,
    )
    assert authorize(ctx=ctx_tech, action="ssp.forms.edit").allowed is False


def test_public_assignment_helpers_revoked():
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from app.routers import public_ssp as pub

    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [
            {
                "id": "a1",
                "status": "revoked",
                "revoked_at": "2026-01-01T00:00:00Z",
                "access_code_hash": None,
            }
        ],
    )
    assignment = pub._load_assignment(svc, "tok")
    with pytest.raises(ApiError) as exc:
        pub._assignment_usable(assignment)
    assert exc.value.status_code == 404
