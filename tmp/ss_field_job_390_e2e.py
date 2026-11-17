"""DEMO-4 e2e: the technician's job on a 390px phone, every step through the UI (LOCAL only).

Usage: python tmp/ss_field_job_390_e2e.py <cctv-project-id>
Needs: API 127.0.0.1:8001, Vite localhost:5173 (restart Vite with --force after api-client
changes), local Supabase, owner ilya.kerner@ and technician tech.demo@ in G1 Local.

Setup (owner, through the API): a new installation job in the CCTV project, assigned to
tech.demo for today 09:00-13:00. Then, as tech.demo at 390x844:
  4.4  Today card reads "J-xxxxx · hh:mm–hh:mm" (number first, separate LTR islands)
  4.2  every checklist row is reachable: plain clicks, nothing on top of them
  4.3  CCTV template: a photo item cannot be ticked before its photo; photo -> tick;
       "לא רלוונטי" on an allowed item; a note; "סומן ע״י"
  4.1  customer signature: name + drawing -> saved and shown with the date
  4.4  no English labels left on the job page
Exit code 0 = all checks pass. Screenshots: tmp/_e2e_field_*.png
"""
import datetime as dt
import re
import struct
import subprocess
import sys
import uuid
import zlib
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright

WEB, API = "http://localhost:5173", "http://127.0.0.1:8001"
WS = "ceacad59-168a-4305-b823-53983ecebb12"  # G1 Local
OWNER, TECH, PASSWORD = "ilya.kerner@g1-group.com", "tech.demo@sitesecure.test", "Test-Pass-2026!"
OUT = Path("tmp")
ALLOWED_LATIN = {"PoE", "CCTV", "NVR", "UPS", "Local", "IP", "Ilya", "Kerner", "png", "jpg", "photo"}  # names, file names


def db(sql: str) -> str:
    return subprocess.run(["docker", "exec", "supabase_db_site-secure-v2", "psql", "-U", "postgres", "-At", "-c", sql],
                          capture_output=True, text=True, encoding="utf-8", check=True).stdout.strip()


def token(email: str) -> str:
    anon = next(line.split("=", 1)[1].strip() for line in Path("apps/web/.env.local").read_text(encoding="utf-8").splitlines()
                if line.startswith("VITE_SUPABASE_ANON_KEY="))
    res = httpx.post("http://127.0.0.1:54321/auth/v1/token?grant_type=password", headers={"apikey": anon},
                     json={"email": email, "password": PASSWORD}, timeout=30)
    res.raise_for_status()
    return res.json()["access_token"]


def tiny_png(path: Path) -> None:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes([40, 90, 160]) * 64 for _ in range(48))
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 64, 48, 8, 2, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def setup_job(project_id: str) -> tuple[str, str]:
    h = {"Authorization": f"Bearer {token(OWNER)}"}
    project = httpx.get(f"{API}/api/v1/workspaces/{WS}/projects/{project_id}", headers=h, timeout=30).json()
    start = dt.datetime.combine(dt.date.today(), dt.time(9, 0)).astimezone()
    job = httpx.post(f"{API}/api/v1/workspaces/{WS}/jobs", timeout=30,
                     headers={**h, "Idempotency-Key": uuid.uuid4().hex},
                     json={"title": "התקנה — בדיקת שטח 390", "customer_id": project["customer_id"],
                           "site_id": project["site_id"], "kind": "installation", "project_id": project_id,
                           "scheduled_for": start.isoformat(), "scheduled_end": (start + dt.timedelta(hours=4)).isoformat()})
    job.raise_for_status()
    tech_id = db(f"select id from auth.users where email='{TECH}'")
    httpx.post(f"{API}/api/v1/workspaces/{WS}/jobs/{job.json()['id']}/assign", headers=h, timeout=30,
               json={"user_id": tech_id}).raise_for_status()
    return job.json()["id"], job.json()["number"]


