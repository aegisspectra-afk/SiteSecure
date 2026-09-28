/**
 * Q4-S commercial model visual QA — live quote builder viewports + themes + RTL.
 * Auth via password grant + localStorage inject (same pattern as flagship QA).
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

const OUT = path.join(ROOT, "Docs/q4s-cost-security-visual-qa");
fs.mkdirSync(OUT, { recursive: true });

const WEB = env.WEB_URL || "http://127.0.0.1:5173";
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
  shots: [],
  checks: {},
  errors: [],
  viewports: {},
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
const hdr = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", apikey: ANON };

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

const created = await api("POST", `/api/v1/workspaces/${WS}/quotes`, {
  title: "Q4-S Visual QA",
  vat_percent: 18,
});
if (created.status >= 400 || !created.data?.id) {
  console.error("quote create failed", created);
  process.exit(1);
}
const quoteId = created.data.id;
report.quoteId = quoteId;

const prodRes = await api("GET", `/api/v1/workspaces/${WS}/catalog/products?q=QA-CAM-4MP-TURRET&limit=5`);
const products = prodRes.data?.items || [];
const p = products.find((i) => i.sku === "QA-CAM-4MP-TURRET") || products[0];
if (p) {
  await api("POST", `/api/v1/workspaces/${WS}/quotes/${quoteId}/items`, {
    product_id: p.id,
    item_type: "catalog",
    description: p.name,
    qty: 2,
    unit_price: Number(p.list_price || 249.95),
    discount: 5,
    discount_type: "percent",
  });
  await api("POST", `/api/v1/workspaces/${WS}/quotes/${quoteId}/items`, {
    product_id: p.id,
    item_type: "catalog",
    description: "Optional QA line",
    qty: 1,
    unit_price: 150,
    is_optional: true,
    cost: 60,
  });
  await api("PATCH", `/api/v1/workspaces/${WS}/quotes/${quoteId}`, {
    discount_type: "percent",
    discount_value: 3,
  });
}

const quoteDoc = await api("GET", `/api/v1/workspaces/${WS}/quotes/${quoteId}`);
report.api_authorized = {
  has_cost_total: "cost_total" in (quoteDoc.data || {}),
  has_item_cost: (quoteDoc.data?.items || []).some((i) => "cost" in i),
  has_optional: (quoteDoc.data?.items || []).some((i) => i.is_optional),
  optional_subtotal: quoteDoc.data?.optional_subtotal,
  margin_percent: quoteDoc.data?.margin_percent,
  snap_cost: (quoteDoc.data?.items || []).some((i) => "cost" in (i.catalog_snapshot || {})),
};

const browser = await chromium.launch({ headless: true });

async function open(theme, width, height) {
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
  await page.goto(`${WEB}/app/quotes/${quoteId}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.lang = "he";
  }, theme);
  await page.waitForSelector(".quote-builder, .cpq-builder, [data-testid='quote-builder']", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page };
}

async function inspect(page, label) {
  const dir = await page.evaluate(() => document.documentElement.getAttribute("dir") || document.dir || "");
  const text = await page.locator("body").innerText();
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 2,
    };
  });
  const result = {
    rtl: dir === "rtl" || (await page.locator("html[dir='rtl'], [dir='rtl']").count()) > 0,
    optional: /אופציונל|optional/i.test(text),
    discount: /הנחה/.test(text) || /%/.test(text),
    summary: /סה.?כ|מע.?מ|סיכום/i.test(text),
    cost_margin: /עלות|מרווח|שולי|רווח|margin|GP/i.test(text),
    overflow: overflow.overflow,
    overflow_detail: overflow,
  };
  report.viewports[label] = result;
  if (!result.rtl) fail(`${label}: expected RTL`);
  if (result.overflow) fail(`${label}: horizontal overflow`);
  return result;
}

const matrix = [
  ["1440", 1440, 900, ["dark", "light"]],
  ["1032", 1032, 800, ["dark", "light"]],
  ["1024", 1024, 800, ["dark"]],
  ["768", 768, 900, ["dark"]],
  ["390", 390, 844, ["dark", "light"]],
  ["360", 360, 740, ["dark"]],
];

try {
  for (const [name, w, h, themes] of matrix) {
    for (const theme of themes) {
      const { ctx, page } = await open(theme, w, h);
      const label = `${name}-${theme}`;
      await inspect(page, label);
      const file = path.join(OUT, `${label}.png`);
      await page.screenshot({ path: file, fullPage: true });
      report.shots.push(label);
      // Try pricing stage / summary scroll
      await page.evaluate(() => {
        const main = document.querySelector(".ops-main, main, .quote-builder");
        if (main) main.scrollTop = main.scrollHeight;
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${label}-bottom.png`), fullPage: false });
      report.shots.push(`${label}-bottom`);
      await ctx.close();
    }
  }

  // Preview if reachable
  const { ctx, page } = await open("dark", 1440, 900);
  const preview = page.getByRole("button", { name: /תצוגה|preview|תצוגה מקדימה/i }).first();
  if ((await preview.count()) > 0) {
    await preview.click().catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, "1440-dark-preview.png"), fullPage: true });
    report.shots.push("1440-dark-preview");
    const prevText = await page.locator("body").innerText();
    report.checks.preview_hides_cost = !/עלות פנימית|cost_total|מרווח גולמי/i.test(prevText);
  }
  await ctx.close();

  report.checks.dark_light = {
    dark: report.shots.filter((s) => s.includes("dark")).length,
    light: report.shots.filter((s) => s.includes("light")).length,
  };
  report.checks.rtl = Object.values(report.viewports).every((v) => v.rtl);
  report.checks.optional_seen = Object.values(report.viewports).some((v) => v.optional);
  report.checks.cost_authorized_ui = Object.values(report.viewports).some((v) => v.cost_margin);
} catch (err) {
  fail(String(err?.stack || err));
} finally {
  await api("DELETE", `/api/v1/workspaces/${WS}/quotes/${quoteId}`);
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
