/**
 * Phase 3 — Field Operations visual QA (truthful reachable states only).
 * Does not mutate job lifecycle. Documents remote assignments.unassigned_at drift.
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

const OUT = path.join(ROOT, "Docs/phase-3-field-qa");
const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const OWNER_EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const TECH_EMAIL = env.QA_TECH_EMAIL || "phase1b.tech.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const JOB_ID = env.QA_JOB_ID || "ce72a357-c397-4935-a760-3fa3f140bd1c";

if (!SUPABASE_URL || !ANON) {
  console.error("Missing SUPABASE_URL / ANON");
  process.exit(1);
}

const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
fs.mkdirSync(OUT, { recursive: true });

async function passwordGrant(email) {
  const tokenRes = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    throw new Error(`Password grant failed for ${email}: ${tokenRes.status} ${JSON.stringify(tokenJson)}`);
  }
  return tokenJson;
}

const ownerTok = await passwordGrant(OWNER_EMAIL);
const techTok = await passwordGrant(TECH_EMAIL);

const browser = await chromium.launch({ headless: true });
const report = {
  owner: OWNER_EMAIL,
  tech: TECH_EMAIL,
  web: WEB,
  jobId: JOB_ID,
  shots: [],
  notes: [],
  security: {},
};

async function openAuthed(tokenJson, theme, width, height, route) {
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
  await page.waitForTimeout(450);
  return { ctx, page };
}

async function waitSettled(page) {
  await page.waitForFunction(
    () => {
      const t = (document.body?.innerText || "").replace(/\s+/g, " ");
      if (!t.trim()) return false;
      if (/\bטוען\b/.test(t) && t.length < 120) return false;
      return (
        Boolean(document.querySelector(".field-today")) ||
        Boolean(document.querySelector(".field-job")) ||
        Boolean(document.querySelector(".ss-error-state")) ||
        /אין עבודות להיום|הפעולה חסומה|אין גישה|SCOPE|חסומה לפי/.test(t)
      );
    },
    { timeout: 60000 },
  ).catch(() => {});
  await page.waitForTimeout(350);
}

async function shot(name, tokenJson, route, width, height, theme, settle) {
  const { ctx, page } = await openAuthed(tokenJson, theme, width, height, route);
  await waitSettled(page);
  if (settle) await settle(page);
  const meta = await page.evaluate(() => {
    const body = document.body?.innerText?.slice(0, 240) || "";
    return {
      url: location.href,
      hasFieldJob: Boolean(document.querySelector(".field-job")),
      hasToday: Boolean(document.querySelector(".field-today")),
      hasError: Boolean(document.querySelector("[class*='error'], .ss-error-state, [role='alert']")) || /חסומה|אין גישה/.test(body),
      hasSticky: Boolean(document.querySelector(".field-job-primary-cta")),
      hasQuick: Boolean(document.querySelector(".field-quick")),
      hasSheet: Boolean(document.querySelector(".field-sheet-root")),
      snippet: body.replace(/\s+/g, " ").trim(),
    };
  });
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  report.shots.push({ name, file, route, width, height, theme, ...meta });
  console.log("OK", name, meta.hasFieldJob || meta.hasToday ? "surface" : "other", meta.hasError ? "error" : "ok");
  await ctx.close();
}

// Technician Today (assignment scope → typically empty when unassigned_at drifts)
await shot("today-390-light", techTok, "/app/today", 390, 844, "light", async (page) => {
  await page.waitForSelector(".field-today, .ss-error-state, [role='alert']", { timeout: 60000 }).catch(() => {});
});
await shot("today-390-dark", techTok, "/app/today", 390, 844, "dark", async (page) => {
  await page.waitForSelector(".field-today, .ss-error-state, [role='alert']", { timeout: 60000 }).catch(() => {});
});
await shot("today-360-light", techTok, "/app/today", 360, 800, "light");
await shot("today-375-light", techTok, "/app/today", 375, 812, "light");
await shot("today-430-light", techTok, "/app/today", 430, 932, "light");
await shot("today-768-light", techTok, "/app/today", 768, 1024, "light");
await shot("today-1440-light", techTok, "/app/today", 1440, 900, "light");
await shot("today-1440-dark", techTok, "/app/today", 1440, 900, "dark");

// FieldJob — owner path (may surface BUSINESS_RULE if assignees query hits unassigned_at)
const jobRoute = `/app/jobs/${JOB_ID}`;
await shot("fieldjob-390-light", ownerTok, jobRoute, 390, 844, "light", async (page) => {
  await page.waitForSelector(".field-job, .ss-error-state, [role='alert'], .text-danger", { timeout: 60000 }).catch(() => {});
});
await shot("fieldjob-390-dark", ownerTok, jobRoute, 390, 844, "dark", async (page) => {
  await page.waitForSelector(".field-job, .ss-error-state, [role='alert'], .text-danger", { timeout: 60000 }).catch(() => {});
});
await shot("fieldjob-360-light", ownerTok, jobRoute, 360, 800, "light");
await shot("fieldjob-375-light", ownerTok, jobRoute, 375, 812, "light");
await shot("fieldjob-430-light", ownerTok, jobRoute, 430, 932, "light");
await shot("fieldjob-768-light", ownerTok, jobRoute, 768, 1024, "light");
await shot("fieldjob-1280-light", ownerTok, jobRoute, 1280, 800, "light");
await shot("fieldjob-1280-dark", ownerTok, jobRoute, 1280, 800, "dark");
await shot("fieldjob-1440-light", ownerTok, jobRoute, 1440, 900, "light");
await shot("fieldjob-1440-dark", ownerTok, jobRoute, 1440, 900, "dark");

// Security: technician direct-route to unassigned job must not render job object
{
  const { ctx, page } = await openAuthed(techTok, "light", 390, 844, jobRoute);
  await waitSettled(page);
  const sec = await page.evaluate(() => {
    const text = document.body?.innerText || "";
    return {
      url: location.href,
      hasJobObject: Boolean(document.querySelector(".field-job-object")),
      hasComplete: /סיים עבודה|התחל עבודה/.test(text),
      hasCost: /עלות|מרווח|₪|ש״ח/.test(text),
      denied: /אין גישה|חסומה|SCOPE/.test(text),
      snippet: text.replace(/\s+/g, " ").trim().slice(0, 280),
    };
  });
  report.security.techUnassignedJob = sec;
  await page.screenshot({ path: path.join(OUT, "security-tech-unassigned-390-light.png"), fullPage: false });
  report.shots.push({ name: "security-tech-unassigned-390-light", ...sec });
  console.log("SEC tech unassigned", sec.hasJobObject, sec.hasComplete, sec.hasCost, sec.denied);
  await ctx.close();
}

report.notes.push(
  "Remote assignments.unassigned_at column missing → assignee queries 400; getJob may return BUSINESS_RULE; technician Today stays empty; do not UI-workaround.",
);
report.notes.push("No dedicated /app/jobs index exists; office job entry is Dashboard attention / Service / Site links.");
report.notes.push("Populated FieldJob layout covered by unit test + CSS; live populated job requires schema fix outside Phase 3.");

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("Wrote", path.join(OUT, "report.json"), "shots", report.shots.length);
await browser.close();
