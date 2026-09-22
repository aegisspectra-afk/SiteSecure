import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "_pdf_studio_native_qa");
const TOKEN = fs.readFileSync(path.join(ROOT, "apps/api/scripts/.tmp_import_token"), "utf8").trim();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

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
const fails = [];
page.on("requestfailed", (r) => fails.push(`${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => {
  if (r.status() >= 400) fails.push(`${r.status()} ${r.url()}`);
});
page.on("pageerror", (e) => console.log("PAGEERR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("ERR", m.text().slice(0, 300));
});

await page.goto("http://127.0.0.1:5173/app/settings/pdf-templates", {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(5000);
const html = await page.content();
fs.writeFileSync(path.join(OUT, "debug.html"), html);
console.log("url", page.url());
console.log("root len", (await page.locator("#root").innerHTML().catch(() => "")).length);
console.log("body text", (await page.locator("body").innerText()).slice(0, 600));
console.log("fails", fails.slice(0, 30));
await page.screenshot({ path: path.join(OUT, "debug-studio2.png"), fullPage: true });
await browser.close();
