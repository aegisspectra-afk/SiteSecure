"""Q2.1 bug: saving a CCTV design failed with "נתונים לא תקינים".

The web sends components[i].equipment_intent (stage E2); the API model forbade the field
(extra="forbid"), so every PATCH with components returned 400 VALIDATION_ERROR.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from app.routers import system_designs as sd
from tests.test_system_designs_r1 import DID, WS, _allow, _client_for, _component, _design, _resp

INTENT = {
    "category": "nvr",
    "channels_min": 8,
    "poe": True,
    "note": "לפי דרישה",
    "cost": 999,  # commercial keys are never stored on a design
}


def test_component_model_accepts_equipment_intent():
    body = sd.SystemDesignPatch.model_validate(
        {"revision": 1, "components": [{"role_key": "nvr", "equipment_intent": INTENT}, {"role_key": "camera", "equipment_intent": None}]}
    )
    assert body.components[0].equipment_intent["channels_min"] == 8
    assert body.components[1].equipment_intent is None


def test_patch_stores_and_returns_equipment_intent():
    design = _design(revision=1)
    client = _client_for(design=design, components=[], patch_rows=[{**design, "revision": 2}])
    stored: dict = {}

    def post(table, payload):
        if table == "system_design_components":
            stored.update(payload)
            return _resp(201, [{**_component(), **payload}])
        return _resp(201, [{**design, **payload}])

    calls = {"n": 0}

    def get(table, params=None):
        if table == "system_design_components":
            calls["n"] += 1
            return _resp(200, [] if calls["n"] <= 1 else [{**_component(role_key="nvr"), "equipment_intent": stored.get("equipment_intent")}])
        if table == "quotes":
            from tests.test_system_designs_r1 import _quote

            return _resp(200, [_quote()])
        return _resp(200, [design])

    client.post.side_effect = post
    client.get.side_effect = get
    body = sd.SystemDesignPatch.model_validate(
        {"revision": 1, "components": [{"role_key": "nvr", "equipment_intent": INTENT}]}
    )
    with _allow(), patch("app.routers.system_designs._ctx", return_value=SimpleNamespace()):
        out = sd.patch_system_design(WS, DID, body, client, {"id": "u1"})

    assert stored["equipment_intent"]["channels_min"] == 8
    assert "cost" not in stored["equipment_intent"]
    assert out["components"][0]["equipment_intent"]["channels_min"] == 8


def test_equipment_intent_must_be_an_object():
    body = sd.SystemDesignPatch.model_validate({"revision": 1, "components": [{"role_key": "nvr", "equipment_intent": {"a": 1}}]})
    bad = body.components[0].model_copy(update={"equipment_intent": "not-an-object"})
    try:
        sd._component_payload(workspace_id=str(WS), design_id=str(DID), body=bad)
    except sd.ApiError as exc:
        assert exc.status_code == 400
        assert "equipment_intent" in exc.message
        return
    raise AssertionError("expected VALIDATION_ERROR for a non-object equipment_intent")
