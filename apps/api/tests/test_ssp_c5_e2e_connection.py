"""Isolated SSP connection E2E against local Supabase only (loopback:54321).

Creates throwaway Auth users. Does not read cloud .env for writes.
Does not print secrets. Does not call *.supabase.co.
"""

from __future__ import annotations

import json
import uuid
from typing import Any
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from tests.ssp_c5_local import (
    C5RemoteTargetError,
    assert_local_supabase_url,
    classify_supabase_host,
    require_c5_local_process_env,
)

pytestmark = [pytest.mark.c5_local, pytest.mark.c5_write]


def _classify(url: str) -> dict[str, Any]:
    parsed = urlparse((url or "").strip())
    host = parsed.hostname or ""
    return {
        "scheme": parsed.scheme,
        "host": host,
        "port": parsed.port,
        "host_class": classify_supabase_host(host),
    }


def _svc_headers(settings) -> dict[str, str]:
    key = settings.supabase_service_role_key or ""
    if not key:
        raise C5RemoteTargetError("C5 isolated env missing SUPABASE_SERVICE_ROLE_KEY")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _fail(source: str, status: int | None, body: str, extra: str = "") -> dict[str, Any]:
    text = (body or "")[:400]
    return {
        "ok": False,
        "source": source,
        "status": status,
        "error": extra or text,
    }


def _ok(**kwargs: Any) -> dict[str, Any]:
    return {"ok": True, "source": None, **kwargs}


def _create_local_user(settings, email: str, password: str) -> str:
    """Admin-create a confirmed local Auth user. Returns user id."""
    assert_local_supabase_url(settings.supabase_url)
    base = settings.supabase_url.rstrip("/")
    with httpx.Client(timeout=30) as client:
        created = client.post(
            f"{base}/auth/v1/admin/users",
            headers=_svc_headers(settings),
            json={"email": email, "password": password, "email_confirm": True},
        )
        if created.status_code not in {200, 201}:
            raise AssertionError(f"local GoTrue admin create failed status={created.status_code}")
        uid = str((created.json() or {}).get("id") or "")
        if not uid:
            raise AssertionError("local GoTrue admin create returned no id")
        return uid


def _password_grant(settings, email: str, password: str) -> str:
    assert_local_supabase_url(settings.supabase_url)
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password",
            headers={
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
            json={"email": email, "password": password},
        )
    if res.status_code != 200:
        raise AssertionError(f"local password grant failed status={res.status_code}")
    token = (res.json() or {}).get("access_token")
    if not token:
        raise AssertionError("local password grant returned no access_token")
    return str(token)


def _enable_ssp(settings, workspace_id: str) -> None:
    """Throwaway-workspace override only. Does not change Solo plan defaults."""
    assert_local_supabase_url(settings.supabase_url)
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/workspace_feature_overrides"
            "?on_conflict=workspace_id,feature_key",
            headers={
                **_svc_headers(settings),
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            json={
                "workspace_id": workspace_id,
                "feature_key": "ssp",
                "enabled": True,
            },
        )
    if res.status_code not in {200, 201, 204}:
        raise AssertionError(f"local ssp override failed status={res.status_code}")


def _add_workspace_member(settings, workspace_id: str, user_id: str, role_key: str = "viewer") -> None:
    assert_local_supabase_url(settings.supabase_url)
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/workspace_memberships",
            headers={
                **_svc_headers(settings),
                "Prefer": "return=minimal",
            },
            json={
                "workspace_id": workspace_id,
                "user_id": user_id,
                "role_key": role_key,
                "workspace_role_key": role_key,
                "status": "active",
            },
        )
    if res.status_code not in {200, 201, 204}:
        raise AssertionError(f"local workspace_memberships insert failed status={res.status_code}")


def _snippet(res) -> str:
    try:
        body = res.json()
        if isinstance(body, dict):
            return json.dumps(
                {k: body.get(k) for k in ("code", "error", "message") if k in body},
                ensure_ascii=False,
            )
    except Exception:
        pass
    return (res.text or "")[:300]


