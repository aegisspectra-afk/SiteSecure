/**
 * Task 11 — live mobile quote actions QA (Playwright).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "_task11_qa");
const TOKEN = fs.readFileSync(path.join(ROOT, "apps/api/scripts/.tmp_import_token"), "utf8").trim();
const WEB = process.env.WEB_URL || "http://localhost:5174";
const quoteId = "c5b81b3b-c0c3-4763-9960-df52782e7281";

const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
];

const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

fs.mkdirSync(OUT, { recursive: true });

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

const report = { viewports: {}, checks: {} };

for (const vp of VIEWPORTS) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(`${WEB}/app/quotes/${quoteId}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.body.innerText.includes("טוען"), { timeout: 60000 });
  await page.waitForSelector("#quote-items", { timeout: 20000 });

  const toolbar = page.getByRole("toolbar", { name: "פעולות הצעה" });
  await toolbar.waitFor({ timeout: 10000 });

  const send = toolbar.getByRole("button", { name: "שליחה לאישור" });
  const preview = toolbar.getByRole("button", { name: "תצוגה מקדימה" });
  const add = toolbar.getByRole("button", { name: "הוסף" });
  const overflow = toolbar.getByRole("button", { name: "פעולות נוספות" });

  const sendBox = await send.boundingBox();
  const viewportHeight = vp.height;
  const navOffset = 60;
  const sendAboveNav = sendBox ? sendBox.y + sendBox.height < viewportHeight - navOffset : false;

  await add.click();
  await page.getByRole("menu", { name: "הוספה להצעה" }).waitFor({ timeout: 5000 });
  const addMenuItems = await page.getByRole("menuitem").allTextContents();
  await page.keyboard.press("Escape");

  await page.screenshot({ path: path.join(OUT, `${vp.name}-actions.png`), fullPage: false });

  await page.locator("#quote-items").evaluate((el) => el.scrollIntoView());
  const qtyInput = page.locator('input[name="qty"], input[aria-label*="כמות"], input[inputmode="decimal"]').first();
  if (await qtyInput.count()) {
    await qtyInput.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-keyboard.png`), fullPage: false });
    await page.keyboard.press("Escape");
  }

  report.viewports[vp.name] = {
    sendVisible: await send.isVisible(),
    previewVisible: await preview.isVisible(),
    addVisible: await add.isVisible(),
    overflowVisible: await overflow.isVisible(),
    sendAboveNav,
    headerHamburger: await page.getByRole("button", { name: "תפריט הצעה" }).count(),
    addMenuItems,
    horizontalScroll: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2),
  };

  await page.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
