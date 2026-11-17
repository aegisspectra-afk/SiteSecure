"""DEMO-4 e2e: the technician's job page on a 390px phone (LOCAL stack only).

Usage: python tmp/ss_field_job_390_e2e.py <job-id-assigned-to-tech.demo>
Needs: API 127.0.0.1:8001, Vite localhost:5173 (restart Vite with --force after api-client
changes), local Supabase, tech.demo@sitesecure.test assigned to the job.

Checks
  DEMO-4.2  every checklist row can be tapped with a normal click (nothing on top of it)
Exit code 0 = all checks pass.
"""
import sys

from playwright.sync_api import sync_playwright

WEB = "http://localhost:5173"
EMAIL, PASSWORD = "tech.demo@sitesecure.test", "Test-Pass-2026!"


def login(pg) -> None:
    pg.goto(f"{WEB}/login")
    pg.wait_for_selector("input[type=email]")
    pg.wait_for_timeout(600)
    pg.fill("input[type=email]", EMAIL)
    pg.fill("input[type=password]", PASSWORD)
    pg.keyboard.press("Enter")
    pg.wait_for_url(lambda u: "/login" not in u, timeout=60_000)


def check_checklist_tappable(pg, fails: list[str]) -> None:
    """DEMO-4.2: tap every row twice (on, then back off) with a plain click."""
    rows = pg.locator("main input[type=checkbox]")
    count = rows.count()
    if count == 0:
        fails.append("4.2: no checklist rows")
        return
    for i in range(count):
        try:
            before = rows.nth(i).is_checked()
            rows.nth(i).click(timeout=5000)
            pg.wait_for_timeout(500)
            rows.nth(i).click(timeout=5000)
            pg.wait_for_timeout(500)
            if rows.nth(i).is_checked() != before:
                fails.append(f"4.2: row {i} did not toggle back")
        except Exception as exc:  # covered by another element, or not clickable
            fails.append(f"4.2: row {i} not tappable: {str(exc).splitlines()[0]}")
    print(f"4.2 checklist rows tappable: {count - len([f for f in fails if f.startswith('4.2: row')])}/{count}")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    job_id = sys.argv[1]
    fails: list[str] = []
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(viewport={"width": 390, "height": 844}, locale="he-IL", is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        login(pg)
        pg.goto(f"{WEB}/app/jobs/{job_id}")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(2000)
        check_checklist_tappable(pg, fails)
        pg.screenshot(path="tmp/_e2e_field_job_390.png", full_page=True)
        br.close()
    print("\n".join(fails) if fails else "OK")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
