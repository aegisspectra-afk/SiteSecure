/**
 * FT #1 live observation — founding technician stuck-point probe.
 * Extends product-experience journey with SETTINGS-3C personal settings access.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/ft1-observation-qa");
fs.mkdirSync(OUT, { recursive: true });

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

const env = { ...loadEnv(path.join(ROOT, ".env")), ...process.env };
const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1];
const API = env.API_URL || "http://127.0.0.1:8000";
const WEB = env.WEB_URL || "http://localhost:5174";
const FT_EMAIL = env.FT_EMAIL || "ft.product.e3588aa5@sitesecure.test";
const EMPTY_EMAIL = env.FT_EMPTY_EMAIL || "ft.empty.e3588aa5@sitesecure.test";
const PASSWORD = env.FT_PASSWORD || "FtProduct!2026";
const JOB = env.FT_JOB_ID || "4c953825-6fb6-488c-b2e5-2cd50b43c4b3";

if (!supabaseUrl || !anon || !ref) {
  console.error("Missing Supabase env");
  process.exit(1);
}

async function passwordSession(email, password) {
  const grant = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
  if (!grant.access_token) throw new Error(`grant failed ${email}: ${JSON.stringify(grant)}`);
  const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${grant.access_token}` },
  }).then((r) => r.json());
  const sess = await fetch(`${API}/api/v1/auth/session`, {
    headers: { Authorization: `Bearer ${grant.access_token}` },
  }).then((r) => r.json());
  return { grant, user, sess, token: grant.access_token };
}

async function inject(ctx, pack) {
  await ctx.addInitScript(
    ({ key, value, workspaceId }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", "dark");
      if (workspaceId) localStorage.setItem("ss.last-workspace-id", workspaceId);
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      value: JSON.stringify({
        access_token: pack.token,
        refresh_token: pack.grant.refresh_token || "qa",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user: pack.user,
      }),
      workspaceId: pack.sess.memberships?.[0]?.workspace_id,
    },
  );
}

async function waitTodaySettled(page) {
  await page.waitForSelector(".field-today, .ss-error-state, form[action*='login'], [data-testid='login']", {
    timeout: 60000,
  });
  const hasToday = await page.locator(".field-today").count();
  if (!hasToday) {
    const url = page.url();
    const snip = (await page.locator("body").innerText()).slice(0, 400);
    throw new Error(`Today surface missing at ${url}: ${snip}`);
  }
  await page.waitForFunction(
    () => {
      const busy = document.querySelector('.field-today[aria-busy="true"]');
      const card = document.querySelector(".field-job-card");
      const empty = document.querySelector(".field-empty");
      const err = document.querySelector(".ss-error-state, [role='alert']");
      return (!busy && (card || empty)) || Boolean(err);
    },
    { timeout: 60000 },
  );
}

function stuck(report, step, severity, detail) {
  report.stuck.push({ step, severity, detail, at: new Date().toISOString() });
}

const FT = await passwordSession(FT_EMAIL, PASSWORD);
const EMPTY = await passwordSession(EMPTY_EMAIL, PASSWORD);
const report = {
  started: new Date().toISOString(),
  web: WEB,
  ft_email: FT_EMAIL,
  ft_role: FT.sess.memberships?.[0]?.role_key,
  ft_badges: FT.sess.profile?.recognition_badges,
  ft_ws: FT.sess.memberships?.[0]?.workspace_name,
  journey: {},
  stuck: [],
  notes: [],
};

const browser = await chromium.launch({ headless: true });

{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await inject(ctx, FT);
  const page = await ctx.newPage();

  // 1) Landing
  await page.goto(`${WEB}/app`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitTodaySettled(page);
  const landOk = page.url().includes("/app/today");
  report.journey.landing = landOk ? "PASS" : "FAIL";
  if (!landOk) stuck(report, "landing", "blocker", `expected /app/today got ${page.url()}`);
  await page.screenshot({ path: path.join(OUT, "01-today-390.png"), fullPage: true });

  let body = await page.locator("body").innerText();
  const hasJob = /J-00001|תיקון מצלמה|פתיחת העבודה/.test(body);
  report.journey.today_work = hasJob ? "PASS" : "STUCK";
  if (!hasJob) stuck(report, "today_work", "blocker", "no assigned job / open CTA on Today");
  if (!/טכנאי מייסד/.test(body)) {
    stuck(report, "badge_sidebar", "minor", "founding badge not visible on Today body/sidebar");
    report.journey.badge = "PARTIAL";
  } else report.journey.badge = "PASS";

  // 2) Open job
  const openCta = page.getByRole("link", { name: /פתיחת העבודה/ }).or(page.getByRole("button", { name: /פתיחת העבודה/ }));
  if (await openCta.count()) {
    await openCta.first().click();
    await page.waitForSelector(".field-job-object, .ss-error-state", { timeout: 60000 });
    body = await page.locator("body").innerText();
    const ctxOk = /לקוח|אתר/.test(body);
    report.journey.open_job = ctxOk ? "PASS" : "PARTIAL";
    if (!ctxOk) stuck(report, "open_job", "major", "FieldJob opened but customer/site context weak");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    if (overflow) stuck(report, "fieldjob_overflow", "major", "horizontal overflow on FieldJob mobile");
    await page.screenshot({ path: path.join(OUT, "02-fieldjob-390.png"), fullPage: true });
  } else {
    report.journey.open_job = "STUCK";
    stuck(report, "open_job", "blocker", "פתיחת העבודה CTA missing");
  }

  // 3) Jobs list
  await page.goto(`${WEB}/app/jobs`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='jobs-list-page'], .ss-error-state", { timeout: 60000 });
  body = await page.locator("body").innerText();
  report.journey.jobs_list = /שובצו אליך|עבודות/.test(body) ? "PASS" : "PARTIAL";
  if (/ללא הקצאה/.test(body)) stuck(report, "jobs_list", "major", "unassigned filter visible to field tech");
  await page.screenshot({ path: path.join(OUT, "03-jobs-390.png"), fullPage: true });

  // 4) Settings hub (SETTINGS-3C personal access)
  await page.goto(`${WEB}/app/settings`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const settingsOk = await page
    .waitForSelector('[data-testid="settings-hub"], [data-testid="settings-shell"]', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  body = await page.locator("body").innerText();
  const forbidden = /אין הרשאה|Forbidden|403/.test(body);
  if (!settingsOk || forbidden) {
    report.journey.settings_hub = "STUCK";
    stuck(report, "settings_hub", "major", "technician cannot open personal settings hub after 3C");
  } else {
    const hasProfile = /פרופיל אישי|עריכת פרופיל|מראה/.test(body);
    const hasWorkspaceLeak = /הצעות מחיר|מספור|פרטי חברה|כללי/.test(body) && /workspace\.edit/i.test(body);
    // Workspace rows should be hidden for technician
    const workspaceRowsVisible = await page.locator('a[href="/app/settings/general"], a[href="/app/settings/quotes"]').count();
    report.journey.settings_hub = hasProfile ? "PASS" : "PARTIAL";
    if (!hasProfile) stuck(report, "settings_hub", "major", "hub loaded but personal rows missing");
    if (workspaceRowsVisible > 0) {
      stuck(report, "settings_authz", "blocker", "technician sees workspace settings rows");
      report.journey.settings_authz = "FAIL";
    } else report.journey.settings_authz = "PASS";
    await page.screenshot({ path: path.join(OUT, "04-settings-hub-390.png"), fullPage: true });

    await page.goto(`${WEB}/app/settings/profile`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const profileOk = await page.waitForSelector('[data-testid="settings-profile"]', { timeout: 20000 }).then(() => true).catch(() => false);
    report.journey.settings_profile = profileOk ? "PASS" : "STUCK";
    if (!profileOk) stuck(report, "settings_profile", "major", "profile page not reachable");
    await page.screenshot({ path: path.join(OUT, "05-settings-profile-390.png"), fullPage: true });

    await page.goto(`${WEB}/app/settings/appearance`, { waitUntil: "domcontentloaded", timeout: 60000 });
    body = await page.locator("body").innerText();
    report.journey.settings_appearance = /מראה|ערכת נושא|בהיר|כהה/.test(body) ? "PASS" : "PARTIAL";
    await page.screenshot({ path: path.join(OUT, "06-settings-appearance-390.png"), fullPage: true });

    // Must not access general
    await page.goto(`${WEB}/app/settings/general`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(800);
    body = await page.locator("body").innerText();
    const generalDenied = /אין הרשאה|Forbidden/.test(body) || !(await page.locator("#ws-name").count());
    report.journey.settings_general_denied = generalDenied ? "PASS" : "FAIL";
    if (!generalDenied) stuck(report, "settings_general", "blocker", "technician can edit workspace general");
    await page.screenshot({ path: path.join(OUT, "07-settings-general-deny-390.png"), fullPage: true });
  }

  // 5) Authz quotes
  const quotes = await fetch(`${API}/api/v1/workspaces/${FT.sess.memberships[0].workspace_id}/quotes`, {
    headers: { Authorization: `Bearer ${FT.token}` },
  });
  report.journey.quotes_403 = quotes.status === 403 ? "PASS" : "FAIL";
  if (quotes.status !== 403) stuck(report, "authz_quotes", "blocker", `quotes status ${quotes.status}`);

  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await inject(ctx, EMPTY);
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/today`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitTodaySettled(page);
  const body = await page.locator("body").innerText();
  const emptyOk = /אין לך עבודות|משויכות/.test(body) && !/error|שגיאה חמורה/i.test(body);
  report.journey.empty_today = emptyOk ? "PASS" : "STUCK";
  if (!emptyOk) stuck(report, "empty_today", "major", "empty FT today not calm / missing copy");
  await page.screenshot({ path: path.join(OUT, "08-empty-today-390.png"), fullPage: true });
  await ctx.close();
}

report.finished = new Date().toISOString();
report.blocker_count = report.stuck.filter((s) => s.severity === "blocker").length;
report.major_count = report.stuck.filter((s) => s.severity === "major").length;
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ journey: report.journey, stuck: report.stuck, blocker_count: report.blocker_count }, null, 2));
await browser.close();
process.exit(report.blocker_count > 0 ? 1 : 0);
