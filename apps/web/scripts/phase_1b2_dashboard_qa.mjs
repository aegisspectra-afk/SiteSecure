/**
 * Phase 1B.2 — Dashboard recomposition visual QA (authenticated, real empty workspace).
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

const shots = [
  { name: "dashboard-390-light", width: 390, height: 844, theme: "light" },
  { name: "dashboard-390-dark", width: 390, height: 844, theme: "dark" },
  { name: "dashboard-1440-light", width: 1440, height: 900, theme: "light" },
  { name: "dashboard-1440-dark", width: 1440, height: 900, theme: "dark" },
  { name: "dashboard-360-light", width: 360, height: 800, theme: "light" },
  { name: "dashboard-430-light", width: 430, height: 932, theme: "light" },
  { name: "dashboard-768-light", width: 768, height: 1024, theme: "light" },
  { name: "dashboard-1280-light", width: 1280, height: 800, theme: "light" },
];

const browser = await chromium.launch({ headless: true });
const report = { email: EMAIL, web: WEB, shots: [] };

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
  let ok = false;
  let error = null;
  try {
    await page.goto(`${WEB}/app/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForFunction(
      () =>
        Boolean(document.querySelector(".ops-dashboard-v2 .ops-command-hero.is-v2")) ||
        Boolean(document.body.innerText?.includes("לא ניתן לטעון")),
      { timeout: 60000 },
    );
    await page.waitForTimeout(500);
    await page.evaluate((theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem("site-secure-theme", theme);
      } catch {
        /* ignore */
      }
    }, shot.theme);
    await page.waitForTimeout(250);
    const file = path.join(OUT, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    ok = true;
    report.shots.push({ ...shot, file: path.relative(ROOT, file), ok });
    console.log("OK", shot.name);
  } catch (err) {
    error = String(err);
    report.shots.push({ ...shot, ok: false, error });
    console.error("FAIL", shot.name, error);
  }
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("Wrote", path.join(OUT, "report.json"));
const failed = report.shots.filter((s) => !s.ok);
process.exit(failed.length ? 1 : 0);
