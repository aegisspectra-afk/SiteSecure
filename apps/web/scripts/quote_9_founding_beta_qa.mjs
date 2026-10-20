/**
 * QUOTE-9 — Founding Beta Quote Builder Verification
 * Audit-first: real UI timing + capability probes. No pricing/architecture changes.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/quote-9-founding-beta-qa");
const FIXTURE_PATH = path.join(ROOT, "Docs/quote-fast-quote-q3b-qa/fixture.json");
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...loadEnv(path.join(ROOT, ".env")),
  ...loadEnv(path.join(ROOT, "apps/web/.env")),
  ...process.env,
};

const WEB = env.WEB_URL || "http://localhost:5175";
const API = (env.VITE_API_URL || env.API_PUBLIC_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const SUPABASE_URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const EMAIL = FIXTURE.email;
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const WORKSPACE = FIXTURE.workspaceId;

fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(FIXTURE_PATH, path.join(OUT, "fixture.json"));

const tokenJson = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());

if (!tokenJson.access_token) {
  console.error("auth_failed", tokenJson);
  process.exit(1);
}

const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
const authHeaders = {
  Authorization: `Bearer ${tokenJson.access_token}`,
  "Content-Type": "application/json",
};

async function api(method, p, body) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: authHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, data: json, text };
}

const report = {
  measuredAt: new Date().toISOString(),
  web: WEB,
  api: API,
  workspaceId: WORKSPACE,
  email: EMAIL,
  targetSecondsFresh: 180,
  targetSecondsFull: 180,
  fixture: {
    customerId: FIXTURE.customerId,
    siteId: FIXTURE.siteId,
    packageId: FIXTURE.packageId,
    packageName: FIXTURE.packageName,
    templateId: FIXTURE.templateId,
    skus: FIXTURE.products.map((p) => p.sku),
  },
  probes: {},
  flows: {},
  viewports: {},
  shots: [],
  issues: [],
  fixes: [],
};

function issue(severity, area, detail) {
  report.issues.push({ severity, area, detail });
}

function blank(name) {
  return {
    name,
    clicks: 0,
    overlaysOpened: 0,
    searches: 0,
    networkErrors: 0,
    failures: [],
    notes: [],
    completed: false,
    elapsedMs: 0,
    elapsedSec: 0,
  };
}

async function createEmptyQuote(title) {
  const res = await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes`, {
    customer_id: FIXTURE.customerId,
    site_id: FIXTURE.siteId,
    title,
    vat_percent: 18,
    payment_terms: "שוטף +30",
    valid_until: "2026-12-31",
  });
  if (!res.ok) throw new Error(`create quote ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
}

async function getQuote(id) {
  const res = await api("GET", `/api/v1/workspaces/${WORKSPACE}/quotes/${id}`);
  if (!res.ok) throw new Error(`get quote ${res.status}`);
  return res.data;
}

async function openBuilder(browser, quoteId, width = 1440, theme = "dark") {
  const ctx = await browser.newContext({
    viewport: { width, height: width <= 430 ? 844 : 900 },
    colorScheme: theme === "dark" ? "dark" : "light",
    locale: "he-IL",
  });
  await ctx.addInitScript(
    ({ key, value, themeMode, ws }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", themeMode);
      localStorage.setItem("ss.last-workspace-id", ws);
      localStorage.setItem("ss.active_workspace_id", ws);
      localStorage.setItem(key, value);
      document.documentElement.setAttribute("dir", "rtl");
    },
    {
      key: `sb-${ref}-auth-token`,
      themeMode: theme,
      ws: WORKSPACE,
      value: JSON.stringify({
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token || "qa",
        expires_at: Math.floor(Date.now() / 1000) + 7200,
        expires_in: 7200,
        token_type: "bearer",
        user: tokenJson.user,
      }),
    },
  );
  const page = await ctx.newPage();
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().includes("/api/")) {
      // counted in metrics if needed
    }
  });
  await page.goto(`${WEB}/app/quotes/${quoteId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".cpq-builder, .quote-builder, .cpq-workspace-v2", { timeout: 60000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}

async function goStage(page, label, m) {
  await page.evaluate((stageLabel) => {
    const buttons = [...document.querySelectorAll(`button[aria-label="${stageLabel}"]`)];
    const visible = buttons.find((b) => {
      const style = window.getComputedStyle(b);
      return style.display !== "none" && style.visibility !== "hidden" && b.getClientRects().length > 0;
    });
    (visible || buttons[0])?.click();
  }, label);
  m.clicks += 1;
  await page.waitForTimeout(350);
}

async function openQuickAdd(page, m) {
  const add = page.getByRole("button", { name: /הוסף להצעה|הוסף פריט/ }).first();
  await add.click({ timeout: 15000 });
  m.clicks += 1;
  m.overlaysOpened += 1;
  await page.locator(".cpq-quick-add .cpq-quick-add-input").first().waitFor({ state: "visible", timeout: 15000 });
}

async function pickQuickOption(page, pattern, m) {
  const opt = page.locator(".cpq-quick-add [role='option']").filter({ hasText: pattern }).first();
  await opt.waitFor({ state: "visible", timeout: 10000 });
  await opt.click();
  m.clicks += 1;
  await page.waitForTimeout(400);
}

async function addCatalogSku(page, sku, m) {
  const input = page.locator(".cpq-quick-add .cpq-quick-add-input").first();
  await input.click();
  await input.fill("");
  await input.pressSequentially(sku, { delay: 25 });
  m.searches += 1;
  await page.waitForFunction(
    (needle) =>
      [...document.querySelectorAll(".cpq-quick-add [role='option']")].some((o) =>
        (o.textContent || "").toLowerCase().includes(String(needle).toLowerCase()),
      ),
    sku,
    { timeout: 10000 },
  );
  await page
    .locator(".cpq-quick-add [role='option']")
    .filter({ hasText: new RegExp(sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
    .first()
    .click();
  m.clicks += 1;
  await page.waitForTimeout(650);
}

async function applyPackage(page, m) {
  await openQuickAdd(page, m);
  // Prefer package action if present, else system picker
  const pkgOpt = page.locator(".cpq-quick-add [role='option']").filter({ hasText: /חבילה|מערכת/ });
  if (await pkgOpt.count()) {
    await pkgOpt.first().click();
    m.clicks += 1;
    m.overlaysOpened += 1;
  } else {
    throw new Error("quick-add package/system option missing");
  }
  const dialog = page.getByRole("dialog").first();
  await dialog.waitFor({ state: "visible", timeout: 15000 });
  const row = dialog.locator("li, button, .cpq-system-picker-row, [role='option']").filter({
    hasText: FIXTURE.packageName,
  });
  if (await row.count()) {
    const addBtn = row.first().getByRole("button", { name: /הוסף להצעה/ });
    if (await addBtn.count()) await addBtn.click();
    else await row.first().click();
  } else {
    await dialog.getByRole("button", { name: /הוסף להצעה/ }).first().click();
  }
  m.clicks += 1;
  await page.waitForTimeout(1400);
}

async function setFirstQty(page, value, m) {
  const qty = page.locator('input[id*="qty"], input[aria-label*="כמות"]').first();
  await qty.waitFor({ state: "visible", timeout: 15000 });
  await qty.click();
  await qty.fill(String(value));
  await qty.blur();
  m.clicks += 1;
  await page.waitForTimeout(900);
}

async function setFirstPrice(page, value, m) {
  const price = page.locator('input[id*="unit_price"], input[id*="price"], input[aria-label*="מחיר"]').first();
  if (!(await price.count())) {
    m.notes.push("unit_price_input_not_found");
    return false;
  }
  await price.click();
  await price.fill(String(value));
  await price.blur();
  m.clicks += 1;
  await page.waitForTimeout(900);
  return true;
}

async function setLineDiscount(page, percent, m) {
  const disc = page.locator('input[id*="discount"], input[aria-label*="הנחה"]').first();
  if (!(await disc.count())) {
    m.notes.push("line_discount_input_not_found");
    return false;
  }
  await disc.click();
  await disc.fill(String(percent));
  await disc.blur();
  m.clicks += 1;
  await page.waitForTimeout(900);
  return true;
}

async function readSaveState(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".cpq-save-state, .cpq-save-state-inline");
    const text = (el?.textContent || "").trim();
    const dot = document.querySelector(".cpq-save-dot");
    const cls = dot ? [...dot.classList].join(" ") : "";
    return { text, cls, present: Boolean(el) };
  });
}

async function probeUi(page) {
  return page.evaluate(() => {
    const body = document.body.innerText || "";
    return {
      hasFastStart: Boolean(document.querySelector('[data-testid="quote-fast-start"]')),
      hasQuickAddTrigger: [...document.querySelectorAll("button")].some((b) =>
        /הוסף להצעה|הוסף פריט/.test(b.textContent || ""),
      ),
      optionalLabel: /אופציונלי/.test(body),
      optionalTotal: /סה״כ כולל אופציות|סה"כ כולל אופציות/.test(body),
      sendCtaCount: [...document.querySelectorAll("button, a")].filter((el) =>
        /שליחה ללקוח/.test(el.textContent || ""),
      ).length,
      costLeak: /עלות יחידה|עלות כוללת|GP|gross profit/i.test(body) && /מרווח/.test(body),
      marginVisible: /מרווח|רווחיות/.test(body),
      vatVisible: /מע״מ|מע"מ/.test(body),
      paymentTerms: /שוטף|תנאי תשלום/.test(body),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      savePresent: Boolean(document.querySelector(".cpq-save-state, .cpq-save-state-inline")),
    };
  });
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.shots.push(name);
  return file;
}

// ---------- Flow A: package accelerated (fresh compose) ----------
async function runFreshPackage(browser) {
  const m = blank("fresh-package-compose");
  const quote = await createEmptyQuote(`QUOTE-9 package ${new Date().toISOString()}`);
  m.notes.push(`quoteId=${quote.id}`);
  report.flows.freshQuoteId = quote.id;
  const t0 = Date.now();
  const { ctx, page } = await openBuilder(browser, quote.id);
  try {
    await goStage(page, "תכנון וציוד", m);
    await applyPackage(page, m);
    // close overlays
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(500);

    // Add free cabling line via quick add
    await openQuickAdd(page, m);
    await pickQuickOption(page, /פריט חופשי|חופשי/, m).catch(async () => {
      // if already in catalog mode after package close, reopen
      await openQuickAdd(page, m);
      await pickQuickOption(page, /פריט חופשי|חופשי/, m);
    });
    await page.waitForTimeout(800);
    // fill description if free line created
    const desc = page.locator('input[id*="description"], textarea[id*="description"]').last();
    if (await desc.count()) {
      await desc.fill("כבלים והתקנת תשתיות — קווי PoE");
      await desc.blur();
      m.clicks += 1;
      await page.waitForTimeout(700);
    }

    await setFirstQty(page, 4, m);
    const saveAfter = await readSaveState(page);
    m.notes.push(`save_after_edit=${JSON.stringify(saveAfter)}`);

    await goStage(page, "הצעה ומחיר", m);
    const disc = page.locator("#discount_percent").first();
    if (await disc.count()) {
      await disc.fill("5");
      m.clicks += 1;
      await page.waitForTimeout(800);
    }

    await goStage(page, "תנאים ושליחה", m);
    const previewBtn = page.getByRole("button", { name: /תצוגת לקוח/ }).first();
    if (await previewBtn.count()) {
      // open customer view in same tab via href if link
      const href = await previewBtn.evaluate((el) => (el.closest("a") || el).getAttribute?.("href") || null);
      m.notes.push(`preview_href=${href}`);
    }

    const ui = await probeUi(page);
    m.ui = ui;
    report.probes.afterCompose = ui;
    if (ui.hasFastStart) issue("P2", "fast-add", "quote-fast-start unexpectedly mounted");
    if (!ui.optionalLabel) issue("P1", "optional", "Optional item UI not visible in builder");
    if (ui.sendCtaCount > 2) issue("P2", "review", `Duplicate Send CTAs count=${ui.sendCtaCount}`);

    await shot(page, "1440-dark-compose");
    const verify = await getQuote(quote.id);
    const items = (verify.items || []).filter((i) => i.item_type !== "note" && i.item_type !== "section");
    m.verify = {
      itemCount: items.length,
      total: verify.total_gross ?? verify.total ?? null,
      vat: verify.vat_percent,
      discount_percent: verify.discount_percent,
      status: verify.status,
    };
    m.completed = items.length >= 4;
    if (!m.completed) m.failures.push(`expected ≥4 lines got ${items.length}`);
  } catch (err) {
    m.failures.push(String(err));
    await shot(page, "fresh-package-error").catch(() => undefined);
  }
  m.elapsedMs = Date.now() - t0;
  m.elapsedSec = Math.round(m.elapsedMs / 100) / 10;
  await ctx.close();
  report.flows.freshPackage = m;
  return m;
}

// ---------- Flow B: manual catalog path ----------
async function runFreshManual(browser) {
  const m = blank("fresh-manual-catalog");
  const quote = await createEmptyQuote(`QUOTE-9 manual ${new Date().toISOString()}`);
  m.notes.push(`quoteId=${quote.id}`);
  const t0 = Date.now();
  const { ctx, page } = await openBuilder(browser, quote.id);
  try {
    await goStage(page, "תכנון וציוד", m);
    await openQuickAdd(page, m);
    await pickQuickOption(page, /מוצר/, m);
    await addCatalogSku(page, "QA-CAM-4MP", m);
    await addCatalogSku(page, "QA-NVR-8CH", m);
    await addCatalogSku(page, "QA-HDD-4TB", m);
    await addCatalogSku(page, "QA-POE-8", m);
    await addCatalogSku(page, "QA-LABOR-INSTALL", m);
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(600);
    await setFirstQty(page, 4, m);
    await setFirstPrice(page, 475, m);
    await setLineDiscount(page, 5, m);

    // free cabling
    await openQuickAdd(page, m);
    await pickQuickOption(page, /פריט חופשי|חופשי/, m);
    await page.waitForTimeout(700);

    await goStage(page, "הצעה ומחיר", m);
    await shot(page, "1440-dark-pricing");
    const verify = await getQuote(quote.id);
    const items = (verify.items || []).filter((i) => i.item_type !== "note" && i.item_type !== "section");
    m.verify = { itemCount: items.length, total: verify.total_gross ?? verify.total, status: verify.status };
    m.completed = items.length >= 5;
    if (!m.completed) m.failures.push(`expected ≥5 lines got ${items.length}`);
  } catch (err) {
    m.failures.push(String(err));
    await shot(page, "fresh-manual-error").catch(() => undefined);
  }
  m.elapsedMs = Date.now() - t0;
  m.elapsedSec = Math.round(m.elapsedMs / 100) / 10;
  await ctx.close();
  report.flows.freshManual = m;
  return m;
}

// ---------- Full lifecycle on package quote ----------
async function runFullLifecycle(browser, quoteId) {
  const m = blank("full-send-lifecycle");
  m.notes.push(`quoteId=${quoteId}`);
  const t0 = Date.now();
  const { ctx, page } = await openBuilder(browser, quoteId);
  try {
    // edit + wait autosave
    await goStage(page, "תכנון וציוד", m);
    await setFirstQty(page, 4, m);
    await page.waitForTimeout(1200);
    let save = await readSaveState(page);
    m.notes.push(`save_pre_send=${JSON.stringify(save)}`);
    // wait until not dirty/saving if possible
    for (let i = 0; i < 8; i++) {
      save = await readSaveState(page);
      if (/נשמר|Saved/i.test(save.text) || save.cls.includes("is-saved")) break;
      await page.waitForTimeout(500);
    }
    m.notes.push(`save_ready=${JSON.stringify(save)}`);
    if (/נכשל|error/i.test(save.text) || save.cls.includes("is-error")) {
      issue("P0", "autosave", `Save error before send: ${save.text}`);
    }

    await goStage(page, "תנאים ושליחה", m);
    await shot(page, "1440-dark-review");

    // Prefer UI send; fall back to API
    const sendBtn = page.getByRole("button", { name: /שליחה ללקוח/ }).first();
    let sentVia = "none";
    if (await sendBtn.count()) {
      await sendBtn.click();
      m.clicks += 1;
      m.overlaysOpened += 1;
      await page.waitForTimeout(600);
      const confirm = page.getByRole("button", { name: /שליחה|אישור|שלח/ }).last();
      if (await confirm.count()) {
        await confirm.click();
        m.clicks += 1;
      }
      await page.waitForTimeout(1500);
      sentVia = "ui";
    }
    let quote = await getQuote(quoteId);
    if (quote.status === "draft") {
      const sent = await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}/send`);
      m.notes.push(`send_api_status=${sent.status}`);
      if (!sent.ok) m.failures.push(`send failed ${JSON.stringify(sent.data)}`);
      else sentVia = sentVia === "ui" ? "ui+api" : "api";
      quote = await getQuote(quoteId);
    }
    m.notes.push(`sentVia=${sentVia} status=${quote.status}`);

    // PDF
    const pdf = await api("GET", `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}/pdf`);
    m.notes.push(`pdf_status=${pdf.status}`);
    if (!pdf.ok && pdf.status !== 200) {
      // some endpoints return blob — if status ok
      issue("P1", "pdf", `PDF endpoint status ${pdf.status}`);
    }

    // Public token
    const share = await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}/share`);
    const token =
      share.data?.token ||
      share.data?.public_token ||
      quote.public_token ||
      null;
    m.notes.push(`share_status=${share.status} token=${Boolean(token)}`);

    let publicOk = false;
    if (token) {
      const pubCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const pubPage = await pubCtx.newPage();
      await pubPage.goto(`${WEB}/public/quotes/${token}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await pubPage.waitForTimeout(800);
      const pubText = await pubPage.locator("body").innerText();
      publicOk = /הצעת מחיר|סה״כ|סה"כ|אישור/.test(pubText);
      const costOnPublic = /עלות|מרווח|GP\b/.test(pubText);
      if (costOnPublic) issue("P0", "public", "Cost/margin leaked on public quote");
      await pubPage.screenshot({ path: path.join(OUT, "390-public-quote.png"), fullPage: true });
      report.shots.push("390-public-quote");
      // approve
      const approve = pubPage.getByRole("button", { name: /אישור/ }).first();
      if (await approve.count()) {
        await approve.click();
        m.clicks += 1;
        await pubPage.waitForTimeout(500);
        const name = pubPage.locator('input[name*="name"], input[id*="name"], input[placeholder*="שם"]').first();
        if (await name.count()) {
          await name.fill("לקוח בדיקה Q9");
          m.clicks += 1;
        }
        const confirm = pubPage.getByRole("button", { name: /אישור|חתימה|שלח/ }).last();
        if (await confirm.count()) {
          await confirm.click();
          m.clicks += 1;
          await pubPage.waitForTimeout(1200);
        }
      }
      await pubCtx.close();
    } else {
      // approve via API fallback
      const approved = await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}/approve`, {
        approved_name: "QA Approve",
      });
      m.notes.push(`approve_api=${approved.status}`);
    }

    quote = await getQuote(quoteId);
    m.notes.push(`post_public_status=${quote.status}`);

    // Revise
    const revised = await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}/revise`);
    m.notes.push(`revise_status=${revised.status} version=${revised.data?.version}`);
    if (!revised.ok) m.failures.push(`revise failed ${JSON.stringify(revised.data)}`);

    const compare = await api(
      "GET",
      `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}/compare?from_version=1&to_version=2`,
    ).catch(() => ({ ok: false, status: 0, data: null }));
    m.notes.push(`compare_status=${compare.status}`);

    // Project if approved
    quote = await getQuote(quoteId);
    if (quote.status === "approved" || quote.status === "draft") {
      // after revise status is draft — create project from approved snapshot if endpoint allows
      const proj = await api("POST", `/api/v1/workspaces/${WORKSPACE}/projects`, {
        // try dedicated endpoint
      }).catch(() => null);
      const fromQuote = await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}/create-project`);
      m.notes.push(`create_project_status=${fromQuote.status}`);
      if (fromQuote.ok) {
        m.notes.push(`projectId=${fromQuote.data?.id || fromQuote.data?.project_id}`);
        report.flows.projectId = fromQuote.data?.id || fromQuote.data?.project_id;
      } else {
        // alternate path name
        const alt = await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}/project`);
        m.notes.push(`create_project_alt_status=${alt.status}`);
      }
    }

    // Reload builder after revise
    await page.goto(`${WEB}/app/quotes/${quoteId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".cpq-builder, .quote-builder", { timeout: 45000 });
    await shot(page, "1440-dark-after-revise");

    m.completed =
      m.failures.length === 0 &&
      ["sent", "viewed", "approved", "draft"].includes((await getQuote(quoteId)).status);
    m.publicOk = publicOk;
  } catch (err) {
    m.failures.push(String(err));
    await shot(page, "full-lifecycle-error").catch(() => undefined);
  }
  m.elapsedMs = Date.now() - t0;
  m.elapsedSec = Math.round(m.elapsedMs / 100) / 10;
  await ctx.close();
  report.flows.fullLifecycle = m;
  return m;
}

// ---------- Viewport matrix on existing quote ----------
async function runViewports(browser, quoteId) {
  const sizes = [
    [1440, "dark"],
    [1032, "dark"],
    [768, "dark"],
    [430, "dark"],
    [390, "dark"],
    [360, "dark"],
    [1440, "light"],
    [390, "light"],
  ];
  for (const [width, theme] of sizes) {
    const { ctx, page } = await openBuilder(browser, quoteId, width, theme);
    try {
      await goStage(page, "תכנון וציוד", blank("vp"));
      const ui = await probeUi(page);
      const name = `${width}-${theme}`;
      await shot(page, name);
      report.viewports[name] = { overflowX: ui.overflowX, sendCtaCount: ui.sendCtaCount, savePresent: ui.savePresent };
      if (ui.overflowX) issue("P1", "responsive", `horizontal overflow at ${name}`);
    } catch (err) {
      issue("P1", "responsive", `${width}-${theme}: ${err}`);
    }
    await ctx.close();
  }
}

// ---------- API capability / optional / cost probes ----------
async function runApiProbes() {
  const quote = await createEmptyQuote(`QUOTE-9 api-probe ${Date.now()}`);
  const item = await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes/${quote.id}/items`, {
    item_type: "custom",
    description: "פריט אופציונלי לבדיקה — טקסט ארוך בעברית לבדיקת גלישה במסמך",
    qty: 1,
    unit_price: 100,
    is_optional: true,
  });
  report.probes.optionalApiCreate = { status: item.status, ok: item.ok, is_optional: item.data?.is_optional };
  const got = await getQuote(quote.id);
  const opt = (got.items || []).find((i) => i.is_optional);
  report.probes.optionalOnQuote = Boolean(opt);
  report.probes.ownerSeesCost = got.items?.some((i) => i.cost != null || i.unit_cost != null) || got.cost != null;
  // strip check: owner should see cost if permitted
  report.probes.quoteTotals = {
    total_gross: got.total_gross,
    total_net: got.total_net,
    vat_amount: got.vat_amount,
    discount_percent: got.discount_percent,
  };
}

const browser = await chromium.launch({ headless: true });
try {
  await runApiProbes();
  const freshPkg = await runFreshPackage(browser);
  await runFreshManual(browser);
  if (freshPkg.completed && report.flows.freshQuoteId) {
    await runFullLifecycle(browser, report.flows.freshQuoteId);
  }
  const vpQuote = report.flows.freshQuoteId || report.flows.freshManual?.notes?.find?.(() => true);
  if (report.flows.freshQuoteId) await runViewports(browser, report.flows.freshQuoteId);
} catch (err) {
  report.fatal = String(err);
} finally {
  await browser.close();
}

const freshSec = report.flows.freshPackage?.elapsedSec ?? null;
const manualSec = report.flows.freshManual?.elapsedSec ?? null;
const fullSec = report.flows.fullLifecycle?.elapsedSec ?? null;

report.summary = {
  freshPackageCompleted: report.flows.freshPackage?.completed ?? false,
  freshManualCompleted: report.flows.freshManual?.completed ?? false,
  fullLifecycleCompleted: report.flows.fullLifecycle?.completed ?? false,
  freshPackageSec: freshSec,
  freshManualSec: manualSec,
  fullLifecycleSec: fullSec,
  underThreeMinutesFresh:
    Boolean(report.flows.freshPackage?.completed) && (freshSec ?? 999) <= 180,
  underThreeMinutesFull:
    Boolean(report.flows.fullLifecycle?.completed) && (fullSec ?? 999) <= 180,
  clicksFresh: report.flows.freshPackage?.clicks ?? null,
  searchesFresh: report.flows.freshPackage?.searches ?? null,
  overlaysFresh: report.flows.freshPackage?.overlaysOpened ?? null,
  issueCounts: {
    P0: report.issues.filter((i) => i.severity === "P0").length,
    P1: report.issues.filter((i) => i.severity === "P1").length,
    P2: report.issues.filter((i) => i.severity === "P2").length,
  },
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
