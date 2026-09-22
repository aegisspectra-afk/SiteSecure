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

const session = await api(TOKEN, `${API}/api/v1/auth/session`);
const ws = session.memberships[0].workspace_id;
const cust = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/customers?limit=1`)).items[0];
const prod = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/catalog/products?limit=1`)).items[0];

const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
});
const user = await userRes.json();
const storageKey = `sb-${ref}-auth-token`;
const sessionPayload = JSON.stringify({
  access_token: TOKEN,
  refresh_token: "qa",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user,
});

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(
  ({ key, value }) => {
    localStorage.setItem("ss.remember-device", "1");
    localStorage.setItem(key, value);
  },
  { key: storageKey, value: sessionPayload },
);
const page = await ctx.newPage();

const inc = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes`, {
  method: "POST",
  body: JSON.stringify({ title: "Send QA inc" }),
});
await page.goto(`${WEB}/app/quotes/${inc.id}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const incVal = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${inc.id}`)).validation;
const sendBtns = page.getByRole("button", { name: "שליחה לאישור" });
const incCount = await sendBtns.count();
const incDisabled = incCount > 0 ? await sendBtns.first().isDisabled() : null;
console.log("INCOMPLETE", JSON.stringify({ can_send: incVal.can_send, gaps: incVal.gaps?.length, btnCount: incCount, disabled: incDisabled }));

await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${inc.id}`, {
  method: "PATCH",
  body: JSON.stringify({ customer_id: cust.id, payment_terms: "מזומן", valid_until: "2099-12-31" }),
});
await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${inc.id}/items`, {
  method: "POST",
  body: JSON.stringify({ product_id: prod.id, qty: 1 }),
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const compVal = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${inc.id}`)).validation;
const compCount = await sendBtns.count();
const compEnabled = compCount > 0 ? await sendBtns.first().isEnabled() : null;
console.log("COMPLETE", JSON.stringify({ can_send: compVal.can_send, gaps: compVal.gaps?.length, btnCount: compCount, enabled: compEnabled }));

const tplQuote = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes`, {
  method: "POST",
  body: JSON.stringify({ customer_id: cust.id, title: "Tpl QA" }),
});
await page.goto(`${WEB}/app/quotes/${tplQuote.id}`, { waitUntil: "networkidle" });
await page.waitForTimeout(3500);
const heading = page.getByRole("heading", { name: "התחל מתבנית" });
const hCount = await heading.count();
console.log("TEMPLATE heading", hCount);
if (hCount) {
  await page.getByRole("button", { name: "החל תבנית" }).click();
  await page.waitForTimeout(4000);
  const after = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${tplQuote.id}`);
  console.log("TEMPLATE items after apply", after.items?.length);
  if (after.items?.length) {
    const id = after.items[0].id;
    const sel = `#item-desc-${id}`;
    await page.locator(sel).click();
    await page.locator(sel).type(" — עריכה מיידית", { delay: 10 });
    await page.locator(sel).blur();
    await page.waitForTimeout(600);
    console.log("TEMPLATE edit ok", (await page.locator(sel).inputValue()).includes("עריכה מיידית"));
  }
} else {
  const bodyText = await page.locator("body").innerText();
  console.log("TEMPLATE page snippet", bodyText.slice(0, 400).replace(/\n/g, " | "));
}

const mainQuote = "c5b81b3b-c0c3-4763-9960-df52782e7281";
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(`${WEB}/app/quotes/${mainQuote}`, { waitUntil: "networkidle" });
await page.waitForTimeout(5000);
const items = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${mainQuote}`)).items.filter((i) => i.item_type !== "note");
const desc = page.locator(`#item-desc-${items[0].id}`);
await desc.scrollIntoViewIfNeeded().catch(() => null);
console.log(
  "MOBILE",
  JSON.stringify({
    visible: await desc.isVisible(),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2),
    loading: (await page.locator("body").innerText()).includes("טוען"),
  }),
);

await browser.close();
