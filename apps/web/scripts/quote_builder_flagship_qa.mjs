/**
 * Flagship Quote Builder QA — P0 occlusion + journey screenshots.
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

const OUT = path.join(ROOT, "Docs/quote-builder-flagship-qa");
const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
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

const browser = await chromium.launch({ headless: true });
const report = { email: EMAIL, web: WEB, notes: [], geometry: [], shots: [] };

async function open(theme, width, height) {
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
  await page.goto(`${WEB}/app/quotes/new`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
  }, theme);
  await page.waitForSelector(".quote-builder, .cpq-builder", { timeout: 60000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}

async function scrollMain(page, mode) {
  await page.evaluate((m) => {
    const main = document.querySelector(".ops-main");
    if (!main) return;
    if (m === "top") main.scrollTop = 0;
    else if (m === "mid") main.scrollTop = Math.round(main.scrollHeight * 0.45);
    else main.scrollTop = main.scrollHeight;
  }, mode);
  await page.waitForTimeout(350);
}

function occlusionProbe(page) {
  return page.evaluate(() => {
    const main = document.querySelector(".ops-main");
    const dock = document.querySelector(".quote-builder-actions");
    const nav = document.querySelector(".ops-bottom-nav");
    const builder = document.querySelector(".quote-builder.cpq-builder");
    const vh = window.innerHeight;
    const dockR = dock?.getBoundingClientRect();
    const navR = nav?.getBoundingClientRect();
    const bandTop = dockR?.top ?? navR?.top ?? vh;

    let lastContentBottom = 0;
    const textBehindNav = [];
    if (builder) {
      builder.querySelectorAll("p, span, label, input, button, h1, h2, h3, td, li, a").forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        if (el.closest(".quote-builder-actions, .cpq-mobile-sheet-root, .ops-bottom-nav")) return;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return;
        const r = el.getBoundingClientRect();
        if (r.height < 2 || r.width < 2) return;
        lastContentBottom = Math.max(lastContentBottom, r.bottom);
        if (navR && r.bottom > navR.top + 1 && r.top < navR.bottom - 1) {
          const t = (el.innerText || el.value || "").trim().slice(0, 40);
          if (t) textBehindNav.push({ t, top: Math.round(r.top), bottom: Math.round(r.bottom) });
        }
      });
    }

    const csMain = main ? getComputedStyle(main) : null;
    const root = getComputedStyle(document.documentElement);
    return {
      scrollTop: main ? Math.round(main.scrollTop) : 0,
      mainPadBottom: csMain?.paddingBottom ?? null,
      clearanceToken: root.getPropertyValue("--quote-mobile-bottom-clearance").trim() || null,
      dock: dockR
        ? {
            top: Math.round(dockR.top),
            bottom: Math.round(dockR.bottom),
            height: Math.round(dockR.height),
            bg: getComputedStyle(dock).backgroundColor,
          }
        : null,
      nav: navR
        ? { top: Math.round(navR.top), bottom: Math.round(navR.bottom), height: Math.round(navR.height) }
        : null,
      gap: dockR && navR ? Math.round(navR.top - dockR.bottom) : null,
      lastContentBottom: Math.round(lastContentBottom),
      clearanceAboveDock: dockR ? Math.round(dockR.top - lastContentBottom) : null,
      textBehindNavCount: textBehindNav.length,
      textBehindNav: textBehindNav.slice(0, 8),
      bandTop: Math.round(bandTop),
    };
  });
}

async function shot(page, name, extra = {}) {
  const geo = await occlusionProbe(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  report.shots.push({ name, ...extra });
  report.geometry.push({ name, ...geo });
  const ok =
    geo.textBehindNavCount === 0 &&
    (geo.clearanceAboveDock == null || geo.clearanceAboveDock >= 8) &&
    (geo.gap == null || geo.gap >= 4);
  console.log(
    name,
    "clear",
    geo.clearanceAboveDock,
    "gap",
    geo.gap,
    "behindNav",
    geo.textBehindNavCount,
    "pad",
    geo.mainPadBottom,
    ok ? "OK" : "CHECK",
  );
  return geo;
}

// ——— 390 Light journey ———
{
  const { ctx, page } = await open("light", 390, 844);
  await scrollMain(page, "top");
  await shot(page, "flagship-390-top-light");

  // Customer zone
  await page.locator("#cpq-zone-details, .cpq-zone-context, .cpq-context-bar").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(200);
  await shot(page, "flagship-390-customer-light");

  await scrollMain(page, "mid");
  await shot(page, "flagship-390-mid-light");

  // Items / empty scope
  await page.locator("#quote-items").scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(200);
  await shot(page, "flagship-390-items-light");

  await scrollMain(page, "bottom");
  const bottom = await shot(page, "flagship-390-bottom-light");
  report.notes.push(
    bottom.textBehindNavCount === 0 && (bottom.clearanceAboveDock ?? 0) >= 8
      ? "PASS P0 390: no text behind nav; content clears dock"
      : `FAIL P0 390: behind=${bottom.textBehindNavCount} clear=${bottom.clearanceAboveDock}`,
  );

  // Summary open/close
  await page.locator(".cpq-mobile-actions-total").click();
  await page.waitForTimeout(400);
  await shot(page, "flagship-390-summary-open-light");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".cpq-mobile-sheet.is-open"), { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  const after = await shot(page, "flagship-390-summary-closed-after-light");
  report.notes.push(
    after.textBehindNavCount === 0
      ? "PASS 390 summary dismiss occlusion"
      : "FAIL 390 summary dismiss occlusion",
  );

  await ctx.close();
}

// ——— 390 Dark ———
{
  const { ctx, page } = await open("dark", 390, 844);
  await scrollMain(page, "bottom");
  await shot(page, "flagship-390-bottom-dark", { theme: "dark" });
  await ctx.close();
}

// ——— Mobile sizes bottom P0 ———
for (const [name, w, h] of [
  ["flagship-360-bottom-light", 360, 800],
  ["flagship-375-bottom-light", 375, 812],
  ["flagship-430-bottom-light", 430, 932],
]) {
  const { ctx, page } = await open("light", w, h);
  await scrollMain(page, "bottom");
  const g = await shot(page, name, { width: w, height: h });
  report.notes.push(
    g.textBehindNavCount === 0 && (g.clearanceAboveDock ?? 0) >= 8
      ? `PASS P0 ${w}: clears dock/nav`
      : `FAIL P0 ${w}: behind=${g.textBehindNavCount} clear=${g.clearanceAboveDock}`,
  );
  await ctx.close();
}

// ——— Desktop ———
for (const [name, w, h, theme] of [
  ["flagship-1280-light", 1280, 800, "light"],
  ["flagship-1440-light", 1440, 900, "light"],
  ["flagship-1440-dark", 1440, 900, "dark"],
]) {
  const { ctx, page } = await open(theme, w, h);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  report.shots.push({ name, width: w, height: h, theme });
  console.log("OK", name);
  await ctx.close();
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("NOTES:", report.notes);
await browser.close();
