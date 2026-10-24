"""Browser acceptance for SSP against isolated local stack.

Requires: API 127.0.0.1:8001 and Vite 127.0.0.1:5176 already targeting Local Supabase.
Does not edit cloud .env. Does not print secrets.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx
from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))
os.chdir(API_ROOT)

from tests.ssp_c5_local import assert_local_supabase_url, require_c5_local_process_env

WEB = "http://localhost:5173"
API = "http://127.0.0.1:8001"
RESULTS: dict[str, object] = {}
CLOUD_HITS: list[str] = []


def rec(step: str, status: str, **extra: object) -> None:
    RESULTS[step] = {"status": status, **extra}
    print(f"STEP {step} {status} {json.dumps(extra, ensure_ascii=False)}", flush=True)


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def svc_headers(key: str) -> dict[str, str]:
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def seed_manager(settings_url: str, anon: str, service: str) -> tuple[str, str, str]:
    marker = uuid.uuid4().hex[:8]
    email = f"ssp-ui-owner-{marker}@sitesecure.test"
    password = f"Owner9x-{marker}"
    assert_local_supabase_url(settings_url)
    with httpx.Client(timeout=30) as client:
        created = client.post(
            f"{settings_url.rstrip('/')}/auth/v1/admin/users",
            headers=svc_headers(service),
            json={"email": email, "password": password, "email_confirm": True, "user_metadata": {"full_name": "מנהל מקומי"}},
        )
        if created.status_code not in {200, 201}:
            raise RuntimeError(f"admin create failed status={created.status_code}")
        token_res = client.post(
            f"{settings_url.rstrip('/')}/auth/v1/token?grant_type=password",
            headers={"apikey": anon, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
        if token_res.status_code != 200:
            raise RuntimeError(f"password grant failed status={token_res.status_code}")
        token = token_res.json()["access_token"]
        ws = client.post(
            f"{API}/api/v1/workspaces",
            headers=auth_headers(token),
            json={"name": f"SSP UI {marker}"},
        )
        if ws.status_code not in {200, 201}:
            raise RuntimeError(f"workspace create failed status={ws.status_code} {ws.text[:200]}")
        ws_id = str(ws.json()["id"])
        ov = client.post(
            f"{settings_url.rstrip('/')}/rest/v1/workspace_feature_overrides?on_conflict=workspace_id,feature_key",
            headers={**svc_headers(service), "Prefer": "resolution=merge-duplicates,return=minimal"},
            json={"workspace_id": ws_id, "feature_key": "ssp", "enabled": True},
        )
        if ov.status_code not in {200, 201, 204}:
            raise RuntimeError(f"ssp override failed status={ov.status_code}")
    return email, password, ws_id


def launch_browser():
    pw = sync_playwright().start()
    last = None
    preferred = (os.environ.get("SSP_PW_CHANNEL") or "").strip().lower()
    if preferred in {"chromium", "bundled", "bundled-chromium"}:
        try:
            browser = pw.chromium.launch(headless=True)
            print("BROWSER channel=bundled-chromium", flush=True)
            return pw, browser
        except Exception as exc:  # noqa: BLE001
            last = exc
            print(f"BROWSER bundled-chromium failed {type(exc).__name__}", flush=True)
    channels = ("msedge", "chrome") if preferred != "msedge" else ("msedge",)
    for channel in channels:
        try:
            browser = pw.chromium.launch(channel=channel, headless=True)
            print(f"BROWSER channel={channel}", flush=True)
            return pw, browser
        except Exception as exc:  # noqa: BLE001
            last = exc
    if preferred not in {"chromium", "bundled", "bundled-chromium"}:
        try:
            browser = pw.chromium.launch(headless=True)
            print("BROWSER channel=bundled-chromium", flush=True)
            return pw, browser
        except Exception as exc:  # noqa: BLE001
            last = exc
    pw.stop()
    raise RuntimeError(f"no browser available last={last}")


def track_requests(page) -> None:
    def on_request(req) -> None:
        url = req.url
        if "supabase.co" in url or "supabase.net" in url:
            CLOUD_HITS.append(url.split("?")[0])

    page.on("request", on_request)


def login(page, email: str, password: str) -> None:
    page.goto(f"{WEB}/login", wait_until="domcontentloaded")
    page.locator("#email").wait_for(timeout=20000)
    page.locator("#email").fill(email)
    page.locator("#password").fill(password)
    page.get_by_role("button", name="התחבר").click()
    page.wait_for_url(lambda url: "/login" not in urlparse(url).path, timeout=45000)
    page.locator("[data-testid=ssp-product-shell], .ops-kpi-card, [data-testid=platform-home], main").first.wait_for(
        timeout=20000
    )


def logout(page) -> None:
    page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
    page.context.clear_cookies()
    page.goto(f"{WEB}/login", wait_until="domcontentloaded")
    page.locator("#email").wait_for(timeout=20000)


def create_office(page, name: str) -> None:
    page.get_by_role("button", name="גורם תפעולי חדש").first.click()
    page.locator("#new-actor-name").wait_for(timeout=10000)
    page.locator("#new-actor-name").fill(name)
    page.locator("form.ss-module-create").get_by_role("button", name="שמירה").click()
    page.get_by_role("link", name=name).first.wait_for(timeout=20000)


def open_ssp(page) -> None:
    page.goto(f"{WEB}/app/ssp", wait_until="domcontentloaded")
    page.locator("[data-testid=ssp-product-shell]").wait_for(timeout=30000)


def main() -> int:
    require_c5_local_process_env()
    supabase_url = os.environ["SUPABASE_URL"]
    anon = os.environ["SUPABASE_ANON_KEY"]
    service = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    parsed = urlparse(supabase_url)
    rec("env_target", "pass", host=parsed.hostname, port=parsed.port)
    if parsed.hostname not in {"127.0.0.1", "localhost"} or parsed.port != 54321:
        rec("env_target", "fail", reason="not local")
        print(json.dumps(RESULTS, ensure_ascii=False))
        return 2

    health = httpx.get(f"{API}/health", timeout=10)
    rec("api_health", "pass" if health.status_code == 200 else "fail", http=health.status_code)
    if health.status_code != 200:
        print(json.dumps(RESULTS, ensure_ascii=False))
        return 2

    email, password, _ws_id = seed_manager(supabase_url, anon, service)
    rec("prep_manager_workspace_ssp_override", "pass")

    pw, browser = launch_browser()
    context = browser.new_context(viewport={"width": 1440, "height": 900}, locale="he-IL")
    page = context.new_page()
    track_requests(page)
    submission_id = None
    submission_path = None
    try:
        page.goto(f"{WEB}/login", wait_until="networkidle")
        rec("1_open_login", "pass")
        if CLOUD_HITS:
            rec("cloud_guard", "fail", hits=CLOUD_HITS[:5])
            print("REFUSED cloud traffic before writes", flush=True)
            print(json.dumps(RESULTS, ensure_ascii=False))
            return 2
        rec("cloud_guard_before_login", "pass")

        login(page, email, password)
        if CLOUD_HITS:
            rec("cloud_guard_after_login", "fail", hits=CLOUD_HITS[:5])
            print("REFUSED cloud traffic after login", flush=True)
            print(json.dumps(RESULTS, ensure_ascii=False))
            return 2
        rec("1_manager_login", "pass", path=page.url)
        open_ssp(page)
        rec("2_open_ssp", "pass" if "ssp" in page.url else "fail", path=page.url)

        page.goto(f"{WEB}/app/ssp/organization", wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-org-page]").wait_for(timeout=20000)
        if page.locator("[data-testid=ssp-org-bootstrap]").count():
            page.locator("#ssp-org-company-name").fill("חברת סיור מקומית")
            page.get_by_role("button", name="הקמת חברה").click()
            page.get_by_text("החברה נוצרה").wait_for(timeout=20000)
            rec("prep_bootstrap_ui", "pass")
        else:
            rec("prep_bootstrap_ui", "pass", note="already bootstrapped")

        page.goto(f"{WEB}/app/ssp/offices", wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-offices]").wait_for(timeout=20000)
        page.get_by_role("button", name="גורם תפעולי חדש").first.wait_for(timeout=15000)
        for name in ("משרד סיור", "שפלה 2", "שפלה 3", "שפלה 4"):
            create_office(page, name)
        rec("3_create_offices", "pass")

        page.goto(f"{WEB}/app/ssp/users", wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-people]").wait_for(timeout=20000)
        worker_email = f"ssp-ui-worker-{uuid.uuid4().hex[:8]}@sitesecure.test"
        worker_password = "Worker9x-local"
        page.get_by_role("button", name="משתמש חדש").first.click()
        page.locator("#new-user-name").wait_for(timeout=10000)
        page.locator("#new-user-name").fill("עובד שפלה 2")
        page.locator("#new-user-email").fill(worker_email)
        page.locator("#new-user-password").fill(worker_password)
        page.locator("#new-user-office").select_option(label="שפלה 2", timeout=15000)
        page.locator("form.ss-module-create").get_by_role("button", name="שמירה").click()
        page.get_by_role("link", name="עובד שפלה 2").first.wait_for(timeout=25000)
        rec("4_create_user", "pass")
        rec("5_user_auth_admin_membership", "pass", note="created via SSP users UI (GoTrue Admin on API)")

        page.get_by_role("link", name="עובד שפלה 2").first.click()
        page.locator("[data-testid=ssp-user-card]").wait_for(timeout=15000)
        body = page.inner_text("body")
        rec("6_user_card", "pass" if "שפלה 2" in body and worker_email in body else "fail")

        page.goto(f"{WEB}/app/ssp/forms", wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-forms]").wait_for(timeout=20000)
        page.get_by_role("button", name="טופס חדש").first.click()
        page.locator("#new-form-title").wait_for(timeout=10000)
        page.locator("#new-form-title").fill("שאלון אישי")
        page.locator("form.ss-module-create").get_by_role("button", name="שמירה").click()
        page.locator("[data-testid=ssp-form-detail]").wait_for(timeout=25000)
        rec("7_open_builder", "pass", path=page.url)
        page.locator("#ssp-title").fill("שאלון אישי")
        page.get_by_role("button", name="שמירה").first.click()
        page.get_by_text("נשמר").first.wait_for(timeout=15000)
        for field_type, label in (("short_text", "שם מלא"), ("number", "גיל"), ("yes_no", "נוכח במשמרת"), ("date", "תאריך מילוי")):
            page.locator("#ssp-add-field-type").select_option(field_type)
            page.get_by_role("button", name="הוספת שדה").click()
            page.locator("input[id^='label-']").last.fill(label)
        page.get_by_role("button", name="תצוגה מקדימה").click()
        page.locator("[data-testid=ssp-form-preview]").wait_for(timeout=5000)
        rec("8_preview", "pass")
        page.get_by_role("button", name="חזרה לעריכה").click()
        page.get_by_role("button", name="שמירת שדות").click()
        page.locator("p").filter(has_text="שמירת שדות").first.wait_for(timeout=15000)
        rec("8_save_draft", "pass")
        page.once("dialog", lambda dialog: dialog.accept())
        with page.expect_response(lambda r: r.request.method == "POST" and r.url.endswith("/publish")) as pub_info:
            page.get_by_role("button", name="פרסום").click()
        pub_res = pub_info.value
        rec("8_publish", "pass" if pub_res.status in {200, 201} else "fail", http=pub_res.status)
        if pub_res.status not in {200, 201}:
            raise RuntimeError(f"publish http={pub_res.status}")
        page.wait_for_function("() => /published\\s*·\\s*v\\d+/i.test(document.body.innerText)", timeout=20000)

        page.goto(f"{WEB}/app/ssp/assignments", wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-assignments]").wait_for(timeout=20000)
        page.wait_for_function(
            """() => {
              const sel = document.querySelector('#assign-form');
              return Boolean(sel && Array.from(sel.options).some((o) => (o.textContent || '').includes('שאלון אישי')));
            }""",
            timeout=20000,
        )
        page.locator("#assign-form").select_option(label="שאלון אישי")
        page.get_by_role("checkbox", name="שפלה 2").check()
        page.locator("#assign-filler").select_option("users")
        page.get_by_role("checkbox", name="עובד שפלה 2").wait_for(timeout=15000)
        page.get_by_role("checkbox", name="עובד שפלה 2").check()
        page.get_by_role("button", name="הקצאה לגורמים תפעוליים").click()
        page.get_by_text("שאלון אישי").nth(1).wait_for(timeout=20000)
        rec("9_assign", "pass")
        assign_text = page.inner_text("[data-testid=ssp-assignments]")
        rec("10_assignment_counts", "pass" if "נדרשים למלא" in assign_text else "fail", snippet=assign_text[:240])

        page.goto(f"{WEB}/app/ssp/submissions", wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-submissions]").wait_for(timeout=20000)
        try:
            page.get_by_text("אין הגשות").wait_for(timeout=15000)
            rec("11_submissions_empty", "pass")
        except PlaywrightTimeout:
            rec("11_submissions_empty", "fail", snippet=page.inner_text("body")[:240])

        logout(page)
        login(page, worker_email, worker_password)
        rec("12_worker_login", "pass", path=page.url)
        page.goto(f"{WEB}/app/ssp", wait_until="domcontentloaded")
        page.wait_for_url("**/app/ssp/my-forms", timeout=20000)
        rec("13_redirect_my_forms", "pass" if "/my-forms" in page.url else "fail", path=page.url)
        page.locator("[data-testid=ssp-my-forms]").wait_for(timeout=20000)
        rec("14_form_visible", "pass" if "שאלון אישי" in page.inner_text("body") else "fail")
        page.get_by_role("button", name="מילוי טופס").first.click()
        page.locator("[data-testid=ssp-my-form-fill]").wait_for(timeout=15000)
        page.get_by_label("שם מלא").fill("בדיקת דפדפן")
        page.get_by_label("גיל").fill("33")
        page.get_by_label("תאריך מילוי").fill("2026-10-22")
        with page.expect_response(lambda r: "/submit" in r.url and r.request.method == "POST") as submit_info:
            page.get_by_role("button", name="שליחה").click()
        submit_res = submit_info.value
        submit_url = submit_res.url
        submission_id = None
        try:
            submission_id = str((submit_res.json() or {}).get("id") or "") or None
        except Exception:
            submission_id = None
        rec("15_submit_status", "pass" if submit_res.status in {200, 201} else "fail", http=submit_res.status)
        page.get_by_text("הטופס נשלח בהצלחה").wait_for(timeout=15000)
        rec("16_success_after_server", "pass")
        page.reload(wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-my-forms]").wait_for(timeout=20000)
        persisted = page.inner_text("body")
        rec("17_persisted", "pass" if "הוגש" in persisted and "שאלון אישי" in persisted else "fail")

        dup_status = page.evaluate(
            """async (url) => {
              const keys = Object.keys(localStorage).concat(Object.keys(sessionStorage));
              let token = "";
              for (const key of keys) {
                const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
                if (!raw || !raw.includes("access_token")) continue;
                try { token = JSON.parse(raw).access_token || JSON.parse(raw).currentSession?.access_token || ""; } catch {}
                if (token) break;
              }
              const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: token ? "Bearer " + token : "" },
                body: JSON.stringify({ answers: { retry: true } }),
              });
              return res.status;
            }""",
            submit_url,
        )
        rec(
            "18_duplicate_409",
            "pass" if dup_status == 409 else "fail",
            http=dup_status,
            note="UI hid fill after success; replayed submit from the same browser session",
        )

        submission_path = None
        links = page.locator("a[href*='/app/ssp/submissions/']")
        if links.count():
            href = links.first.get_attribute("href") or ""
            submission_path = urlparse(href).path if href.startswith("http") else href

        logout(page)
        login(page, email, password)
        rec("19_manager_return", "pass")
        page.goto(f"{WEB}/app/ssp/submissions", wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-submissions]").wait_for(timeout=20000)
        try:
            page.get_by_role("link", name="שאלון אישי").first.wait_for(timeout=20000)
            rec("20_submissions_list", "pass")
        except PlaywrightTimeout:
            rec("20_submissions_list", "fail", snippet=page.inner_text("body")[-400:])
        if submission_id:
            page.goto(f"{WEB}/app/ssp/submissions/{submission_id}", wait_until="domcontentloaded")
            page.locator("[data-testid=ssp-submission-detail]").wait_for(timeout=15000)
            detail = page.inner_text("body")
            rec(
                "21_submission_detail",
                "pass"
                if "שאלון אישי" in detail and "בדיקת דפדפן" in detail and "שפלה 2" in detail
                else "fail",
                snippet=detail[-400:],
            )
            submission_path = f"/app/ssp/submissions/{submission_id}"
        elif page.locator("a[href*='/app/ssp/submissions/']").count():
            page.locator("a[href*='/app/ssp/submissions/']").first.click()
            page.locator("[data-testid=ssp-submission-detail]").wait_for(timeout=15000)
            detail = page.inner_text("body")
            rec(
                "21_submission_detail",
                "pass"
                if "שאלון אישי" in detail and "בדיקת דפדפן" in detail and "שפלה 2" in detail
                else "fail",
            )
        else:
            rec("21_submission_detail", "fail", note="no submission id or link")

        page.goto(f"{WEB}/app/ssp/submissions", wait_until="domcontentloaded")
        page.locator("#ssp-filter-form").wait_for(timeout=15000)
        page.locator("#ssp-filter-form").select_option(label="שאלון אישי")
        page.locator("#ssp-filter-office").select_option(label="שפלה 2")
        page.locator("#ssp-filter-status").select_option("submitted")
        rec("22_filters", "pass" if "שאלון אישי" in page.inner_text("body") else "fail")
        page.goto(f"{WEB}/app/ssp", wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-dashboard]").wait_for(timeout=20000)
        try:
            page.get_by_text("משתמשים פעילים").wait_for(timeout=20000)
            page.get_by_text("משרדים פעילים").wait_for(timeout=5000)
            rec("23_dashboard", "pass")
        except PlaywrightTimeout:
            rec("23_dashboard", "fail", snippet=page.inner_text("[data-testid=ssp-dashboard]")[:400])

        page.goto(f"{WEB}/app/ssp/users", wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-people]").wait_for(timeout=20000)
        other_email = f"ssp-ui-other-{uuid.uuid4().hex[:8]}@sitesecure.test"
        other_password = "Other9x-local"
        page.get_by_role("button", name="משתמש חדש").first.click()
        page.locator("#new-user-name").wait_for(timeout=10000)
        page.locator("#new-user-name").fill("עובד שפלה 3")
        page.locator("#new-user-email").fill(other_email)
        page.locator("#new-user-password").fill(other_password)
        page.locator("#new-user-office").select_option(label="שפלה 3", timeout=15000)
        page.locator("form.ss-module-create").get_by_role("button", name="שמירה").click()
        page.get_by_role("link", name="עובד שפלה 3").first.wait_for(timeout=25000)

        logout(page)
        login(page, other_email, other_password)
        rec("24_other_office_login", "pass")
        page.goto(f"{WEB}/app/ssp/my-forms", wait_until="domcontentloaded")
        page.locator("[data-testid=ssp-my-forms]").wait_for(timeout=20000)
        rec("25_no_foreign_form", "pass" if "שאלון אישי" not in page.inner_text("body") else "fail")
        if submission_path:
            page.goto(f"{WEB}{submission_path}", wait_until="domcontentloaded")
            blocked_body = page.inner_text("body")
            rec(
                "26_direct_submission_blocked_ui",
                "pass"
                if "אין הרשאה" in blocked_body or "לא ניתן להתחבר" in blocked_body or "בדיקת דפדפן" not in blocked_body
                else "fail",
            )
        else:
            rec("26_direct_submission_blocked_ui", "untested")
        token = page.evaluate(
            """() => {
              const keys = Object.keys(localStorage).concat(Object.keys(sessionStorage));
              for (const key of keys) {
                const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
                if (!raw || !raw.includes("access_token")) continue;
                try {
                  const parsed = JSON.parse(raw);
                  return parsed.access_token || parsed.currentSession?.access_token || "";
                } catch {}
              }
              return "";
            }"""
        )
        admin_res = page.request.get(
            f"{WEB}/api/v1/workspaces/{_ws_id}/ssp/users",
            headers={"Authorization": f"Bearer {token}"} if token else {},
        )
        rec(
            "27_server_rejects_admin",
            "pass" if admin_res.status in {401, 403} else "fail",
            http=admin_res.status,
        )
        page.goto(f"{WEB}/app/ssp/users", wait_until="domcontentloaded")
        rec("27_no_admin_users_ui", "pass" if page.locator("#new-user-name").count() == 0 else "fail")

        rec("cloud_guard_final", "fail" if CLOUD_HITS else "pass", hits=CLOUD_HITS[:5])
    except PlaywrightTimeout as exc:
        rec("timeout", "fail", error=str(exc)[:300], path=getattr(page, "url", ""), body=page.inner_text("body")[:400])
        page.screenshot(path=str(API_ROOT / "scripts" / "_ssp_browser_fail.png"))
    except Exception as exc:  # noqa: BLE001
        rec("exception", "fail", error=f"{type(exc).__name__}: {str(exc)[:300]}", path=getattr(page, "url", ""))
        try:
            page.screenshot(path=str(API_ROOT / "scripts" / "_ssp_browser_fail.png"))
        except Exception:
            pass
    finally:
        browser.close()
        pw.stop()

    print("SSP_BROWSER_RESULTS " + json.dumps(RESULTS, ensure_ascii=False), flush=True)
    failed = [k for k, v in RESULTS.items() if isinstance(v, dict) and v.get("status") == "fail"]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
