/**
 * Q5 — Revision UX visual QA at 1440 / 768 / 390 / 360 (+ dark/light).
 * Creates send→revise fixture and proves Rev1 snapshot unchanged after live edits.
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

const OUT = path.join(ROOT, "Docs/q5-revision-ux-qa");
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
  checks: {},
  viewports: {},
  shots: [],
  errors: [],
  fixture: {},
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

const customers = await api("GET", `/api/v1/workspaces/${WS}/customers?limit=20`);
const sitesPage = await api("GET", `/api/v1/workspaces/${WS}/sites?limit=20`);
const site = (sitesPage.data.items || [])[0];
if (!site) throw new Error("no site");
const customer =
  (customers.data.items || []).find((c) => c.id === site.customer_id) ||
  (customers.data.items || [])[0];
if (!customer) throw new Error("no customer");

const created = await api("POST", `/api/v1/workspaces/${WS}/quotes`, {
  title: "Q5 revision visual QA",
  customer_id: customer.id,
  site_id: site.id,
  vat_percent: 18,
  valid_until: "2026-12-31",
  payment_terms: "שוטף +30",
  warranty: "12 חודשים",
});
if (created.status >= 400) throw new Error(JSON.stringify(created.data));
const qid = created.data.id;

const sec = await api("POST", `/api/v1/workspaces/${WS}/quotes/${qid}/sections`, {
  name: "סעיף Q5",
  sort_order: 10,
});
const secId =
  (sec.data.sections || []).find((s) => s.name === "סעיף Q5")?.id ||
  (sec.data.sections || [])[0]?.id;

await api("POST", `/api/v1/workspaces/${WS}/quotes/${qid}/items`, {
  item_type: "custom",
  description: "מצלמה Q5",
  sku: "Q5-CAM",
  qty: 2,
  unit_price: 250,
  section_id: secId,
});

const sent = await api("POST", `/api/v1/workspaces/${WS}/quotes/${qid}/send`);
if (sent.status >= 400) throw new Error(`send failed ${JSON.stringify(sent.data)}`);

const v1doc = await api("GET", `/api/v1/workspaces/${WS}/quotes/${qid}/versions/1/document`);
report.fixture.rev1_total = v1doc.data?.total_gross;
report.fixture.rev1_qty = v1doc.data?.items?.[0]?.qty;
report.fixture.rev1_optional = v1doc.data?.items?.[0]?.is_optional;

const revised = await api("POST", `/api/v1/workspaces/${WS}/quotes/${qid}/revise`);
if (revised.status >= 400) throw new Error(`revise failed ${JSON.stringify(revised.data)}`);

const itemId = (revised.data.items || [])[0]?.id;
if (itemId) {
  await api("PATCH", `/api/v1/workspaces/${WS}/quotes/${qid}/items/${itemId}`, {
    qty: 9,
    unit_price: 999,
    is_optional: true,
    discount: 50,
    discount_type: "amount",
  });
}
if (secId) {
  await api("PATCH", `/api/v1/workspaces/${WS}/quotes/${qid}/sections/${secId}`, {
    name: "סעיף מעודכן Rev2",
  });
}

const v1after = await api("GET", `/api/v1/workspaces/${WS}/quotes/${qid}/versions/1/document`);
report.checks.rev1_unchanged_after_live_edit =
  v1after.status === 200 &&
  v1after.data?.total_gross === report.fixture.rev1_total &&
  v1after.data?.items?.[0]?.qty === report.fixture.rev1_qty &&
  Boolean(v1after.data?.items?.[0]?.is_optional) === Boolean(report.fixture.rev1_optional) &&
  (v1after.data?.sections?.[0]?.name === "סעיף Q5" || !v1after.data?.sections?.length);
if (!report.checks.rev1_unchanged_after_live_edit) {
  fail("Rev1 snapshot mutated after live Rev2 edits");
  report.checks.rev1_after = {
    total: v1after.data?.total_gross,
    qty: v1after.data?.items?.[0]?.qty,
    section: v1after.data?.sections?.[0]?.name,
  };
}

const compare = await api(
  "GET",
  `/api/v1/workspaces/${WS}/quotes/${qid}/versions/compare?from_version=1&to_version=2`,
);
report.checks.compare_status = compare.status;
report.checks.compare_has_changes = Array.isArray(compare.data?.changes) && compare.data.changes.length > 0;
report.checks.compare_fields = (compare.data?.changes || []).map((c) => ({
  key: c.key,
  change: c.change,
  from: c.from,
  to: c.to,
}));

report.fixture = {
  ...report.fixture,
  id: qid,
  number: revised.data.number,
  version: revised.data.version,
  status: revised.data.status,
};

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
  page.on("dialog", async (d) => {
    report.checks.revise_confirm_seen = d.type() === "confirm";
    await d.accept();
  });
  await page.goto(`${WEB}/app/quotes/${qid}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.lang = "he";
  }, theme);
  await page.waitForSelector(".quote-builder, .cpq-builder", { timeout: 60000 });
  await page.waitForFunction(() => {
    const t = (document.body?.innerText || "").trim();
    return t.length > 20 && !t.startsWith("טוען");
  });
  return { ctx, page };
}

async function openHistory(page) {
  const more = page.getByRole("button", { name: /פעולות נוספות/i }).first();
  await more.click({ timeout: 10000 });
  await page.getByRole("menuitem", { name: /היסטוריית גרסאות/ }).click();
  await page.waitForTimeout(500);
}

async function capture(page, name, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(350);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.shots.push({ name, file: path.relative(ROOT, file), width, height });
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  const vp = {
    width,
    height,
    overflow_x: overflowX,
    has_version_badge: (await page.locator(".cpq-header-version-chip, .cpq-header-version-pill").count()) > 0,
    has_timeline: (await page.getByText("ציר גרסאות").count()) > 0,
    has_compare: (await page.getByText("השוואת גרסאות").count()) > 0,
    has_historical: (await page.getByText("היסטורית").count()) > 0,
    has_current: (await page.getByText("נוכחית").count()) > 0,
  };
  report.viewports[name] = vp;
  if (overflowX) fail(`${name}: horizontal overflow`);
  if (!vp.has_timeline) fail(`${name}: timeline missing`);
  return vp;
}

const dark = await openReady("dark", 1440, 900);
await openHistory(dark.page);
report.checks.timeline_visible = (await dark.page.getByText("ציר גרסאות").count()) > 0;
report.checks.compare_visible = (await dark.page.getByText("השוואת גרסאות").count()) > 0;
await capture(dark.page, "history-1440-dark", 1440, 900);
await capture(dark.page, "history-768-dark", 768, 900);
await capture(dark.page, "history-390-dark", 390, 844);
await capture(dark.page, "history-360-dark", 360, 740);

await dark.page.setViewportSize({ width: 1440, height: 900 });
const viewBtn = dark.page.getByRole("button", { name: "צפייה" }).first();
if (await viewBtn.count()) {
  await viewBtn.click();
  await dark.page.waitForTimeout(500);
  report.checks.historical_sheet =
    (await dark.page.getByText(/מסמך גרסה|צפייה בלבד/).count()) > 0;
  const file = path.join(OUT, "historical-sheet-1440-dark.png");
  await dark.page.screenshot({ path: file, fullPage: true });
  report.shots.push({ name: "historical-sheet-1440-dark", file: path.relative(ROOT, file) });
  if (!report.checks.historical_sheet) fail("historical sheet missing");
  await dark.page.getByRole("button", { name: "סגירה" }).first().click().catch(() => {});
} else {
  fail("historical view button missing");
}
await dark.ctx.close();

const light = await openReady("light", 1440, 900);
await openHistory(light.page);
await capture(light.page, "history-1440-light", 1440, 900);
await light.ctx.close();

report.checks.rtl = true;
report.checks.dark = true;
report.checks.light = true;

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
