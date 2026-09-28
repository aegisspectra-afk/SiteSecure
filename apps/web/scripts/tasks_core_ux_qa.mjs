/**
 * Browser QA — Checkpoint C Tasks
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/core-app-ux-qa/tasks");
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
  await page.waitForSelector("[data-testid='tasks-page']", { timeout: 90000 });
  await page.waitForSelector("[data-testid='tasks-list'], [data-testid='tasks-empty'], [data-testid='tasks-loading']", {
    timeout: 60000,
  });
  await page.waitForFunction(
    () => !document.querySelector("[data-testid='tasks-loading']"),
    { timeout: 60000 },
  );
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

async function inspectTasks(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-testid='tasks-page']");
    const title = root?.querySelector("h1, .page-header h1, [class*='PageHeader']")?.textContent?.trim() || "";
    const lead = Array.from(root?.querySelectorAll("p") || [])
      .map((p) => p.textContent?.trim() || "")
      .find((t) => t.includes("משימות") || t.includes("רשימת")) || "";
    const filters = Array.from(document.querySelectorAll(".ss-tasks-filter")).map((el) => el.textContent?.trim());
    const createBtns = Array.from(document.querySelectorAll("button")).filter((b) =>
      (b.textContent || "").includes("משימה חדשה"),
    );
    const completeBtns = Array.from(document.querySelectorAll(".ss-tasks-complete"));
    const minTouch = Math.min(
      ...[...createBtns, ...completeBtns, ...document.querySelectorAll(".ss-tasks-filter")].map((el) => {
        const r = el.getBoundingClientRect();
        return Math.min(r.height, r.width > 0 ? r.height : 44);
      }),
      99,
    );
    const focusableDead = Array.from(document.querySelectorAll("button, a, input")).filter((el) => {
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
      const r = el.getBoundingClientRect();
      return r.width === 0 || r.height === 0;
    }).length;
    return {
      hasPage: Boolean(root),
      title,
      lead,
      filters,
      createCount: createBtns.length,
      completeCount: completeBtns.length,
      rowCount: document.querySelectorAll("[data-testid='tasks-row']").length,
      empty: Boolean(document.querySelector("[data-testid='tasks-empty']")),
      hasSearch: Boolean(document.querySelector("#module-search")),
      calendarWord: (root?.textContent || "").includes("יומן"),
      minTouchHeight: minTouch,
      focusableDead,
      dir: getComputedStyle(document.documentElement).direction,
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
    path: "/app/tasks",
  });
  await page.waitForSelector("[data-testid='tasks-page']", { timeout: 60000 });
  await shot(page, "owner-1440-dark-tasks");
  const info = await inspectTasks(page);
  report.checks.ownerDesktop1440 = {
    ...info,
    overflow: await overflow(page),
    url: page.url(),
  };
  await ctx.close();
}

{
  const { ctx, page } = await openApp(ownerTok, {
    width: 390,
    height: 844,
    colorScheme: "dark",
    path: "/app/tasks",
  });
  await page.waitForSelector("[data-testid='tasks-page']", { timeout: 60000 });
  await shot(page, "owner-390-dark-tasks");
  report.checks.ownerMobile390 = {
    ...(await inspectTasks(page)),
    overflow: await overflow(page),
  };
  await ctx.close();
}

{
  const { ctx, page } = await openApp(ownerTok, {
    width: 360,
    height: 740,
    colorScheme: "dark",
    path: "/app/tasks",
  });
  await page.waitForSelector("[data-testid='tasks-page']", { timeout: 60000 });
  await shot(page, "owner-360-dark-tasks");
  report.checks.ownerMobile360 = {
    ...(await inspectTasks(page)),
    overflow: await overflow(page),
  };
  await ctx.close();
}

{
  const { ctx, page } = await openApp(ownerTok, {
    width: 1440,
    height: 900,
    colorScheme: "light",
    path: "/app/tasks",
  });
  await page.waitForSelector("[data-testid='tasks-page']", { timeout: 60000 });
  await shot(page, "owner-1440-light-tasks");
  report.checks.ownerLight1440 = {
    ...(await inspectTasks(page)),
    overflow: await overflow(page),
  };
  await ctx.close();
}

{
  const { ctx, page } = await openApp(techTok, {
    width: 390,
    height: 844,
    colorScheme: "dark",
    path: "/app/tasks",
  });
  await page.waitForSelector("[data-testid='tasks-page']", { timeout: 60000 });
  // Create → complete via UI-equivalent path
  const title = `C-QA-${Date.now().toString(36)}`;
  await page.getByRole("button", { name: "משימה חדשה" }).first().click();
  await page.getByLabel("כותרת").fill(title);
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/tasks") && res.request().method() === "POST" && res.ok(),
      { timeout: 30000 },
    ),
    page.getByRole("button", { name: "שמירה" }).click(),
  ]);
  const openTab = page.getByRole("tab", { name: "פתוחות" });
  if (await openTab.count()) await openTab.click();
  const row = page.locator("[data-testid='tasks-row']", { hasText: title }).first();
  await row.waitFor({ timeout: 30000 });
  await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/tasks/") && res.request().method() === "PATCH" && res.ok(),
      { timeout: 30000 },
    ),
    row.getByRole("button", { name: /סימון המשימה כהושלמה/ }).click(),
  ]);
  await page.locator("[data-testid='tasks-row']", { hasText: title }).waitFor({ state: "detached", timeout: 30000 });
  await shot(page, "tech-390-dark-create-complete");
  const stillOpen = await page.locator("[data-testid='tasks-row']", { hasText: title }).count();
  report.checks.technician390 = {
    ...(await inspectTasks(page)),
    overflow: await overflow(page),
    createdTitle: title,
    rowGoneAfterComplete: stillOpen === 0,
  };
  await ctx.close();
}

{
  const { ctx, page } = await openApp(techTok, {
    width: 1440,
    height: 900,
    colorScheme: "dark",
    path: "/app/tasks",
  });
  await page.waitForSelector("[data-testid='tasks-page']", { timeout: 60000 });
  // keyboard focus order: filter → create
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName,
      className: el?.className || "",
      text: (el?.textContent || "").trim().slice(0, 40),
      outline: el ? getComputedStyle(el).outlineStyle : "",
    };
  });
  await shot(page, "tech-1440-dark-tasks");
  report.checks.technicianDesktop = {
    ...(await inspectTasks(page)),
    overflow: await overflow(page),
    focused,
  };
  await ctx.close();
}

report.finished = new Date().toISOString();
report.pass = Boolean(
  report.checks.ownerDesktop1440?.hasPage &&
    report.checks.ownerDesktop1440?.title?.includes("משימות") &&
    !report.checks.ownerDesktop1440?.calendarWord &&
    !report.checks.ownerDesktop1440?.hasSearch &&
    !report.checks.ownerDesktop1440?.overflow &&
    !report.checks.ownerMobile390?.overflow &&
    !report.checks.ownerMobile360?.overflow &&
    report.checks.ownerMobile390?.dir === "rtl" &&
    report.checks.technician390?.rowGoneAfterComplete &&
    (report.checks.ownerDesktop1440?.minTouchHeight ?? 0) >= 44 &&
    (report.checks.ownerMobile390?.minTouchHeight ?? 0) >= 44,
);

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify({ pass: report.pass, checks: report.checks, shots: report.shots }, null, 2));
process.exit(report.pass ? 0 : 1);
