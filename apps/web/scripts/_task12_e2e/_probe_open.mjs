import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const WEB = payload.web;
const TOKEN = payload.token;
const qid = payload.quotes.approved_with_project;
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

async function authContext(browser, viewport) {
  const ctx = await browser.newContext(viewport ? { viewport } : {});
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
  return ctx;
}

const browser = await chromium.launch({ headless: true });
const ctx = await authContext(browser);
const page = await ctx.newPage();
await page.goto(`${WEB}/app/quotes/${qid}`, { waitUntil: "networkidle" });
await page.waitForSelector("#quote-items", { timeout: 45000 });
const immediate = {
  open: await page.getByRole("button", { name: "פתיחת הפרויקט" }).count(),
  create: await page.getByRole("button", { name: "יצירת פרויקט" }).count(),
};
let afterWait = null;
try {
  await page.getByRole("button", { name: "פתיחת הפרויקט" }).first().waitFor({ timeout: 15000 });
  afterWait = {
    open: await page.getByRole("button", { name: "פתיחת הפרויקט" }).count(),
    create: await page.getByRole("button", { name: "יצירת פרויקט" }).count(),
  };
} catch (e) {
  afterWait = { error: String(e) };
}
await ctx.close();

const ctx2 = await authContext(browser, { width: 390, height: 844 });
const page2 = await ctx2.newPage();
await page2.goto(`${WEB}/app/quotes/${qid}`, { waitUntil: "networkidle" });
await page2.waitForSelector("#quote-items", { timeout: 45000 });
let mobile = null;
try {
  await page2
    .getByRole("toolbar", { name: "פעולות הצעה" })
    .getByRole("button", { name: "פתיחת הפרויקט" })
    .first()
    .waitFor({ timeout: 15000 });
  mobile = {
    open: await page2
      .getByRole("toolbar", { name: "פעולות הצעה" })
      .getByRole("button", { name: "פתיחת הפרויקט" })
      .count(),
  };
} catch (e) {
  mobile = { error: String(e) };
}
await ctx2.close();
await browser.close();
console.log(JSON.stringify({ immediate, afterWait, mobile }, null, 2));
