/**
 * Q3 Fast Quote timed benchmark — actual measured Playwright QA.
 * Paths A (manual catalog) and B (package/CCTV/template accelerated).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

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

const OUT = path.join(ROOT, "Docs/quote-fast-quote-q3-qa");
const WEB = env.WEB_URL || "http://localhost:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const QUOTE_ID = env.QA_QUOTE_ID || "";
fs.mkdirSync(OUT, { recursive: true });

const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
const tokenJson = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());

if (!tokenJson.access_token) {
  console.error("auth failed", tokenJson);
  process.exit(1);
}

function blankMetrics(pathName) {
  return {
    path: pathName,
    clicks: 0,
    overlaysOpened: 0,
    searches: 0,
    repeatedDataEntry: 0,
    failures: [],
    notes: [],
  };
}

async function openBuilder(browser, width = 1440) {
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
  const target = QUOTE_ID ? `/app/quotes/${QUOTE_ID}` : "/app/quotes/new";
  await page.goto(`${WEB}${target}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.theme = "dark";
  });
  await page.waitForSelector(".cpq-workspace-v2, .cpq-stage-panel, #quote-items", { timeout: 45000 });
  return { ctx, page };
}

async function goItems(page, m) {
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button[aria-label="תכנון וציוד"]')];
    const visible = buttons.find((b) => {
      const style = window.getComputedStyle(b);
      return style.display !== "none" && style.visibility !== "hidden" && b.getClientRects().length > 0;
    });
    (visible || buttons[0])?.click();
  });
  m.clicks += 1;
  await page.waitForTimeout(300);
}

async function goPricing(page, m) {
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button[aria-label="הצעה ומחיר"]')];
    const visible = buttons.find((b) => {
      const style = window.getComputedStyle(b);
      return style.display !== "none" && style.visibility !== "hidden" && b.getClientRects().length > 0;
    });
    (visible || buttons[0])?.click();
  });
  m.clicks += 1;
  await page.waitForTimeout(300);
}

async function goReview(page, m) {
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button[aria-label="תנאים ושליחה"]')];
    const visible = buttons.find((b) => {
      const style = window.getComputedStyle(b);
      return style.display !== "none" && style.visibility !== "hidden" && b.getClientRects().length > 0;
    });
    (visible || buttons[0])?.click();
  });
  m.clicks += 1;
  await page.waitForTimeout(300);
}

async function ensureCustomerSite(page, m) {
  // If fast-start already visible, context is scoped.
  if (await page.locator('[data-testid="quote-fast-start"]').count()) {
    m.notes.push("fast-start already present");
    return;
  }
  // Try picking first customer from selector if present
  const customerTrigger = page.locator("#customer_id, [data-testid='customer-selector'] button, button:has-text('בחר לקוח')").first();
  if (await customerTrigger.count()) {
    await customerTrigger.click().catch(() => undefined);
    m.clicks += 1;
    const option = page.locator('[role="option"], [role="listbox"] button, .customer-option').first();
    if (await option.count()) {
      await option.click();
      m.clicks += 1;
      m.repeatedDataEntry += 1;
    }
  }
  const site = page.locator("#site_id");
  if (await site.count()) {
    const options = await site.locator("option").all();
    if (options.length > 1) {
      const val = await options[1].getAttribute("value");
      if (val) {
        await site.selectOption(val);
        m.clicks += 1;
        m.repeatedDataEntry += 1;
      }
    }
  }
  await goItems(page, m);
}

async function addCatalogHits(page, terms, m) {
  const fastCatalog = page.locator('[data-testid="quote-fast-start"]').getByRole("button", { name: /^מוצר/ });
  if (await fastCatalog.count()) {
    await fastCatalog.first().click();
    m.clicks += 1;
  } else {
    const toolbar = page.getByRole("button", { name: /הוסף/ }).first();
    await toolbar.click();
    m.clicks += 1;
    const catalog = page.locator(".cpq-quick-add [role='option']").filter({ hasText: /מוצר/ }).first();
    if (await catalog.count()) {
      await catalog.click();
      m.clicks += 1;
    }
  }
  m.overlaysOpened += 1;
  const input = page.locator(".cpq-quick-add .cpq-quick-add-input").first();
  await input.waitFor({ state: "visible", timeout: 10000 });

  for (const term of terms) {
    await input.fill(term);
    m.searches += 1;
    await page.waitForTimeout(550);
    const opt = page.locator(".cpq-quick-add [role='option']").first();
    if (await opt.count()) {
      await opt.click();
      m.clicks += 1;
      await page.waitForTimeout(400);
    } else {
      m.failures.push(`catalog miss: ${term}`);
    }
  }
  await page.keyboard.press("Escape");
  m.clicks += 1;
}

async function adjustQtyDiscountPreview(page, m) {
  const qty = page.locator('input[id*="qty"], input[aria-label*="כמות"]').first();
  if (await qty.count()) {
    await qty.click();
    await qty.fill("4");
    m.clicks += 1;
  }
  await goPricing(page, m);
  const disc = page.locator("#discount_percent").first();
  if (await disc.count()) {
    await disc.fill("5");
    m.clicks += 1;
  } else {
    const amt = page.locator("#discount_amount").first();
    if (await amt.count()) {
      await amt.fill("100");
      m.clicks += 1;
    }
  }
  await goReview(page, m);
}

async function runPathA(browser) {
  const m = blankMetrics("A-manual-catalog");
  const t0 = Date.now();
  const { ctx, page } = await openBuilder(browser, 1440);
  try {
    await ensureCustomerSite(page, m);
    await goItems(page, m);
    await addCatalogHits(page, ["מצלמה", "NVR", "HDD", "התקנה"], m);
    await adjustQtyDiscountPreview(page, m);
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
  const m = blankMetrics("B-accelerated");
  const t0 = Date.now();
  const { ctx, page } = await openBuilder(browser, 1440);
  try {
    await ensureCustomerSite(page, m);
    await goItems(page, m);

    const packageBtn = page.locator('[data-testid="quote-fast-start"]').getByRole("button", { name: /מערכת|חבילה/ });
    const cctvBtn = page.locator('[data-testid="quote-fast-start"]').getByRole("button", { name: /^CCTV/ });
    const templateBtn = page.locator('[data-testid="quote-fast-start"]').getByRole("button", { name: /^תבנית/ });

    if (await packageBtn.count()) {
      await packageBtn.first().click();
      m.clicks += 1;
      m.overlaysOpened += 1;
      const dialog = page.getByRole("dialog").filter({ hasText: /מערכת|חבילה/ }).first();
      await dialog.waitFor({ state: "visible", timeout: 15000 });
      const apply = dialog.getByRole("button", { name: /הוסף להצעה/ }).first();
      await apply.click();
      m.clicks += 1;
      m.notes.push("used package one-click");
      await page.waitForTimeout(1000);
    } else if (await cctvBtn.count()) {
      await cctvBtn.first().click();
      m.clicks += 1;
      m.overlaysOpened += 1;
      await page.locator("#cpq-camera-count").waitFor({ state: "visible", timeout: 15000 });
      await page.locator("#cpq-camera-count").fill("4");
      m.clicks += 1;
      await page.getByRole("button", { name: /חשב|המלצ|תכנון/ }).first().click();
      m.clicks += 1;
      const add = page.getByRole("button", { name: /הוסף.*הצעה|הוסף מתוכנן|הוסף פתרון/ }).first();
      await add.waitFor({ state: "visible", timeout: 45000 });
      await add.click();
      m.clicks += 1;
      m.notes.push("used CCTV apply");
      await page.waitForTimeout(1000);
    } else if (await templateBtn.count()) {
      await templateBtn.first().click();
      m.clicks += 1;
      m.overlaysOpened += 1;
      const dialog = page.getByRole("dialog").filter({ hasText: /תבנית/ }).first();
      await dialog.waitFor({ state: "visible", timeout: 15000 });
      await dialog.getByRole("button", { name: /החל|התחל/ }).first().click();
      m.clicks += 1;
      m.notes.push("used template apply");
      await page.waitForTimeout(1000);
    } else {
      m.failures.push("no accelerated fast-start action available");
      await addCatalogHits(page, ["מצלמה"], m);
    }

    await adjustQtyDiscountPreview(page, m);
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

async function mobileSmoke(browser) {
  const out = { widths: [] };
  for (const width of [390, 360]) {
    const { ctx, page } = await openBuilder(browser, width);
    await goItems(page, blankMetrics("mobile"));
    const fast = await page.locator('[data-testid="quote-fast-start"]').count();
    const dock = await page.locator(".quote-builder-actions, .cpq-mobile-actions").boundingBox();
    await page.screenshot({ path: path.join(OUT, `mobile-${width}-items.png`), fullPage: true });
    // open add if available
    const add = page.getByRole("button", { name: /הוסף/ }).first();
    if (await add.count()) {
      await add.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `mobile-${width}-add.png`), fullPage: true });
      await page.keyboard.press("Escape");
    }
    out.widths.push({ width, fastStart: fast > 0, dockBottom: dock ? dock.y + dock.height : null });
    await ctx.close();
  }
  return out;
}

const browser = await chromium.launch({ headless: true });
const report = {
  measuredAt: new Date().toISOString(),
  web: WEB,
  email: EMAIL,
  targetMinutes: 5,
  quoteIdSeed: QUOTE_ID || null,
  paths: [],
};

try {
  report.paths.push(await runPathA(browser));
  report.paths.push(await runPathB(browser));
  report.mobile = await mobileSmoke(browser);
} catch (err) {
  report.fatal = String(err);
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
