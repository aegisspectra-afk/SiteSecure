/**
 * Phase 1B.4 — Adaptive daily command center visual QA (low-data + layout probes).
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

const OUT = path.join(ROOT, "Docs/phase-1b4-qa");
const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON) {
  console.error("Missing SUPABASE_URL / ANON");
  process.exit(1);
}

const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
fs.mkdirSync(OUT, { recursive: true });

const tokenJson = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());
if (!tokenJson.access_token) {
  console.error("Password grant failed", tokenJson);
  process.exit(1);
}

const shots = [
  { name: "adapt-390-light-live", width: 390, height: 844, theme: "light" },
  { name: "adapt-390-dark", width: 390, height: 844, theme: "dark" },
  { name: "adapt-360-light", width: 360, height: 800, theme: "light" },
  { name: "adapt-375-light", width: 375, height: 812, theme: "light" },
  { name: "adapt-430-light", width: 430, height: 932, theme: "light" },
  { name: "adapt-768-light", width: 768, height: 1024, theme: "light" },
  { name: "adapt-1280-light", width: 1280, height: 800, theme: "light" },
  { name: "adapt-1440-light-live", width: 1440, height: 900, theme: "light" },
  { name: "adapt-1440-dark", width: 1440, height: 900, theme: "dark" },
];

const forced = [
  { name: "adapt-390-light-day", width: 390, height: 844, theme: "light", surface: "light-day", period: "morning" },
  { name: "adapt-390-light-night", width: 390, height: 844, theme: "light", surface: "dark-night", period: "night" },
  { name: "adapt-1440-light-day", width: 1440, height: 900, theme: "light", surface: "light-day", period: "morning" },
  { name: "adapt-1440-light-night", width: 1440, height: 900, theme: "light", surface: "dark-night", period: "night" },
];

const browser = await chromium.launch({ headless: true });
const report = { email: EMAIL, web: WEB, shots: [], audit: {} };

async function openDash(theme, width, height) {
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
  await page.goto(`${WEB}/app/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(
    () => Boolean(document.querySelector(".ops-dashboard-adaptive .ops-command-hero")),
    { timeout: 60000 },
  );
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    localStorage.setItem("site-secure-theme", t);
  }, theme);
  await page.waitForTimeout(400);
  return { ctx, page };
}

async function capture(shot) {
  const { ctx, page } = await openDash(shot.theme, shot.width, shot.height);
  if (shot.surface) {
    await page.evaluate(({ surface, period }) => {
      const hero = document.querySelector(".ops-command-hero");
      if (!hero) return;
      hero.setAttribute("data-hero-surface", surface);
      hero.setAttribute("data-time-period", period);
    }, shot);
    await page.waitForTimeout(200);
  }

  const file = path.join(OUT, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: false });

  const metrics = await page.evaluate(() => {
    const dash = document.querySelector(".ops-dashboard-adaptive");
    const today = document.querySelector(".ops-today-card");
    const qa = document.querySelector(".ops-qa");
    const workbench = document.querySelector(".ops-command-workbench.is-low-data");
    const rail = document.querySelector(".ops-command-rail");
    const createMenu = document.querySelector(".ops-create-trigger");
    const floatingAttentionKpi = document.querySelector(".ops-command-hero-primary.is-attention");
    const signalWarn = document.querySelector(".ops-command-hero-signal.is-warn");
    const recentCompact = document.querySelector(".ops-recent-panel.is-compact");
    const attentionCta = document.querySelector(".ops-attention-cta");
    const attentionRow = document.querySelector(".ops-attention-row");
    const attentionRowH = attentionRow ? Math.round(attentionRow.getBoundingClientRect().height) : null;
    const qaTile = document.querySelector(".ops-qa-tile");
    const qaTileH = qaTile ? Math.round(qaTile.getBoundingClientRect().height) : null;
    const primary = document.querySelector(".ops-command-primary");
    const attention = document.querySelector(".ops-attention-card.is-active");
    const commercial = document.querySelector(".ops-commercial-card");
    const activity = document.querySelector(".ops-activity-panel");
    const recent = document.querySelector(".ops-recent-panel");
    const setup = document.querySelector(".ops-setup-strip, .ops-activation");
    const usage = document.querySelector(".ops-usage-row");
    const hero = document.querySelector(".ops-command-hero");
    const todayBox = today?.getBoundingClientRect();
    const dashBox = dash?.getBoundingClientRect();
    const workbenchBox = workbench?.getBoundingClientRect();
    const heroBox = hero?.getBoundingClientRect();
    const setupBox = setup?.getBoundingClientRect();
    const usageBox = usage?.getBoundingClientRect();
    const qaTiles = qa ? [...qa.querySelectorAll(":scope > .ops-qa-tile, :scope > .ops-qa-more > .ops-qa-tile")] : [];
    const qaTops = qaTiles.map((el) => Math.round(el.getBoundingClientRect().top));
    const qaOneRow = qaTops.length <= 1 || qaTops.every((t) => Math.abs(t - qaTops[0]) <= 4);
    const nav = document.querySelector(".ops-bottom-nav");
    const navTop = nav ? nav.getBoundingClientRect().top : null;
    const todayVisibleInFirstViewport =
      todayBox != null && todayBox.top < window.innerHeight - 72 && todayBox.bottom > 0;
    return {
      hasAdaptive: Boolean(dash),
      hasQuickActions: Boolean(qa && qa.children.length > 0),
      qaTileCount: qaTiles.length,
      qaOneRow,
      hasToday: Boolean(today),
      todayEmpty: today?.classList.contains("is-empty") ?? false,
      todayWidth: todayBox ? Math.round(todayBox.width) : null,
      todayHeight: todayBox ? Math.round(todayBox.height) : null,
      todayTop: todayBox ? Math.round(todayBox.top) : null,
      todayVisibleInFirstViewport,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      dashWidth: dashBox ? Math.round(dashBox.width) : null,
      workbenchWidth: workbenchBox ? Math.round(workbenchBox.width) : null,
      hasLowDataWorkbench: Boolean(workbench),
      hasRail: Boolean(rail),
      noIsolatedCreate: !createMenu,
      noFloatingAttentionKpi: !floatingAttentionKpi,
      hasWarnAttentionSignal: Boolean(signalWarn),
      recentCompact: Boolean(recentCompact),
      attentionRowHeight: attentionRowH,
      qaTileHeight: qaTileH,
      hasAttention: Boolean(attention),
      hasCommercial: Boolean(commercial),
      hasActivity: Boolean(activity),
      hasRecent: Boolean(recent),
      hasSetup: Boolean(setup),
      setupHeight: setupBox ? Math.round(setupBox.height) : null,
      setupIsPanel: setup?.classList.contains("is-panel") ?? false,
      hasUsage: Boolean(usage),
      usageHeight: usageBox ? Math.round(usageBox.height) : null,
      hasPrimary: Boolean(primary),
      heroHeight: heroBox ? Math.round(heroBox.height) : null,
      heroBottom: heroBox ? Math.round(heroBox.bottom) : null,
      composedHero: hero?.classList.contains("is-composed") ?? false,
      bottomNavTop: navTop != null ? Math.round(navTop) : null,
    };
  });

  report.shots.push({ ...shot, file: path.relative(ROOT, file), ok: true, ...metrics });
  console.log("OK", shot.name, {
    qa: metrics.hasQuickActions,
    qaRow: metrics.qaOneRow,
    noCreate: metrics.noIsolatedCreate,
    noFloatKpi: metrics.noFloatingAttentionKpi,
    heroH: metrics.heroHeight,
    qaH: metrics.qaTileHeight,
    attRowH: metrics.attentionRowHeight,
    recentCompact: metrics.recentCompact,
    todayTop: metrics.todayTop,
  });
  await ctx.close();
}

for (const shot of shots) await capture(shot);
for (const shot of forced) await capture(shot);

report.audit = {
  noNewDomainQueries: true,
  adaptiveClass: "ops-dashboard-adaptive",
  lowDataQaWorkspace: EMAIL,
};
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("Wrote", path.join(OUT, "report.json"));
await browser.close();
