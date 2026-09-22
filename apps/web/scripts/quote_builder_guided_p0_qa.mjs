/**
 * Guided workspace P0 visual QA — screenshots only.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...loadEnv(path.join(ROOT, ".env")),
  ...loadEnv(path.join(ROOT, "apps/web/.env")),
  ...process.env,
};

const OUT = path.join(ROOT, "Docs/quote-builder-guided-p0-qa");
const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const QUOTE_ID = env.QA_QUOTE_ID || "c79b9091-6200-454e-b0f9-c7dee78007f6";
fs.mkdirSync(OUT, { recursive: true });

const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
const tokenJson = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());

if (!tokenJson.access_token) {
  console.error("auth failed", tokenJson);
  process.exit(1);
}

const STAGES = [
  { key: "details", label: "פרטי ההצעה" },
  { key: "items", label: "תכנון וציוד" },
  { key: "pricing", label: "הצעה ומחיר" },
  { key: "review", label: "תנאים ושליחה" },
];

const browser = await chromium.launch({ headless: true });
const report = { email: EMAIL, web: WEB, quoteId: QUOTE_ID, shots: [], notes: [] };

async function open(theme, width, height, pathSuffix) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  await ctx.addInitScript(
    ({ key, value, theme: t }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", t);
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      theme,
      value: JSON.stringify({
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token || "qa",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user: tokenJson.user,
      }),
    },
  );
  const page = await ctx.newPage();
  await page.goto(`${WEB}${pathSuffix}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
  }, theme);
  await page.waitForSelector(".cpq-workspace-v2, .cpq-stage-panel", { timeout: 30000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.shots.push(name);
  console.log("shot", name);
}

async function clickStage(page, label) {
  await page.evaluate((stageLabel) => {
    const buttons = [...document.querySelectorAll(`button[aria-label="${stageLabel}"]`)];
    const visible = buttons.find((b) => {
      const style = window.getComputedStyle(b);
      return style.display !== "none" && style.visibility !== "hidden" && b.getClientRects().length > 0;
    });
    (visible || buttons[0])?.click();
  }, label);
  await page.waitForTimeout(300);
}

// Empty-ish / existing quote — capture each stage at desktop + mobile light
{
  const { ctx, page } = await open("light", 1440, 900, `/app/quotes/${QUOTE_ID}`);
  for (const stage of STAGES) {
    await clickStage(page, stage.label);
    const active = await page.locator('.cpq-stage-panel.is-active').count();
    const inactive = await page.locator('.cpq-stage-panel.is-inactive').count();
    report.notes.push({ view: "desktop-1440", stage: stage.key, activePanels: active, inactivePanels: inactive });
    await shot(page, `desktop-1440-${stage.key}-light`);
  }
  await ctx.close();
}

{
  const { ctx, page } = await open("dark", 1440, 900, `/app/quotes/${QUOTE_ID}`);
  await clickStage(page, "תכנון וציוד");
  await shot(page, "desktop-1440-items-dark");
  await clickStage(page, "הצעה ומחיר");
  await shot(page, "desktop-1440-pricing-dark");
  await ctx.close();
}

{
  const { ctx, page } = await open("light", 1280, 800, `/app/quotes/${QUOTE_ID}`);
  await clickStage(page, "פרטי ההצעה");
  await shot(page, "desktop-1280-details-light");
  await ctx.close();
}

{
  const { ctx, page } = await open("light", 1100, 800, `/app/quotes/${QUOTE_ID}`);
  await clickStage(page, "הצעה ומחיר");
  await shot(page, "narrow-1100-pricing-light");
  await ctx.close();
}

for (const width of [390, 360]) {
  const { ctx, page } = await open("light", width, 844, `/app/quotes/${QUOTE_ID}`);
  for (const stage of STAGES) {
    await clickStage(page, stage.label);
    const dock = await page.locator(".quote-builder-actions").boundingBox();
    const pad = await page.evaluate(() => {
      const main = document.querySelector(".cpq-workspace-v2, main");
      return main ? getComputedStyle(main).paddingBottom : null;
    });
    report.notes.push({ view: `mobile-${width}`, stage: stage.key, dockH: dock?.height ?? null, pad });
    await shot(page, `mobile-${width}-${stage.key}-light`);
  }
  await ctx.close();
}

{
  const { ctx, page } = await open("dark", 390, 844, `/app/quotes/${QUOTE_ID}`);
  await clickStage(page, "תנאים ושליחה");
  await shot(page, "mobile-390-review-dark");
  await ctx.close();
}

{
  const { ctx, page } = await open("light", 1440, 900, "/app/quotes/new");
  const stage = await page.locator('button[aria-current="step"]').first().getAttribute("aria-label");
  report.notes.push({ view: "new-empty", initialStage: stage });
  await shot(page, "desktop-1440-new-details-light");
  await ctx.close();
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
