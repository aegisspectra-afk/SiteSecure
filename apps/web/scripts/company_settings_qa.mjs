/**
 * Visual QA — Company settings (real workspace, no demo)
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/core-app-ux-qa/company");
const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("playwright");

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

const env = { ...loadEnv(path.join(ROOT, ".env")), ...loadEnv(path.join(ROOT, "apps/web/.env")) };
const WEB = process.env.WEB_URL || "http://127.0.0.1:5173";
const SUPABASE_URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const OWNER = "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = "Phase1b-1790012816-Qa!";
const WS = "50339413-11c7-4903-820c-7541fbd2a476";
const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
fs.mkdirSync(OUT, { recursive: true });

const tok = await (
  await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: OWNER, password: PASSWORD }),
  })
).json();
if (!tok.access_token) {
  console.error("auth_failed");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const report = { shots: [], checks: {}, started: new Date().toISOString() };

async function openCompany({ width, height, colorScheme }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme });
  await ctx.addInitScript(
    ({ key, value, ws, theme }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", theme);
      localStorage.setItem("ss.last-workspace-id", ws);
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      ws: WS,
      theme: colorScheme === "light" ? "light" : "dark",
      value: JSON.stringify({
        access_token: tok.access_token,
        refresh_token: tok.refresh_token || "qa",
        expires_at: Math.floor(Date.now() / 1000) + 7200,
        expires_in: 7200,
        token_type: "bearer",
        user: tok.user,
      }),
    },
  );
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/settings/company`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(".settings-panel", { timeout: 60000 });
  await page.waitForSelector("#co-display", { timeout: 60000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}

{
  const { ctx, page } = await openCompany({ width: 1440, height: 900, colorScheme: "dark" });
  const body = await page.locator("main, .settings-panel").first().innerText();
  const display = await page.locator("#co-display").inputValue();
  const phone = await page.locator("#co-phone").inputValue();
  const city = await page.locator("#co-city").inputValue();
  const hasDemoWord = /דמו|demo|לקוח לדוגמה|INV-PREVIEW/i.test(body);
  const hasDemoButtons = (await page.getByRole("button", { name: /תצוגת חשבונית|תצוגת הצעת מחיר/ }).count()) > 0;
  const hasDocsSection = body.includes("מסמכים");
  const paymentShowsProductBrand = await page.locator(".ss-payment-card-product").innerText().catch(() => "");
  const paymentOk =
    paymentShowsProductBrand.toLowerCase().includes("phase1b") ||
    paymentShowsProductBrand.toLowerCase().includes(display.toLowerCase());
  const hasProductBrandLeak = /site\s*secure/i.test(paymentShowsProductBrand);

  // live save via UI
  const stamp = `QA-${Date.now().toString().slice(-6)}`;
  await page.locator("#co-web").fill(`https://example.com/${stamp}`);
  await page.getByRole("button", { name: "שמירה" }).click();
  await page.waitForSelector(".settings-saved", { timeout: 15000 }).catch(() => {});
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#co-web", { timeout: 60000 });
  await page.waitForTimeout(600);
  const websiteAfter = await page.locator("#co-web").inputValue();

  await page.screenshot({ path: path.join(OUT, "1440-dark-company.png"), fullPage: true });
  report.shots.push("1440-dark-company.png");
  report.checks = {
    displayName: display,
    phone,
    city,
    hasDemoWord,
    hasDemoButtons,
    hasDocsSection,
    paymentLabel: paymentShowsProductBrand,
    paymentOk,
    hasProductBrandLeak,
    websitePersisted: websiteAfter.includes(stamp),
    websiteAfter,
  };
  await ctx.close();
}

{
  const { ctx, page } = await openCompany({ width: 390, height: 844, colorScheme: "dark" });
  await page.screenshot({ path: path.join(OUT, "390-dark-company.png"), fullPage: true });
  report.shots.push("390-dark-company.png");
  await ctx.close();
}

report.pass =
  Boolean(report.checks.displayName) &&
  !report.checks.hasDemoWord &&
  !report.checks.hasDemoButtons &&
  report.checks.hasDocsSection &&
  report.checks.paymentOk &&
  !report.checks.hasProductBrandLeak &&
  report.checks.websitePersisted;

report.finished = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, checks: report.checks }, null, 2));
await browser.close();
process.exit(report.pass ? 0 : 1);
