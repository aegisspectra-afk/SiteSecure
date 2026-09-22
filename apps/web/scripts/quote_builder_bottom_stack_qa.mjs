/**
 * Quote Builder — mobile bottom stack final correction QA.
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
const report = { email: EMAIL, web: WEB, shots: [], geometry: [], notes: [] };

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
  await page
    .waitForFunction(
      () => {
        const t = (document.body?.innerText || "").replace(/\s+/g, " ");
        return (
          Boolean(document.querySelector(".quote-builder, .cpq-builder")) ||
          /הצעת מחיר|טרם נשמר|פרטי הצעה|₪/.test(t)
        );
      },
      { timeout: 60000 },
    )
    .catch(() => {});
  await page.waitForSelector(".quote-builder-actions", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
}

function bottomProbe(page) {
  return page.evaluate(() => {
    const main = document.querySelector(".ops-main");
    const scrollY = main ? Math.round(main.scrollTop) : Math.round(window.scrollY);
    const scrollMax = main
      ? Math.round(main.scrollHeight - main.clientHeight)
      : Math.round(document.body.scrollHeight - window.innerHeight);

    function layer(sel) {
      const el = document.querySelector(sel);
      if (!el) return { sel, present: false };
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        sel,
        present: true,
        position: cs.position,
        display: cs.display,
        bottomCss: cs.bottom,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        width: Math.round(r.width),
        z: cs.zIndex,
        visible: r.height > 1 && cs.display !== "none" && cs.visibility !== "hidden",
      };
    }

    const dock = layer(".quote-builder-actions");
    const nav = layer(".ops-bottom-nav");
    const sheet = layer(".cpq-mobile-sheet");
    const sheetRoot = layer(".cpq-mobile-sheet-root");
    const handle = layer(".cpq-mobile-sheet-handle");

    const gap =
      dock.visible && nav.visible ? Math.round(nav.top - dock.bottom) : null;
    const overlap =
      dock.visible && nav.visible ? Math.max(0, Math.round(dock.bottom - nav.top)) : 0;

    const permanentSummaryTitle = [...document.querySelectorAll("body *")].some((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.closest(".cpq-mobile-sheet.is-open")) return false;
      const t = (el.textContent || "").trim();
      if (t !== "סיכום הצעה") return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.height > 1 && cs.display !== "none" && cs.visibility !== "hidden";
    });

    const builder = document.querySelector(".quote-builder.cpq-builder");
    const pad = builder ? getComputedStyle(builder).paddingBottom : null;

    return {
      scrollY,
      scrollMax,
      dock,
      nav,
      sheet,
      sheetRoot,
      handle,
      gap,
      overlap,
      permanentSummaryTitle,
      paddingBottom: pad,
      bodyOverflow: document.body.style.overflow || "",
    };
  });
}

async function scrollMain(page, mode) {
  await page.evaluate((m) => {
    const main = document.querySelector(".ops-main");
    if (main && main.scrollHeight > main.clientHeight) {
      if (m === "mid") main.scrollTop = Math.round(main.clientHeight * 0.7);
      else if (m === "bottom") main.scrollTop = main.scrollHeight;
      else main.scrollTop = 0;
    } else if (m === "mid") {
      window.scrollBy(0, Math.round(window.innerHeight * 0.7));
    } else if (m === "bottom") {
      window.scrollTo(0, document.body.scrollHeight);
    } else {
      window.scrollTo(0, 0);
    }
  }, mode);
  await page.waitForTimeout(350);
}

const ROUTE = "/app/quotes/new";

async function shot(page, name, extra = {}) {
  const geo = await bottomProbe(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  report.shots.push({ name, ...extra, ...geo });
  report.geometry.push({ name, ...geo });
  console.log(
    name,
    "dock.h",
    geo.dock?.height,
    "gap",
    geo.gap,
    "overlap",
    geo.overlap,
    "sheet.vis",
    geo.sheet?.visible,
    "summaryGhost",
    geo.permanentSummaryTitle,
  );
  return geo;
}

{
  const { ctx, page } = await open("light", 390, 844, ROUTE);
  await waitQuote(page);

  await scrollMain(page, "mid");
  const mid = await shot(page, "quote-bottom-390-mid-closed-light", { scroll: "mid" });

  await scrollMain(page, "bottom");
  const closed = await shot(page, "quote-bottom-390-closed-light", { scroll: "bottom" });

  // Open summary via total affordance
  await page.locator(".cpq-mobile-actions-total").click();
  await page.waitForTimeout(450);
  const openGeo = await shot(page, "quote-bottom-390-summary-open-light", { scroll: "bottom", summary: "open" });

  // Prefer Escape — reliable dismiss regardless of panel hit-testing
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !document.querySelector(".cpq-mobile-sheet.is-open"),
    { timeout: 5000 },
  ).catch(() => {});
  // Fallback: click open handle if still open
  if (await page.locator(".cpq-mobile-sheet.is-open").count()) {
    await page.locator(".cpq-mobile-sheet.is-open .cpq-mobile-sheet-handle").click();
    await page.waitForFunction(
      () => !document.querySelector(".cpq-mobile-sheet.is-open"),
      { timeout: 5000 },
    ).catch(() => {});
  }
  await page.waitForTimeout(350);
  const after = await shot(page, "quote-bottom-390-closed-after-summary-light", {
    scroll: "bottom",
    summary: "closed-after",
  });

  const passClosed =
    closed.dock?.visible &&
    closed.nav?.visible &&
    !closed.sheet?.visible &&
    !closed.handle?.visible &&
    !closed.permanentSummaryTitle &&
    closed.overlap === 0 &&
    (closed.gap ?? 0) >= 4;

  const passOpen = openGeo.sheet?.visible === true;
  const passAfter =
    after.sheet?.visible !== true &&
    !after.permanentSummaryTitle &&
    after.bodyOverflow === "" &&
    after.overlap === 0;

  report.notes.push(
    passClosed
      ? "PASS 390 closed: one dock + one nav, no summary layer, no overlap"
      : "FAIL 390 closed architecture",
  );
  report.notes.push(passOpen ? "PASS 390 summary open" : "FAIL 390 summary open");
  report.notes.push(
    passAfter
      ? "PASS 390 after dismiss: no ghost / no stuck overflow / no overlap"
      : "FAIL 390 after dismiss",
  );
  report.notes.push(
    mid.scrollY > 40
      ? `PASS mid-scroll verified (scrollY=${mid.scrollY})`
      : `WARN mid-scroll low (scrollY=${mid.scrollY})`,
  );

  await ctx.close();
}

{
  const { ctx, page } = await open("dark", 390, 844, ROUTE);
  await waitQuote(page);
  await scrollMain(page, "bottom");
  await shot(page, "quote-bottom-390-closed-dark", { theme: "dark" });
  await ctx.close();
}

{
  const { ctx, page } = await open("light", 360, 800, ROUTE);
  await waitQuote(page);
  await scrollMain(page, "bottom");
  const g360 = await shot(page, "quote-bottom-360-closed-light", { width: 360 });
  report.notes.push(
    g360.dock?.visible && g360.nav?.visible && g360.overlap === 0 && (g360.gap ?? 0) >= 4
      ? "PASS 360 closed: dock + nav separated"
      : "FAIL 360 closed architecture",
  );
  await ctx.close();
}

for (const [name, w, h] of [
  ["quote-bottom-768-light", 768, 1024],
  ["quote-bottom-1440-light", 1440, 900],
]) {
  const { ctx, page } = await open("light", w, h, ROUTE);
  await waitQuote(page);
  if (w < 1024) await scrollMain(page, "bottom");
  await shot(page, name, { width: w, height: h });
  await ctx.close();
}

fs.writeFileSync(path.join(OUT, "bottom-stack-report.json"), JSON.stringify(report, null, 2));
console.log("Wrote", path.join(OUT, "bottom-stack-report.json"));
console.log("NOTES:", report.notes);
await browser.close();
