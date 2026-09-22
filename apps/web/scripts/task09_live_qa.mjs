/**
 * Task 09 — live Quote Builder interaction QA (Playwright + API prep).
 * Run: node apps/web/scripts/task09_live_qa.mjs
 * Requires: API :8000, Vite :5173, apps/api/scripts/.tmp_import_token
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const TOKEN_PATH = path.join(ROOT, "apps/api/scripts/.tmp_import_token");
const API = "http://127.0.0.1:8000";
const WEB = process.env.WEB_URL || "http://localhost:5174";
const OUT = path.join(__dirname, "_task09_qa");
const HEB_DESC =
  "מצלמת אבטחה חיצונית 4MP כולל התקנה, חיבור, הגדרה ובדיקת תקינות מלאה";
const HEB_SECTION = "ציוד מצלמות ותשתיות";

fs.mkdirSync(OUT, { recursive: true });

const results = [];

function record(name, pass, observation) {
  results.push({ name, pass, observation });
  console.log(pass ? "PASS" : "FAIL", name, "-", observation);
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function apiFetch(token, url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...authHeaders(token), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function loadEnvSupabaseRef() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return null;
  const raw = fs.readFileSync(envPath, "utf8");
  const m = raw.match(/SUPABASE_URL=(.+)/);
  if (!m) return null;
  const url = m[1].trim().replace(/^["']|["']$/g, "");
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  return ref || null;
}

async function getSupabaseUser(token, ref) {
  const envPath = path.join(ROOT, ".env");
  const raw = fs.readFileSync(envPath, "utf8");
  const anon = raw.match(/SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const res = await fetch(`${raw.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "")}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`auth user ${res.status}`);
  return res.json();
}

async function ensureSections(token, ws, quoteId, minSections = 3) {
  const full = (await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}`)).json;
  const existing = full?.sections || [];
  if (existing.length >= minSections) return full;
  const names = ["מצלמות", "הקלטה", "תשתיות", "התקנה ושירותים"];
  for (let i = existing.length; i < minSections; i++) {
    await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}/sections`, {
      method: "POST",
      body: JSON.stringify({ name: names[i] || `סעיף ${i + 1}`, sort_order: (i + 1) * 10 }),
    });
  }
  return (await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}`)).json;
}

async function prepareQuote(token, ws) {
  const list = await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes?limit=50`);
  let best = null;
  for (const row of list.json?.items || []) {
    if (row.status !== "draft") continue;
    const full = (await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${row.id}`)).json;
    const items = full?.items || [];
    const sections = full?.sections || [];
    if (full?.customer_id && items.length >= 8 && sections.length >= 3) {
      return { id: row.id, number: row.number, full };
    }
    if (full?.customer_id && items.length >= 3 && (!best || items.length > (best.full.items?.length || 0))) {
      best = { id: row.id, number: row.number, full };
    }
  }
  if (best) {
    const n = best.full.items?.length || 0;
    const sec = best.full.sections?.length || 0;
    if (n < 8 || sec < 3) {
      const templates = await apiFetch(token, `${API}/api/v1/workspaces/${ws}/catalog/templates`);
      const templateId = templates.json?.items?.[0]?.id;
      if (templateId && n < 8) {
        await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${best.id}/apply-template`, {
          method: "POST",
          body: JSON.stringify({ template_id: templateId }),
        });
        best.full = (await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${best.id}`)).json;
      }
    }
    best.full = await ensureSections(token, ws, best.id);
    return best;
  }

  const customers = await apiFetch(token, `${API}/api/v1/workspaces/${ws}/customers?limit=5`);
  const customerId = customers.json?.items?.[0]?.id;
  if (!customerId) throw new Error("no customer for QA quote");

  const created = await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes`, {
    method: "POST",
    body: JSON.stringify({
      customer_id: customerId,
      title: "Task09 QA",
      payment_terms: "שוטף+30",
      valid_until: "2099-12-31",
    }),
  });
  const quoteId = created.json?.id;
  const templates = await apiFetch(token, `${API}/api/v1/workspaces/${ws}/catalog/templates`);
  const templateId = templates.json?.items?.[0]?.id;
  if (templateId) {
    await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}/apply-template`, {
      method: "POST",
      body: JSON.stringify({ template_id: templateId }),
    });
  }
  const full = await ensureSections(token, ws, quoteId);
  return { id: quoteId, number: full?.number, full };
}

function patchRequests(requests, quoteId) {
  return requests.filter(
    (r) =>
      r.method === "PATCH" &&
      r.url.includes(`/quotes/${quoteId}`) &&
      (r.url.includes("/sections/") || r.url.includes("/items/")),
  );
}

async function main() {
  if (!fs.existsSync(TOKEN_PATH)) throw new Error("Missing .tmp_import_token — run get_owner_token.py");
  const token = fs.readFileSync(TOKEN_PATH, "utf8").trim();
  const session = (await apiFetch(token, `${API}/api/v1/auth/session`)).json;
  const ws = session.memberships[0].workspace_id;
  const quote = await prepareQuote(token, ws);
  const quoteId = quote.id;
  quote.full = await ensureSections(token, ws, quoteId);
  console.log("QA quote:", quote.number, quoteId, "items", quote.full.items?.length, "sections", quote.full.sections?.length);

  const ref = await loadEnvSupabaseRef();
  const user = ref ? await getSupabaseUser(token, ref) : null;
  const storageKey = ref ? `sb-${ref}-auth-token` : null;
  const sessionPayload = JSON.stringify({
    access_token: token,
    refresh_token: "qa-refresh",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user,
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (storageKey) {
    await context.addInitScript(
      ({ key, value }) => {
        localStorage.setItem("ss.remember-device", "1");
        localStorage.setItem(key, value);
      },
      { key: storageKey, value: sessionPayload },
    );
  }
  const page = await context.newPage();
  const allRequests = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/v1/")) {
      allRequests.push({ method: req.method(), url: req.url(), time: Date.now() });
    }
  });

  const quoteUrl = `${WEB}/app/quotes/${quoteId}`;
  await page.goto(quoteUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  if (page.url().includes("/login") || page.url().includes("/auth")) {
    throw new Error(`Auth redirect — landed on ${page.url()}`);
  }

  let items = quote.full.items?.filter((i) => i.item_type !== "note") || [];
  const targetItem = items[0];
  if (!targetItem) throw new Error("No line items on QA quote");

  // ── 2. Description typing ──
  const descId = `#item-desc-${targetItem.id}`;
  await page.waitForSelector(descId, { timeout: 20000 });
  const desc = page.locator(descId);
  await desc.click();
  await desc.fill("");
  const patchBeforeDesc = allRequests.length;
  for (const ch of HEB_DESC) {
    await desc.type(ch, { delay: 12 });
  }
  const midValue = await desc.inputValue();
  await desc.blur();
  await page.waitForTimeout(800);
  const afterBlur = await desc.inputValue();
  const descPatches = patchRequests(allRequests, quoteId).filter((r) => r.url.includes("/items/"));
  const descOk =
    midValue === HEB_DESC &&
    afterBlur === HEB_DESC &&
    descPatches.length <= 2;
  record(
    "Hebrew description typing",
    descOk,
    `mid=${midValue.length}chars blur=${afterBlur.length}chars itemPATCHes=${descPatches.length}`,
  );

  // Refetch persistence
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(descId, { timeout: 20000 });
  const refetched = await page.locator(descId).inputValue();
  record(
    "Hebrew description persistence",
    refetched === HEB_DESC,
    refetched === HEB_DESC ? "refetch match" : `got="${refetched.slice(0, 40)}..."`,
  );

  // Refresh item list after reload
  quote.full = (await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}`)).json;
  items = quote.full.items?.filter((i) => i.item_type !== "note") || [];

  // ── 3. Section rename ──
  const section = quote.full.sections?.[0];
  const sectionReqStart = allRequests.length;
  if (section) {
    const secInput = page.locator(`#section-name-${section.id}`);
    await secInput.click();
    await secInput.fill("");
    for (const ch of HEB_SECTION) {
      await secInput.type(ch, { delay: 10 });
    }
    await page.waitForTimeout(500);
    const sectionPatchesDuringType = patchRequests(allRequests.slice(sectionReqStart), quoteId).filter((r) =>
      r.url.includes("/sections/"),
    );
    await secInput.blur();
    await page.waitForTimeout(600);
    const sectionPatchesTotal = patchRequests(allRequests.slice(sectionReqStart), quoteId).filter((r) =>
      r.url.includes("/sections/"),
    );
    const secValue = await secInput.inputValue();
    record(
      "Section rename",
      secValue === HEB_SECTION && sectionPatchesDuringType.length === 0 && sectionPatchesTotal.length <= 1,
      `patches_during_type=${sectionPatchesDuringType.length} total=${sectionPatchesTotal.length} value="${secValue}"`,
    );
  } else {
    record("Section rename", false, "no sections on quote");
  }

  // ── 4. Pricing edits ──
  const priceItem = items[1] || items[0];
  const qtySel = `#item-qty-${priceItem.id}`;
  const priceSel = `#item-price-${priceItem.id}`;
  const discSel = `#item-discount-${priceItem.id}`;
  const pricingStart = allRequests.length;
  await page.locator(qtySel).scrollIntoViewIfNeeded();
  await page.locator(qtySel).click({ clickCount: 3 });
  await page.locator(qtySel).press("Backspace");
  await page.locator(qtySel).type("8", { delay: 20 });
  await page.locator(qtySel).blur();
  await page.waitForResponse((r) => r.url().includes("/items/") && r.request().method() === "PATCH", { timeout: 8000 }).catch(() => null);
  await page.locator(priceSel).click({ clickCount: 3 });
  await page.locator(priceSel).press("Backspace");
  await page.locator(priceSel).type("425", { delay: 20 });
  await page.locator(priceSel).blur();
  await page.waitForResponse((r) => r.url().includes("/items/") && r.request().method() === "PATCH", { timeout: 8000 }).catch(() => null);
  await page.locator(discSel).click({ clickCount: 3 });
  await page.locator(discSel).press("Backspace");
  await page.locator(discSel).type("10", { delay: 20 });
  await page.locator(discSel).blur();
  await page.waitForResponse((r) => r.url().includes("/items/") && r.request().method() === "PATCH", { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(500);
  const apiQuote = (await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}`)).json;
  const apiItem = (apiQuote.items || []).find((i) => i.id === priceItem.id);
  const pricingPatches = patchRequests(allRequests.slice(pricingStart), quoteId).filter((r) =>
    r.url.includes("/items/"),
  );
  const lineNetOk = apiItem && Number(apiItem.qty) === 8 && Number(apiItem.unit_price) === 425;
  record(
    "Pricing edits",
    lineNetOk && pricingPatches.length <= 4,
    `qty=${apiItem?.qty} price=${apiItem?.unit_price} line_net=${apiItem?.line_net} patches=${pricingPatches.length} total_gross=${apiQuote.total_gross}`,
  );

  // ── 5. Multi-row ──
  let multiOk = true;
  const multiObs = [];
  for (let i = 0; i < Math.min(5, items.length); i++) {
    const it = items[i];
    const sel = `#item-desc-${it.id}`;
    const val = `שורה QA ${i + 1} — בדיקה`;
    await page.locator(sel).click();
    await page.locator(sel).fill(val);
    await page.locator(sel).blur();
    await page.waitForTimeout(350);
    const v = await page.locator(sel).inputValue();
    if (v !== val) {
      multiOk = false;
      multiObs.push(`row${i} mismatch`);
    }
  }
  record("Multi-row editing", multiOk, multiObs.join("; ") || "5 rows edited sequentially");

  // ── 6. Concurrent section + line ──
  if (section) {
    const secInput = page.locator(`#section-name-${section.id}`);
    const lineSel = `#item-desc-${items[2]?.id || targetItem.id}`;
    await secInput.click();
    await secInput.type(" + QA", { delay: 15 });
    await page.locator(lineSel).click();
    await page.locator(lineSel).type(" (concurrent)", { delay: 15 });
    await page.locator(lineSel).blur();
    await secInput.blur();
    await page.waitForTimeout(900);
    const secVal = await secInput.inputValue();
    const lineVal = await page.locator(lineSel).inputValue();
    record(
      "Concurrent section + line",
      secVal.includes("QA") && lineVal.includes("concurrent"),
      `section="${secVal.slice(-20)}" line="${lineVal.slice(-30)}"`,
    );
  } else {
    record("Concurrent section + line", false, "no section");
  }

  // ── 7. Template fast path ──
  const emptyQuote = (
    await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes`, {
      method: "POST",
      body: JSON.stringify({
        customer_id: quote.full.customer_id,
        site_id: quote.full.site_id || undefined,
        title: "Task09 template QA",
      }),
    })
  ).json;
  await page.goto(`${WEB}/app/quotes/${emptyQuote.id}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);
  const fastPath = page.getByRole("heading", { name: "התחל מתבנית" });
  let templateOk = false;
  if (await fastPath.count()) {
    await page.getByRole("button", { name: "החל תבנית" }).click();
    await page.waitForTimeout(3000);
    const tplQuote = (await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${emptyQuote.id}`)).json;
    const tplItems = tplQuote?.items || [];
    if (tplItems.length > 0) {
      const tDesc = `#item-desc-${tplItems[0].id}`;
      await page.locator(tDesc).click();
      await page.locator(tDesc).type(" — עריכה מיידית", { delay: 10 });
      await page.locator(tDesc).blur();
      await page.waitForTimeout(600);
      const edited = await page.locator(tDesc).inputValue();
      templateOk = edited.includes("עריכה מיידית");
    }
  }
  record(
    "Template → immediate editing",
    templateOk,
    templateOk ? "applied + edited first line" : `fastPath=${await fastPath.count()} items after apply`,
  );
  await page.goto(quoteUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // ── 8. Save indicator ──
  const saveText = await page.locator(".cpq-save-state-inline").textContent();
  record(
    "Save indicator",
    /נשמר|שומר|שינויים/.test(saveText || ""),
    `label="${(saveText || "").trim()}"`,
  );

  // ── 9. Send readiness ──
  const incQuote = (
    await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes`, {
      method: "POST",
      body: JSON.stringify({ title: "Incomplete QA" }),
    })
  ).json;
  await page.goto(`${WEB}/app/quotes/${incQuote.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const incValidation = (await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${incQuote.id}`)).json?.validation;
  const sendBtns = page.getByRole("button", { name: "שלח לאישור" });
  const sendCount = await sendBtns.count();
  const firstDisabled = sendCount > 0 ? await sendBtns.first().isDisabled() : true;
  record(
    "Send readiness (incomplete)",
    firstDisabled,
    `disabled=${firstDisabled} buttons=${sendCount} can_send=${incValidation?.can_send} gaps=${incValidation?.gaps?.length}`,
  );

  await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${incQuote.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      customer_id: quote.full.customer_id,
      title: "Complete QA",
      payment_terms: "מזומן",
      valid_until: "2099-12-31",
    }),
  });
  const catalog = await apiFetch(token, `${API}/api/v1/workspaces/${ws}/catalog/products?limit=1`);
  const prod = catalog.json?.items?.[0];
  if (prod) {
    await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${incQuote.id}/items`, {
      method: "POST",
      body: JSON.stringify({ product_id: prod.id, qty: 1 }),
    });
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const completeValidation = (await apiFetch(token, `${API}/api/v1/workspaces/${ws}/quotes/${incQuote.id}`)).json?.validation;
  const sendEnabled = (await sendBtns.count()) > 0 ? await sendBtns.first().isEnabled() : false;
  record(
    "Send readiness (complete)",
    sendEnabled && completeValidation?.can_send,
    `enabled=${sendEnabled} can_send=${completeValidation?.can_send} gaps=${completeValidation?.gaps?.length}`,
  );

  await page.goto(quoteUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // ── 10. Network ──
  const headerPatches = allRequests.filter(
    (r) => r.method === "PATCH" && r.url.includes(`/quotes/${quoteId}`) && !r.url.includes("/items/") && !r.url.includes("/sections/"),
  );
  const itemPatches = patchRequests(allRequests, quoteId).filter((r) => r.url.includes("/items/"));
  const sectionPatches = patchRequests(allRequests, quoteId).filter((r) => r.url.includes("/sections/"));
  record(
    "Network behavior",
    itemPatches.length < 25 && sectionPatches.length < 5,
    `headerPATCH=${headerPatches.length} itemPATCH=${itemPatches.length} sectionPATCH=${sectionPatches.length}`,
  );

  // ── 11. Mobile sanity ──
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(400);
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  const mobileDesc = page.locator(descId);
  const mobileInputVisible = await mobileDesc.isVisible();
  await page.screenshot({ path: path.join(OUT, "mobile-375.png"), fullPage: true });
  record(
    "Mobile sanity",
    mobileInputVisible && !mobileOverflow,
    `descVisible=${mobileInputVisible} overflowX=${mobileOverflow}`,
  );

  await page.screenshot({ path: path.join(OUT, "desktop-final.png"), fullPage: true });
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ quoteId, results, allRequests: allRequests.length }, null, 2));

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log("\n--- SUMMARY ---");
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}\t${r.name}\t${r.observation}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("QA aborted:", err);
  process.exit(2);
});
