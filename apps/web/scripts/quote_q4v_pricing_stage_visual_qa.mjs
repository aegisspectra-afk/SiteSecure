/**
 * Q4-V — Commercial Pricing stage visual QA.
 * Deterministic fixture + real Builder stage navigation (no fragile deep-link race).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

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

const OUT = path.join(ROOT, "Docs/q4v-pricing-stage-visual-qa");
fs.mkdirSync(OUT, { recursive: true });

const WEB = env.WEB_URL || "http://localhost:5173";
const API = env.VITE_API_URL || env.API_URL || "http://127.0.0.1:8000";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const WS = env.QA_WORKSPACE_ID || "50339413-11c7-4903-820c-7541fbd2a476";

const report = {
  ok: true,
  web: WEB,
  email: EMAIL,
  navigation: null,
  race_root_cause: null,
  fixture: {},
  checks: {},
  viewports: {},
  shots: [],
  errors: [],
  unauthorized: {
    attempted: false,
    limitation:
      "QA workspace only has owner + technician. Technician lacks quotes.view on this quote and catalog.view. Authz unit matrix already proves sales/technician/viewer cannot quotes.view_cost. No persistent membership created.",
  },
};

function fail(msg) {
  report.ok = false;
  report.errors.push(msg);
  console.error("FAIL:", msg);
}

const tokenJson = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());

if (!tokenJson.access_token) {
  console.error("auth failed", tokenJson);
  process.exit(1);
}

const token = tokenJson.access_token;
const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
const hdr = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function api(method, pathName, body) {
  const res = await fetch(`${API.replace(/\/$/, "")}${pathName}`, {
    method,
    headers: hdr,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function findProduct(q, pred) {
  const res = await api("GET", `/api/v1/workspaces/${WS}/catalog/products?q=${encodeURIComponent(q)}&limit=20`);
  const items = res.data?.items || [];
  return items.find(pred) || items[0] || null;
}

// ——— Fixture ———
const created = await api("POST", `/api/v1/workspaces/${WS}/quotes`, {
  title: "Q4-V Pricing Visual Fixture",
  vat_percent: 18,
});
if (created.status >= 400 || !created.data?.id) {
  console.error("quote create failed", created);
  process.exit(1);
}
const quoteId = created.data.id;
report.fixture.quoteId = quoteId;

const cam =
  (await findProduct("QA-CAM-4MP-TURRET", (i) => i.sku === "QA-CAM-4MP-TURRET")) ||
  (await findProduct("QA-", (i) => i.kind === "product"));
const labor =
  (await findProduct("QA Installation", (i) => i.kind === "service" || i.is_labor)) ||
  (await findProduct("QA-", (i) => i.kind === "service"));

if (!cam) {
  console.error("no QA catalog product");
  process.exit(1);
}

const section = await api("POST", `/api/v1/workspaces/${WS}/quotes/${quoteId}/sections`, {
  name: "ציוד ראשי",
  sort_order: 10,
  discount_type: "percent",
  discount_value: 5,
});
// create section returns enriched quote — section id is in sections[], not top-level id (that's the quote).
let secId = null;
if (Array.isArray(section.data?.sections)) {
  secId = section.data.sections.find((s) => s.name === "ציוד ראשי")?.id || section.data.sections[0]?.id;
}
if (!secId) {
  const secs = await api("GET", `/api/v1/workspaces/${WS}/quotes/${quoteId}/sections`);
  secId = (secs.data?.items || []).find((s) => s.name === "ציוד ראשי")?.id || (secs.data?.items || [])[0]?.id;
}
if (!secId) {
  console.error("section create failed", section);
  process.exit(1);
}
report.fixture.sectionId = secId;

async function addItem(body) {
  const res = await api("POST", `/api/v1/workspaces/${WS}/quotes/${quoteId}/items`, body);
  if (res.status >= 400) {
    console.error("item failed", res.status, res.data);
    process.exit(1);
  }
  return res;
}

const listPrice = Number(cam.list_price || 249.95);
const overridePrice = Math.round(listPrice * 1.15 * 100) / 100;

await addItem({
  product_id: cam.id,
  item_type: "catalog",
  description: cam.name,
  qty: 2,
  unit_price: overridePrice,
  discount: 10,
  discount_type: "percent",
  section_id: secId,
  sort_order: 10,
});

if (labor) {
  await addItem({
    product_id: labor.id,
    item_type: "labor",
    description: labor.name || "QA Installation Labor",
    qty: 4,
    unit_price: Number(labor.list_price || 180),
    cost: Number(labor.cost || 90) || 90,
    discount: 0,
    section_id: secId,
    sort_order: 20,
  });
} else {
  await addItem({
    item_type: "labor",
    description: "QA Installation Labor (manual)",
    qty: 4,
    unit_price: 180,
    cost: 90,
    sort_order: 20,
    section_id: secId,
  });
}

await addItem({
  product_id: cam.id,
  item_type: "catalog",
  description: "Optional spare camera",
  qty: 1,
  unit_price: 150,
  is_optional: true,
  cost: Number(cam.cost || 60),
  sort_order: 30,
  section_id: secId,
});

await api("PATCH", `/api/v1/workspaces/${WS}/quotes/${quoteId}`, {
  discount_type: "percent",
  discount_value: 3,
});

const doc = await api("GET", `/api/v1/workspaces/${WS}/quotes/${quoteId}`);
if (!(doc.data?.items || []).length) {
  console.error("fixture has zero items after seeding", doc.data);
  process.exit(1);
}
report.fixture.api = {
  number: doc.data?.number,
  items: (doc.data?.items || []).map((i) => ({
    desc: i.description,
    type: i.item_type,
    optional: i.is_optional,
    unit_price: i.unit_price,
    discount: i.discount,
    cost: i.cost,
  })),
  sections: (doc.data?.sections || []).map((s) => ({
    name: s.name,
    discount_type: s.discount_type,
    discount_value: s.discount_value,
  })),
  subtotal_net: doc.data?.subtotal_net,
  vat_amount: doc.data?.vat_amount,
  total_gross: doc.data?.total_gross,
  optional_subtotal: doc.data?.optional_subtotal,
  total_with_options_gross: doc.data?.total_with_options_gross,
  cost_total: doc.data?.cost_total,
  margin_amount: doc.data?.margin_amount,
  margin_percent: doc.data?.margin_percent,
  quote_discount: doc.data?.discount_value,
};

report.race_root_cause =
  "Prior Q4-S pricing automation used waitForSelector(...).catch(()=>{}) which swallowed load timeouts, then clicked stage CTA / screenshot while the Builder was still on the Hebrew loading spinner (טוען). Also reused WEB_URL=127.0.0.1 while Vite listens on IPv6 localhost. This is a QA navigation/wait bug, not a Builder stage initialization race.";

report.navigation =
  "Open /app/quotes/{id} → wait for .cpq-builder + commercial lines → click QuoteStepper aria-label הצעה ומחיר → wait for [data-testid=stage3-financial-summary] + [data-testid=stage3-commercial-workspace]";

const browser = await chromium.launch({ headless: true });

async function openReady(theme, width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme === "dark" ? "dark" : "light",
    locale: "he-IL",
  });
  await ctx.addInitScript(
    ({ key, value, theme: t }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", t);
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      theme,
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
  await page.goto(`${WEB}/app/quotes/${quoteId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.lang = "he";
  }, theme);

  await page.waitForSelector(".quote-builder, .cpq-builder", { timeout: 60000 });
  await page.waitForSelector("button.cpq-stepper-btn", { state: "attached", timeout: 60000 });
  await page.waitForFunction(() => {
    const t = (document.body?.innerText || "").trim();
    return t.length > 20 && !t.startsWith("טוען") && document.querySelectorAll("button.cpq-stepper-btn").length > 0;
  }, { timeout: 60000 });

  async function clickVisibleStep(label) {
    const clicked = await page.evaluate((aria) => {
      const buttons = [...document.querySelectorAll(`button.cpq-stepper-btn[aria-label="${aria}"]`)];
      const visible = buttons.find((b) => {
        const r = b.getBoundingClientRect();
        const style = window.getComputedStyle(b);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      });
      if (!visible) return false;
      visible.click();
      return true;
    }, label);
    if (!clicked) {
      // Fallback: force first match
      await page.locator(`button.cpq-stepper-btn[aria-label="${label}"]`).first().click({ force: true });
    }
    await page.waitForTimeout(350);
  }

  // Walk supported journey: Details → Planning → Pricing (visible stepper only)
  await clickVisibleStep("פרטי ההצעה");
  await clickVisibleStep("תכנון וציוד");
  await page.waitForFunction(() => {
    return !!document.querySelector('.cpq-stage-panel.is-active [data-testid="stage2-solution-workspace"], .cpq-stage-panel.is-active [data-testid="commercial-line-row"]');
  }, { timeout: 45000 });
  await clickVisibleStep("הצעה ומחיר");
  await page.waitForFunction(() => {
    return !!document.querySelector('.cpq-stage-panel.is-active [data-testid="stage3-financial-summary"]');
  }, { timeout: 45000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}

async function inspectPricing(page, label) {
  const text = await page.locator("body").innerText();
  const dir = await page.evaluate(() => document.documentElement.getAttribute("dir") || "");
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 2,
    };
  });

  const optionalToggle = await page.locator('[data-testid="optional-line-toggle"]').count();
  const optionalBadge = await page.locator('[data-testid="optional-line-badge"]').count();
  const summary = await page.locator('[data-testid="stage3-financial-summary"]').count();
  const lineDiscount = await page.locator('input[id^="item-discount-"]').count();
  const quoteDiscount = await page.locator("#discount_percent, #discount_amount").count();
  const sectionDiscount = await page.locator(".cpq-section-discount, [id^='section-discount-']").count();
  const overrideBadge = /שינוי מחיר/i.test(text);
  const totalWithOptions = /סה.?כ כולל אופצי|כולל אופצי/i.test(text);

  const result = {
    rtl: dir === "rtl",
    overflow: overflow.overflow,
    overflow_detail: overflow,
    optional_toggle: optionalToggle > 0,
    optional_badge: optionalBadge > 0,
    line_discount_inputs: lineDiscount,
    section_discount: sectionDiscount > 0 || /הנחת סעיף/i.test(text),
    quote_discount: quoteDiscount > 0,
    override_signal: overrideBadge,
    summary: summary > 0,
    subtotal: /לפני מע.?מ|סכום ביניים|סה.?כ שורות|סיכום כספי|סכום שורות/i.test(text),
    vat: /מע.?מ/i.test(text),
    optional_amount: /אופציונל/i.test(text),
    total_with_options: totalWithOptions,
    // Main pricing rail shows margin %; cost + GP are on Profitability tab (opened separately).
    margin_percent_rail: /מרווח/i.test(text),
    cost: /עלות/i.test(text),
    margin: /מרווח/i.test(text),
    gp: /רווח גולמי|רווח/i.test(text),
    text_sample: text.replace(/\s+/g, " ").slice(0, 500),
  };

  report.viewports[label] = result;
  if (!result.rtl) fail(`${label}: expected RTL`);
  if (result.overflow) fail(`${label}: horizontal overflow`);
  if (!result.summary) fail(`${label}: missing stage3 financial summary`);
  if (!result.optional_toggle && !result.optional_badge) fail(`${label}: optional control/badge missing`);
  if (result.line_discount_inputs < 1) fail(`${label}: line discount inputs missing`);
  if (!result.quote_discount) fail(`${label}: quote discount controls missing`);
  if (!result.margin_percent_rail) fail(`${label}: authorized margin % missing on pricing rail`);
  if (!result.override_signal) fail(`${label}: price override badge missing`);
  return result;
}

async function openProfitability(page) {
  // More menu → רווחיות (authorized cost/GP panel)
  const moreBtn = page.locator('button[aria-label="פעולות נוספות"]').first();
  await moreBtn.click({ force: true });
  await page.waitForTimeout(400);
  const profit = page.getByRole("menuitem", { name: /רווחיות/i }).first();
  await profit.waitFor({ state: "visible", timeout: 10000 });
  await profit.click();
  await page.waitForTimeout(500);
  await page.waitForFunction(() => {
    const t = document.body?.innerText || "";
    return t.includes("עלות") && t.includes("רווח גולמי");
  }, { timeout: 20000 });
}

const matrix = [
  ["1440-dark", 1440, 900, "dark"],
  ["1440-light", 1440, 900, "light"],
  ["1032-dark", 1032, 800, "dark"],
  ["1024-dark", 1024, 800, "dark"],
  ["768-dark", 768, 900, "dark"],
  ["390-dark", 390, 844, "dark"],
  ["390-light", 390, 844, "light"],
  ["360-dark", 360, 740, "dark"],
];

try {
  for (const [name, w, h, theme] of matrix) {
    const { ctx, page } = await openReady(theme, w, h);
    await inspectPricing(page, name);
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    report.shots.push(name);

    if (w <= 768) {
      await page.evaluate(() => {
        const main = document.querySelector(".ops-main, main");
        if (main) main.scrollTop = main.scrollHeight;
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${name}-bottom.png`), fullPage: false });
      report.shots.push(`${name}-bottom`);
    }
    await ctx.close();
  }

  // Authorized cost / GP / margin detail — Profitability workspace tab
  {
    const { ctx, page } = await openReady("dark", 1440, 900);
    await openProfitability(page);
    const profitText = await page.locator("body").innerText();
    report.checks.profitability_tab = {
      cost: /עלות/i.test(profitText),
      gp: /רווח גולמי/i.test(profitText),
      margin: /מרווח/i.test(profitText),
      internal_badge: /פנימי|internal/i.test(profitText),
    };
    if (!report.checks.profitability_tab.cost) fail("profitability tab missing cost");
    if (!report.checks.profitability_tab.gp) fail("profitability tab missing GP");
    if (!report.checks.profitability_tab.margin) fail("profitability tab missing margin");
    await page.screenshot({ path: path.join(OUT, "1440-dark-profitability.png"), fullPage: true });
    report.shots.push("1440-dark-profitability");
    await ctx.close();
  }

  // Preview parity (owner authorized — preview must NOT show cost)
  const { ctx, page } = await openReady("dark", 1440, 900);
  const previewBtn = page.getByRole("button", { name: /תצוגת לקוח|תצוגה מקדימה|preview/i }).first();
  if ((await previewBtn.count()) > 0) {
    await previewBtn.click();
    await page.waitForTimeout(1200);
    const previewText = await page.locator("body").innerText();
    const previewHasCost = /עלות פנימית|cost_total|מרווח גולמי|רווחיות|רווח גולמי/i.test(previewText);
    report.checks.preview = {
      opened: true,
      hides_cost_margin: !previewHasCost,
      shows_optional_semantics: /אופציונל/i.test(previewText),
      shows_totals: /סה.?כ|מע.?מ/i.test(previewText),
    };
    if (previewHasCost) fail("preview exposes cost/margin");
    await page.screenshot({ path: path.join(OUT, "1440-dark-preview.png"), fullPage: true });
    report.shots.push("1440-dark-preview");
  } else {
    await page.goto(`${WEB}/app/quotes/${quoteId}/preview`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1000);
    const previewText = await page.locator("body").innerText();
    report.checks.preview = {
      opened: true,
      via: "route",
      hides_cost_margin: !/עלות פנימית|cost_total|מרווח גולמי|רווח גולמי/i.test(previewText),
      shows_totals: /סה.?כ|מע.?מ/i.test(previewText),
      shows_optional_semantics: /אופציונל/i.test(previewText),
    };
    await page.screenshot({ path: path.join(OUT, "1440-dark-preview.png"), fullPage: true });
    report.shots.push("1440-dark-preview");
  }
  await ctx.close();

  const primary = report.viewports["1440-dark"] || {};
  report.checks.optional = {
    toggle: primary.optional_toggle,
    badge: primary.optional_badge,
  };
  report.checks.discounts = {
    line: (primary.line_discount_inputs || 0) > 0,
    section: primary.section_discount,
    quote: primary.quote_discount,
  };
  report.checks.override = primary.override_signal;
  report.checks.cost_margin_authorized = {
    margin_percent_on_pricing_rail: primary.margin_percent_rail,
    cost_on_profit_tab: report.checks.profitability_tab?.cost || false,
    gp_on_profit_tab: report.checks.profitability_tab?.gp || false,
  };
  report.checks.summary = {
    present: primary.summary,
    vat: primary.vat,
    optional_amount: primary.optional_amount,
    total_with_options: primary.total_with_options,
  };
  report.checks.rtl = Object.values(report.viewports).every((v) => v.rtl);
  report.checks.overflow_any = Object.values(report.viewports).some((v) => v.overflow);
} catch (err) {
  fail(String(err?.stack || err));
  try {
    const page = (await browser.contexts())[0]?.pages()?.[0];
    if (page) await page.screenshot({ path: path.join(OUT, "error-state.png"), fullPage: true });
  } catch {}
} finally {
  // Keep fixture for manual revisit unless CLEANUP=1
  if (process.env.CLEANUP === "1") {
    await api("DELETE", `/api/v1/workspaces/${WS}/quotes/${quoteId}`);
    report.fixture.deleted = true;
  } else {
    report.fixture.deleted = false;
    report.fixture.url = `${WEB}/app/quotes/${quoteId}`;
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
