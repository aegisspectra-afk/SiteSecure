"""SITE SECURE golden path in the browser, every step through the UI (LOCAL stack only).

Usage: python tmp/ss_golden_path_browser.py [owner|sales]
Needs: API on 127.0.0.1:8001 and Vite on localhost:5173 against local Supabase (G1 Local users).
customer -> catalog item (owner) -> new quote -> line from catalog -> terms -> preview -> send
-> customer signs on the public link -> approved. Screenshots go to ./shots.
"""
import re
import subprocess
import sys
import uuid
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

OUT = Path.cwd() / "shots"
OUT.mkdir(exist_ok=True)
WEB = "http://localhost:5173"
assert WEB.startswith("http://localhost"), "local stack only"
WHO = sys.argv[1] if len(sys.argv) > 1 else "owner"
EMAIL = {"owner": "ilya.kerner@g1-group.com", "sales": "ss.s35.sales@sitesecure.test"}[WHO]
TAG = uuid.uuid4().hex[:5]
CUSTOMER = f"לקוח פיילוט {TAG}"
PRODUCT = f"מצלמת כיפה 4MP {TAG}"
api_errors: list[str] = []
step_no = 0


def db(sql: str) -> str:
    return subprocess.run(["docker", "exec", "supabase_db_site-secure-v2", "psql", "-U", "postgres", "-At", "-c", sql],
                          capture_output=True, text=True, encoding="utf-8", check=True).stdout.strip()


def shot(page: Page, name: str) -> None:
    global step_no
    step_no += 1
    page.screenshot(path=str(OUT / f"s6_{WHO}_{step_no:02d}_{name}.png"), full_page=True)
    print(f"[{step_no:02d}] {name}: {page.url[len(WEB):]}")


