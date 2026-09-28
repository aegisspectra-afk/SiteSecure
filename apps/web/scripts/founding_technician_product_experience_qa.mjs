/**
 * Founding Technician product experience — browser QA.
 * Uses controlled FT + empty technician accounts (role=technician + badge).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/founding-technician-product-experience-qa");
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
const WEB = env.WEB_URL || "http://127.0.0.1:5173";
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

const FT = await passwordSession(FT_EMAIL, PASSWORD);
const EMPTY = await passwordSession(EMPTY_EMAIL, PASSWORD);
const report = {
  ft_email: FT_EMAIL,
  ft_badges: FT.sess.profile?.recognition_badges,
  ft_role: FT.sess.memberships?.[0]?.role_key,
  empty_ws: EMPTY.sess.memberships?.[0]?.workspace_name,
  golden: {},
  empty: {},
  authz: {},
  journey: {},
};

const dash = await fetch(
  `${API}/api/v1/workspaces/${FT.sess.memberships[0].workspace_id}/dashboard`,
  { headers: { Authorization: `Bearer ${FT.token}` } },
).then((r) => r.json());
report.api_today_count = dash?.today?.items?.length ?? null;
report.api_today_sample = (dash?.today?.items ?? []).slice(0, 1).map((i) => ({
  number: i.number,
  title: i.title_he,
  customer: i.customer_name,
  site: i.site_name,
  status: i.status,
}));

const jobApi = await fetch(
  `${API}/api/v1/workspaces/${FT.sess.memberships[0].workspace_id}/jobs/${JOB}`,
  { headers: { Authorization: `Bearer ${FT.token}` } },
).then(async (r) => ({ status: r.status, body: await r.json() }));
report.api_job = {
  status: jobApi.status,
  number: jobApi.body?.number,
  customer_name: jobApi.body?.customer_name,
  site_name: jobApi.body?.site_name,
  job_status: jobApi.body?.status,
};

const browser = await chromium.launch({ headless: true });

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await inject(ctx, FT);
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitTodaySettled(page);
  report.journey.landing = page.url().includes("/app/today") ? "PASS" : "FAIL";
  report.golden.landing_is_today = page.url().includes("/app/today");

  let body = await page.locator("body").innerText();
  report.golden.today_has_job = /J-00001|תיקון מצלמה/.test(body);
  report.golden.today_has_open_cta = /פתיחת העבודה/.test(body);
  report.journey.today_with_work = report.golden.today_has_job && report.golden.today_has_open_cta ? "PASS" : "PARTIAL";

  // Badge in sidebar identity
  report.golden.badge_visible = /טכנאי מייסד/.test(body);
  report.journey.badge = report.golden.badge_visible ? "PASS" : "PARTIAL";

  const hrefs = await page.locator('a[href*="/app/"]').evaluateAll((as) =>
    [...new Set(as.map((a) => a.getAttribute("href")))].sort(),
  );
  report.golden.hrefs = hrefs;
  report.golden.has_projects_href = hrefs.some((h) => h === "/app/projects");
  report.golden.has_warranties_href = hrefs.some((h) => (h || "").includes("warranties"));
  report.golden.has_settings_href = hrefs.some((h) => h === "/app/settings" || h === "/app/settings/");
  report.golden.has_service_href = hrefs.some((h) => h === "/app/service" || h === "/app/service/");
  await page.screenshot({ path: path.join(OUT, "A-today-with-work-1440.png"), fullPage: true });
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.theme = "dark";
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "A-today-with-work-1440-dark.png"), fullPage: true });
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
  });

  await page.goto(`${WEB}/app/jobs/${JOB}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(".field-job-object, .ss-error-state", { timeout: 60000 });
  body = await page.locator("body").innerText();
  report.golden.fieldjob_has_customer = /לקוח FT/.test(body);
  report.golden.fieldjob_has_site = /אתר FT/.test(body);
  report.golden.fieldjob_has_address = /הרצל|תל אביב/.test(body);
  report.golden.fieldjob_has_lifecycle = /בדרך|הגעתי|התחל|סיום|יציאה|סימון/.test(body);
  const cta = page.locator(".field-job-primary-cta button, .field-job-primary button").first();
  if (await cta.count()) {
    await cta.click();
    await page.waitForTimeout(2000);
    report.golden.lifecycle_clicked = true;
    report.journey.lifecycle = "PASS";
  } else {
    report.golden.lifecycle_clicked = false;
    report.journey.lifecycle = "PARTIAL";
  }
  await page.screenshot({ path: path.join(OUT, "C-fieldjob-active-1440.png"), fullPage: true });
  report.journey.fieldjob =
    report.golden.fieldjob_has_customer && report.golden.fieldjob_has_site ? "PASS" : "PARTIAL";

  await page.goto(`${WEB}/app/jobs`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='jobs-list-page']", { timeout: 60000 });
  body = await page.locator("body").innerText();
  report.golden.jobs_field_lead = /שובצו אליך/.test(body);
  report.golden.jobs_no_unassigned_filter = !/ללא הקצאה/.test(body);
  await page.screenshot({ path: path.join(OUT, "jobs-field-1440.png"), fullPage: true });
  report.journey.jobs = report.golden.jobs_field_lead ? "PASS" : "PARTIAL";

  await page.getByRole("button", { name: /שליחת משוב/ }).click();
  await page.waitForSelector(".feedback-panel", { timeout: 10000 });
  body = await page.locator(".feedback-panel").innerText();
  report.golden.feedback_categories =
    /בעיה/.test(body) && /לא ברור לי/.test(body) && /חסר לי משהו/.test(body) && /רעיון לשיפור/.test(body);
  await page.screenshot({ path: path.join(OUT, "E-feedback-1440.png"), fullPage: true });
  await page.locator(".feedback-backdrop").click({ force: true });
  report.journey.feedback = report.golden.feedback_categories ? "PASS" : "FAIL";

  await page.getByRole("banner").getByRole("button", { name: "תפריט משתמש" }).click();
  await page.waitForSelector('[role="dialog"][aria-label="תפריט משתמש"]', { timeout: 10000 });
  body = await page.locator('[role="dialog"][aria-label="תפריט משתמש"]').innerText();
  report.golden.profile_badge = /טכנאי מייסד/.test(body);
  report.golden.profile_role = /טכנאי/.test(body);
  await page.screenshot({ path: path.join(OUT, "D-profile-founding-1440.png"), fullPage: true });
  report.journey.profile =
    report.golden.profile_badge && report.golden.profile_role ? "PASS" : "PARTIAL";

  // Do not logout here — keeps session token valid for subsequent contexts.
  report.journey.logout = "SKIPPED_IN_QA";
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await inject(ctx, FT);
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/today`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitTodaySettled(page);
  await page.screenshot({ path: path.join(OUT, "A-today-with-work-390.png"), fullPage: true });
  await page.screenshot({ path: path.join(OUT, "F-technician-nav-390.png"), fullPage: true });

  await page.goto(`${WEB}/app/jobs/${JOB}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".field-job-object, .ss-error-state", { timeout: 60000 });
  report.golden.mobile_fieldjob_overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  await page.screenshot({ path: path.join(OUT, "C-fieldjob-active-390.png"), fullPage: true });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "C-fieldjob-active-360.png"), fullPage: true });
  report.journey.fieldjob_mobile = report.golden.mobile_fieldjob_overflow ? "FAIL" : "PASS";

  const ws = FT.sess.memberships[0].workspace_id;
  report.authz.quotes_status = (
    await fetch(`${API}/api/v1/workspaces/${ws}/quotes`, {
      headers: { Authorization: `Bearer ${FT.token}` },
    })
  ).status;
  report.authz.admin_status = (
    await fetch(`${API}/api/v1/admin/summary`, { headers: { Authorization: `Bearer ${FT.token}` } })
  ).status;
  await page.goto(`${WEB}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const adminBody = await page.locator("body").innerText();
  report.authz.admin_ui_denied =
    /אין גישה|לא מורשה|אין הרשאה|Platform Admin|לוח ניהול/.test(adminBody) ||
    !/ארגונים|תוכנית בטא/.test(adminBody);
  report.journey.authz =
    report.authz.quotes_status === 403 && report.authz.admin_status === 403 ? "PASS" : "FAIL";
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await inject(ctx, EMPTY);
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/today`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitTodaySettled(page);
  const body = await page.locator("body").innerText();
  report.empty.has_calm_empty = /אין לך עבודות משויכות כרגע/.test(body);
  report.empty.no_error = !/שגיאה|לא ניתן לטעון/.test(body);
  report.empty.no_manager_metrics = !/הצעות מחיר|מרווח|עלות/.test(body);
  await page.screenshot({ path: path.join(OUT, "B-today-empty-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "B-today-empty-390.png"), fullPage: true });
  report.journey.empty = report.empty.has_calm_empty && report.empty.no_error ? "PASS" : "PARTIAL";
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
