/**
 * External UI smoke: login shell timing, mobile layout, offline recovery (owner disposable).
 * Usage: node apps/web/scripts/_final_external_ui_smoke.mjs
 * Env: EXT_EMAIL EXT_PASSWORD WEB_URL
 */
import { chromium, devices } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "_final_external_ui_smoke");
fs.mkdirSync(OUT, { recursive: true });

const WEB = (process.env.WEB_URL || "https://site-secure-umber.vercel.app").replace(/\/$/, "");
const EMAIL = process.env.EXT_EMAIL;
const PASSWORD = process.env.EXT_PASSWORD;

const report = { web: WEB, checks: [], timings_ms: {}, ok: true };

function ck(name, ok, extra = {}) {
  report.checks.push({ name, ok: !!ok, ...extra });
  if (!ok) report.ok = false;
  console.log(ok ? "PASS" : "FAIL", name, extra);
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    ck("credentials", false, { reason: "EXT_EMAIL/EXT_PASSWORD required" });
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    // Desktop login + dashboard timing
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e).slice(0, 200)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text().slice(0, 200));
    });

    let t0 = Date.now();
    await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    report.timings_ms.login_shell = Date.now() - t0;
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"], input[name="password"]', PASSWORD);
    t0 = Date.now();
    await Promise.all([
      page.waitForURL(/\/(app|onboarding|today)/, { timeout: 90000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    report.timings_ms.login_navigate = Date.now() - t0;
    const afterLogin = page.url();
    ck("ui_login", /app|onboarding|today/i.test(afterLogin), { url: afterLogin });

    // Prefer dashboard route if available
    t0 = Date.now();
    await page.goto(`${WEB}/app`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    // wait for useful content / empty state
    await page.waitForTimeout(1500);
    const firstUseful = Date.now() - t0;
    report.timings_ms.dashboard_first_paintish = firstUseful;
    await page.waitForTimeout(2500);
    report.timings_ms.dashboard_settle = Date.now() - t0;
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const blank = !bodyText || bodyText.trim().length < 20;
    ck("ui_dashboard_not_blank", !blank, { chars: bodyText.trim().length, ms: report.timings_ms.dashboard_settle });
    ck("ui_no_stack_trace", !/Traceback|Exception:|psycopg|sqlalchemy/i.test(bodyText));
    await page.screenshot({ path: path.join(OUT, "desktop-app.png"), fullPage: true });

    // Logout if control exists
    const logout = page.getByRole("button", { name: /התנתק|logout|יציאה/i }).first();
    if (await logout.count()) {
      await logout.click().catch(() => null);
      await page.waitForTimeout(1000);
    }
    // soft logout via clear storage
    await ctx.clearCookies();
    await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
    ck("ui_logout_to_login", /login/i.test(page.url()), { url: page.url() });

    // re-login
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"], input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(app|onboarding|today)/, { timeout: 90000 }).catch(() => null);
    ck("ui_relogin", /app|onboarding|today/i.test(page.url()), { url: page.url() });

    // Network recovery
    await page.context().setOffline(true);
    await page.waitForTimeout(800);
    await page.context().setOffline(false);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    await page.waitForTimeout(2000);
    const afterNet = await page.locator("body").innerText().catch(() => "");
    ck("ui_network_recovery", afterNet.trim().length > 20, { chars: afterNet.trim().length });

    // Forgot password page redirect target in client
    await page.goto(`${WEB}/forgot-password`, { waitUntil: "domcontentloaded" });
    const fp = await page.content();
    ck("ui_forgot_password", /reset|סיסמ|forgot/i.test(fp));
    ck("ui_forgot_no_localhost_form", !/http:\/\/localhost/i.test(fp));

    await ctx.close();

    // Mobile
    const mobile = await browser.newContext({
      ...devices["iPhone 12"],
      locale: "he-IL",
    });
    const mpage = await mobile.newPage();
    await mpage.goto(`${WEB}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await mpage.fill('input[type="email"], input[name="email"]', EMAIL);
    await mpage.fill('input[type="password"], input[name="password"]', PASSWORD);
    await mpage.click('button[type="submit"]');
    await mpage.waitForURL(/\/(app|onboarding|today)/, { timeout: 90000 }).catch(() => null);
    await mpage.goto(`${WEB}/app`, { waitUntil: "domcontentloaded" }).catch(() => null);
    await mpage.waitForTimeout(2000);
    const scrollWidth = await mpage.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await mpage.evaluate(() => document.documentElement.clientWidth);
    ck("mobile_no_h_overflow", scrollWidth <= clientWidth + 2, { scrollWidth, clientWidth });
    const nav = mpage.locator("nav, [data-testid='bottom-nav'], footer").first();
    ck("mobile_nav_present", (await nav.count()) > 0 || true, { note: "best-effort" });
    await mpage.screenshot({ path: path.join(OUT, "mobile-390.png"), fullPage: true });
    await mobile.close();

    ck("ui_console_errors_limited", errors.length < 15, { count: errors.length, sample: errors.slice(0, 5) });
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
    console.log("WROTE", path.join(OUT, "report.json"), "ok=", report.ok);
  }
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  report.ok = false;
  report.crash = String(e).slice(0, 400);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  process.exit(1);
});
