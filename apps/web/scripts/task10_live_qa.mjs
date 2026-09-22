/**
 * Task 10 — live System apply QA (Playwright).
 */
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

const packages = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/catalog/packages`)).items || [];
console.log("systems", packages.length, packages.map((p) => ({ name: p.name, count: p.item_count })));

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
await page.goto(`${WEB}/app/quotes/${quoteId}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.body.innerText.includes("טוען"), { timeout: 60000 });
await page.waitForSelector("#quote-items", { timeout: 20000 });

const addSystemBtn = page.locator("#quote-items").getByRole("button", { name: "הוסף מערכת" });
await addSystemBtn.scrollIntoViewIfNeeded();
await addSystemBtn.click();
await page.getByRole("dialog", { name: "הוסף מערכת" }).waitFor({ timeout: 15000 });
await page.getByText("CCTV 4 Cameras").waitFor({ timeout: 10000 });
const beforeCount = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}`)).items?.length || 0;
const hasPackageWord = (await page.locator("body").innerText()).includes("Package");
console.log("picker open", true, "has Package word", hasPackageWord);

if (packages.length) {
  const target = packages[0];
  const dialog = page.getByRole("dialog", { name: "הוסף מערכת" });
  await dialog.getByRole("button", { name: "הוסף להצעה" }).first().click();
  await page.waitForTimeout(5000);
  const after = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}`);
  const afterCount = after.items?.length || 0;
  const applied = (after.items || []).filter((i) => i.package_name === target.name);
  const section = (after.sections || []).find((s) => s.name?.includes(target.name.slice(0, 8)));
  console.log("APPLY", {
    beforeCount,
    afterCount,
    newLines: applied.length,
    section: section?.name,
    package_name: applied[0]?.package_name,
    qty: applied[0]?.qty,
    unit_price: applied[0]?.unit_price,
    has_snapshot: Boolean(applied[0]?.catalog_snapshot),
  });
}

await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(500);
const mobileBtn = page.getByRole("button", { name: "הוסף מערכת" }).first();
console.log("MOBILE reachable", await mobileBtn.isVisible());

await browser.close();
