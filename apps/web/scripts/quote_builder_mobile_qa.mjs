/**
 * Quote Builder mobile UX QA — scroll proof for sticky budget.
 * Presentation only; does not mutate quote/pricing.
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

const OUT = path.join(ROOT, "Docs/quote-builder-mobile-qa");
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

const tokenJson = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());

if (!tokenJson.access_token) {
  console.error("Password grant failed", tokenJson);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const report = { email: EMAIL, web: WEB, shots: [], stickyAudit: [], notes: [] };

async function open(theme, width, height, route) {
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
  await page.goto(`${WEB}${route}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    localStorage.setItem("site-secure-theme", t);
  }, theme);
  await page.waitForTimeout(500);
  return { ctx, page };
}

async function waitQuote(page) {
  await page.waitForFunction(
    () => {
      const t = (document.body?.innerText || "").replace(/\s+/g, " ");
      return (
        Boolean(document.querySelector(".quote-builder, .cpq-builder")) ||
        /הצעת מחיר|טרם נשמר|פרטי הצעה|₪/.test(t)
      );
    },
    { timeout: 60000 },
  ).catch(() => {});
  await page.waitForTimeout(400);
}

function stickyProbe(page) {
  return page.evaluate(() => {
    const main = document.querySelector(".ops-main");
    const scrollY = main ? Math.round(main.scrollTop) : Math.round(window.scrollY);
    const unsaved = [...document.querySelectorAll(".cpq-save-state")].map((el) => {
      const cs = getComputedStyle(el);
      const header = el.closest(".cpq-builder-header");
      const hcs = header ? getComputedStyle(header) : null;
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || "").trim(),
        position: cs.position,
        headerPosition: hcs?.position || null,
        top: Math.round(r.top),
        height: Math.round(r.height),
        width: Math.round(r.width),
      };
    });
    const layers = [];
    for (const sel of [
      ".ops-topbar, .ops-app-header, header.ops-shell-header",
      ".cpq-builder-header",
      ".quote-builder-actions",
      ".ops-bottom-nav",
      ".cpq-mobile-sheet",
    ]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      layers.push({
        sel,
        position: cs.position,
        display: cs.display,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        z: cs.zIndex,
      });
    }
    return { unsaved, layers, scrollY };
  });
}

// Prefer /app/quotes/new for unsaved ₪0 state matching the bug screenshot class
const ROUTE = "/app/quotes/new";

{
  const { ctx, page } = await open("light", 390, 844, ROUTE);
  await waitQuote(page);

  const top = await stickyProbe(page);
  await page.screenshot({ path: path.join(OUT, "quote-mobile-390-top-light.png"), fullPage: false });
  report.shots.push({ name: "quote-mobile-390-top-light", ...top });
  report.stickyAudit.push({ scroll: "top", ...top });
  console.log("TOP", top.unsaved?.[0], "header", top.layers?.find((l) => l.sel.includes("cpq-builder-header")));

  await page.evaluate(() => {
    const main = document.querySelector(".ops-main");
    if (main && main.scrollHeight > main.clientHeight) {
      main.scrollBy(0, Math.round(main.clientHeight * 0.7));
    } else {
      window.scrollBy(0, Math.round(window.innerHeight * 0.7));
    }
  });
  await page.waitForTimeout(350);
  const mid = await stickyProbe(page);
  await page.screenshot({ path: path.join(OUT, "quote-mobile-390-mid-light.png"), fullPage: false });
  report.shots.push({ name: "quote-mobile-390-mid-light", ...mid });
  report.stickyAudit.push({ scroll: "mid", ...mid });
  console.log("MID unsaved top", mid.unsaved?.[0]?.top, "scrollY", mid.scrollY);

  await page.evaluate(() => {
    const main = document.querySelector(".ops-main");
    if (main && main.scrollHeight > main.clientHeight) {
      main.scrollTop = main.scrollHeight;
    } else {
      window.scrollTo(0, document.body.scrollHeight);
    }
  });
  await page.waitForTimeout(350);
  const bottom = await stickyProbe(page);
  await page.screenshot({ path: path.join(OUT, "quote-mobile-390-bottom-light.png"), fullPage: false });
  report.shots.push({ name: "quote-mobile-390-bottom-light", ...bottom });
  report.stickyAudit.push({ scroll: "bottom", ...bottom });
  console.log("BOTTOM unsaved top", bottom.unsaved?.[0]?.top, "scrollY", bottom.scrollY);

  const followed =
    top.unsaved?.[0] &&
    mid.unsaved?.[0] &&
    Math.abs(mid.unsaved[0].top - top.unsaved[0].top) < 8 &&
    mid.scrollY > 80 &&
    (mid.unsaved[0].headerPosition === "sticky" || mid.unsaved[0].headerPosition === "fixed");
  report.notes.push(
    followed
      ? "FAIL: unsaved indicator still tracks viewport while scrolling"
      : "PASS: unsaved indicator does not travel as a large sticky band",
  );
  console.log(followed ? "STICKY BUG STILL PRESENT" : "STICKY BUG FIXED");

  await ctx.close();
}

{
  const { ctx, page } = await open("dark", 390, 844, ROUTE);
  await waitQuote(page);
  await page.screenshot({ path: path.join(OUT, "quote-mobile-390-top-dark.png"), fullPage: false });
  report.shots.push({ name: "quote-mobile-390-top-dark", theme: "dark" });
  console.log("OK dark 390");
  await ctx.close();
}

for (const [name, w, h] of [
  ["quote-mobile-360-light", 360, 800],
  ["quote-mobile-375-light", 375, 812],
  ["quote-mobile-430-light", 430, 932],
  ["quote-tablet-768-light", 768, 1024],
  ["quote-desktop-1280-light", 1280, 800],
  ["quote-desktop-1440-light", 1440, 900],
]) {
  const { ctx, page } = await open("light", w, h, ROUTE);
  await waitQuote(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  report.shots.push({ name, width: w, height: h });
  console.log("OK", name);
  await ctx.close();
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("Wrote", path.join(OUT, "report.json"));
await browser.close();
