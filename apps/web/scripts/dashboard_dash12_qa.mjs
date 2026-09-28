/**
 * DASH-1 + DASH-2 visual QA — Docs/core-app-ux-qa/dashboard/
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/core-app-ux-qa/dashboard");

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

const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const WS = env.QA_WORKSPACE_ID || "50339413-11c7-4903-820c-7541fbd2a476";
const TECH = env.QA_TECH_EMAIL || "phase1b.tech.1790012816@sitesecure.test";
const TECH_PASS = env.QA_TECH_PASSWORD || "Phase1b-1790012816-Qa!";

fs.mkdirSync(OUT, { recursive: true });

if (!SUPABASE_URL || !ANON) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];

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

const ownerTok = await login(EMAIL, PASSWORD);
let techTok = null;
try {
  techTok = await login(TECH, TECH_PASS);
} catch (err) {
  techTok = null;
}

const browser = await chromium.launch({ headless: true });
const report = {
  email: EMAIL,
  web: WEB,
  shots: [],
  checks: {},
  started: new Date().toISOString(),
};

async function openApp(tok, { width, height, colorScheme, go }) {
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
  await page.goto(`${WEB}${go}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("main#main, .ops-shell, .ops-command-hero, .ops-today-home", {
    timeout: 90000,
  });
  // Light theme hydration can lag behind dark; wait for dashboard shell or field home.
  await page
    .waitForSelector(".ops-command-hero.is-dash12-hero, .ops-dashboard-final, .ops-today-home, .field-today", {
      timeout: 90000,
    })
    .catch(() => {});
  await page.waitForTimeout(colorScheme === "light" ? 3200 : 2400);
  return { ctx, page };
}

function overflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
}

async function capture(name, tok, opts) {
  const { ctx, page } = await openApp(tok, opts);
  await page.waitForSelector(".ops-command-hero.is-dash12-hero, .ops-today-home, .ops-dashboard", {
    timeout: 60000,
  }).catch(() => {});
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  report.shots.push(file);

  const metrics = await page.evaluate(() => {
    const hero = document.querySelector(".ops-command-hero.is-dash12-hero");
    const dash = document.querySelector(".ops-dashboard-dash12");
    const quoteCta = document.querySelector(".ops-qa-primary.is-quote-cta");
    const qaDash6 = document.querySelector(".ops-qa.is-dash6");
    const qaTools = document.querySelectorAll(".ops-qa-tool[data-qa-key]").length;
    const balance = document.querySelector(".ops-command-balance-value");
    const queue = document.querySelector(".ops-attention-card.is-queue, .ops-attention-calm.is-queue-clear");
    const queueRows = document.querySelectorAll(".ops-attention-row.is-queue").length;
    const lead = document.querySelector(".ops-attention-row.is-queue .ss-activity-row-leading");
    const todayQueue = document.querySelector(".ops-today-card.is-queue");
    const todayRows = document.querySelectorAll(".ops-today-row.is-queue").length;
    const todayLead = document.querySelector(".ops-today-row.is-queue .ss-activity-row-leading");
    const quotePipeline = document.querySelector(".ops-quote-pipeline.is-dash5, [data-testid='quote-pipeline']");
    const pipelineStations = document.querySelectorAll(".ops-quote-pipeline-station").length;
    const recentPanel = document.querySelector(".ops-recent-panel.is-dash5, [data-testid='recent-quotes']");
    const recentRows = document.querySelectorAll(".ops-recent-row.is-dash5, [data-testid='recent-quote-row']").length;
    const deadChevrons = [...document.querySelectorAll(".ops-attention-row, .ops-today-row")].some((el) =>
      (el.textContent || "").includes("›") && !el.querySelector(".ops-attention-cta, .ops-today-cta"),
    );
    const zones = [...document.querySelectorAll(".ops-zone")].map((z) => z.getAttribute("data-zone"));
    const bottom = [...document.querySelectorAll(".ops-bottom-nav a, .ops-bottom-nav button")].map(
      (el) => el.textContent?.trim() || "",
    );
    const dir = getComputedStyle(document.documentElement).direction;
    const finalShell = document.querySelector(".ops-dashboard-final");
    const focusSample = document.querySelector(
      ".ops-qa-primary.is-quote-cta, .ops-attention-row.is-interactive, .ops-recent-row.is-dash5",
    );
    return {
      hasDash12: Boolean(dash),
      hasFinal: Boolean(finalShell),
      hasHero: Boolean(hero),
      hasQuoteCta: Boolean(quoteCta),
      quoteLabel: quoteCta?.textContent?.trim() || null,
      hasDash6Qa: Boolean(qaDash6),
      qaToolCount: qaTools,
      hasBalance: Boolean(balance),
      balanceLtr: balance?.classList.contains("ltr-meta") || balance?.getAttribute("dir") === "ltr",
      hasAttentionQueue: Boolean(queue),
      queueRows,
      hasLeadGeometry: Boolean(lead),
      hasTodayQueue: Boolean(todayQueue),
      todayRows,
      hasTodayLead: Boolean(todayLead),
      hasQuotePipeline: Boolean(quotePipeline),
      pipelineStations,
      hasRecentQuotes: Boolean(recentPanel),
      recentRows,
      deadChevrons,
      zones,
      bottom,
      dir,
      hasFocusableSample: Boolean(focusSample),
      hello: document.querySelector(".ops-command-hero-hello")?.textContent?.trim() || "",
    };
  });

  report.checks[name] = {
    ...metrics,
    overflow: await overflow(page),
    url: page.url(),
    width: opts.width,
    theme: opts.colorScheme,
  };
  await ctx.close();
}

await capture("1440-dark", ownerTok, {
  width: 1440,
  height: 900,
  colorScheme: "dark",
  go: "/app/dashboard",
});
await capture("1440-light", ownerTok, {
  width: 1440,
  height: 900,
  colorScheme: "light",
  go: "/app/dashboard",
});
await capture("1024-dark", ownerTok, {
  width: 1024,
  height: 900,
  colorScheme: "dark",
  go: "/app/dashboard",
});
await capture("768-dark", ownerTok, {
  width: 768,
  height: 1024,
  colorScheme: "dark",
  go: "/app/dashboard",
});
await capture("390-dark", ownerTok, {
  width: 390,
  height: 844,
  colorScheme: "dark",
  go: "/app/dashboard",
});
await capture("390-light", ownerTok, {
  width: 390,
  height: 844,
  colorScheme: "light",
  go: "/app/dashboard",
});
await capture("360-dark", ownerTok, {
  width: 360,
  height: 740,
  colorScheme: "dark",
  go: "/app/dashboard",
});

if (techTok) {
  await capture("tech-redirect-1440-dark", techTok, {
    width: 1440,
    height: 900,
    colorScheme: "dark",
    go: "/app",
  });
}

report.pass = Object.values(report.checks).every((c) => {
  if (c.overflow) return false;
  if (String(c.url || "").includes("/app/today")) return true; // tech home
  return c.hasDash12 && c.hasHero && c.hasFinal !== false;
});

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.pass ? 0 : 1);
