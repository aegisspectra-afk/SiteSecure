import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const TOKEN = fs.readFileSync(path.join(ROOT, "apps/api/scripts/.tmp_import_token"), "utf8").trim();
const API = "http://127.0.0.1:8000";
const WEB = process.env.WEB_URL || "http://localhost:5174";

async function api(token, url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  return res.json();
}

const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

const session = await api(TOKEN, `${API}/api/v1/auth/session`);
const ws = session.memberships[0].workspace_id;
const quoteId = "c5b81b3b-c0c3-4763-9960-df52782e7281";
const items = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}`)).items.filter((i) => i.item_type !== "note");
const itemId = items[0].id;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
let failNext = true;
await page.route("**/api/v1/workspaces/*/quotes/*/items/*", async (route) => {
  if (route.request().method() === "PATCH" && failNext) {
    failNext = false;
    await route.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"simulated failure"}' });
    return;
  }
  await route.continue();
});

await page.goto(`${WEB}/app/quotes/${quoteId}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.body.innerText.includes("טוען"), { timeout: 60000 });
const sel = `#item-desc-${itemId}`;
await page.locator(sel).click();
await page.locator(sel).fill("בדיקת שגיאת שמירה");
await page.locator(sel).blur();
await page.waitForTimeout(1200);
const saveText = (await page.locator(".cpq-save-state-inline").textContent())?.trim();
console.log("SAVE ERROR STATE", { label: saveText, falselySaved: saveText === "נשמר" });
await browser.close();
