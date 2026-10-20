/**
 * SETTINGS-3C Visual QA — Profile / General / Company / Team
 * Viewports: 1440, 1032, 768, 390, 360 × dark/light × RTL
 * Flags only: overflow, spacing anomalies, contrast/focus, broken responsive.
 * No redesign — capture + report; agent may apply surgical CSS fixes after.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/settings-3c-visual-qa");
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

const PAGES = [
  { id: "hub", path: "/app/settings", wait: '[data-testid="settings-hub"], [data-testid="settings-shell"]' },
  { id: "profile", path: "/app/settings/profile", wait: '[data-testid="settings-profile"]' },
  { id: "general", path: "/app/settings/general", wait: ".settings-panel" },
  { id: "company", path: "/app/settings/company", wait: ".settings-panel" },
  { id: "team", path: "/app/settings/users", wait: ".settings-panel, table, [data-testid='settings-shell']" },
];

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1032, height: 800 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 740 },
];

const THEMES = ["dark", "light"];

const browser = await chromium.launch({ headless: true });
const report = { shots: [], issues: [], started: new Date().toISOString() };

function isDesktop(width) {
  return width >= 900;
}

async function inspect(page, meta) {
  return page.evaluate((m) => {
    const issues = [];
    const doc = document.documentElement;
    const overflowX = doc.scrollWidth > doc.clientWidth + 2;
    if (overflowX) issues.push({ type: "overflow_x", detail: `${doc.scrollWidth}>${doc.clientWidth}` });

    const shell = document.querySelector('[data-testid="settings-shell"]');
    const select = document.querySelector('[data-testid="settings-nav-select"]');
    const desktop = document.querySelector('[data-testid="settings-nav-desktop"]');
    const aside = document.querySelector(".settings-aside");
    const vis = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
    };
    const selectVisible = vis(select);
    const desktopVisible = vis(desktop);
    const asideVisible = vis(aside);
    const hub = Boolean(document.querySelector('[data-testid="settings-hub"]'));

    if (m.width >= 900) {
      if (!desktopVisible) issues.push({ type: "responsive", detail: "desktop nav hidden at desktop width" });
      if (selectVisible) issues.push({ type: "responsive", detail: "mobile select visible at desktop width" });
    } else if (m.pageId === "hub") {
      if (asideVisible) issues.push({ type: "responsive", detail: "aside should hide on mobile hub" });
    } else if (!hub) {
      if (!selectVisible) issues.push({ type: "responsive", detail: "mobile select hidden on section" });
    }

    // Focusable primary CTAs should be keyboard-reachable
    const ctas = [...document.querySelectorAll(".settings-hub-cta, .settings-save-cta, button[type='submit']")];
    for (const el of ctas.slice(0, 4)) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 40) issues.push({ type: "hit_target", detail: `${el.className || el.tagName} h=${r.height}` });
    }

    // Hub rows
    for (const row of [...document.querySelectorAll(".settings-hub-row")].slice(0, 3)) {
      const r = row.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) issues.push({ type: "hit_target", detail: `hub-row h=${r.height}` });
    }

    // Contrast heuristic: muted text on bg should not be same luminance approx
    const sample = document.querySelector(".settings-hub-email, .settings-section-lead, .settings-field-hint");
    if (sample) {
      const cs = getComputedStyle(sample);
      if (cs.color === cs.backgroundColor) issues.push({ type: "contrast", detail: "muted text equals background" });
    }

    // Localhost leak
    const hrefs = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") || "");
    if (hrefs.some((h) => h.includes("localhost") || h.includes("127.0.0.1"))) {
      issues.push({ type: "localhost_link", detail: "found localhost href" });
    }

    return {
      overflowX,
      selectVisible,
      desktopVisible,
      asideVisible,
      hub,
      dir: doc.getAttribute("dir") || document.body.dir || "",
      issues,
      title: document.title,
    };
  }, meta);
}

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    for (const pageDef of PAGES) {
      const name = `${pageDef.id}-${vp.width}-${theme}`;
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme,
        locale: "he-IL",
      });
      await ctx.addInitScript(
        ({ key, value, ws, themeMode }) => {
          localStorage.setItem("ss.remember-device", "1");
          localStorage.setItem("site-secure-theme", themeMode);
          localStorage.setItem("ss.last-workspace-id", ws);
          localStorage.setItem(key, value);
          document.documentElement.setAttribute("dir", "rtl");
        },
        {
          key: `sb-${ref}-auth-token`,
          ws: WS,
          themeMode: theme,
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
      try {
        await page.goto(`${WEB}${pageDef.path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
        await page.waitForSelector(pageDef.wait, { timeout: 60000 });
        if (pageDef.id === "team") {
          await page.waitForFunction(
            () => {
              const body = document.body?.innerText || "";
              return !body.includes("טוען") || body.includes("הזמנה") || body.includes("חבר") || body.includes("אימייל");
            },
            { timeout: 60000 },
          ).catch(() => {});
        }
        await page.waitForTimeout(350);
        // ensure RTL attribute for screenshot fidelity
        await page.evaluate(() => {
          document.documentElement.setAttribute("dir", "rtl");
        });
        const probe = await inspect(page, { width: vp.width, pageId: pageDef.id });
        const file = `${name}.png`;
        await page.screenshot({ path: path.join(OUT, file), fullPage: true });
        const entry = {
          name,
          file,
          page: pageDef.id,
          path: pageDef.path,
          width: vp.width,
          theme,
          desktop: isDesktop(vp.width),
          ...probe,
        };
        report.shots.push(entry);
        for (const issue of probe.issues) {
          report.issues.push({ ...issue, shot: name, width: vp.width, theme, page: pageDef.id });
        }
      } catch (err) {
        report.issues.push({
          type: "load_error",
          detail: String(err?.message || err),
          shot: name,
          width: vp.width,
          theme,
          page: pageDef.id,
        });
      }
      await ctx.close();
    }
  }
}

const byType = {};
for (const i of report.issues) byType[i.type] = (byType[i.type] || 0) + 1;
report.summary = {
  shots: report.shots.length,
  issueCount: report.issues.length,
  byType,
  overflowShots: report.shots.filter((s) => s.overflowX).map((s) => s.name),
};
report.finished = new Date().toISOString();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
await browser.close();
process.exit(report.issues.some((i) => i.type === "overflow_x" || i.type === "load_error" || i.type === "responsive") ? 1 : 0);
