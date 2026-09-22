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

function authSetup() {
  const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
  const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
  const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
  return { supabaseUrl, ref, anon };
}

const session = await api(TOKEN, `${API}/api/v1/auth/session`);
const ws = session.memberships[0].workspace_id;
const cust = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/customers?limit=1`)).items[0];
const { supabaseUrl, ref, anon } = authSetup();
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
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

const tplQuote = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes`, {
  method: "POST",
  body: JSON.stringify({ customer_id: cust.id, title: "Tpl QA 2" }),
});
console.log("quote id", tplQuote.id);

await page.goto(`${WEB}/app/quotes/${tplQuote.id}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.body.innerText.includes("טוען"), { timeout: 60000 });
await page.waitForTimeout(1500);

const heading = page.getByRole("heading", { name: "התחל מתבנית" });
console.log("heading count", await heading.count());
const applyBtn = page.getByRole("button", { name: "החל תבנית" });
console.log("apply btn count", await applyBtn.count());

if (await heading.count()) {
  await applyBtn.click();
  await page.waitForFunction(() => !document.body.innerText.includes("טוען"), { timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(2000);
  const after = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${tplQuote.id}`);
  console.log("items", after.items?.length, "sections", after.sections?.length);
  if (after.items?.length) {
    const sec = after.sections?.[0];
    if (sec) {
      const secInput = page.locator(`#section-name-${sec.id}`);
      await secInput.click();
      await secInput.fill("סעיף נערך מיד");
      await secInput.blur();
      await page.waitForTimeout(700);
      console.log("section rename", await secInput.inputValue());
    }
    const id = after.items[0].id;
    const sel = `#item-desc-${id}`;
    await page.locator(sel).click();
    await page.locator(sel).type(" — עריכה מיידית", { delay: 10 });
    const qty = page.locator(`#item-qty-${id}`);
    await qty.click({ clickCount: 3 });
    await qty.fill("3");
    await qty.blur();
    await page.waitForTimeout(800);
    const price = page.locator(`#item-price-${id}`);
    await price.click({ clickCount: 3 });
    await price.fill("100");
    await price.blur();
    await page.waitForTimeout(800);
    const refreshed = await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes/${tplQuote.id}`);
    const item = refreshed.items.find((i) => i.id === id);
    console.log("TEMPLATE QA", {
      desc: (await page.locator(sel).inputValue()).includes("עריכה מיידית"),
      qty: item?.qty,
      price: item?.unit_price,
    });
  }
} else {
  console.log("no fast path — body has template?", (await page.locator("body").innerText()).includes("תבנית"));
}

// Save indicator ago tick
const mainQuote = "c5b81b3b-c0c3-4763-9960-df52782e7281";
await page.goto(`${WEB}/app/quotes/${mainQuote}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.body.innerText.includes("טוען"), { timeout: 60000 });
const save1 = await page.locator(".cpq-save-state-inline").textContent();
await page.waitForTimeout(35000);
const save2 = await page.locator(".cpq-save-state-inline").textContent();
console.log("SAVE AGO", { t0: save1?.trim(), t35: save2?.trim(), changed: save1 !== save2 });

await browser.close();
