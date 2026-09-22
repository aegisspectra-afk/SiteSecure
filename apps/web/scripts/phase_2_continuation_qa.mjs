/**
 * Phase 2 continuation — visual QA only (no product mutations beyond optional
 * navigation). Fills deferred Dark / desktop shots for operational modules.
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

const OUT = path.join(ROOT, "Docs/phase-2-continuation-qa");
const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON) {
  console.error("Missing SUPABASE_URL / ANON");
  process.exit(1);
}

const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
fs.mkdirSync(OUT, { recursive: true });

const tokenJson = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());
if (!tokenJson.access_token) {
  console.error("Password grant failed", tokenJson);
  process.exit(1);
}

const shots = [
  { name: "customers-390-light", path: "/app/customers", width: 390, height: 844, theme: "light" },
  { name: "customers-390-dark", path: "/app/customers", width: 390, height: 844, theme: "dark" },
  { name: "customers-1440-light", path: "/app/customers", width: 1440, height: 900, theme: "light" },
  { name: "customers-1440-dark", path: "/app/customers", width: 1440, height: 900, theme: "dark" },
  { name: "sites-390-light", path: "/app/sites", width: 390, height: 844, theme: "light" },
  { name: "sites-390-dark", path: "/app/sites", width: 390, height: 844, theme: "dark" },
  { name: "sites-1440-light", path: "/app/sites", width: 1440, height: 900, theme: "light" },
  { name: "sites-1440-dark", path: "/app/sites", width: 1440, height: 900, theme: "dark" },
  { name: "service-390-light", path: "/app/service", width: 390, height: 844, theme: "light" },
  { name: "service-390-dark", path: "/app/service", width: 390, height: 844, theme: "dark" },
  { name: "service-1440-light", path: "/app/service", width: 1440, height: 900, theme: "light" },
  { name: "service-1440-dark", path: "/app/service", width: 1440, height: 900, theme: "dark" },
  { name: "customers-360-light", path: "/app/customers", width: 360, height: 800, theme: "light" },
  { name: "customers-430-light", path: "/app/customers", width: 430, height: 932, theme: "light" },
  { name: "customers-768-light", path: "/app/customers", width: 768, height: 1024, theme: "light" },
  { name: "customers-1280-light", path: "/app/customers", width: 1280, height: 800, theme: "light" },
];

const browser = await chromium.launch({ headless: true });
const report = { email: EMAIL, web: WEB, shots: [], journey: {} };

async function openApp(theme, width, height, route) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme === "dark" ? "dark" : "light",
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
  await page.goto(`${WEB}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    localStorage.setItem("site-secure-theme", t);
  }, theme);
  // Wait until list chrome leaves loading (skeleton / "טוען") or shows empty/error/rows
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText || "";
      if (text.includes("לא ניתן לטעון") || text.includes("חסומה לפי כללי")) return true;
      if (text.includes("אין לקוחות") || text.includes("אין אתרים") || text.includes("אין קריאות")) return true;
      if (document.querySelector(".customer-dir-row, .ss-module-mobile-row, .ss-service-row, .customer-dir-empty, .ss-module-empty-text")) {
        return true;
      }
      if (document.querySelector(".customer-dir-skeleton-row")) return false;
      if (text.includes("טוען") && !document.querySelector("table tbody tr, .customer-dir-row")) return false;
      return Boolean(document.querySelector("h1, .customer-dir-title, .ss-module"));
    },
    { timeout: 45000 },
  ).catch(() => {});
  await page.waitForTimeout(400);
  return { ctx, page };
}

async function capture(shot) {
  const { ctx, page } = await openApp(shot.theme, shot.width, shot.height, shot.path);
  const file = path.join(OUT, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: false });

  const metrics = await page.evaluate(() => {
    const text = document.body?.innerText || "";
    const hasErrorUi =
      text.includes("לא ניתן לטעון") ||
      text.includes("חסומה לפי כללי") ||
      Boolean(document.querySelector("[data-error], .ss-error"));
    const hasMobileList = Boolean(
      document.querySelector(".customer-dir-row, .ss-module-mobile-list, .ss-service-list, .ss-module-mobile-row"),
    );
    const hasDesktopTable = Boolean(
      document.querySelector(".customer-dir-desktop-table, .ss-module-desktop-table, table tbody tr"),
    );
    const hasEmpty = Boolean(
      document.querySelector(".customer-dir-empty, .ss-module-empty-text") ||
        text.includes("אין לקוחות") ||
        text.includes("אין אתרים") ||
        text.includes("אין קריאות"),
    );
    const loading = Boolean(document.querySelector(".customer-dir-skeleton-row")) || /\bטוען\b/.test(text);
    return {
      title: document.title,
      path: location.pathname,
      hasErrorUi,
      hasMobileList,
      hasDesktopTable,
      hasEmpty,
      loading,
      activityRowCount: document.querySelectorAll(".ss-activity-row").length,
      hasOpsCard: Boolean(document.querySelector(".ops-card")),
      bodySnippet: text.slice(0, 220).replace(/\s+/g, " "),
    };
  });

  report.shots.push({ ...shot, file: path.relative(ROOT, file), ok: true, ...metrics });
  console.log("OK", shot.name, {
    err: metrics.hasErrorUi,
    mobile: metrics.hasMobileList,
    table: metrics.hasDesktopTable,
  });
  await ctx.close();
}

for (const shot of shots) await capture(shot);

// Journey: Customers → first customer → first site link if present → Service
{
  const { ctx, page } = await openApp("light", 390, 844, "/app/customers");
  const journey = { steps: [] };
  journey.steps.push({ at: "/app/customers", ok: true });

  const firstCustomer = page.locator('a[href*="/app/customers/"]').first();
  if ((await firstCustomer.count()) > 0) {
    await firstCustomer.click();
    await page.waitForTimeout(800);
    journey.steps.push({ at: page.url(), ok: page.url().includes("/customers/") });
    const fileProfile = path.join(OUT, "journey-390-customer-profile.png");
    await page.screenshot({ path: fileProfile, fullPage: false });
    journey.profileShot = path.relative(ROOT, fileProfile);

    const siteLink = page.locator('a[href*="/app/sites/"]').first();
    if ((await siteLink.count()) > 0) {
      await siteLink.click();
      await page.waitForTimeout(800);
      journey.steps.push({ at: page.url(), ok: page.url().includes("/sites/") });
      const fileSite = path.join(OUT, "journey-390-site-dossier.png");
      await page.screenshot({ path: fileSite, fullPage: false });
      journey.siteShot = path.relative(ROOT, fileSite);
    } else {
      journey.steps.push({ at: "site-link", ok: false, note: "No site link on profile in this workspace" });
    }
  } else {
    journey.steps.push({ at: "customer-link", ok: false, note: "No customer rows" });
  }

  await page.goto(`${WEB}/app/service`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(600);
  const serviceFile = path.join(OUT, "journey-390-service.png");
  await page.screenshot({ path: serviceFile, fullPage: false });
  journey.serviceShot = path.relative(ROOT, serviceFile);
  journey.serviceError = await page.evaluate(
    () =>
      document.body?.innerText?.includes("לא ניתן לטעון") ||
      document.body?.innerText?.includes("חסומה לפי כללי התוכנית") ||
      false,
  );
  journey.steps.push({ at: "/app/service", ok: true, entitlementError: journey.serviceError });

  report.journey = journey;
  console.log("JOURNEY", journey);
  await ctx.close();
}

// Desktop profile + dossier if links exist
{
  const { ctx, page } = await openApp("dark", 1440, 900, "/app/customers");
  const firstCustomer = page.locator(".customer-dir-desktop-table a[href*='/app/customers/'], a.customer-dir-row").first();
  if ((await firstCustomer.count()) > 0) {
    await firstCustomer.click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, "customer-profile-1440-dark.png"), fullPage: false });
  }
  await page.goto(`${WEB}/app/sites`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  const firstSite = page.locator(".ss-module-desktop-table a[href*='/app/sites/'], .ss-module-mobile-row, a[href*='/app/sites/']").first();
  if ((await firstSite.count()) > 0) {
    await firstSite.click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, "site-dossier-1440-dark.png"), fullPage: false });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${WEB}/app/sites`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  const mobileSite = page.locator("a.ss-module-mobile-row, a[href*='/app/sites/']").first();
  if ((await mobileSite.count()) > 0) {
    await mobileSite.click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, "site-dossier-390-light.png"), fullPage: false });
  }
  await ctx.close();
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("Wrote", path.join(OUT, "report.json"));
await browser.close();
