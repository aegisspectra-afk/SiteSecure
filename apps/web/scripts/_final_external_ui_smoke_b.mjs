/**
 * Focused follow-up: relogin, network, mobile only.
 */
import { chromium, devices } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "_final_external_ui_smoke");
fs.mkdirSync(OUT, { recursive: true });
const WEB = "https://site-secure-umber.vercel.app";
const EMAIL = process.env.EXT_EMAIL;
const PASSWORD = process.env.EXT_PASSWORD;
const report = { checks: [], timings_ms: {}, ok: true };
const ck = (n, ok, e = {}) => {
  report.checks.push({ name: n, ok: !!ok, ...e });
  if (!ok) report.ok = false;
  console.log(ok ? "PASS" : "FAIL", n, e);
};

async function login(page) {
  await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(app|onboarding|today)/, { timeout: 90000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await login(page);
    ck("relogin_fresh", /app|today|onboarding/i.test(page.url()), { url: page.url() });

    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await page.context().setOffline(false);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    const txt = await page.locator("body").innerText();
    ck("network_recovery", txt.trim().length > 30, { chars: txt.trim().length });

    // logout via storage clear + login page
    await ctx.clearCookies();
    await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await login(page);
    ck("session_relogin", true, { url: page.url() });
    await ctx.close();

    const mobile = await browser.newContext({ ...devices["iPhone 12"], locale: "he-IL" });
    const m = await mobile.newPage();
    await login(m);
    await m.goto(`${WEB}/app`, { waitUntil: "domcontentloaded" }).catch(() => null);
    await m.waitForTimeout(2000);
    const sw = await m.evaluate(() => document.documentElement.scrollWidth);
    const cw = await m.evaluate(() => document.documentElement.clientWidth);
    ck("mobile_no_h_overflow", sw <= cw + 4, { sw, cw });
    await m.screenshot({ path: path.join(OUT, "mobile-390-b.png"), fullPage: true });
    const forgot = await (await mobile.newPage()).goto(`${WEB}/forgot-password`, { waitUntil: "domcontentloaded" });
    ck("forgot_status", forgot && forgot.ok());
    await mobile.close();
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, "report_b.json"), JSON.stringify(report, null, 2));
    console.log("WROTE report_b ok=", report.ok);
  }
  process.exit(report.ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