def click(page: Page, name: str, *, exact: bool = True) -> None:
    page.get_by_role("button", name=name, exact=exact).first.click()


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, locale="he-IL")
    page = ctx.new_page()
    page.on("response", lambda r: api_errors.append(f"{r.status} {r.request.method} {r.url.split('?')[0][-80:]}")
            if r.status >= 400 and "/api/" in r.url else None)
    page.goto(f"{WEB}/login"); page.wait_for_timeout(1200)
    page.fill("input[type=email]", EMAIL); page.fill("input[type=password]", "Test-Pass-2026!")
    page.keyboard.press("Enter"); page.wait_for_timeout(3500)
    shot(page, "after_login")

    # 1) customer
    page.goto(f"{WEB}/app/customers"); page.wait_for_timeout(2500)
    click(page, "לקוח חדש"); page.wait_for_timeout(800)
    page.fill("#customer-name", CUSTOMER)
    page.fill("#customer-phone", "0501234567")
    page.fill("#customer-email", f"pilot.{TAG}@example.test")
    click(page, "שמירה"); page.wait_for_timeout(2500)
    shot(page, "customer_created")
    print("   db customer:", db(f"select count(*) from customers where display_name='{CUSTOMER}'"))

    # 2) catalog item (owner only: sales has no catalog.edit)
    if WHO == "owner":
        page.goto(f"{WEB}/app/catalog"); page.wait_for_timeout(2500)
        click(page, "פריט חדש"); page.wait_for_timeout(800)
        page.fill("#product-name", PRODUCT)
        page.fill("#product-sku", f"CAM-{TAG}")
        page.fill("#product-price", "480")
        page.fill("#product-cost", "290")
        click(page, "שמירה"); page.wait_for_timeout(2500)
        shot(page, "catalog_item_created")
        print("   db product:", db(f"select list_price, cost from products where name='{PRODUCT}'"))

    # 3) new quote: customer + title
    page.goto(f"{WEB}/app/quotes/new"); page.wait_for_timeout(3000)
    click(page, "לקוח קיים"); page.wait_for_timeout(500)
    page.fill("#quote-flow-customer-q", CUSTOMER[:12]); page.wait_for_timeout(2500)
    page.get_by_text(CUSTOMER, exact=True).first.click(); page.wait_for_timeout(3000)
    # Picking the customer creates the draft and collapses the details card.
    if not page.locator("#title").count():
        click(page, "עריכת פרטים"); page.wait_for_timeout(1000)
    page.fill("#title", f"מערכת מצלמות {TAG}")
    page.locator("#title").blur(); page.wait_for_timeout(2500)
    click(page, "המשך לתכנון וציוד"); page.wait_for_timeout(3000)
    shot(page, "quote_details_done")
    qid = re.search(r"/app/quotes/([0-9a-f-]{36})", page.url)
    qid = qid.group(1) if qid else db(f"select id from quotes where title='מערכת מצלמות {TAG}'")
    print("   quote id:", qid)

    # 4) line from the catalog
    search = page.get_by_placeholder(re.compile("הקלידו כדי לחפש"))
    if not search.count():
        click(page, "הוסף פריט", exact=False); page.wait_for_timeout(1500)
        shot(page, "add_item_opened")
    search = page.get_by_placeholder(re.compile("הקלידו כדי לחפש")).first
    product_query = PRODUCT if WHO == "owner" else "מצלמת כיפה 4MP"
    search.fill(product_query[:14]); page.wait_for_timeout(2500)
    shot(page, "catalog_search")
    hits = page.get_by_text(re.compile(re.escape(product_query[:14])))
    print("   search hits:", hits.count())
    hits.last.click(); page.wait_for_timeout(3000)
    shot(page, "line_added")
    print("   db items:", db(f"select name, qty, unit_price, line_net from quote_items where quote_id='{qid}'"))
    qty = page.get_by_label("כמות").first
    qty.fill("4"); qty.blur(); page.wait_for_timeout(3500)
    print("   db totals:", db(f"select subtotal_net, vat_amount, total_gross from quotes where id='{qid}'"))

    # 5) terms + preview
    click(page, "תנאים ושליחה"); page.wait_for_timeout(2000)
    terms = page.locator("#payment_terms")
    if not terms.input_value().strip():
        terms.fill("שוטף + 30 מיום הוצאת החשבונית")
        click(page, "שמירה"); page.wait_for_timeout(3000)
    shot(page, "terms")
    print("   db terms/valid:", db(f"select payment_terms, valid_until from quotes where id='{qid}'"))
    page.goto(f"{WEB}/app/quotes/{qid}/preview"); page.wait_for_timeout(3500)
    shot(page, "preview")

    # 6) send
    click(page, "שלח ללקוח"); page.wait_for_timeout(1500)
    shot(page, "send_dialog")
    click(page, "סמן כנשלחה ונעל"); page.wait_for_timeout(3500)
    shot(page, "sent")
    print("   db status:", db(f"select status, version, total_gross from quotes where id='{qid}'"))
    link = None
    for el in page.locator("input:visible").all():
        v = el.input_value()
        if "/q/" in v:
            link = v
    print("   public link found in UI:", bool(link))

    # 7) customer approves on the public link
    if link:
        pub = browser.new_context(viewport={"width": 1280, "height": 900}, locale="he-IL").new_page()
        pub.goto(link); pub.wait_for_timeout(3500)
        shot(pub, "public_view")
        approve_cta = pub.get_by_role("button", name=re.compile("אישור"))
        if approve_cta.count():
            approve_cta.first.click(); pub.wait_for_timeout(1500)
        cb = pub.locator("#cqx-sign input[type=checkbox]")
        if cb.count():
            cb.first.check()
        if pub.locator("#cqx-signer").count():
            pub.fill("#cqx-signer", "ישראל לקוח")
        canvas = pub.locator("#cqx-sign canvas")
        if canvas.count():
            canvas.first.scroll_into_view_if_needed(); pub.wait_for_timeout(500)
            box = canvas.first.bounding_box()
            pub.mouse.move(box["x"] + 20, box["y"] + box["height"] / 2)
            pub.mouse.down()
            for dx in range(20, int(box["width"]) - 20, 15):
                pub.mouse.move(box["x"] + dx, box["y"] + box["height"] / 2 + (10 if dx % 30 else -10))
            pub.mouse.up()
        shot(pub, "public_sign_form")
        submit = pub.locator("#cqx-sign").get_by_role("button", name="אישור וחתימה")
        print("   approve enabled:", submit.is_enabled())
        submit.click(); pub.wait_for_timeout(3500)
        shot(pub, "public_approved")
        print("   db after approve:", db(f"select status, approved_name from quotes where id='{qid}'"))

    # 8) back in the app
    page.goto(f"{WEB}/app/quotes/{qid}"); page.wait_for_timeout(3500)
    shot(page, "app_after_approve")
    print("API ERRORS:", api_errors)
    browser.close()
