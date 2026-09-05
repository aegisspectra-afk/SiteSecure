/**
 * Task 14 — mobile browser QA for Build System at 375 / 390 / 430.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "_task14_qa");
const TOKEN = fs.readFileSync(path.join(REPO, "apps/api/scripts/.tmp_import_token"), "utf8").trim();
const API = process.env.API_URL || "http://127.0.0.1:8000";
const WEB = process.env.WEB_URL || "http://localhost:5173";

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const env = fs.readFileSync(path.join(REPO, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

const session = await api("GET", `${API}/api/v1/auth/session`);
const ws = session.json.memberships?.[0]?.workspace_id;
const stamp = Date.now();
const cats = await api("GET", `${API}/api/v1/workspaces/${ws}/catalog/categories`);
const byKey = Object.fromEntries((cats.json.items || []).map((c) => [c.key, c]));
const created = [];

async function createProduct(sample) {
  const res = await api("POST", `${API}/api/v1/workspaces/${ws}/catalog/products`, sample);
  if (res.status >= 300) throw new Error(JSON.stringify(res.json));
  created.push(res.json.id);
  return res.json;
}

await createProduct({
  name: `QA14M Cam ${stamp}`,
  sku: `QA14M-CAM-${stamp}`,
  kind: "product",
  list_price: 100,
  category_id: byKey.cameras_ip.id,
  attributes: { resolution_mp: 4, environment: "outdoor", poe: true, max_power_w: 8 },
});
await createProduct({
  name: `QA14M NVR ${stamp}`,
  sku: `QA14M-NVR-${stamp}`,
  kind: "product",
  list_price: 800,
  category_id: byKey.nvr.id,
  attributes: { channels: 16, poe_ports: 16, poe_budget_w: 200, drive_bays: 4, max_hdd_tb: 12 },
});
await createProduct({
  name: `QA14M HDD ${stamp}`,
  sku: `QA14M-HDD-${stamp}`,
  kind: "product",
  list_price: 70,
  category_id: byKey.hdd_recorders.id,
  attributes: { capacity_tb: 10, surveillance_grade: true },
});

const quote = await api("POST", `${API}/api/v1/workspaces/${ws}/quotes`, {
  title: `QA14 Mobile ${stamp}`,
});
const quoteId = quote.json.id;

fs.mkdirSync(OUT, { recursive: true });
const viewports = [
  { w: 375, h: 812 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
];

const browser = await chromium.launch({ headless: true });
const report = { quoteId, web: WEB, viewports: {}, ok: true };

for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    locale: "he-IL",
  });
  await ctx.addInitScript(
    ({ key, value }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      value: JSON.stringify({
        access_token: TOKEN,
        refresh_token: "qa",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user,
      }),
    },
  );

  const page = await ctx.newPage();
  const entry = {
    width: vp.w,
    horizontalScroll: false,
    requirementsVisible: false,
    reviewVisible: false,
    footerClear: false,
    errors: [],
  };
  page.on("pageerror", (err) => entry.errors.push(String(err)));

  try {
    await page.goto(`${WEB}/app/quotes/${quoteId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("#quote-items, [data-testid='quote-builder'], text=עדיין אין פריטים", {
      timeout: 45000,
    }).catch(() => {});
    await page.waitForTimeout(1000);

    // Prefer empty-state CTA, then toolbar/menu
    const emptyBuild = page.getByRole("button", { name: "בנה מערכת" });
    if (await emptyBuild.count()) {
      await emptyBuild.first().click();
    } else {
      const plus = page.getByRole("button", { name: /הוספה|הוסף/ });
      if (await plus.count()) await plus.first().click();
      await page.waitForTimeout(300);
      await page.getByText("בנה מערכת", { exact: true }).first().click({ timeout: 10000 });
    }

    await page.waitForSelector("#cpq-camera-count, #cpq-system-type", { timeout: 15000 });
    entry.requirementsVisible = (await page.locator("#cpq-camera-count").count()) > 0;

    await page.getByRole("button", { name: "חשב מערכת" }).click();
    try {
      await page.waitForFunction(
        () => {
          const t = document.body?.innerText || "";
          return t.includes("NVR נדרש") || t.includes("הקלטה ואחסון") || t.includes("לא ניתן להשלים") || t.includes("מוכנות קטלוג");
        },
        { timeout: 90000 },
      );
    } catch (err) {
      entry.errors.push(`review-timeout:${String(err).slice(0, 120)}`);
    }
    await page.waitForTimeout(500);

    entry.reviewVisible =
      (await page.getByText(/מערכת CCTV ·|NVR נדרש|הקלטה ואחסון|לא ניתן להשלים|מוכנות קטלוג/).count()) > 0;

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    entry.horizontalScroll = scrollWidth > clientWidth + 2;

    const addCta = page.getByRole("button", { name: /הוסף להצעה|המשך הוספה/ });
    if (await addCta.count()) {
      const box = await addCta.first().boundingBox();
      entry.footerClear = Boolean(box && box.y >= 0 && box.y + box.height <= vp.h + 8);
    }

    await page.screenshot({ path: path.join(OUT, `build-${vp.w}.png`), fullPage: true });

    if (!entry.requirementsVisible || !entry.reviewVisible || entry.horizontalScroll || entry.errors.length) {
      report.ok = false;
    }
  } catch (err) {
    entry.errors.push(String(err));
    report.ok = false;
    await page.screenshot({ path: path.join(OUT, `build-${vp.w}-error.png`), fullPage: true }).catch(() => {});
  }

  report.viewports[String(vp.w)] = entry;
  await ctx.close();
}

await browser.close();

for (const id of created) {
  await api("PATCH", `${API}/api/v1/workspaces/${ws}/catalog/products/${id}`, { is_active: false });
}
await api("DELETE", `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}`);

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);
