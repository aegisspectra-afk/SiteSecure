import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const WEB = payload.web;
const TOKEN = payload.token;
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
await page.goto(`${WEB}/app/quotes/${payload.quotes.sent}`, { waitUntil: "networkidle" });
await page.waitForSelector("#quote-items", { timeout: 45000 });
const statusPill = await page.locator(".cpq-header-status-pill").innerText();
const sendCount = await page.getByRole("button", { name: "שליחה לאישור" }).count();
const toolbar = page.getByRole("toolbar", { name: "פעולות הצעה" });
const toolbarSend = await toolbar.getByRole("button", { name: "שליחה לאישור" }).count();
console.log(JSON.stringify({ statusPill, sendCount, toolbarSend }, null, 2));
await browser.close();
