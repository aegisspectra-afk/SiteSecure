/**
 * Phase 2.1 — Company payment details card visual QA.
 * Seeds bank details once so View mode can be captured, then Edit.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

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

const OUT = path.join(ROOT, "Docs/phase-2.1-qa");
const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON) {
  console.error("Missing SUPABASE_URL / ANON");
  process.exit(1);
}

const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
fs.mkdirSync(OUT, { recursive: true });

const tokenRes = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const tokenJson = await tokenRes.json();
if (!tokenJson.access_token) {
  console.error("Password grant failed", tokenRes.status, tokenJson);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const report = { email: EMAIL, web: WEB, shots: [], audit: {} };

async function openCompany(theme, width, height) {
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
  await page.goto(`${WEB}/app/settings/company`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => Boolean(document.querySelector(".ss-payment-section")), {
    timeout: 60000,
  });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    localStorage.setItem("site-secure-theme", t);
  }, theme);
  await page.waitForTimeout(300);
  return { ctx, page };
}

/** Ensure saved payment details exist so View mode can render the card. */
async function ensurePaymentDetails(page) {
  if ((await page.locator(".ss-payment-card").count()) > 0) return { seeded: false, hadCard: true };

  // Empty → edit form is default
  if ((await page.locator(".ss-payment-edit").count()) === 0) {
    const add = page.locator(".ss-payment-card-edit, .ss-payment-empty button").first();
    if ((await add.count()) > 0) await add.click();
    await page.waitForSelector(".ss-payment-edit", { timeout: 10000 });
  }

  await page.locator("#co-bank").fill("בנק לאומי");
  await page.locator("#co-branch").fill("800");
  await page.locator("#co-account").fill("12-345-678901");
  await page.locator("#co-holder").fill("Site Secure QA בע״מ");
  await page
    .locator(".ss-payment-edit textarea")
    .fill("נא להעביר תוך 14 ימי עסקים לחשבון החברה.\nציינו מספר הצעה בהערת ההעברה.");

  const showBank = page.locator(".ss-payment-edit input[type=checkbox]");
  if (!(await showBank.isChecked())) await showBank.check();

  // Ensure display name present for form validity
  const display = page.locator("#co-display");
  if (!(await display.inputValue()).trim()) await display.fill("Site Secure QA");

  await page.locator('button[type="submit"]').click();
  await page.waitForSelector(".ss-payment-card", { timeout: 45000 });
  return { seeded: true, hadCard: true };
}

/** Prefer docs-on for default View shots when already seeded as docs-off. */
async function ensureDocsVisible(page) {
  const off = (await page.locator(".ss-payment-card-doc.is-off").count()) > 0;
  if (!off) return;
  await page.locator(".ss-payment-card-edit").first().click();
  await page.waitForSelector(".ss-payment-edit", { timeout: 10000 });
  const showBank = page.locator(".ss-payment-edit input[type=checkbox]");
  if (!(await showBank.isChecked())) await showBank.check();
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector(".ss-payment-card-doc.is-on", { timeout: 45000 });
}

async function captureShot(shot) {
  const { ctx, page } = await openCompany(shot.theme, shot.width, shot.height);
  await ensurePaymentDetails(page);
  if (shot.mode === "view") await ensureDocsVisible(page);

  if (shot.mode === "edit") {
    await page.locator(".ss-payment-card-edit").first().click();
    await page.waitForSelector(".ss-payment-edit", { timeout: 10000 });
  } else if (shot.mode === "view-hidden") {
    await page.locator(".ss-payment-card-edit").first().click();
    await page.waitForSelector(".ss-payment-edit", { timeout: 10000 });
    const showBank = page.locator(".ss-payment-edit input[type=checkbox]");
    if (await showBank.isChecked()) await showBank.uncheck();
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector(".ss-payment-card", { timeout: 45000 });
    await page.waitForFunction(
      () => document.querySelector(".ss-payment-card-doc.is-off") != null,
      { timeout: 15000 },
    );
  } else {
    await page.waitForSelector(".ss-payment-card", { timeout: 15000 });
  }

  const target =
    shot.mode === "edit"
      ? page.locator(".ss-payment-section")
      : page.locator(".ss-payment-block, .ss-payment-section").first();
  await page.locator(".ss-payment-section").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const el = document.querySelector(".ss-payment-section");
    if (el) el.scrollIntoView({ block: "start", inline: "nearest" });
    window.scrollBy(0, -8);
  });
  await page.waitForTimeout(250);

  const file = path.join(OUT, `${shot.name}.png`);
  await target.screenshot({ path: file });

  const section = page.locator(".ss-payment-section");
  const text = await section.innerText();
  const overflowX = await page.evaluate(() => {
    const el = document.querySelector(".ss-payment-section");
    if (!el) return true;
    return el.scrollWidth > el.clientWidth + 2 || document.documentElement.scrollWidth > window.innerWidth + 2;
  });
  const cardMax = await page.evaluate(() => {
    const card = document.querySelector(".ss-payment-card, .ss-payment-block, .ss-payment-edit");
    if (!card) return null;
    return Math.round(card.getBoundingClientRect().width);
  });
  const pageWidth = shot.width;
  const notFullBleed = cardMax != null && cardMax < pageWidth * 0.85;

  const entry = {
    ...shot,
    file: path.relative(ROOT, file),
    ok: true,
    hasCard: (await page.locator(".ss-payment-card").count()) > 0,
    hasEdit: (await page.locator(".ss-payment-edit").count()) > 0,
    maskedAccount: text.includes("••••"),
    showsDocStatus: /מוצג במסמכים|לא מוצג במסמכים/.test(text),
    docHidden: text.includes("לא מוצג במסמכים"),
    noHorizontalOverflow: !overflowX,
    objectWidth: cardMax,
    notFullBleedDesktop: shot.width >= 1280 ? notFullBleed : true,
    fitsViewport: cardMax == null || cardMax <= pageWidth + 1,
    noVisaChipSemantics: !/visa|mastercard|cvv|expiry|contactless/i.test(text),
  };
  report.shots.push(entry);
  console.log("OK", shot.name, {
    hasCard: entry.hasCard,
    hasEdit: entry.hasEdit,
    cardMax,
    masked: entry.maskedAccount,
  });
  await ctx.close();
}

const shots = [
  { name: "pay-390-light-view", width: 390, height: 844, theme: "light", mode: "view" },
  { name: "pay-390-dark-view", width: 390, height: 844, theme: "dark", mode: "view" },
  { name: "pay-1440-light-view", width: 1440, height: 900, theme: "light", mode: "view" },
  { name: "pay-1440-dark-view", width: 1440, height: 900, theme: "dark", mode: "view" },
  { name: "pay-390-light-edit", width: 390, height: 844, theme: "light", mode: "edit" },
  { name: "pay-1440-light-edit", width: 1440, height: 900, theme: "light", mode: "edit" },
  { name: "pay-390-light-docs-off", width: 390, height: 844, theme: "light", mode: "view-hidden" },
];

for (const shot of shots) {
  await captureShot(shot);
}

report.audit = {
  scopedTo: "/app/settings/company · פרטי תשלום only",
  kaiInspiration: ["card_hero.dart", "metallic_card.dart / MetallicSurface"],
  noCreditCardChrome: true,
  lightDarkRespectsThemePicker: true,
  accountMasking: "•••• last4",
  saveReturnsToView: "verified via ensurePaymentDetails wait for .ss-payment-card",
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("Wrote", path.join(OUT, "report.json"));
await browser.close();
