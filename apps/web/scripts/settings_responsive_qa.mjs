/**
 * Visual QA — Settings responsive shell
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/core-app-ux-qa/settings");
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
const report = { shots: [], started: new Date().toISOString() };

async function shot(name, { width, height, colorScheme }) {
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
  await page.goto(`${WEB}/app/settings`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('[data-testid="settings-shell"]', { timeout: 60000 });
  await page.waitForSelector('[data-testid="settings-general"], .settings-panel', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(400);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  const selectVisible = await page.locator('[data-testid="settings-nav-select"]').evaluate((el) => {
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden";
  });
  const desktopVisible = await page.locator('[data-testid="settings-nav-desktop"]').evaluate((el) => {
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden";
  });
  report.shots.push({
    name,
    file,
    width,
    colorScheme,
    overflow,
    selectVisible,
    desktopVisible,
    hasTitle: (await page.locator(".settings-aside-title").innerText()).includes("הגדרות"),
  });
  await ctx.close();
}

await shot("1440-dark", { width: 1440, height: 900, colorScheme: "dark" });
await shot("1440-light", { width: 1440, height: 900, colorScheme: "light" });
await shot("390-dark", { width: 390, height: 844, colorScheme: "dark" });
await shot("360-dark", { width: 360, height: 740, colorScheme: "dark" });

report.pass = {
  desktop: report.shots.filter((s) => s.width === 1440).every((s) => !s.overflow && s.desktopVisible && !s.selectVisible),
  mobile: report.shots.filter((s) => s.width <= 390).every((s) => !s.overflow && s.selectVisible && !s.desktopVisible),
};
report.finished = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.pass, null, 2));
await browser.close();
process.exit(report.pass.desktop && report.pass.mobile ? 0 : 1);
