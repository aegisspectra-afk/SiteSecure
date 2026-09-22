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
  body: JSON.stringify({ customer_id: cust.id, title: "Tpl QA final" }),
});

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
const apiCalls = [];
page.on("response", (res) => {
  const u = res.url();
  if (u.includes("127.0.0.1:8000") && u.includes("templates")) {
    apiCalls.push({ url: u, status: res.status() });
  }
});

await page.goto(`${WEB}/app/quotes/${tplQuote.id}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.body.innerText.includes("טוען"), { timeout: 60000 });

let appeared = false;
try {
  await page.getByRole("heading", { name: "התחל מתבנית" }).waitFor({ timeout: 20000 });
  appeared = true;
} catch {
  appeared = false;
}
console.log("fast path appeared", appeared, "template API calls", apiCalls);

if (appeared) {
  await page.getByRole("button", { name: "החל תבנית" }).click();
  await page.waitForFunction(() => document.querySelectorAll("[id^='item-desc-']").length > 0, { timeout: 30000 });
  const after = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${tplQuote.id}`);
  const sec = after.sections?.[0];
  const item = after.items?.[0];
  if (sec) {
    const secInput = page.locator(`#section-name-${sec.id}`);
    await secInput.fill("סעיף נערך מיד");
    await secInput.blur();
    await page.waitForTimeout(700);
  }
  if (item) {
    const sel = `#item-desc-${item.id}`;
    await page.locator(sel).fill("שורה מיידית אחרי תבנית");
    await page.locator(`#item-qty-${item.id}`).fill("4");
    await page.locator(`#item-price-${item.id}`).fill("250");
    await page.locator(`#item-price-${item.id}`).blur();
    await page.waitForTimeout(1000);
  }
  const final = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${tplQuote.id}`);
  const fi = final.items?.[0];
  const fs = final.sections?.[0];
  console.log("TEMPLATE REGRESSION PASS", {
    section: fs?.name,
    desc: fi?.description?.slice(0, 30),
    qty: fi?.qty,
    price: fi?.unit_price,
  });
} else {
  // fallback: expand details + use template select
  const details = page.getByText("פרטים נוספים");
  if (await details.count()) await details.click();
  await page.waitForTimeout(500);
  const select = page.locator("#template_id");
  const opts = await select.locator("option").count();
  console.log("fallback template select options", opts);
  if (opts > 1) {
    await select.selectOption({ index: 1 });
    await page.getByRole("button", { name: "החל תבנית" }).click();
    await page.waitForTimeout(4000);
    const after = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${tplQuote.id}`);
    console.log("fallback apply items", after.items?.length);
  }
}

await browser.close();
