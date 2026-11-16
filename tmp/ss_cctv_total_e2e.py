"""DEMO-2.5 e2e: one CCTV quote, the same total in the wizard, the quote, the public link and the PDF.

LOCAL stack only: API 127.0.0.1:8001, Vite localhost:5173, local Supabase (G1 Local owner).
Usage: python tmp/ss_cctv_total_e2e.py
Every step goes through the UI. Also checks on the way:
  DEMO-2.1  no "מחיר לדוגמה" on the public link / PDF
  DEMO-2.2  the wizard quote (with labor lines) can be sent
  DEMO-2.3  exactly one new quote is created
Exit code 0 = all equal; 1 = mismatch (printed).
"""
import re
import subprocess
import sys

import pymupdf
from playwright.sync_api import sync_playwright

WEB = "http://localhost:5173"
EMAIL, PASSWORD = "ilya.kerner@g1-group.com", "Test-Pass-2026!"
CUSTOMER = "9289b69d-d4d6-4e27-ae44-a7c46b60d1d7"  # דמו – משרדי אורן (DEMO-0)
SITE = "f21dd5c6-7f61-40fc-be0a-7875d69a48d4"
MARK = "מחיר לדוגמה"


def db(sql: str) -> str:
    return subprocess.run(["docker", "exec", "supabase_db_site-secure-v2", "psql", "-U", "postgres", "-At", "-c", sql],
                          capture_output=True, text=True, check=True).stdout.strip()


def money(value: float) -> str:
    return f"{value:,.2f}"


def amounts(text: str) -> set[str]:
    return set(re.findall(r"\d{1,3}(?:,\d{3})*\.\d{2}", text))


def main() -> int:
    before = int(db(f"select count(*) from quotes where customer_id='{CUSTOMER}'"))
    fails: list[str] = []
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(viewport={"width": 1440, "height": 900}, locale="he-IL", accept_downloads=True)
        pg = ctx.new_page()
        pg.goto(f"{WEB}/login")
        pg.wait_for_selector("input[type=email]")
        pg.wait_for_timeout(600)
        pg.fill("input[type=email]", EMAIL)
        pg.fill("input[type=password]", PASSWORD)
        pg.keyboard.press("Enter")
        pg.wait_for_url(lambda u: "/login" not in u, timeout=60_000)

        # 1. Wizard
        pg.goto(f"{WEB}/app/quotes/new?customerId={CUSTOMER}&siteId={SITE}")
        pg.wait_for_load_state("networkidle")
        pg.get_by_role("button", name="CCTV", exact=True).first.click()
        pg.wait_for_selector("[data-testid=cctv-calc-state]:has-text('מחושב')", timeout=30_000)
        pg.get_by_role("button", name="המשך לבחירת ציוד").click()
        pg.wait_for_selector("[data-testid=cctv-designer-review]", timeout=30_000)
        pg.locator(".cpq-cctv-designer-footer button:enabled", has_text="הצעה").last.click()
        pg.wait_for_selector("[data-testid=cctv-applied-total]", timeout=60_000)
        wizard_total = float(pg.get_attribute("[data-testid=cctv-applied-total]", "data-total"))
        pg.screenshot(path="tmp/_e2e_total_1_wizard.png")
        pg.get_by_role("button", name="חזרה להצעה").click()
        pg.wait_for_url(re.compile(r"/app/quotes/[0-9a-f-]{36}"), timeout=30_000)
        qid = re.search(r"/app/quotes/([0-9a-f-]{36})", pg.url).group(1)
        pg.wait_for_timeout(2000)

        # 2. The quote (server value and what the builder shows)
        quote_total = float(db(f"select total_gross from quotes where id='{qid}'"))
        if money(quote_total) not in pg.locator("body").inner_text():
            fails.append(f"builder does not show {money(quote_total)}")

        # Terms needed to send, then send.
        pg.get_by_text("פרטי ההצעה").first.click()
        pg.fill("#title", "מערכת מצלמות – בדיקת סכום")
        pg.get_by_text("תנאים ושליחה").first.click()
        pg.fill("#payment_terms", "שוטף + 30")
        pg.wait_for_timeout(2500)
        send = pg.get_by_role("button", name="שליחה ללקוח").first
        if not send.is_enabled():
            fails.append("DEMO-2.2: the wizard quote cannot be sent: " + str(send.get_attribute("title")))
            br.close()
            print("\n".join(fails))
            return 1
        send.click()
        pg.get_by_role("button", name="סמן כנשלחה ונעל").click()
        pg.wait_for_timeout(3000)
        link = re.search(r"http://localhost:5173/q/[A-Za-z0-9_-]+", pg.locator("body").inner_text()).group(0)
        pg.screenshot(path="tmp/_e2e_total_2_sent.png")

        # 3. Public link
        pub = ctx.new_page()
        pub.goto(link)
        pub.wait_for_load_state("networkidle")
        pub.wait_for_timeout(2000)
        public_text = pub.locator("body").inner_text()
        pub.screenshot(path="tmp/_e2e_total_3_public.png", full_page=True)
        if MARK in public_text:
            fails.append("DEMO-2.1: public link shows the sample-price mark")

        # 4. PDF from the public link
        with pub.expect_download(timeout=60_000) as dl:
            pub.get_by_role("button", name="הורדת PDF").click()
        dl.value.save_as("tmp/_e2e_total_4.pdf")
        pdf_text = "".join(page.get_text() for page in pymupdf.open("tmp/_e2e_total_4.pdf"))
        if "לדוגמה" in pdf_text:
            fails.append("DEMO-2.1: PDF shows the sample-price mark")
        br.close()

    after = int(db(f"select count(*) from quotes where customer_id='{CUSTOMER}'"))
    if after - before != 1:
        fails.append(f"DEMO-2.3: expected exactly 1 new quote, got {after - before}")

    expected = money(quote_total)
    print(f"quote {qid}")
    print(f"wizard  {money(wizard_total)}")
    print(f"quote   {expected}")
    print(f"public  {'found' if expected in amounts(public_text) else 'MISSING'}")
    print(f"pdf     {'found' if expected in amounts(pdf_text) else 'MISSING'}")
    if abs(wizard_total - quote_total) > 0.005:
        fails.append(f"wizard {wizard_total} != quote {quote_total}")
    if expected not in amounts(public_text):
        fails.append(f"public link does not show {expected}: {sorted(amounts(public_text))}")
    if expected not in amounts(pdf_text):
        fails.append(f"PDF does not show {expected}: {sorted(amounts(pdf_text))}")
    print("\n".join(fails) if fails else "OK: the same total everywhere")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
