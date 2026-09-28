/**
 * Visual QA for Project Minimum Workspace — verification only.
 * Captures: empty + populated at desktop/mobile/light/dark.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/project-minimum-workspace-qa");
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
const fixture = JSON.parse(fs.readFileSync(path.join(OUT, "fixture.json"), "utf8"));
const EMPTY = fixture.empty_project_id;
const POPULATED = fixture.populated_project_id;
const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];

fs.mkdirSync(OUT, { recursive: true });

const tok = await (
  await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: OWNER, password: PASSWORD }),
  })
).json();

const browser = await chromium.launch({ headless: true });
const report = { shots: [], checks: {}, started: new Date().toISOString() };

async function shot(name, projectId, { width, height, colorScheme }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme,
  });
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${WEB}/app/projects/${projectId}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForSelector('[data-testid="project-workspace"]', { timeout: 60000 });
  // Wait until secondary customer/site hydrate (or settle on empty project without ids).
  await page
    .waitForFunction(() => {
      const customer = document.querySelector('[data-testid="project-customer-label"]');
      const site = document.querySelector('[data-testid="project-site-label"]');
      if (!customer || !site) return false;
      const c = (customer.textContent || "").trim();
      const s = (site.textContent || "").trim();
      const loading = c.includes("טוען") || s.includes("טוען");
      return !loading;
    }, { timeout: 45000 })
    .catch(() => {});
  await page.waitForTimeout(500);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="project-workspace"]');
    if (!el) return true;
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
  });
  const text = await page.locator('[data-testid="project-workspace"]').innerText();
  report.shots.push({
    name,
    file,
    width,
    colorScheme,
    overflow,
    errors,
    hasJobsHeading: text.includes("עבודות"),
    hasEmpty: text.includes("טרם נוצרה עבודת התקנה"),
    hasOpenJob: text.includes("פתח עבודה"),
    hasSummary: /עבודות|אין עבודות/.test(text),
  });
  await ctx.close();
}

await shot("1440-dark-empty", EMPTY, { width: 1440, height: 900, colorScheme: "dark" });
await shot("1440-dark-populated", POPULATED, { width: 1440, height: 900, colorScheme: "dark" });
await shot("1440-light-populated", POPULATED, { width: 1440, height: 900, colorScheme: "light" });
await shot("1100-dark-populated", POPULATED, { width: 1100, height: 900, colorScheme: "dark" });
await shot("390-dark-empty", EMPTY, { width: 390, height: 844, colorScheme: "dark" });
await shot("390-dark-populated", POPULATED, { width: 390, height: 844, colorScheme: "dark" });
await shot("360-light-populated", POPULATED, { width: 360, height: 740, colorScheme: "light" });

report.finished = new Date().toISOString();
report.checks.noOverflow = report.shots.every((s) => !s.overflow);
report.checks.noPageErrors = report.shots.every((s) => s.errors.length === 0);
report.checks.emptyHasEmptyCopy = report.shots
  .filter((s) => s.name.includes("empty"))
  .every((s) => s.hasEmpty);
report.checks.populatedHasOpen = report.shots
  .filter((s) => s.name.includes("populated"))
  .every((s) => s.hasOpenJob);

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
