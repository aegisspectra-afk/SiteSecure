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
const cust = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/customers?limit=1`)).items[0];
const tplQuote = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes`, {
  method: "POST",
  body: JSON.stringify({ customer_id: cust.id, title: "Tpl debug" }),
});

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const storageKey = `sb-${ref}-auth-token`;
await ctx.addInitScript(
  ({ key, value }) => {
    localStorage.setItem("ss.remember-device", "1");
    localStorage.setItem(key, value);
  },
  {
    key: storageKey,
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
const network = [];
page.on("response", async (res) => {
  const u = res.url();
  if (u.includes("/quotes/") || u.includes("/templates")) {
    network.push({ url: u.replace(/.*\/api\/v1\//, ""), status: res.status() });
  }
});

await page.goto(`${WEB}/app/quotes/${tplQuote.id}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.body.innerText.includes("טוען"), { timeout: 60000 });
await page.waitForTimeout(3000);

const apiQuote = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${tplQuote.id}`);
console.log("API quote", { items: apiQuote.items?.length, customer_id: apiQuote.customer_id, status: apiQuote.status });

const checks = {
  heading: await page.getByRole("heading", { name: "התחל מתבנית" }).count(),
  quoteTitle: await page.locator("#title").count(),
  linesPanel: await page.locator(".cpq-lines-panel, [class*='cpq-line']").count(),
  bodySnippet: (await page.locator("body").innerText()).split("\n").slice(0, 40).join(" | "),
  network: network.slice(0, 20),
};

console.log(JSON.stringify(checks, null, 2));
await page.screenshot({ path: path.join(__dirname, "_task09_qa/template-debug.png"), fullPage: true });
await browser.close();
