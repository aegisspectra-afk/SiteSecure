/**
 * SECURITY-SETTINGS-2 Visual QA — /app/settings/security
 * Viewports: 1440, 1032, 768, 390, 360 × dark/light
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/security-settings-2-qa");
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
const WEB = process.env.WEB_URL || "http://127.0.0.1:5174";
const SUPABASE_URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const OWNER = process.env.QA_OWNER_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = process.env.QA_OWNER_PASSWORD || "Phase1b-1790012816-Qa!";
const WS = process.env.QA_WORKSPACE_ID || "50339413-11c7-4903-820c-7541fbd2a476";
const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1];
if (!SUPABASE_URL || !ANON || !ref) {
  console.error("missing_supabase_env");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const tok = await (
  await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: OWNER, password: PASSWORD }),
  })
).json();
if (!tok.access_token) {
  console.error("auth_failed", tok);
  process.exit(1);
}

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1032, height: 800 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 740 },
];
const THEMES = ["dark", "light"];

const browser = await chromium.launch({ headless: true });
const report = {
  started: new Date().toISOString(),
  shots: [],
  checks: {},
  issues: [],
};

const context = await browser.newContext({
  locale: "he-IL",
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});
await context.addInitScript(
  ({ key, value, ws }) => {
    localStorage.setItem("ss.remember-device", "1");
    localStorage.setItem("site-secure-theme", "dark");
    localStorage.setItem("ss.last-workspace-id", ws);
    localStorage.setItem("ss.active_workspace_id", ws);
    localStorage.setItem(key, value);
    document.documentElement.setAttribute("dir", "rtl");
  },
  {
    key: `sb-${ref}-auth-token`,
    ws: WS,
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

const page = await context.newPage();
await page.goto(`${WEB}/app/settings/security`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-testid="settings-security"]', { timeout: 45000 });

const bodyText = await page.locator('[data-testid="settings-security"]').innerText();
report.checks.hasStatus = bodyText.includes("מצב אבטחה");
report.checks.hasAccount = bodyText.includes("החשבון שלי");
report.checks.hasAccess = bodyText.includes("גישה והרשאות");
report.checks.hasProtect = bodyText.includes("הגנות מערכת");
report.checks.hasPasswordCta = bodyText.includes("איפוס סיסמה");
report.checks.hasMfaUnavailable = bodyText.includes("לא זמין כרגע");
report.checks.noJwt = !/JWT/.test(bodyText);
report.checks.noAuthorize = !/authorize\(\)/.test(bodyText);
report.checks.noRlsPrimary = !/\bRLS\b/.test(bodyText);
report.checks.passwordHref = await page
  .locator('[data-testid="settings-security-password"] a')
  .getAttribute("href");
report.checks.emailVisible = (await page.locator(".settings-security-account-item .ltr-meta").first().innerText()).includes("@");
report.checks.rolesLink = await page.locator('a[href="/app/settings/roles"]').count();
report.checks.auditLink = await page.locator('[data-testid="settings-security-audit-link"]').count();
report.checks.rtl = (await page.locator("html").getAttribute("dir")) === "rtl";

for (const theme of THEMES) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    document.documentElement.classList.toggle("dark", t === "dark");
    localStorage.setItem("ss.theme", t);
  }, theme);
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(200);
    const name = `${vp.width}-${theme}`;
    const shot = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 2;
    });
    if (overflow) report.issues.push({ name, issue: "horizontal_overflow" });
    const ctaBox = await page.locator('[data-testid="settings-security-password"] a').boundingBox();
    if (ctaBox && ctaBox.height < 40) report.issues.push({ name, issue: "cta_tap_target_lt_40" });
    report.shots.push({ name, file: shot, overflow });
  }
}

await browser.close();
report.finished = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
