
import { chromium } from "playwright";
import fs from "node:fs";
const WEB = "http://localhost:5173";
const API = "http://127.0.0.1:8010";
const email = "beta.e2e.owner.ca3dffde@sitesecure.test";
const password = "BetaQA-ca3dffde-2026!";
const supabaseUrl = "https://rhxqqudlngimhplvndmz.supabase.co";
const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHFxdWRsbmdpbWhwbHZuZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTY4NjcsImV4cCI6MjEwMjI3Mjg2N30.m6nQeUDm-P7uRbO_p6XZbEB1mZHLavt9whph1Wkwi1Q";
const out = { viewports: {} };
const grant = await fetch(supabaseUrl + "/auth/v1/token?grant_type=password", {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
}).then(r => r.json());
const token = grant.access_token;
if (!token) {
  console.log(JSON.stringify({ viewports: { "375": { pending: true, detail: "no token" }, "390": { pending: true, detail: "no token" }, "430": { pending: true, detail: "no token" } } }));
  process.exit(0);
}
const user = await fetch(supabaseUrl + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token } }).then(r => r.json());
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const browser = await chromium.launch({ headless: true });
for (const w of [375, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 812 } });
  await ctx.addInitScript(({ key, value }) => {
    localStorage.setItem("ss.remember-device", "1");
    localStorage.setItem(key, value);
  }, {
    key: `sb-${ref}-auth-token`,
    value: JSON.stringify({
      access_token: token,
      refresh_token: grant.refresh_token || "qa",
      expires_at: Math.floor(Date.now()/1000)+3600,
      expires_in: 3600,
      token_type: "bearer",
      user,
    }),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    await page.goto(WEB + "/app/today", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    const bottom = await page.locator("nav, [data-testid='bottom-nav'], .bottom-nav").count();
    out.viewports[String(w)] = { ok: !overflow && errors.length === 0, overflow, bottom_nav: bottom > 0, url: page.url(), errors: errors.slice(0,3) };
    await page.screenshot({ path: "C:\\Users\\shimd\\OneDrive\\Desktop\\\u05d0\u05d2\u05d9\u05e1 \u05de\u05e2\u05e8\u05db\u05d5\u05ea\\SiteSecureV1\\apps\\api\\scripts\\_beta_task04" + `/mobile-${w}.png` });
  } catch (e) {
    out.viewports[String(w)] = { ok: false, detail: String(e) };
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out));