@pytest.mark.c5_local
def test_ssp_eight_live_flows_against_local_supabase():
    host = require_c5_local_process_env()
    from app.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    classified = _classify(settings.supabase_url)
    assert classified["host_class"] == "local", classified
    assert classified["port"] == 54321, classified
    assert host == classified["host"]
    assert_local_supabase_url(settings.supabase_url)

    from app.main import create_app

    api = TestClient(create_app())
    marker = uuid.uuid4().hex[:10]
    password = f"SspC5-{marker}-Local!"
    owner_email = f"ssp-c5-owner-{marker}@sitesecure.test"
    other_email = f"ssp-c5-other-{marker}@sitesecure.test"
    officer_email = f"ssp-c5-officer-{marker}@sitesecure.test"

    results: dict[str, Any] = {
        "target": classified,
        "env_source": ".env.c5.local",
    }

    owner_id = _create_local_user(settings, owner_email, password)
    _create_local_user(settings, other_email, password)
    officer_id = _create_local_user(settings, officer_email, password)
    owner_tok = _password_grant(settings, owner_email, password)
    other_tok = _password_grant(settings, other_email, password)
    officer_tok = _password_grant(settings, officer_email, password)
    assert owner_id

    ws_a = api.post(
        "/api/v1/workspaces",
        headers=_auth(owner_tok),
        json={"name": f"SSP C5 A {marker}"},
    )
    if ws_a.status_code not in {200, 201}:
        pytest.fail(
            f"setup workspace A failed source=API status={ws_a.status_code} {_snippet(ws_a)}"
        )
    ws_a_id = str(ws_a.json()["id"])

    ws_b = api.post(
        "/api/v1/workspaces",
        headers=_auth(other_tok),
        json={"name": f"SSP C5 B {marker}"},
    )
    if ws_b.status_code not in {200, 201}:
        pytest.fail(
            f"setup workspace B failed source=API status={ws_b.status_code} {_snippet(ws_b)}"
        )
    ws_b_id = str(ws_b.json()["id"])

    _enable_ssp(settings, ws_a_id)
    _enable_ssp(settings, ws_b_id)

    pre_boot = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/sites", headers=_auth(owner_tok))
    # Company missing is an explicit empty, not a false-success live list.
    if pre_boot.status_code == 200:
        pre_body = pre_boot.json()
        assert pre_body.get("data_mode") in {"empty", "unavailable"}
        assert pre_body.get("items") == []

    boot_a = api.post(
        f"/api/v1/workspaces/{ws_a_id}/ssp/org/bootstrap",
        headers=_auth(owner_tok),
        json={"name": f"חברת בדיקה {marker}"},
    )
    if boot_a.status_code not in {200, 201, 409}:
        pytest.fail(
            "setup bootstrap A failed source="
            f"{'schema' if boot_a.status_code == 503 else 'auth' if boot_a.status_code in {401, 403} else 'API'} "
            f"status={boot_a.status_code} {_snippet(boot_a)}"
        )
    boot_body = boot_a.json() if boot_a.status_code != 409 else {}
    dept_id = (boot_body.get("patrol_department") or {}).get("id")
    org_unit_id = (boot_body.get("root_unit") or {}).get("id")
    if not dept_id or not org_unit_id:
        units = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/org/units", headers=_auth(owner_tok))
        depts = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/org/departments", headers=_auth(owner_tok))
        if units.status_code == 200:
            org_unit_id = next(
                (u.get("id") for u in (units.json().get("items") or []) if u.get("unit_type") == "root"),
                org_unit_id,
            )
        if depts.status_code == 200:
            dept_id = next(
                (d.get("id") for d in (depts.json().get("items") or []) if d.get("key") == "patrol"),
                dept_id,
            )

    boot_b = api.post(
        f"/api/v1/workspaces/{ws_b_id}/ssp/org/bootstrap",
        headers=_auth(other_tok),
        json={"name": f"חברת בידוד {marker}"},
    )
    if boot_b.status_code not in {200, 201}:
        pytest.fail(
            f"setup bootstrap B failed source=API status={boot_b.status_code} {_snippet(boot_b)}"
        )

    # 1. List sites
    listed = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/sites", headers=_auth(owner_tok))
    if listed.status_code != 200:
        results["1_list_sites"] = _fail(
            "schema" if listed.status_code == 503 else "API",
            listed.status_code,
            _snippet(listed),
        )
    else:
        body = listed.json()
        if body.get("data_mode") == "unavailable":
            results["1_list_sites"] = _fail("schema", 200, "data_mode=unavailable")
        else:
            results["1_list_sites"] = _ok(
                data_mode=body.get("data_mode"), count=len(body.get("items") or [])
            )

    # 2. Create office site
    created_site = api.post(
        f"/api/v1/workspaces/{ws_a_id}/ssp/sites",
        headers=_auth(owner_tok),
        json={"name": f"משרד בדיקה {marker}", "kind": "office"},
    )
    if created_site.status_code not in {200, 201}:
        source = "schema" if created_site.status_code == 503 else (
            "permission" if created_site.status_code == 403 else "API"
        )
        results["2_create_office"] = _fail(source, created_site.status_code, _snippet(created_site))
        site_id = None
    else:
        site = created_site.json()
        site_id = site.get("id")
        if site.get("kind") != "office":
            results["2_create_office"] = _fail("API", created_site.status_code, "kind was not office")
        else:
            results["2_create_office"] = _ok(kind=site.get("kind"))

    # 3. Officers screen (dedicated /ssp/officers)
    officers = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/officers", headers=_auth(owner_tok))
    if officers.status_code == 403:
        results["3_list_officers"] = _fail("permission", 403, _snippet(officers))
    elif officers.status_code != 200:
        results["3_list_officers"] = _fail(
            "schema" if officers.status_code == 503 else "API",
            officers.status_code,
            _snippet(officers),
        )
    else:
        obody = officers.json()
        if obody.get("data_mode") == "unavailable":
            results["3_list_officers"] = _fail("schema", 200, "data_mode=unavailable")
        else:
            results["3_list_officers"] = _ok(
                data_mode=obody.get("data_mode"),
                count=len(obody.get("items") or []),
            )

    # 4. Create personal questionnaire
    form_res = api.post(
        f"/api/v1/workspaces/{ws_a_id}/ssp/forms",
        headers=_auth(owner_tok),
        json={"title": "שאלון אישי", "description": "בדיקת C5", "category": "personal_questionnaire"},
    )
    if form_res.status_code not in {200, 201}:
        results["4_create_form"] = _fail(
            "schema" if form_res.status_code == 503 else "API",
            form_res.status_code,
            _snippet(form_res),
        )
        form_id = None
    else:
        form = form_res.json()
        form_id = form.get("id")
        results["4_create_form"] = _ok(status=form.get("status"), category=form.get("category"))

    field_id = str(uuid.uuid4())
    assignment_id = None
    submission_id = None

    # 5. Save definition, publish, assign
    if not form_id or not site_id:
        results["5_save_publish_assign"] = _fail(
            "test_data", None, "form or office site missing from earlier step"
        )
    else:
        put_def = api.put(
            f"/api/v1/workspaces/{ws_a_id}/ssp/forms/{form_id}/definition",
            headers=_auth(owner_tok),
            json={
                "definition": {
                    "fields": [
                        {
                            "id": field_id,
                            "type": "short_text",
                            "label": "שם מלא",
                            "required": True,
                        }
                    ]
                }
            },
        )
        if put_def.status_code != 200:
            results["5_save_publish_assign"] = _fail(
                "API", put_def.status_code, _snippet(put_def), "definition"
            )
        else:
            published = api.post(
                f"/api/v1/workspaces/{ws_a_id}/ssp/forms/{form_id}/publish",
                headers=_auth(owner_tok),
            )
            if published.status_code != 200:
                results["5_save_publish_assign"] = _fail(
                    "API", published.status_code, _snippet(published), "publish"
                )
            else:
                assigned = api.post(
                    f"/api/v1/workspaces/{ws_a_id}/ssp/site-assignments",
                    headers=_auth(owner_tok),
                    json={"form_id": form_id, "site_ids": [site_id], "filler_mode": "site"},
                )
                if assigned.status_code not in {200, 201}:
                    results["5_save_publish_assign"] = _fail(
                        "API", assigned.status_code, _snippet(assigned), "assign"
                    )
                else:
                    items = (assigned.json() or {}).get("items") or []
                    assignment_id = items[0]["id"] if items else None
                    results["5_save_publish_assign"] = _ok(assignment_id=bool(assignment_id))

    # 6. Fill and submit
    if not assignment_id:
        results["6_submit"] = _fail("test_data", None, "assignment missing from step 5")
    else:
        submitted = api.post(
            f"/api/v1/workspaces/{ws_a_id}/ssp/site-assignments/{assignment_id}/submit",
            headers=_auth(owner_tok),
            json={"answers": {field_id: "בודק מקומי"}},
        )
        if submitted.status_code not in {200, 201}:
            results["6_submit"] = _fail("API", submitted.status_code, _snippet(submitted))
        else:
            submission_id = submitted.json().get("id")
            results["6_submit"] = _ok(status=submitted.json().get("status"))

    # 7. Load submission after submit
    loaded = api.get(
        f"/api/v1/workspaces/{ws_a_id}/ssp/submissions",
        headers=_auth(owner_tok),
        params={"form_id": form_id} if form_id else None,
    )
    if loaded.status_code != 200:
        results["7_load_submission"] = _fail(
            "schema" if loaded.status_code == 503 else "API",
            loaded.status_code,
            _snippet(loaded),
        )
    else:
        lbody = loaded.json()
        if lbody.get("data_mode") == "unavailable":
            results["7_load_submission"] = _fail("schema", 200, "data_mode=unavailable")
        else:
            items = lbody.get("items") or []
            found = any(str(i.get("id")) == str(submission_id) for i in items) if submission_id else bool(items)
            if not found:
                results["7_load_submission"] = _fail(
                    "API", 200, f"submitted row not in list count={len(items)}"
                )
            else:
                if submission_id:
                    detail = api.get(
                        f"/api/v1/workspaces/{ws_a_id}/ssp/submissions/{submission_id}",
                        headers=_auth(owner_tok),
                    )
                    if detail.status_code != 200:
                        results["7_load_submission"] = _fail(
                            "API", detail.status_code, _snippet(detail), "get_submission"
                        )
                    else:
                        results["7_load_submission"] = _ok(count=len(items))
                else:
                    results["7_load_submission"] = _ok(count=len(items))

    # 8. Workspace isolation + officer permission
    cross = api.get(f"/api/v1/workspaces/{ws_a_id}/ssp/sites", headers=_auth(other_tok))
    isolation_ok = cross.status_code in {401, 403, 404}
    isolation_note = f"cross_status={cross.status_code}"
    if cross.status_code == 200:
        leaked = [s for s in (cross.json().get("items") or []) if str(s.get("id")) == str(site_id)]
        isolation_ok = not leaked
        isolation_note = f"cross_status=200 leaked={len(leaked)}"

    perm_ok = False
    perm_note = "officer not assigned"
    try:
        _add_workspace_member(settings, ws_a_id, officer_id, "viewer")
        assign_officer = api.put(
            f"/api/v1/workspaces/{ws_a_id}/ssp/org/members",
            headers=_auth(owner_tok),
            json={
                "user_id": officer_id,
                "product_role": "patrol_officer",
                "org_unit_id": org_unit_id,
                "department_id": dept_id,
            },
        )
        if assign_officer.status_code not in {200, 201}:
            perm_note = f"assign_officer status={assign_officer.status_code} {_snippet(assign_officer)}"
        else:
            denied = api.post(
                f"/api/v1/workspaces/{ws_a_id}/ssp/sites",
                headers=_auth(officer_tok),
                json={"name": f"ניסיון שוטר {marker}", "kind": "office"},
            )
            perm_ok = denied.status_code == 403
            perm_note = f"officer_create_status={denied.status_code}"
    except Exception as exc:
        perm_note = f"officer_setup={type(exc).__name__}"

    if isolation_ok and perm_ok:
        results["8_isolation_permissions"] = _ok(note=f"{isolation_note}; {perm_note}")
    else:
        source = "permission" if not perm_ok and isolation_ok else "auth"
        results["8_isolation_permissions"] = _fail(
            source, None, f"{isolation_note}; {perm_note}"
        )

    failed = {k: v for k, v in results.items() if isinstance(v, dict) and v.get("ok") is False}
    print("SSP_C5_E2E_RESULTS " + json.dumps(results, ensure_ascii=False))
    if failed:
        pytest.fail("SSP local E2E failures: " + json.dumps(failed, ensure_ascii=False))
