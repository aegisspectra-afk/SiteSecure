/**
 * Browser QA — Checkpoint B Work Navigation
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/core-app-ux-qa/work-navigation");
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
const OWNER_PASS = "Phase1b-1790012816-Qa!";
const WS = "50339413-11c7-4903-820c-7541fbd2a476";
const TECH = process.env.QA_TECH_EMAIL || "phase1b.tech.1790012816@sitesecure.test";
const TECH_PASS = process.env.QA_TECH_PASSWORD || "Phase1b-1790012816-Qa!";
const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
fs.mkdirSync(OUT, { recursive: true });

async function login(email, password) {
  const tok = await (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  ).json();
  if (!tok.access_token) throw new Error(`auth_failed:${email}:${JSON.stringify(tok)}`);
  return tok;
}

const browser = await chromium.launch({ headless: true });
const report = { shots: [], checks: {}, started: new Date().toISOString() };

async function openApp(tok, { width, height, colorScheme, path: go }) {
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
  await page.goto(`${WEB}${go}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("main#main, .ops-shell", { timeout: 90000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}

function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
}

const ownerTok = await login(OWNER, OWNER_PASS);
let techTok = null;
try {
  techTok = await login(TECH, TECH_PASS);
} catch (err) {
  report.checks.techAuth = String(err);
}

// Owner desktop 1440
{
  const { ctx, page } = await openApp(ownerTok, {
    width: 1440,
    height: 900,
    colorScheme: "dark",
    path: "/app/dashboard",
  });
  const groupLabels = await page.locator(".ops-sidebar-group-label").allTextContents();
  const linkLabels = await page.locator(".ops-sidebar-link").allTextContents();
  const hasWork = groupLabels.some((t) => t.includes("עבודה"));
  const hasCustomers = groupLabels.some((t) => t.includes("לקוחות"));
  const hasTasks = groupLabels.some((t) => t.includes("משימות"));
  const hasMore = groupLabels.some((t) => t.includes("עוד"));
  await page.getByRole("link", { name: "עבודות" }).click();
  await page.waitForURL(/\/app\/jobs/, { timeout: 30000 });
  const jobsActive = await page.locator('.ops-sidebar-link.is-active[href*="/app/jobs"]').count();
  await page.goto(`${WEB}/app/projects`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main#main", { timeout: 60000 });
  await page.goBack();
  await page.waitForTimeout(400);
  const backOk = page.url().includes("/app/jobs") || page.url().includes("/app/dashboard");
  await page.goto(`${WEB}/app/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".settings-panel, [data-testid='settings-shell']", { timeout: 60000 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, "owner-1440-dark-work.png"), fullPage: false });
  report.shots.push("owner-1440-dark-work.png");
  report.checks.ownerDesktop = {
    groupLabels,
    linkLabels,
    hasWork,
    hasCustomers,
    hasTasks,
    hasMore,
    jobsActive: jobsActive > 0,
    backOk,
    overflow: await overflow(page),
    settingsReachable: page.url().includes("/app/settings"),
  };
  await ctx.close();
}

// Owner mobile 390 + work sheet
{
  const { ctx, page } = await openApp(ownerTok, {
    width: 390,
    height: 844,
    colorScheme: "dark",
    path: "/app/dashboard",
  });
  await page.getByRole("button", { name: "עבודה" }).click();
  await page.waitForSelector(".mcc-row", { timeout: 15000 });
  const workRows = await page.locator(".mcc-row-label").allTextContents();
  await page.screenshot({ path: path.join(OUT, "owner-390-dark-work-sheet.png"), fullPage: false });
  report.shots.push("owner-390-dark-work-sheet.png");
  await page.getByRole("link", { name: "עבודות" }).click();
  await page.waitForURL(/\/app\/jobs/, { timeout: 30000 });
  await page.goto(`${WEB}/app/customers`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main#main", { timeout: 60000 });
  await page.screenshot({ path: path.join(OUT, "owner-390-dark-customers.png"), fullPage: false });
  report.shots.push("owner-390-dark-customers.png");
  report.checks.ownerMobile390 = {
    workRows,
    hasJobs: workRows.some((t) => t.includes("עבודות")),
    hasProjects: workRows.some((t) => t.includes("פרויקט")),
    hasService: workRows.some((t) => t.includes("שירות")),
    overflow: await overflow(page),
    customersOk: page.url().includes("/app/customers"),
  };
  await ctx.close();
}

// Owner 360
{
  const { ctx, page } = await openApp(ownerTok, {
    width: 360,
    height: 740,
    colorScheme: "dark",
    path: "/app/jobs",
  });
  await page.screenshot({ path: path.join(OUT, "owner-360-dark-jobs.png"), fullPage: false });
  report.shots.push("owner-360-dark-jobs.png");
  report.checks.ownerMobile360 = { overflow: await overflow(page), url: page.url() };
  await ctx.close();
}

// Owner light
{
  const { ctx, page } = await openApp(ownerTok, {
    width: 1440,
    height: 900,
    colorScheme: "light",
    path: "/app/dashboard",
  });
  await page.screenshot({ path: path.join(OUT, "owner-1440-light-sidebar.png"), fullPage: false });
  report.shots.push("owner-1440-light-sidebar.png");
  report.checks.ownerLight = { overflow: await overflow(page) };
  await ctx.close();
}

// Technician
if (techTok) {
  const { ctx, page } = await openApp(techTok, {
    width: 390,
    height: 844,
    colorScheme: "dark",
    path: "/app/today",
  });
  const bottomLabels = await page.locator(".ops-bottom-nav-item").allTextContents();
  await page.getByRole("button", { name: "עבודה" }).click();
  await page.waitForSelector(".mcc-row", { timeout: 15000 });
  const workRows = await page.locator(".mcc-row-label").allTextContents();
  const leaked = workRows.some((t) => /פרויקט|שירות|הצעות|הגדרות|ליד/.test(t));
  await page.screenshot({ path: path.join(OUT, "tech-390-dark-work-sheet.png"), fullPage: false });
  report.shots.push("tech-390-dark-work-sheet.png");

  // Today → FieldJob if a job card exists
  await page.goto(`${WEB}/app/today`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const openJob = page.getByRole("link", { name: /פתיחת העבודה|פתח/ }).first();
  let fieldJobOk = false;
  if (await openJob.count()) {
    await openJob.click();
    await page.waitForTimeout(1000);
    fieldJobOk = /\/app\/jobs\//.test(page.url());
    await page.screenshot({ path: path.join(OUT, "tech-390-fieldjob.png"), fullPage: false });
    report.shots.push("tech-390-fieldjob.png");
  } else {
    fieldJobOk = true; // no assigned job — nav intact; mark soft pass
    report.checks.techNoAssignedJob = true;
  }

  // manager leak via sidebar not present on mobile; check more sheet
  await page.goto(`${WEB}/app/today`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "עוד" }).click();
  await page.waitForTimeout(400);
  const moreText = await page.locator(".mcc-sheet, [role='dialog']").first().innerText().catch(() => "");
  const moreLeak = /הצעות מחיר|הגדרות|פרויקטים|לידים/.test(moreText);

  report.checks.technician = {
    bottomLabels,
    workRows,
    leaked,
    moreLeak,
    fieldJobOk,
    overflow: await overflow(page),
    homeIsToday: page.url().includes("/app/today") || bottomLabels[0]?.includes("בית"),
  };
  await ctx.close();

  const { ctx: dctx, page: dpage } = await openApp(techTok, {
    width: 1440,
    height: 900,
    colorScheme: "dark",
    path: "/app/today",
  });
  const techLinks = await dpage.locator(".ops-sidebar-link").allTextContents();
  report.checks.techDesktop = {
    techLinks,
    noQuotes: !techLinks.some((t) => t.includes("הצעות")),
    noSettings: !techLinks.some((t) => t.includes("הגדרות")),
    noProjects: !techLinks.some((t) => t.includes("פרויקט")),
    hasJobs: techLinks.some((t) => t.includes("עבודות")),
  };
  await dpage.screenshot({ path: path.join(OUT, "tech-1440-dark-sidebar.png"), fullPage: false });
  report.shots.push("tech-1440-dark-sidebar.png");
  await dctx.close();
}

// Quote builder nav regression — open quotes list then a quote if any
{
  const { ctx, page } = await openApp(ownerTok, {
    width: 390,
    height: 844,
    colorScheme: "dark",
    path: "/app/quotes",
  });
  await page.waitForTimeout(800);
  const bottomVisible = await page.locator(".ops-bottom-nav").isVisible().catch(() => false);
  report.checks.quoteListBottomNav = bottomVisible;
  await page.screenshot({ path: path.join(OUT, "owner-390-quotes.png"), fullPage: false });
  report.shots.push("owner-390-quotes.png");
  await ctx.close();
}

report.pass = {
  ownerDesktop:
    report.checks.ownerDesktop?.hasWork &&
    report.checks.ownerDesktop?.hasCustomers &&
    report.checks.ownerDesktop?.hasTasks &&
    report.checks.ownerDesktop?.hasMore &&
    report.checks.ownerDesktop?.jobsActive &&
    !report.checks.ownerDesktop?.overflow,
  ownerMobile390:
    report.checks.ownerMobile390?.hasJobs &&
    report.checks.ownerMobile390?.hasProjects &&
    !report.checks.ownerMobile390?.overflow,
  ownerMobile360: !report.checks.ownerMobile360?.overflow,
  technician: techTok
    ? report.checks.technician &&
      !report.checks.technician.leaked &&
      !report.checks.technician.moreLeak &&
      report.checks.techDesktop?.hasJobs &&
      report.checks.techDesktop?.noQuotes &&
      report.checks.techDesktop?.noSettings
    : false,
};

report.finished = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, checks: report.checks }, null, 2));
await browser.close();
const ok =
  report.pass.ownerDesktop &&
  report.pass.ownerMobile390 &&
  report.pass.ownerMobile360 &&
  (techTok ? report.pass.technician : true);
process.exit(ok ? 0 : 1);
