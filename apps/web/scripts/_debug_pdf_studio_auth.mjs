import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const TOKEN = fs.readFileSync(path.join(ROOT, "apps/api/scripts/.tmp_import_token"), "utf8").trim();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
console.log("user", user.id, user.email);

const session = await fetch("http://127.0.0.1:8000/api/v1/auth/session", {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
console.log("session keys", Object.keys(session), "role", session.memberships?.[0]?.role_key, "ws", session.memberships?.[0]?.workspace_id);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
page.on("console", (m) => console.log("console", m.type(), m.text().slice(0, 200)));
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://127.0.0.1:5173/app", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(3000);
console.log("url1", page.url());
console.log("body1", (await page.locator("body").innerText()).slice(0, 500).replace(/\s+/g, " "));
await page.screenshot({ path: path.join(__dirname, "_pdf_studio_native_qa/debug-app.png"), fullPage: true });
await page.goto("http://127.0.0.1:5173/app/settings/pdf-templates", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(5000);
console.log("url2", page.url());
console.log("body2", (await page.locator("body").innerText()).slice(0, 800).replace(/\s+/g, " "));
console.log("has studio", await page.locator(".pdf-studio").count());
await page.screenshot({ path: path.join(__dirname, "_pdf_studio_native_qa/debug-studio.png"), fullPage: true });
await browser.close();
