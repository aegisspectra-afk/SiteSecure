/**
 * Phase 1B.2.1 — time-aware Command Hero visual QA.
 * Live current-time shots + forced surface variants (presentation-only DOM seam).
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

const OUT = path.join(ROOT, "Docs/phase-1b2-qa");
const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON) {
  console.error("Missing SUPABASE_URL / ANON key");
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

const liveShots = [
  { name: "hero-live-390-light", width: 390, height: 844, theme: "light" },
  { name: "hero-live-390-dark", width: 390, height: 844, theme: "dark" },
  { name: "hero-live-1440-light", width: 1440, height: 900, theme: "light" },
  { name: "hero-live-1440-dark", width: 1440, height: 900, theme: "dark" },
];

const forcedSurfaces = [
  { name: "hero-force-light-day", theme: "light", surface: "light-day", period: "morning" },
  { name: "hero-force-light-evening", theme: "light", surface: "dark-evening", period: "evening" },
  { name: "hero-force-light-night", theme: "light", surface: "dark-night", period: "night" },
  { name: "hero-force-dark-day", theme: "dark", surface: "dark-day", period: "morning" },
  { name: "hero-force-dark-evening", theme: "dark", surface: "dark-evening", period: "evening" },
  { name: "hero-force-dark-night", theme: "dark", surface: "dark-night", period: "night" },
];

const browser = await chromium.launch({ headless: true });
const report = { email: EMAIL, web: WEB, shots: [] };

async function openDashboard(theme, width, height) {
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
  await page.goto(`${WEB}/app/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(
    () => Boolean(document.querySelector(".ops-command-hero.is-v2[data-hero-surface]")),
    { timeout: 60000 },
  );
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    localStorage.setItem("site-secure-theme", t);
  }, theme);
  await page.waitForTimeout(300);
  return { ctx, page };
}

for (const shot of liveShots) {
  const { ctx, page } = await openDashboard(shot.theme, shot.width, shot.height);
  const file = path.join(OUT, `${shot.name}.png`);
  const surface = await page.getAttribute(".ops-command-hero", "data-hero-surface");
  const period = await page.getAttribute(".ops-command-hero", "data-time-period");
  await page.screenshot({ path: file, fullPage: false });
  report.shots.push({ ...shot, file: path.relative(ROOT, file), ok: true, surface, period });
  console.log("OK", shot.name, surface, period);
  await ctx.close();
}

for (const shot of forcedSurfaces) {
  const { ctx, page } = await openDashboard(shot.theme, 390, 844);
  await page.evaluate(({ surface, period, theme }) => {
    const hero = document.querySelector(".ops-command-hero");
    if (!hero) return;
    hero.setAttribute("data-hero-surface", surface);
    hero.setAttribute("data-time-period", period);
    hero.setAttribute("data-theme-tone", theme);
  }, shot);
  await page.waitForTimeout(350);
  const file = path.join(OUT, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  report.shots.push({ ...shot, width: 390, height: 844, file: path.relative(ROOT, file), ok: true });
  console.log("OK", shot.name);
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report-1b21.json"), JSON.stringify(report, null, 2));
console.log("Wrote", path.join(OUT, "report-1b21.json"));
