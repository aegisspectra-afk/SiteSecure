/**
 * Visual QA — Customers operational index (Checkpoint A)
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/core-app-ux-qa/customers");
const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("playwright");

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

const env = { ...loadEnv(path.join(ROOT, ".env")), ...loadEnv(path.join(ROOT, "apps/web/.env")) };
const WEB = process.env.WEB_URL || "http://127.0.0.1:5173";
const SUPABASE_URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const OWNER = "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = "Phase1b-1790012816-Qa!";
const WS = "50339413-11c7-4903-820c-7541fbd2a476";
const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];

fs.mkdirSync(OUT, { recursive: true });

const tok = await (
  await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: OWNER, password: PASSWORD }),
  })
).json();

if (!tok.access_token) {
  console.error("auth_failed", Object.keys(tok));
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const report = { shots: [], checks: {}, started: new Date().toISOString() };

async function withPage({ width, height, colorScheme }, fn) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme });
  await ctx.addInitScript(
    ({ key, value, ws, theme }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", theme);
      localStorage.setItem("ss.last-workspace-id", ws);
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      ws: WS,
      theme: colorScheme === "light" ? "light" : "dark",
      value: JSON.stringify({
        access_token: tok.access_token,
        refresh_token: tok.refresh_token || "qa",
        expires_at: Math.floor(Date.now() / 1000) + 7200,
        expires_in: 7200,
        token_type: "bearer",
        user: tok.user,
      }),
    },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    return await fn(page, errors);
  } finally {
    await ctx.close();
  }
}

async function waitCustomers(page) {
  await page.goto(`${WEB}/app/customers`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('[data-testid="customers-page"]', { timeout: 60000 });
  await page
    .waitForFunction(() => {
      const root = document.querySelector('[data-testid="customers-page"]');
      if (!root) return false;
      return (
        Boolean(document.querySelector('[data-testid="customers-mobile-list"]')) ||
        Boolean(document.querySelector('[data-testid="customers-desktop-table"]')) ||
        Boolean(document.querySelector('[data-testid="customers-empty"]')) ||
        Boolean(document.querySelector('[data-testid="customers-filtered-empty"]')) ||
        Boolean(document.querySelector('[data-testid="customers-loading"]')) === false
      );
    }, { timeout: 60000 })
    .catch(() => {});
  await page.waitForTimeout(400);
}

async function shot(name, { width, height, colorScheme, beforeShot }) {
  await withPage({ width, height, colorScheme }, async (page, errors) => {
    await waitCustomers(page);
    if (beforeShot) await beforeShot(page);
    await page.waitForTimeout(350);
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(OUT, file), fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    const text = await page.locator('[data-testid="customers-page"]').innerText().catch(() => "");
    const desktopVisible = await page.locator('[data-testid="customers-desktop-table"]').evaluate((el) => {
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden";
    }).catch(() => false);
    const mobileVisible = await page.locator('[data-testid="customers-mobile-list"]').evaluate((el) => {
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden";
    }).catch(() => false);
    report.shots.push({
      name,
      file,
      width,
      colorScheme,
      overflow,
      errors,
      hasTitle: text.includes("לקוחות"),
      hasOpen: text.includes("פתיחת לקוח"),
      hasCreate: text.includes("לקוח חדש") || text.includes("הוספת לקוח"),
      hasSearch: Boolean(await page.$('[data-testid="customers-search"]')),
      desktopVisible,
      mobileVisible,
      hasLtrPhone: Boolean(await page.$('.ltr-meta[dir="ltr"]')),
      empty: text.includes("אין עדיין לקוחות"),
      filteredEmpty: text.includes("לא נמצאו לקוחות שמתאימים לחיפוש"),
      error: text.includes("לא הצלחנו לטעון את הלקוחות"),
    });
  });
}

await shot("1440-dark-populated", { width: 1440, height: 900, colorScheme: "dark" });
await shot("1440-light-populated", { width: 1440, height: 900, colorScheme: "light" });
await shot("390-dark-populated", { width: 390, height: 844, colorScheme: "dark" });
await shot("360-dark-populated", { width: 360, height: 740, colorScheme: "dark" });
await shot("390-light-populated", { width: 390, height: 844, colorScheme: "light" });

await shot("1440-dark-search-filtered", {
  width: 1440,
  height: 900,
  colorScheme: "dark",
  beforeShot: async (page) => {
    await page.fill('[data-testid="customers-search"]', "zzz-no-match-qa-customers");
    await page.waitForTimeout(500);
    await page.waitForSelector('[data-testid="customers-filtered-empty"]', { timeout: 15000 }).catch(() => {});
  },
});

await withPage({ width: 1440, height: 900, colorScheme: "dark" }, async (page, errors) => {
  await waitCustomers(page);
  const create = page.locator('[data-testid="customers-create-toggle"]');
  report.checks.createVisible = await create.count().then((n) => n > 0);
  if (report.checks.createVisible) {
    await create.click();
    report.checks.createForm = await page.locator('[data-testid="customers-create-form"]').count().then((n) => n > 0);
    await page.screenshot({ path: path.join(OUT, "1440-dark-create-form.png"), fullPage: false });
  }
  const open = page.locator('[data-testid="customers-desktop-table"] [data-testid="customer-open"]').first();
  report.checks.openAvailable = (await open.count()) > 0;
  if (report.checks.openAvailable) {
    await open.click({ force: false });
    await page.waitForURL(/\/app\/customers\/[^/]+/, { timeout: 20000 }).catch(() => {});
    report.checks.openedDetail = /\/app\/customers\/[^/]+/.test(page.url());
    await page.screenshot({ path: path.join(OUT, "1440-dark-customer-open.png"), fullPage: false });
  }
  // focus ring on search
  await page.goto(`${WEB}/app/customers`, { waitUntil: "domcontentloaded" });
  await waitCustomers(page);
  await page.focus('[data-testid="customers-search"]');
  const focusOk = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="customers-search"]');
    return document.activeElement === el;
  });
  report.checks.searchFocus = focusOk;
  report.checks.pageErrors = errors;
});

report.finished = new Date().toISOString();
report.pass = {
  desktop1440: report.shots.filter((s) => s.width === 1440 && !s.name.includes("search")).every((s) => s.hasTitle && !s.overflow && s.desktopVisible),
  mobile390: report.shots.filter((s) => s.width === 390).every((s) => s.hasTitle && !s.overflow && s.mobileVisible),
  mobile360: report.shots.filter((s) => s.width === 360).every((s) => s.hasTitle && !s.overflow && s.mobileVisible),
  filteredEmpty: report.shots.some((s) => s.filteredEmpty),
  open: Boolean(report.checks.openedDetail),
  create: Boolean(report.checks.createVisible),
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.pass, null, 2));
await browser.close();
process.exit(Object.values(report.pass).every(Boolean) ? 0 : 1);
