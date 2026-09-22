/**
 * Phase 1B.3.1 — empty/new-workspace premium visual QA.
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

const OUT = path.join(ROOT, "Docs/phase-1b31-qa");
const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
fs.mkdirSync(OUT, { recursive: true });

const tokenJson = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());
if (!tokenJson.access_token) {
  console.error(tokenJson);
  process.exit(1);
}

const shots = [
  { name: "empty-390-light-live", width: 390, height: 844, theme: "light" },
  { name: "empty-390-dark", width: 390, height: 844, theme: "dark" },
  { name: "empty-1440-light-live", width: 1440, height: 900, theme: "light" },
  { name: "empty-1440-dark", width: 1440, height: 900, theme: "dark" },
  { name: "empty-390-light-day", width: 390, height: 844, theme: "light", surface: "light-day", period: "morning" },
  { name: "empty-390-light-night", width: 390, height: 844, theme: "light", surface: "dark-night", period: "night" },
  { name: "empty-1440-light-day", width: 1440, height: 900, theme: "light", surface: "light-day", period: "morning" },
  { name: "empty-1440-light-night", width: 1440, height: 900, theme: "light", surface: "dark-night", period: "night" },
];

const browser = await chromium.launch({ headless: true });
for (const shot of shots) {
  const ctx = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    colorScheme: shot.theme === "dark" ? "dark" : "light",
  });
  await ctx.addInitScript(
    ({ key, value, theme }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", theme);
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      theme: shot.theme,
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
  await page.goto(`${WEB}/app/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => document.querySelector(".ops-dashboard-daily .ops-command-hero"), {
    timeout: 60000,
  });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    localStorage.setItem("site-secure-theme", t);
  }, shot.theme);
  if (shot.surface) {
    await page.evaluate(({ surface, period, theme }) => {
      const hero = document.querySelector(".ops-command-hero");
      if (!hero) return;
      hero.setAttribute("data-hero-surface", surface);
      hero.setAttribute("data-time-period", period);
      hero.setAttribute("data-theme-tone", theme);
    }, shot);
  }
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${shot.name}.png`), fullPage: false });
  console.log("OK", shot.name);
  await ctx.close();
}
await browser.close();
