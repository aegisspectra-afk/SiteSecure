/**
 * Q3-B Fast Quote benchmark — must COMPLETE with seeded QA fixtures.
 * No product UX changes. Measures actual Playwright times.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/quote-fast-quote-q3b-qa");
const FIXTURE = JSON.parse(fs.readFileSync(path.join(OUT, "fixture.json"), "utf8"));

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

const WEB = env.WEB_URL || "http://localhost:5173";
const API = (env.VITE_API_URL || env.API_PUBLIC_URL || "http://localhost:8000").replace(/\/$/, "");
const SUPABASE_URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const EMAIL = FIXTURE.email;
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const WORKSPACE = FIXTURE.workspaceId;

fs.mkdirSync(OUT, { recursive: true });

const tokenJson = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());

if (!tokenJson.access_token) {
  console.error("auth failed", tokenJson);
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
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${p} ${res.status} ${text.slice(0, 300)}`);
  return json;
}

async function createEmptyQuote() {
  return api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes`, {
    customer_id: FIXTURE.customerId,
    site_id: FIXTURE.siteId,
    title: `Q3-B benchmark ${new Date().toISOString()}`,
  });
}

function blank(pathName) {
  return {
    path: pathName,
    clicks: 0,
    overlaysOpened: 0,
    searches: 0,
    duplicateEntry: 0,
    networkErrors: 0,
    failures: [],
    notes: [],
    completed: false,
  };
}

async function openQuote(browser, quoteId, width = 1440) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: "dark",
  });
  await ctx.addInitScript(
    ({ key, value }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", "dark");
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      value: JSON.stringify({
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token || "qa",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user: tokenJson.user,
      }),
    },
  );
  const page = await ctx.newPage();
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().includes("/api/")) {
      // counted later via page evaluation if needed
    }
  });
  await page.goto(`${WEB}/app/quotes/${quoteId}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(".cpq-workspace-v2, .cpq-stage-panel, #quote-items", { timeout: 45000 });
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

async function openCatalogBrowse(page, m) {
  const fast = page.locator('[data-testid="quote-fast-start"]').getByRole("button", { name: /^מוצר/ });
  if (await fast.count()) {
    await fast.first().click();
    m.clicks += 1;
  } else {
    const add = page.getByRole("button", { name: /הוסף/ }).first();
    await add.click();
    m.clicks += 1;
    const catalog = page.locator(".cpq-quick-add [role='option']").filter({ hasText: /מוצר/ }).first();
    if (await catalog.count()) {
      await catalog.click();
      m.clicks += 1;
    }
  }
  m.overlaysOpened += 1;
  await page.locator(".cpq-quick-add .cpq-quick-add-input").first().waitFor({ state: "visible", timeout: 15000 });
}

async function addCatalogBySearch(page, term, times, m) {
  const input = page.locator(".cpq-quick-add .cpq-quick-add-input").first();
  for (let i = 0; i < times; i++) {
    await input.click();
    await input.fill("");
    await input.pressSequentially(term, { delay: 40 });
    m.searches += 1;
    // Wait for a non-empty option that looks like a product hit
    try {
      await page.waitForFunction(
        (needle) => {
          const opts = [...document.querySelectorAll(".cpq-quick-add [role='option']")];
          return opts.some((o) => {
            const t = (o.textContent || "").toLowerCase();
            return t.includes(String(needle).toLowerCase()) && !t.includes("אין");
          });
        },
        term,
        { timeout: 8000 },
      );
    } catch {
      m.failures.push(`catalog miss: ${term} #${i + 1}`);
      continue;
    }
    const opt = page
      .locator(".cpq-quick-add [role='option']")
      .filter({ hasText: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
      .first();
    await opt.click();
    m.clicks += 1;
    await page.waitForTimeout(700);
  }
}

async function setFirstQty(page, value, m) {
  const qty = page.locator('input[id*="qty"], input[aria-label*="כמות"]').first();
  await qty.waitFor({ state: "visible", timeout: 15000 });
  await qty.click();
  await qty.fill(String(value));
  await qty.blur();
  m.clicks += 1;
  await page.waitForTimeout(400);
}

async function setDiscountAndPreview(page, m) {
  await goStage(page, "הצעה ומחיר", m);
  const disc = page.locator("#discount_percent").first();
  if (await disc.count()) {
    await disc.fill("5");
    m.clicks += 1;
  } else {
    const amt = page.locator("#discount_amount").first();
    if (await amt.count()) {
      await amt.fill("100");
      m.clicks += 1;
    } else {
      m.failures.push("discount field missing");
    }
  }
  await page.waitForTimeout(500);
  await goStage(page, "תנאים ושליחה", m);
  // preview / customer view if present
  const preview = page.getByRole("button", { name: /תצוגת לקוח|תצוגה/ }).first();
  if (await preview.count()) {
    await preview.click();
    m.clicks += 1;
    m.overlaysOpened += 1;
    await page.waitForTimeout(600);
    await page.keyboard.press("Escape").catch(() => undefined);
  }
}

async function countLines(page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll(
      ".cpq-line-row, [data-quote-line], [data-testid*='quote-line'], .quote-line-row",
    );
    if (rows.length) return rows.length;
    // fallback: description inputs that look like line editors
    return document.querySelectorAll('input[id*="description"], textarea[id*="description"]').length;
  });
}

async function verifyQuoteLines(quoteId, minLines) {
  const quote = await api("GET", `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}`);
  const items = (quote.items || []).filter((i) => i.item_type !== "note" && i.item_type !== "section");
  return { itemCount: items.length, total: quote.total_gross ?? quote.total ?? null, ok: items.length >= minLines };
}

async function runPathA(browser) {
  const m = blank("A-manual-catalog");
  const quote = await createEmptyQuote();
  m.notes.push(`quoteId=${quote.id}`);
  const t0 = Date.now();
  const { ctx, page } = await openQuote(browser, quote.id);
  try {
    // customer/site already on quote — no duplicate entry
    m.duplicateEntry = 0;
    await goStage(page, "תכנון וציוד", m);
    await openCatalogBrowse(page, m);

    // Add camera once then set qty=4 (scenario: add 4 cameras + later qty adjust)
    await addCatalogBySearch(page, "QA-CAM-4MP", 1, m);
    await addCatalogBySearch(page, "QA-NVR-8CH", 1, m);
    await addCatalogBySearch(page, "QA-HDD-4TB", 1, m);
    await addCatalogBySearch(page, "QA-LABOR-INSTALL", 1, m);

    await page.keyboard.press("Escape");
    m.clicks += 1;
    await page.waitForTimeout(800);

    await setFirstQty(page, 4, m);
    await setDiscountAndPreview(page, m);

    const verify = await verifyQuoteLines(quote.id, 4);
    m.verify = verify;
    m.completed = verify.ok && m.failures.length === 0;
    if (!verify.ok) m.failures.push(`expected ≥4 lines, got ${verify.itemCount}`);

    await page.screenshot({ path: path.join(OUT, "path-a-final.png"), fullPage: true });
  } catch (err) {
    m.failures.push(String(err));
    await page.screenshot({ path: path.join(OUT, "path-a-error.png"), fullPage: true }).catch(() => undefined);
  }
  m.elapsedMs = Date.now() - t0;
  m.elapsedSec = Math.round(m.elapsedMs / 100) / 10;
  await ctx.close();
  return m;
}

async function runPathB(browser) {
  const m = blank("B-accelerated-package");
  const quote = await createEmptyQuote();
  m.notes.push(`quoteId=${quote.id}`);
  m.notes.push(`package=${FIXTURE.packageName}`);
  const t0 = Date.now();
  const { ctx, page } = await openQuote(browser, quote.id);
  try {
    m.duplicateEntry = 0;
    await goStage(page, "תכנון וציוד", m);

    const packageBtn = page.locator('[data-testid="quote-fast-start"]').getByRole("button", {
      name: /מערכת|חבילה/,
    });
    if (!(await packageBtn.count())) {
      m.failures.push("fast-start package action missing");
    } else {
      await packageBtn.first().click();
      m.clicks += 1;
      m.overlaysOpened += 1;
      const dialog = page.getByRole("dialog").filter({ hasText: /מערכת|חבילה|QA CCTV/ }).first();
      await dialog.waitFor({ state: "visible", timeout: 15000 });
      // Prefer the QA package row
      const row = dialog.locator("li, .cpq-system-picker-row").filter({ hasText: FIXTURE.packageName }).first();
      if (await row.count()) {
        await row.getByRole("button", { name: /הוסף להצעה/ }).click();
      } else {
        await dialog.getByRole("button", { name: /הוסף להצעה/ }).first().click();
      }
      m.clicks += 1;
      await page.waitForTimeout(1200);
    }

    // Optionally tweak qty + discount + preview (same business finish)
    await setFirstQty(page, 4, m);
    await setDiscountAndPreview(page, m);

    const verify = await verifyQuoteLines(quote.id, 4);
    m.verify = verify;
    m.completed = verify.ok && !m.failures.some((f) => /missing|Timeout|Error/.test(f));
    if (!verify.ok) m.failures.push(`expected ≥4 package lines, got ${verify.itemCount}`);

    await page.screenshot({ path: path.join(OUT, "path-b-final.png"), fullPage: true });
  } catch (err) {
    m.failures.push(String(err));
    await page.screenshot({ path: path.join(OUT, "path-b-error.png"), fullPage: true }).catch(() => undefined);
  }
  m.elapsedMs = Date.now() - t0;
  m.elapsedSec = Math.round(m.elapsedMs / 100) / 10;
  await ctx.close();
  return m;
}

const browser = await chromium.launch({ headless: true });
const report = {
  measuredAt: new Date().toISOString(),
  web: WEB,
  api: API,
  workspaceId: WORKSPACE,
  fixture: {
    packageId: FIXTURE.packageId,
    templateId: FIXTURE.templateId,
    productSkus: FIXTURE.products.map((p) => p.sku),
    customerId: FIXTURE.customerId,
    siteId: FIXTURE.siteId,
  },
  targetMinutes: 5,
  paths: [],
};

try {
  report.paths.push(await runPathA(browser));
  report.paths.push(await runPathB(browser));
} catch (err) {
  report.fatal = String(err);
} finally {
  await browser.close();
}

report.summary = {
  pathA_completed: report.paths[0]?.completed ?? false,
  pathB_completed: report.paths[1]?.completed ?? false,
  pathA_sec: report.paths[0]?.elapsedSec ?? null,
  pathB_sec: report.paths[1]?.elapsedSec ?? null,
  underFiveMinutes:
    Boolean(report.paths[0]?.completed) &&
    Boolean(report.paths[1]?.completed) &&
    (report.paths[0]?.elapsedSec ?? 999) <= 300 &&
    (report.paths[1]?.elapsedSec ?? 999) <= 300,
};

fs.writeFileSync(path.join(OUT, "benchmark-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
