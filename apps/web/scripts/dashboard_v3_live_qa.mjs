/**
 * Dashboard V3 — Operations Command Center live visual QA.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "_dashboard_v3_qa");
const TOKEN_PATH = path.join(ROOT, "apps/api/scripts/.tmp_import_token");
const API = process.env.API_URL || "http://127.0.0.1:8010";
const WEB_CANDIDATES = [
  process.env.WEB_URL,
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean);

async function pickWeb() {
  for (const url of WEB_CANDIDATES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status < 500) return url;
    } catch {
      /* try next */
    }
  }
  throw new Error("No web server on 5173/5174");
}

async function api(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

if (!fs.existsSync(TOKEN_PATH)) {
  console.error("Missing token at", TOKEN_PATH);
  process.exit(1);
}
const TOKEN = fs.readFileSync(TOKEN_PATH, "utf8").trim();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

const WEB = await pickWeb();
const session = await api(TOKEN, `${API}/api/v1/auth/session`);
const ws = session.memberships?.[0]?.workspace_id;
if (!ws) throw new Error("No workspace in session");

fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: "mobile-360", width: 360, height: 740 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1024", width: 1024, height: 768 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

const browser = await chromium.launch({ headless: true });
const report = {
  web: WEB,
  api: API,
  workspace: ws,
  viewports: {},
  checks: {},
  load: {},
};

for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addInitScript(
    ({ key, value }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      value: JSON.stringify({
        access_token: TOKEN,
        refresh_token: "qa",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user,
      }),
    },
  );
  const page = await ctx.newPage();
  const dashRequests = [];
  page.on("request", (req) => {
    if (req.url().includes("/dashboard")) dashRequests.push(req.url());
  });
  const started = Date.now();
  let loadError = null;
  try {
    await page.goto(`${WEB}/app`, { waitUntil: "networkidle", timeout: 90000 });
    // Wait until dashboard data resolves (not the V3-shaped skeleton).
    await page.waitForFunction(
      () =>
        Boolean(document.querySelector(".ops-dashboard-v3:not(.ops-dashboard-skeleton) .ops-cmd-header")) ||
        Boolean(document.body.innerText?.includes("לא ניתן לטעון את הסקירה")),
      { timeout: 60000 },
    );
    await page.waitForTimeout(700);
  } catch (err) {
    loadError = String(err);
  }
  const loadMs = Date.now() - started;

  const shot = path.join(OUT, `${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => null);

  const metrics = await page.evaluate(() => {
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const clientWidth = document.documentElement.clientWidth;
    const bodyText = document.body.innerText || "";
    const attention = document.querySelector("#command-attention");
    const commercial = document.querySelector("#commercial-pulse-heading");
    const today = document.querySelector("#active-work-heading");
    const header = document.querySelector(".ops-cmd-header");
    const signals = [...document.querySelectorAll(".ops-signal")].map((el) => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent?.replace(/\s+/g, " ").trim(), h: r.height, w: r.width };
    });
    const touchables = [
      ...document.querySelectorAll(
        ".ops-attention-cta, .ops-create-trigger, .ops-cmd-search, .quote-new-btn, .ops-today-empty-cta, .ops-section-link, .ops-recent-mobile-row",
      ),
    ].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent?.replace(/\s+/g, " ").trim()?.slice(0, 40),
        w: r.width,
        h: r.height,
        clipped: r.right > clientWidth + 2 || r.left < -2,
      };
    });
    const bottomNav = document.querySelector("[data-bottom-nav], .app-bottom-nav, nav.app-mobile-nav");
    const bottomNavH = bottomNav ? bottomNav.getBoundingClientRect().height : 0;
    return {
      horizontalOverflow: scrollWidth > clientWidth + 2,
      scrollWidth,
      clientWidth,
      signals,
      touchables,
      bottomNavH,
      hasV3: Boolean(document.querySelector(".ops-dashboard-v3")),
      hasHeader: Boolean(header),
      hasSignalStrip: Boolean(document.querySelector(".ops-signal-strip")),
      hasCommandQueue: Boolean(attention),
      hasCommercial: Boolean(commercial),
      hasToday: Boolean(today),
      hasRecentTable: Boolean(document.querySelector(".ops-recent-table")),
      hasRecentMobile: Boolean(document.querySelector(".ops-recent-mobile")),
      hasApex: Boolean(document.querySelector(".ops-commercial-apex .apexcharts-canvas, .apexcharts-canvas")),
      hasWorkspace: Boolean(document.querySelector(".ops-workspace-panel, #usage-heading")),
      loadFailCopy: bodyText.includes("לא ניתן לטעון את הסקירה"),
      order: {
        headerTop: header?.getBoundingClientRect().top ?? null,
        signalTop: document.querySelector(".ops-signal-strip")?.getBoundingClientRect().top ?? null,
        attentionTop: attention?.getBoundingClientRect().top ?? null,
        todayTop: today?.getBoundingClientRect().top ?? null,
        commercialTop: commercial?.getBoundingClientRect().top ?? null,
      },
    };
  }).catch((err) => ({ evaluateError: String(err) }));

  report.viewports[vp.name] = {
    shot: path.basename(shot),
    loadMs,
    loadError,
    dashRequestCount: dashRequests.length,
    ...metrics,
  };
  report.load[vp.name] = { loadMs, loadError, loadFailCopy: metrics.loadFailCopy ?? null };
  await ctx.close();
}

const values = Object.values(report.viewports);
report.checks.noHorizontalScroll = values.every((v) => !v.horizontalOverflow);
report.checks.hasV3Shell = values.every((v) => v.hasV3);
report.checks.hasCommandHeader = values.every((v) => v.hasHeader);
report.checks.hasSignalStrip = values.every((v) => v.hasSignalStrip);
report.checks.hierarchyOk = values.every((v) => {
  const { attentionTop, commercialTop, signalTop, headerTop } = v.order || {};
  if (headerTop != null && signalTop != null && signalTop < headerTop) return false;
  if (attentionTop == null) return true;
  if (commercialTop != null && commercialTop < attentionTop) return false;
  return true;
});
report.checks.mobileTouchOk = ["mobile-360", "mobile-375", "mobile-390", "mobile-430"].every((k) => {
  const v = report.viewports[k];
  return (v.touchables || [])
    .filter((c) => c.w >= 8 && c.h >= 8)
    .every((c) => !c.clipped && c.h >= 36);
});
report.checks.desktopRecentTable = ["desktop-1024", "desktop-1280", "desktop-1440"].every(
  (k) => report.viewports[k]?.hasRecentTable !== false,
);
report.checks.mobileRecentCards = ["mobile-360", "mobile-375", "mobile-390", "mobile-430"].every((k) => {
  const v = report.viewports[k];
  return !v.hasRecentTable || v.hasRecentMobile;
});
report.checks.commercialChartPresent = values
  .filter((v) => v.hasCommercial)
  .every((v) => v.hasApex !== false);
report.checks.noLoadFailCopy = values.every((v) => !v.loadFailCopy);
report.verdict =
  report.checks.noHorizontalScroll &&
  report.checks.hasV3Shell &&
  report.checks.hasCommandHeader &&
  report.checks.hasSignalStrip &&
  report.checks.hierarchyOk &&
  report.checks.mobileTouchOk
    ? "PASS"
    : "FAIL";

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.verdict === "PASS" ? 0 : 1);
