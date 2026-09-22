import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const WEB = payload.web;
const TOKEN = payload.token;
const API = "http://127.0.0.1:8000";
const SIG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
const session = await fetch(`${API}/api/v1/auth/session`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
const ws = session.memberships[0].workspace_id;
const cust = await fetch(`${API}/api/v1/workspaces/${ws}/customers`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    display_name: `QA UI NoSite ${Date.now()}`,
    email: "nosite-ui@task12.local",
    phone: "0500000077",
  }),
}).then((r) => r.json());
const site = await fetch(`${API}/api/v1/workspaces/${ws}/sites`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ customer_id: cust.id, name: "UI Pick Site", address: { line: "x", city: "y" } }),
}).then((r) => r.json());
let q = await fetch(`${API}/api/v1/workspaces/${ws}/quotes`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    customer_id: cust.id,
    title: "UI No Site Picker",
    valid_until: "2099-12-31",
    payment_terms: "מזומן",
  }),
}).then((r) => r.json());
await fetch(`${API}/api/v1/workspaces/${ws}/quotes/${q.id}/items`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ item_type: "free", description: "x", qty: 1, unit_price: 100 }),
});
const sent = await fetch(`${API}/api/v1/workspaces/${ws}/quotes/${q.id}/send`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
await fetch(`${API}/api/v1/public/quotes/${sent.public_token}/approve`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "UI QA", terms_accepted: true, signature_data_url: SIG }),
});

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
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
await page.goto(`${WEB}/app/quotes/${q.id}`, { waitUntil: "networkidle" });
await page.waitForSelector("#quote-items", { timeout: 45000 });
const selectSiteBtn = await page.getByRole("button", { name: "בחר אתר" }).count();
await page.getByRole("button", { name: "בחר אתר" }).first().click();
const dialog = await page.getByText("הצעת המחיר אושרה").count();
const siteOptions = await page.locator("select option").count();
const siteText = await page.locator("select").innerText().catch(() => "");
console.log(
  JSON.stringify(
    {
      quote_id: q.id,
      customer_id: cust.id,
      site_id_for_customer: site.id,
      selectSiteBtn,
      dialogOpen: dialog > 0,
      siteOptions,
      siteTextIncludesCustomerSite: siteText.includes("UI Pick Site"),
    },
    null,
    2,
  ),
);
await browser.close();
