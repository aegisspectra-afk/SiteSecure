import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(pathToFileURL(path.resolve("c:/Users/shimd/OneDrive/Desktop/אגיס מערכות/SiteSecureV1/package.json")).href);
const { chromium } = require("playwright");
const WEB = "https://site-secure-umber.vercel.app";
const OUT = "c:/Users/shimd/OneDrive/Desktop/אגיס מערכות/SiteSecureV1/apps/web/scripts/_beta_vercel_mobile";
fs.mkdirSync(OUT, { recursive: true });
const report = { web: WEB, ok: true, failures: [], viewports: {}, pages: {} };
function fail(m){ report.ok=false; report.failures.push(m); }
const browser = await chromium.launch({ headless: true });
for (const w of [390, 375, 360, 430]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true, locale: "he-IL" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  await page.goto(WEB + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  const body = await page.locator("body").innerText();
  const hasLogin = /התחבר|כניסה|אימייל|סיסמה|login/i.test(body);
  await page.screenshot({ path: path.join(OUT, `login-${w}.png`) });
  report.viewports[w] = { overflow, hasLogin, pageErrors: errs.slice(0,5) };
  if (overflow) fail(`overflow login ${w}`);
  if (!hasLogin) fail(`login UI missing ${w}`);
  if (errs.length) fail(`pageerror login ${w}`);
  await ctx.close();
}
// home
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "he-IL" });
const page2 = await ctx2.newPage();
await page2.goto(WEB + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page2.waitForTimeout(1500);
report.pages.home_snip = (await page2.locator("body").innerText()).slice(0, 300);
await page2.screenshot({ path: path.join(OUT, "home-390.png") });
await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(report.ok ? "OK" : "FAILED");
console.log(JSON.stringify(report.failures));
