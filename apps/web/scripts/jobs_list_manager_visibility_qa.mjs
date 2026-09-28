/**
 * Visual QA — Global Jobs List (manager visibility)
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/jobs-list-manager-visibility-qa");
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

const browser = await chromium.launch({ headless: true });
const report = { shots: [], checks: {}, started: new Date().toISOString() };

async function shot(name, { width, height, colorScheme, pathSuffix = "", beforeShot }) {
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${WEB}/app/jobs${pathSuffix}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('[data-testid="jobs-list-page"]', { timeout: 60000 });
  if (beforeShot) await beforeShot(page);
  await page
    .waitForFunction(() => {
      const root = document.querySelector('[data-testid="jobs-list-page"]');
      if (!root) return false;
      const text = root.textContent || "";
      if (text.includes("טוען") && !text.includes("פתח עבודה") && !text.includes("אין עבודות") && !text.includes("לא נמצאו")) {
        return false;
      }
      return (
        Boolean(document.querySelector('[data-testid="jobs-list-rows"]')) ||
        Boolean(document.querySelector('[data-testid="jobs-list-empty"]')) ||
        Boolean(document.querySelector('[data-testid="jobs-list-filtered-empty"]')) ||
        Boolean(document.querySelector('[data-testid="jobs-list-summary"]'))
      );
    }, { timeout: 60000 })
    .catch(() => {});
  await page.waitForTimeout(500);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  const text = await page.locator('[data-testid="jobs-list-page"]').innerText();
  report.shots.push({
    name,
    file,
    width,
    colorScheme,
    overflow,
    errors,
    hasTitle: text.includes("עבודות"),
    hasOpen: text.includes("פתח עבודה"),
    hasEmpty: text.includes("אין עבודות להצגה"),
    hasFiltered: text.includes("לא נמצאו עבודות לפי הסינון"),
    hasUnassigned: text.includes("לא הוקצה"),
  });
  await ctx.close();
}

await shot("1440-dark-populated", { width: 1440, height: 900, colorScheme: "dark" });
await shot("1440-light-populated", { width: 1440, height: 900, colorScheme: "light" });
await shot("1100-dark-populated", { width: 1100, height: 900, colorScheme: "dark" });
await shot("1440-dark-filtered", {
  width: 1440,
  height: 900,
  colorScheme: "dark",
  beforeShot: async (page) => {
    await page.locator("#jobs-status").selectOption("cancelled");
    await page.waitForSelector('[data-testid="jobs-list-filtered-empty"]', { timeout: 30000 });
  },
});
await shot("390-dark-populated", { width: 390, height: 844, colorScheme: "dark" });
await shot("360-dark-populated", { width: 360, height: 740, colorScheme: "dark" });
await shot("390-light-empty", {
  width: 390,
  height: 844,
  colorScheme: "light",
  beforeShot: async (page) => {
    await page.locator("#jobs-status").selectOption("cancelled");
    await page.waitForSelector('[data-testid="jobs-list-filtered-empty"]', { timeout: 30000 });
  },
});
// Alias empty capture for checklist naming (true empty may not exist in QA WS).
await shot("1440-dark-empty", {
  width: 1440,
  height: 900,
  colorScheme: "dark",
  beforeShot: async (page) => {
    await page.locator("#jobs-status").selectOption("cancelled");
    await page.waitForSelector('[data-testid="jobs-list-filtered-empty"]', { timeout: 30000 });
  },
});

report.finished = new Date().toISOString();
report.checks.noOverflow = report.shots.every((s) => !s.overflow);
report.checks.noPageErrors = report.shots.every((s) => s.errors.length === 0);
report.checks.populatedHasOpen = report.shots
  .filter((s) => s.name.includes("populated"))
  .every((s) => s.hasOpen);
report.note =
  "1440-dark-empty / 390-light-empty capture filtered-empty (cancelled) because QA workspace has Jobs; product empty state covered by unit tests.";
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
