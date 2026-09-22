/**
 * Kai premium Quote Builder visual QA — screenshots only.
 * Copied runner targeting Docs/quote-builder-kai-premium-qa
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

const OUT = path.join(ROOT, "Docs/quote-builder-kai-premium-qa");
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

const browser = await chromium.launch({ headless: true });
const report = { email: EMAIL, web: WEB, quoteId: QUOTE_ID, shots: [], notes: [] };

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
  await page.goto(`${WEB}/app/quotes/${QUOTE_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
  }, theme);
  await page.waitForSelector(".cpq-workspace-v2, #quote-items", { timeout: 30000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.shots.push(name);
  console.log("shot", name);
}

const cases = [
  ["light", 1440, 900, "desktop-1440-light"],
  ["dark", 1440, 900, "desktop-1440-dark"],
  ["light", 1280, 800, "desktop-1280-light"],
  ["light", 1100, 800, "narrow-desktop-1100-light"],
  ["light", 390, 844, "mobile-390-light"],
  ["dark", 390, 844, "mobile-390-dark"],
  ["light", 360, 800, "mobile-360-light"],
];

for (const [theme, w, h, name] of cases) {
  const { ctx, page } = await open(theme, w, h);
  await shot(page, name);
  if (w >= 1100) {
    const geo = await page.evaluate(() => {
      const summary = document.querySelector(".cpq-workspace-sidebar, [aria-label*='סיכום']");
      const items = document.getElementById("quote-items");
      const title = document.querySelector(".cpq-header-quote-title, .cpq-header-mobile-number");
      return {
        summaryWidth: summary?.getBoundingClientRect().width ?? null,
        itemsWidth: items?.getBoundingClientRect().width ?? null,
        titleText: title?.textContent?.trim() ?? null,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    report.notes.push({ name, ...geo });
  } else {
    const mobile = await page.evaluate(() => {
      const dock = document.querySelector(".quote-builder-actions");
      const nav = document.querySelector(".ss-bottom-nav, [data-app-shell-nav], nav.premium-bottom-nav, .premium-mobile-nav");
      const main = document.querySelector("main, .cpq-workspace-v2");
      const dockBox = dock?.getBoundingClientRect();
      const navBox = nav?.getBoundingClientRect();
      const last = [...document.querySelectorAll("#quote-items, .cpq-context-kai, .cpq-content-kai")].pop();
      const lastBox = last?.getBoundingClientRect();
      return {
        dockH: dockBox?.height ?? null,
        dockBottom: dockBox?.bottom ?? null,
        navTop: navBox?.top ?? null,
        gap: dockBox && navBox ? Math.round(navBox.top - dockBox.bottom) : null,
        mainPadBottom: main ? getComputedStyle(main).paddingBottom : null,
        contentClearsDock:
          !dockBox || !lastBox ? null : lastBox.bottom <= dockBox.top + 2 || document.documentElement.scrollHeight > window.innerHeight,
      };
    });
    report.notes.push({ name, mobile });
  }
  await ctx.close();
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
