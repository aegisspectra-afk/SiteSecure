"""SSP acceptance lifecycle against local Supabase only (loopback:54321).

Covers the 15 product-acceptance steps plus failure cases.
Creates throwaway Auth users. Does not read cloud .env for writes.
Does not print secrets. Does not call *.supabase.co.
"""

from __future__ import annotations

import json
import uuid
from typing import Any
import pytest
from fastapi.testclient import TestClient

from tests.ssp_c5_local import assert_local_supabase_url, require_c5_local_process_env
from tests.test_ssp_c5_e2e_connection import (
    _auth,
    _classify,
    _create_local_user,
    _enable_ssp,
    _fail,
    _ok,
    _password_grant,
    _snippet,
)

pytestmark = [pytest.mark.c5_local, pytest.mark.c5_write]


def _field(label: str = "שם מלא") -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "type": "short_text",
        "label": label,
        "required": True,
    }


def _create_office(api: TestClient, token: str, ws: str, name: str) -> dict[str, Any]:
    res = api.post(
        f"/api/v1/workspaces/{ws}/ssp/sites",
        headers=_auth(token),
        json={"name": name, "kind": "office"},
    )
    if res.status_code not in {200, 201}:
        return _fail("API", res.status_code, _snippet(res), name)
    body = res.json()
    if body.get("kind") != "office" or body.get("name") != name:
        return _fail("API", res.status_code, "office payload mismatch", name)
    return _ok(id=body.get("id"), name=name)


