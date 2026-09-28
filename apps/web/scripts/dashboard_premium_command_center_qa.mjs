/**
 * Dashboard Premium Command Center — visual QA screenshots.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/dashboard-premium-command-center-qa");

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

const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

fs.mkdirSync(OUT, { recursive: true });

if (!SUPABASE_URL || !ANON) {
  console.error("Missing Supabase env");
  process.exit(1);
}

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
const report = { email: EMAIL, web: WEB, shots: [], notes: [] };

async function shot(name, theme, width, height, extra) {
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
        user: { id: "qa" },
      }),
    },
  );
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".ops-command-hero, .ops-attention-card, .ops-today-card", {
    timeout: 90000,
  });
  await page.waitForTimeout(2800);

  const readyText = await page.locator("text=מוכן לפעולה").count();
  if (readyText > 0) report.notes.push(`${name}: still shows מוכן לפעולה`);

  // Empty-column / greeting identity checks on mobile widths
  if (width <= 390) {
    const layout = await page.evaluate(() => {
      const compose = document.querySelector(".ops-command-hero-compose");
      const identity = document.querySelector(".ops-command-hero-identity");
      const hello = document.querySelector(".ops-command-hero-hello");
      if (!compose || !identity) return { ok: false, reason: "missing compose/identity" };
      const cs = getComputedStyle(compose);
      const cBox = compose.getBoundingClientRect();
      const iBox = identity.getBoundingClientRect();
      const sideGap = Math.abs(cBox.width - iBox.width);
      const helloText = hello?.textContent?.trim() || "";
      return {
        ok: true,
        flexDirection: cs.flexDirection,
        justifyContent: cs.justifyContent,
        sideGap,
        helloText,
        hasAt: helloText.includes("@"),
        hasPhase: /phase\d/i.test(helloText),
      };
    });
    if (!layout.ok) report.notes.push(`${name}: ${layout.reason}`);
    else {
      if (layout.flexDirection !== "column") {
        report.notes.push(`${name}: compose flexDirection=${layout.flexDirection} (expected column)`);
      }
      if (layout.justifyContent === "space-between") {
        report.notes.push(`${name}: compose still uses space-between (empty column risk)`);
      }
      if (layout.sideGap > 48) {
        report.notes.push(`${name}: identity narrower than compose by ${Math.round(layout.sideGap)}px`);
      }
      if (layout.hasAt || layout.hasPhase) {
        report.notes.push(`${name}: greeting leaked technical identity: ${layout.helloText}`);
      }
    }
  }

  if (extra === "status") {
    const btn = page.getByRole("button", { name: "מצב המערכת" });
    await btn.click();
    await page.waitForSelector('[role="dialog"][aria-label="מצב המערכת"]', { timeout: 5000 });
    await page.waitForTimeout(400);
  }

  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.shots.push({ name, file: path.relative(ROOT, file), width, height, theme, extra: extra || null });
  await ctx.close();
}

await shot("desktop-dark-1440", "dark", 1440, 900);
await shot("desktop-dark-1280", "dark", 1280, 800);
await shot("desktop-dark-1100", "dark", 1100, 800);
await shot("desktop-dark-1600", "dark", 1600, 900);
await shot("desktop-light-1440", "light", 1440, 900);
await shot("desktop-dark-status-popover", "dark", 1280, 800, "status");
await shot("mobile-dark-390", "dark", 390, 844);
await shot("mobile-dark-360", "dark", 360, 740);
await shot("mobile-light-390", "light", 390, 844);

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out: OUT, shots: report.shots.length, notes: report.notes }, null, 2));