def row(pg, key: str):
    return pg.locator(f"[data-testid=checklist-row][data-key={key}]")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    fails: list[str] = []
    job_id, number = setup_job(sys.argv[1])
    print(f"job {number} {job_id}")
    if db(f"select count(*) from job_checklist_items where job_id='{job_id}' and template_key='cctv_installation_v1'") != "12":
        fails.append("4.3: the job did not get the 12-item CCTV template")
    photo = OUT / "_e2e_photo.png"
    tiny_png(photo)

    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(viewport={"width": 390, "height": 844}, locale="he-IL", is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.goto(f"{WEB}/login")
        pg.wait_for_selector("input[type=email]")
        pg.wait_for_timeout(600)
        pg.fill("input[type=email]", TECH)
        pg.fill("input[type=password]", PASSWORD)
        pg.keyboard.press("Enter")
        pg.wait_for_url(lambda u: "/login" not in u, timeout=60_000)
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(1500)

        # 4.4 Today card order
        card = pg.locator("li.field-job-card", has=pg.locator(f"[data-testid=today-card-number]:text-is('{number}')"))
        if not card.count():
            fails.append(f"4.4: {number} not on Today")
        else:
            meta = card.first.locator("[data-testid=today-card-number]").evaluate(
                "n => { const t = n.parentElement.querySelector('[data-testid=today-card-time]');"
                " const a = n.getBoundingClientRect(), b = t.getBoundingClientRect();"
                " return {numRight: a.right, timeRight: b.right, time: t.textContent}; }")
            if not re.fullmatch(r"\d{2}:\d{2}–\d{2}:\d{2}", meta["time"] or ""):
                fails.append(f"4.4: time island is '{meta['time']}'")
            if not meta["numRight"] > meta["timeRight"]:
                fails.append("4.4: in RTL the number should be to the right of the time")
            card.first.screenshot(path=str(OUT / "_e2e_field_today_card.png"))

        pg.goto(f"{WEB}/app/jobs/{job_id}")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(1500)
        for label in ("יציאה לדרך", "הגעה לאתר", "התחל עבודה"):
            pg.get_by_role("button", name=label).first.click()
            pg.wait_for_timeout(1500)

        # 4.3 photo item: locked until a photo, then tick
        cabling = row(pg, "cabling")
        if cabling.get_by_role("checkbox").is_enabled():
            fails.append("4.3: photo item can be ticked without a photo")
        cabling.locator("[data-testid=checklist-photo-input]").set_input_files(str(photo))
        pg.wait_for_selector("[data-testid=checklist-row][data-key=cabling] [data-testid=checklist-photo]", timeout=30_000)
        cabling.get_by_role("checkbox").click()
        pg.wait_for_timeout(1500)
        if not cabling.get_by_role("checkbox").is_checked():
            fails.append("4.3: photo item not ticked after the photo")
        # N/A on an allowed item, a note on another
        row(pg, "poe_switch").get_by_test_id("checklist-na").click()
        pg.wait_for_timeout(1200)
        if "לא רלוונטי" not in row(pg, "poe_switch").inner_text():
            fails.append("4.3: N/A not shown")
        walk = row(pg, "site_walkthrough")
        walk.get_by_role("button", name="הערה").click()
        walk.get_by_test_id("checklist-notes").fill("אושר עם הלקוח")
        walk.get_by_role("checkbox").click()  # blur saves the note, click ticks
        pg.wait_for_timeout(1800)
        walk_text = row(pg, "site_walkthrough").inner_text()
        if "סומן ע״י" not in walk_text:
            fails.append("4.3: 'סומן ע״י' missing")
        saved = db(f"select coalesce(notes,'')||'|'||completed||'|'||coalesce(completed_by::text,'') from job_checklist_items where job_id='{job_id}' and item_key='site_walkthrough'")
        if not saved.startswith("אושר עם הלקוח|true|"):
            fails.append(f"4.3: note/tick not saved: {saved}")

        # 4.2 every enabled row is reachable with a plain click (toggle twice)
        boxes = pg.locator("[data-testid=checklist-row] input[type=checkbox]:enabled")
        reachable = 0
        for i in range(boxes.count()):
            try:
                boxes.nth(i).click(timeout=5000)
                pg.wait_for_timeout(700)
                boxes.nth(i).click(timeout=5000)
                pg.wait_for_timeout(700)
                reachable += 1
            except Exception as exc:
                fails.append(f"4.2: row {i} not reachable: {str(exc).splitlines()[0]}")
        print(f"4.2 rows reachable: {reachable}/{boxes.count()}")
        pg.screenshot(path=str(OUT / "_e2e_field_checklist.png"), full_page=True)

        # 4.1 signature
        sig = pg.get_by_test_id("job-signature")
        sig.scroll_into_view_if_needed()
        sig.get_by_label("שם החותם").fill("דני אורן")
        canvas = sig.get_by_test_id("signature-canvas")
        canvas.scroll_into_view_if_needed()
        b = canvas.bounding_box()
        pg.mouse.move(b["x"] + 30, b["y"] + b["height"] / 2)
        pg.mouse.down()
        for i in range(1, 12):
            pg.mouse.move(b["x"] + 30 + i * 20, b["y"] + b["height"] / 2 + (14 if i % 2 else -14), steps=3)
        pg.mouse.up()
        sig.get_by_test_id("job-signature-save").click()
        pg.wait_for_selector("[data-testid=job-signature-done] img", timeout=30_000)
        if "נחתם על ידי דני אורן" not in sig.inner_text():
            fails.append("4.1: signer not shown")
        sig.screenshot(path=str(OUT / "_e2e_field_signature.png"))
        stored = db(f"select d.storage_bucket||'|'||d.storage_path from jobs j join documents d on d.id=j.customer_signature_document_id where j.id='{job_id}'")
        if not stored.startswith(f"signatures|{WS}/job/{job_id}/"):
            fails.append(f"4.1: signature storage: {stored}")

        # 4.4 no English labels on the job page
        latin = set(re.findall(r"[A-Za-z]{2,}", pg.locator("main").inner_text())) - ALLOWED_LATIN
        latin = {w for w in latin if not re.fullmatch(r"J", w)}
        if latin:
            fails.append(f"4.4: English on the job page: {sorted(latin)}")
        pg.screenshot(path=str(OUT / "_e2e_field_job_top.png"))
        br.close()

    print("\n".join(fails) if fails else "OK")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