@pytest.mark.c5_local
def test_ssp_acceptance_lifecycle_against_local_supabase():
    host = require_c5_local_process_env()
    from app.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    classified = _classify(settings.supabase_url)
    assert classified["host_class"] == "local", classified
    assert classified["port"] == 54321, classified
    assert host == classified["host"]
    assert_local_supabase_url(settings.supabase_url)
    assert "supabase.co" not in (settings.supabase_url or "").lower()

    from app.main import create_app

    api = TestClient(create_app())
    marker = uuid.uuid4().hex[:10]
    password = f"SspAcc-{marker}-9x"
    owner_email = f"ssp-acc-owner-{marker}@sitesecure.test"
    other_ws_email = f"ssp-acc-otherws-{marker}@sitesecure.test"

    results: dict[str, Any] = {"target": classified, "env_source": ".env.c5.local"}

    _create_local_user(settings, owner_email, password)
    _create_local_user(settings, other_ws_email, password)
    owner_tok = _password_grant(settings, owner_email, password)
    other_tok = _password_grant(settings, other_ws_email, password)

    ws_a = api.post("/api/v1/workspaces", headers=_auth(owner_tok), json={"name": f"SSP ACC A {marker}"})
    if ws_a.status_code not in {200, 201}:
        pytest.fail(f"setup workspace A failed status={ws_a.status_code} {_snippet(ws_a)}")
    ws_a_id = str(ws_a.json()["id"])

    ws_b = api.post("/api/v1/workspaces", headers=_auth(other_tok), json={"name": f"SSP ACC B {marker}"})
    if ws_b.status_code not in {200, 201}:
        pytest.fail(f"setup workspace B failed status={ws_b.status_code} {_snippet(ws_b)}")
    ws_b_id = str(ws_b.json()["id"])

    _enable_ssp(settings, ws_a_id)
    _enable_ssp(settings, ws_b_id)

    boot_a = api.post(
        f"/api/v1/workspaces/{ws_a_id}/ssp/org/bootstrap",
        headers=_auth(owner_tok),
        json={"name": f"חברת קבלה {marker}"},
    )
    if boot_a.status_code not in {200, 201, 409}:
        pytest.fail(f"bootstrap A failed status={boot_a.status_code} {_snippet(boot_a)}")
    boot_b = api.post(
        f"/api/v1/workspaces/{ws_b_id}/ssp/org/bootstrap",
        headers=_auth(other_tok),
        json={"name": f"חברת בידוד {marker}"},
    )
    if boot_b.status_code not in {200, 201}:
        pytest.fail(f"bootstrap B failed status={boot_b.status_code} {_snippet(boot_b)}")

    # 1. Manager session
    me = api.get("/api/v1/auth/session", headers=_auth(owner_tok))
    results["1_manager_login"] = (
        _ok() if me.status_code == 200 else _fail("auth", me.status_code, _snippet(me))
    )

    # 2-3. Operational offices
    office_names = ["משרד סיור", "שפלה 2", "שפלה 3", "שפלה 4"]
    offices: dict[str, str] = {}
    office_errors = []
    for name in office_names:
        created = _create_office(api, owner_tok, ws_a_id, name)
        if not created.get("ok"):
            office_errors.append(created)
        else:
            offices[name] = str(created["id"])
    results["2_create_patrol_office"] = _ok(id=offices.get("משרד סיור")) if "משרד סיור" in offices else office_errors[0]
    results["3_create_shafla_offices"] = (
        _ok(count=3)
        if all(name in offices for name in ("שפלה 2", "שפלה 3", "שפלה 4"))
        else _fail("API", None, json.dumps(office_errors, ensure_ascii=False))
    )

    # 4-5. Provision user and attach to שפלה 2
    worker_email = f"ssp-acc-worker-{marker}@sitesecure.test"
    worker_password = f"Worker9x-{marker}"
    created_user = api.post(
        f"/api/v1/workspaces/{ws_a_id}/ssp/users",
        headers=_auth(owner_tok),
        json={
            "full_name": "עובד בדיקה",
            "email": worker_email,
            "password": worker_password,
            "product_role": "patrol_officer",
            "site_id": offices.get("שפלה 2"),
        },
    )
    if created_user.status_code not in {200, 201}:
        results["4_create_user"] = _fail("API", created_user.status_code, _snippet(created_user))
        results["5_assign_shafla2"] = _fail("test_data", None, "user missing")
        worker_id = None
        worker_tok = None
    else:
        person = created_user.json()
        worker_id = person.get("user_id")
        site_names = [s.get("name") for s in (person.get("sites") or [])]
        results["4_create_user"] = _ok(user_id=bool(worker_id), created_auth=person.get("created_auth"))
        results["5_assign_shafla2"] = (
            _ok() if "שפלה 2" in site_names else _fail("API", 201, f"sites={site_names}")
        )
        worker_tok = _password_grant(settings, worker_email, worker_password)

    other_office_email = f"ssp-acc-otheroff-{marker}@sitesecure.test"
    other_office = api.post(
        f"/api/v1/workspaces/{ws_a_id}/ssp/users",
        headers=_auth(owner_tok),
        json={
            "full_name": "עובד שפלה 3",
            "email": other_office_email,
            "password": f"Other9x-{marker}",
            "product_role": "patrol_officer",
            "site_id": offices.get("שפלה 3"),
        },
    )
    other_office_tok = None
    if other_office.status_code in {200, 201}:
        other_office_tok = _password_grant(settings, other_office_email, f"Other9x-{marker}")

    # 6-8. Build, draft, publish
    form_res = api.post(
        f"/api/v1/workspaces/{ws_a_id}/ssp/forms",
        headers=_auth(owner_tok),
        json={"title": "שאלון אישי", "description": "בדיקת קבלה", "category": "personal_questionnaire"},
    )
    form_id = form_res.json().get("id") if form_res.status_code in {200, 201} else None
    results["6_create_form"] = (
        _ok(status=(form_res.json() or {}).get("status"))
        if form_res.status_code in {200, 201}
        else _fail("API", form_res.status_code, _snippet(form_res))
    )
    field = _field()
    if not form_id:
        results["7_save_draft"] = _fail("test_data", None, "form missing")
        results["8_publish"] = _fail("test_data", None, "form missing")
    else:
        put_def = api.put(
            f"/api/v1/workspaces/{ws_a_id}/ssp/forms/{form_id}/definition",
            headers=_auth(owner_tok),
            json={"definition": {"fields": [field]}},
        )
        results["7_save_draft"] = (
            _ok() if put_def.status_code == 200 else _fail("API", put_def.status_code, _snippet(put_def))
        )
        published = api.post(
            f"/api/v1/workspaces/{ws_a_id}/ssp/forms/{form_id}/publish",
            headers=_auth(owner_tok),
        )
        pub_body = published.json() if published.status_code == 200 else {}
        results["8_publish"] = (
            _ok(version=pub_body.get("latest_published_version") or (pub_body.get("form") or {}).get("latest_published_version"))
            if published.status_code == 200
            else _fail("API", published.status_code, _snippet(published))
        )

    # Unpublished assign must fail
    draft_form = api.post(
        f"/api/v1/workspaces/{ws_a_id}/ssp/forms",
        headers=_auth(owner_tok),
        json={"title": "טיוטה בלבד", "description": ""},
    )
    draft_id = draft_form.json().get("id") if draft_form.status_code in {200, 201} else None
    if draft_id and offices.get("שפלה 2"):
        unpublished = api.post(
            f"/api/v1/workspaces/{ws_a_id}/ssp/site-assignments",
            headers=_auth(owner_tok),
            json={"form_id": draft_id, "site_ids": [offices["שפלה 2"]], "filler_mode": "site"},
        )
        results["fail_unpublished_assign"] = (
            _ok(status=unpublished.status_code)
            if unpublished.status_code in {400, 404, 409, 422}
            else _fail("API", unpublished.status_code, "unpublished assign was accepted")
        )
    else:
        results["fail_unpublished_assign"] = _fail("test_data", None, "draft form or office missing")

    missing_target = api.post(
        f"/api/v1/workspaces/{ws_a_id}/ssp/site-assignments",
        headers=_auth(owner_tok),
        json={
            "form_id": form_id or str(uuid.uuid4()),
            "site_ids": [str(uuid.uuid4())],
            "filler_mode": "site",
        },
    )
    results["fail_missing_target"] = (
        _ok(status=missing_target.status_code)
        if missing_target.status_code in {400, 403, 404}
        else _fail("API", missing_target.status_code, "missing target was accepted")
    )

    # 9. Assign published form to the worker / office
    assignment_id = None
    if form_id and offices.get("שפלה 2") and worker_id:
        assigned = api.post(
            f"/api/v1/workspaces/{ws_a_id}/ssp/site-assignments",
            headers=_auth(owner_tok),
            json={
                "form_id": form_id,
                "site_ids": [offices["שפלה 2"]],
                "filler_mode": "users",
                "user_ids": [worker_id],
            },
        )
        items = (assigned.json() or {}).get("items") or []
        assignment_id = items[0]["id"] if items else None
        results["9_assign"] = (
            _ok(assignment_id=bool(assignment_id), target_mode="users")
            if assigned.status_code in {200, 201} and assignment_id
            else _fail("API", assigned.status_code, _snippet(assigned))
        )
    else:
        results["9_assign"] = _fail("test_data", None, "form, office or user missing")

    # 10. Worker inbox
    if not worker_tok:
        results["10_my_forms"] = _fail("test_data", None, "worker token missing")
    else:
        inbox = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/me/forms", headers=_auth(worker_tok))
        items = (inbox.json() or {}).get("items") or [] if inbox.status_code == 200 else []
        found = any(str(i.get("assignment_id")) == str(assignment_id) for i in items)
        results["10_my_forms"] = (
            _ok(count=len(items))
            if inbox.status_code == 200 and found
            else _fail("API", inbox.status_code, _snippet(inbox) if inbox.status_code != 200 else "assignment not in inbox")
        )

    # 11. Worker submit
    submission_id = None
    if not worker_tok or not assignment_id:
        results["11_submit"] = _fail("test_data", None, "worker or assignment missing")
    else:
        submitted = api.post(
            f"/api/v1/workspaces/{ws_a_id}/ssp/site-assignments/{assignment_id}/submit",
            headers=_auth(worker_tok),
            json={"answers": {field["id"]: "תשובת קבלה"}},
        )
        if submitted.status_code not in {200, 201}:
            results["11_submit"] = _fail("API", submitted.status_code, _snippet(submitted))
        else:
            submission_id = submitted.json().get("id")
            results["11_submit"] = _ok(status=submitted.json().get("status"))
            duplicate = api.post(
                f"/api/v1/workspaces/{ws_a_id}/ssp/site-assignments/{assignment_id}/submit",
                headers=_auth(worker_tok),
                json={"answers": {field["id"]: "ניסיון כפול"}},
            )
            results["fail_duplicate_submit"] = (
                _ok(status=duplicate.status_code)
                if duplicate.status_code == 409
                else _fail("API", duplicate.status_code, "duplicate submit accepted")
            )

    # 12-13. Manager sees answers and they persist
    if not submission_id:
        results["12_manager_sees_submission"] = _fail("test_data", None, "submission missing")
        results["13_persist_reload"] = _fail("test_data", None, "submission missing")
    else:
        listed = api.get(
            f"/api/v1/workspaces/{ws_a_id}/ssp/submissions",
            headers=_auth(owner_tok),
            params={"form_id": form_id} if form_id else None,
        )
        detail = api.get(
            f"/api/v1/workspaces/{ws_a_id}/ssp/submissions/{submission_id}",
            headers=_auth(owner_tok),
        )
        answers = (detail.json() or {}).get("answers") if detail.status_code == 200 else {}
        listed_ok = listed.status_code == 200 and any(
            str(i.get("id")) == str(submission_id) for i in ((listed.json() or {}).get("items") or [])
        )
        results["12_manager_sees_submission"] = (
            _ok(answer=answers.get(field["id"]))
            if listed_ok and detail.status_code == 200 and answers.get(field["id"]) == "תשובת קבלה"
            else _fail("API", detail.status_code, _snippet(detail) if detail.status_code != 200 else "answers missing")
        )
        reload_detail = api.get(
            f"/api/v1/workspaces/{ws_a_id}/ssp/submissions/{submission_id}",
            headers=_auth(owner_tok),
        )
        reload_answers = (reload_detail.json() or {}).get("answers") if reload_detail.status_code == 200 else {}
        results["13_persist_reload"] = (
            _ok()
            if reload_detail.status_code == 200 and reload_answers.get(field["id"]) == "תשובת קבלה"
            else _fail("API", reload_detail.status_code, "reload lost answers")
        )

    # 14. Other office / other workspace cannot see
    isolation_notes = []
    isolation_ok = True
    if other_office_tok and assignment_id:
        other_inbox = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/me/forms", headers=_auth(other_office_tok))
        other_items = (other_inbox.json() or {}).get("items") or [] if other_inbox.status_code == 200 else []
        leaked_assign = any(str(i.get("assignment_id")) == str(assignment_id) for i in other_items)
        isolation_notes.append(f"other_office_inbox_leak={leaked_assign}")
        isolation_ok = isolation_ok and other_inbox.status_code == 200 and not leaked_assign
        if submission_id:
            other_detail = api.get(
                f"/api/v1/workspaces/{ws_a_id}/ssp/submissions/{submission_id}",
                headers=_auth(other_office_tok),
            )
            isolation_notes.append(f"other_office_submission={other_detail.status_code}")
            isolation_ok = isolation_ok and other_detail.status_code in {401, 403, 404}
        other_submit = api.post(
            f"/api/v1/workspaces/{ws_a_id}/ssp/site-assignments/{assignment_id}/submit",
            headers=_auth(other_office_tok),
            json={"answers": {field["id"]: "גניבה"}},
        )
        isolation_notes.append(f"other_office_submit={other_submit.status_code}")
        isolation_ok = isolation_ok and other_submit.status_code in {401, 403, 404}
    else:
        isolation_ok = False
        isolation_notes.append("other office user missing")
    cross = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/sites", headers=_auth(other_tok))
    if cross.status_code == 200:
        leaked = [s for s in (cross.json().get("items") or []) if str(s.get("id")) in set(offices.values())]
        isolation_ok = isolation_ok and not leaked
        isolation_notes.append(f"cross_ws_leaked={len(leaked)}")
    else:
        isolation_ok = isolation_ok and cross.status_code in {401, 403, 404}
        isolation_notes.append(f"cross_ws_status={cross.status_code}")
    results["14_isolation"] = _ok(note="; ".join(isolation_notes)) if isolation_ok else _fail("auth", None, "; ".join(isolation_notes))

    # 15. Unauthorized cannot create users, edit forms, or view protected submissions
    perm_ok = True
    perm_notes = []
    if worker_tok:
        denied_user = api.post(
            f"/api/v1/workspaces/{ws_a_id}/ssp/users",
            headers=_auth(worker_tok),
            json={
                "full_name": "לא מורשה",
                "email": f"ssp-acc-denied-{marker}@sitesecure.test",
                "password": f"Denied9x-{marker}",
                "product_role": "patrol_officer",
            },
        )
        perm_ok = perm_ok and denied_user.status_code == 403
        perm_notes.append(f"create_user={denied_user.status_code}")
        denied_form = api.post(
            f"/api/v1/workspaces/{ws_a_id}/ssp/forms",
            headers=_auth(worker_tok),
            json={"title": "ניסיון עריכה", "description": ""},
        )
        perm_ok = perm_ok and denied_form.status_code in {401, 403}
        perm_notes.append(f"create_form={denied_form.status_code}")
        if form_id:
            denied_def = api.put(
                f"/api/v1/workspaces/{ws_a_id}/ssp/forms/{form_id}/definition",
                headers=_auth(worker_tok),
                json={"definition": {"fields": [field]}},
            )
            perm_ok = perm_ok and denied_def.status_code in {401, 403}
            perm_notes.append(f"edit_form={denied_def.status_code}")
        all_subs = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/submissions", headers=_auth(worker_tok))
        if all_subs.status_code == 200:
            leaked_subs = [
                i
                for i in (all_subs.json().get("items") or [])
                if str(i.get("submitted_by") or "") not in {str(worker_id), ""}
            ]
            perm_ok = perm_ok and not leaked_subs
            perm_notes.append(f"list_subs_leak={len(leaked_subs)}")
        else:
            perm_ok = perm_ok and all_subs.status_code in {401, 403}
            perm_notes.append(f"list_subs={all_subs.status_code}")
    else:
        perm_ok = False
        perm_notes.append("worker token missing")
    results["15_unauthorized"] = _ok(note="; ".join(perm_notes)) if perm_ok else _fail("permission", None, "; ".join(perm_notes))

    # Wrong workspace on create user
    if offices.get("שפלה 2"):
        wrong_ws = api.post(
            f"/api/v1/workspaces/{ws_b_id}/ssp/users",
            headers=_auth(owner_tok),
            json={
                "full_name": "חוצה סביבה",
                "email": f"ssp-acc-cross-{marker}@sitesecure.test",
                "password": f"Cross9x-{marker}",
                "site_id": offices["שפלה 2"],
            },
        )
        results["fail_wrong_workspace"] = (
            _ok(status=wrong_ws.status_code)
            if wrong_ws.status_code in {401, 403, 404}
            else _fail("auth", wrong_ws.status_code, "cross-workspace create accepted")
        )
    else:
        results["fail_wrong_workspace"] = _fail("test_data", None, "office missing")

    dash = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/dashboard", headers=_auth(owner_tok))
    if dash.status_code == 200:
        body = dash.json()
        live = body.get("data_mode") == "live"
        results["dashboard_live"] = (
            _ok(
                users_active=body.get("users_active"),
                offices_active=body.get("offices_active"),
                forms_published=body.get("forms_published"),
            )
            if live and (body.get("offices_active") or 0) >= 4 and (body.get("forms_published") or 0) >= 1
            else _fail("API", 200, json.dumps({k: body.get(k) for k in ("data_mode", "users_active", "offices_active", "forms_published")}, ensure_ascii=False))
        )
    else:
        results["dashboard_live"] = _fail("API", dash.status_code, _snippet(dash))

    failed = {k: v for k, v in results.items() if isinstance(v, dict) and v.get("ok") is False}
    print("SSP_ACCEPTANCE_RESULTS " + json.dumps(results, ensure_ascii=False))
    if failed:
        pytest.fail("SSP acceptance failures: " + json.dumps(failed, ensure_ascii=False))
