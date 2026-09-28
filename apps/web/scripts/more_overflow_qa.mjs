/**
 * Browser QA — More UX cleanup (D1–D5)
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/core-app-ux-qa/more");
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
const TECH = process.env.QA_TECH_EMAIL || "phase1b.tech.1790012816@sitesecure.test";
const TECH_PASS = process.env.QA_TECH_PASSWORD || "Phase1b-1790012816-Qa!";
const WS = "50339413-11c7-4903-820c-7541fbd2a476";
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

async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  report.shots.push(file);
}

async function openMoreSheet(page) {
  const moreBtn = page.getByRole("button", { name: "עוד" }).first();
  await moreBtn.click();
  await page.waitForSelector(".mcc", { timeout: 15000 });
  await page.waitForTimeout(300);
  // Expand all collapsed sections so destination inventory is visible
  await page.evaluate(() => {
    document.querySelectorAll(".mcc-section-toggle[aria-expanded='false']").forEach((btn) => {
      if (btn instanceof HTMLElement) btn.click();
    });
  });
  await page.waitForTimeout(200);
}

async function inspectMore(page) {
  return page.evaluate(() => {
    const search = document.querySelector(".mcc-search input");
    const hint = document.querySelector(".mcc-search-hint")?.textContent?.trim() || "";
    const sections = Array.from(document.querySelectorAll(".mcc-section-toggle, .mcc-section-label")).map((el) =>
      (el.textContent || "").trim(),
    );
    const rows = Array.from(document.querySelectorAll(".mcc-row-label")).map((el) => (el.textContent || "").trim());
    const quick = Array.from(document.querySelectorAll(".mcc-quick-tile")).map((el) => (el.textContent || "").trim());
    const workspace = document.querySelector(".mcc-workspace");
    const workspaceHasChevron = Boolean(workspace?.querySelector("svg"));
    const text = document.querySelector(".mcc")?.textContent || "";
    return {
      placeholder: search?.getAttribute("placeholder") || "",
      hint,
      sections,
      rows,
      quick,
      workspaceHasChevron,
      hasCustomersWordInSections: sections.some((s) => s.includes("לקוחות")),
      mentionsGlobalEntities: /לקוח|אתר|הצעה|פרויקט/.test(hint + (search?.getAttribute("placeholder") || "")),
      hasWorkDup: rows.some((r) => ["עבודות", "פרויקטים", "שירות", "ביקורים", "תיקי אתר"].includes(r)),
      hasQuotes: rows.includes("הצעות מחיר"),
      hasKnowledge: rows.includes("מודיעין טכני"),
      hasSettings: rows.includes("הגדרות"),
      hasLeads: rows.includes("לידים"),
      hasVisitQuick: quick.some((q) => q.includes("ביקור")),
      dir: getComputedStyle(document.documentElement).direction,
    };
  });
}

async function desktopMoreLinks(page) {
  return page.evaluate(() => {
    const groups = Array.from(document.querySelectorAll(".ops-sidebar-group, [data-nav-group]"));
    // Fallback: collect sidebar links after Tasks that look like More destinations
    const links = Array.from(document.querySelectorAll(".ops-sidebar a, nav a")).map((a) => ({
      href: a.getAttribute("href") || "",
      label: (a.textContent || "").trim(),
    }));
    return {
      links,
      settings: links.some((l) => l.href.includes("/app/settings") && l.label.includes("הגדרות")),
      quotes: links.some((l) => l.href.includes("/app/quotes")),
      knowledge: links.some((l) => l.href.includes("/app/knowledge")),
      jobsInSidebar: links.some((l) => l.href.includes("/app/jobs")),
    };
  });
}

const ownerTok = await login(OWNER, OWNER_PASS);
const techTok = await login(TECH, TECH_PASS);

{
  const { ctx, page } = await openApp(ownerTok, {
    width: 1440,
    height: 900,
    colorScheme: "dark",
    path: "/app/dashboard",
  });
  await shot(page, "owner-1440-dark-sidebar");
  report.checks.ownerDesktop1440 = {
    ...(await desktopMoreLinks(page)),
    overflow: await overflow(page),
    dir: await page.evaluate(() => getComputedStyle(document.documentElement).direction),
  };
  await page.goto(`${WEB}/app/quotes`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main#main", { timeout: 60000 });
  await page.goBack();
  await page.waitForTimeout(400);
  report.checks.ownerDesktop1440.backOk = page.url().includes("/app/");
  await ctx.close();
}

{
  const { ctx, page } = await openApp(ownerTok, {
    width: 390,
    height: 844,
    colorScheme: "dark",
    path: "/app/dashboard",
  });
  await openMoreSheet(page);
  await shot(page, "owner-390-dark-more");
  report.checks.ownerMobile390 = {
    ...(await inspectMore(page)),
    overflow: await overflow(page),
  };
  await ctx.close();
}

{
  const { ctx, page } = await openApp(ownerTok, {
    width: 360,
    height: 740,
    colorScheme: "dark",
    path: "/app/dashboard",
  });
  await openMoreSheet(page);
  await shot(page, "owner-360-dark-more");
  report.checks.ownerMobile360 = {
    ...(await inspectMore(page)),
    overflow: await overflow(page),
  };
  await ctx.close();
}

{
  const { ctx, page } = await openApp(ownerTok, {
    width: 390,
    height: 844,
    colorScheme: "light",
    path: "/app/dashboard",
  });
  await openMoreSheet(page);
  await shot(page, "owner-390-light-more");
  report.checks.ownerLight390 = {
    ...(await inspectMore(page)),
    overflow: await overflow(page),
  };
  await ctx.close();
}

{
  const { ctx, page } = await openApp(techTok, {
    width: 390,
    height: 844,
    colorScheme: "dark",
    path: "/app/today",
  });
  await openMoreSheet(page);
  await shot(page, "tech-390-dark-more");
  report.checks.technician390 = {
    ...(await inspectMore(page)),
    overflow: await overflow(page),
  };
  await ctx.close();
}

{
  const { ctx, page } = await openApp(techTok, {
    width: 1440,
    height: 900,
    colorScheme: "dark",
    path: "/app/today",
  });
  await shot(page, "tech-1440-dark-sidebar");
  report.checks.technicianDesktop = {
    ...(await desktopMoreLinks(page)),
    overflow: await overflow(page),
  };
  // keyboard focus smoke
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  report.checks.technicianDesktop.focusedTag = await page.evaluate(() => document.activeElement?.tagName || "");
  await ctx.close();
}

report.finished = new Date().toISOString();
report.pass = Boolean(
  report.checks.ownerMobile390?.placeholder?.includes("אפשרויות נוספות") &&
    !report.checks.ownerMobile390?.mentionsGlobalEntities &&
    !report.checks.ownerMobile390?.hasCustomersWordInSections &&
    !report.checks.ownerMobile390?.workspaceHasChevron &&
    !report.checks.ownerMobile390?.hasVisitQuick &&
    !report.checks.ownerMobile390?.hasWorkDup &&
    report.checks.ownerMobile390?.hasQuotes &&
    report.checks.ownerMobile390?.hasSettings &&
    !report.checks.ownerMobile390?.overflow &&
    !report.checks.ownerMobile360?.overflow &&
    report.checks.technician390?.hasKnowledge &&
    !report.checks.technician390?.hasQuotes &&
    !report.checks.technician390?.hasLeads &&
    !report.checks.technician390?.hasSettings &&
    !report.checks.technician390?.overflow &&
    report.checks.ownerDesktop1440?.settings &&
    !report.checks.technicianDesktop?.settings &&
    report.checks.ownerMobile390?.dir === "rtl",
);

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify({ pass: report.pass, checks: report.checks, shots: report.shots }, null, 2));
process.exit(report.pass ? 0 : 1);
