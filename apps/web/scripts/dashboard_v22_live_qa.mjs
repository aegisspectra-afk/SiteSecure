/**
 * Dashboard Command Center V2.2 — live visual QA (desktop + mobile).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "_dashboard_v22_qa");
const TOKEN_PATH = path.join(ROOT, "apps/api/scripts/.tmp_import_token");
const API = process.env.API_URL || "http://127.0.0.1:8000";
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
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
];

const browser = await chromium.launch({ headless: true });
const report = { web: WEB, api: API, workspace: ws, viewports: {}, checks: {} };

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
  await page.goto(`${WEB}/app`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".ops-command-center, .ops-dash-hero-v22", { timeout: 30000 });
  await page.waitForTimeout(600);

  const shot = path.join(OUT, `${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  const metrics = await page.evaluate(() => {
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const clientWidth = document.documentElement.clientWidth;
    const attention = document.querySelector("#command-attention, #command-heading, .ops-attention-card");
    const commercial = document.querySelector("#commercial-pulse-heading");
    const today = document.querySelector("#active-work-heading");
    const chips = [...document.querySelectorAll(".ops-cmd-chip")].map((el) => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent?.trim(), h: r.height, w: r.width };
    });
    const ctas = [...document.querySelectorAll(".ops-attention-cta, .ops-dash-secondary-cta, .quote-new-btn")].map(
      (el) => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent?.trim(), w: r.width, h: r.height, clipped: r.right > clientWidth + 1 };
      },
    );
    const titleNoise = document.body.innerText.includes("תמונת מצב");
    const statusNoise = ["טיוטות", "נשלחו", "נצפו", "אושרו", "נדחו"].some((label) =>
      [...document.querySelectorAll(".ops-status-chip")].some((el) => el.textContent?.includes(label)),
    );
    const order = {
      attentionTop: attention?.getBoundingClientRect().top ?? null,
      todayTop: today?.getBoundingClientRect().top ?? null,
      commercialTop: commercial?.getBoundingClientRect().top ?? null,
    };
    return {
      horizontalOverflow: scrollWidth > clientWidth + 2,
      scrollWidth,
      clientWidth,
      chips,
      ctas,
      titleNoise,
      statusNoise,
      order,
      quiet: Boolean(document.body.innerText.includes("אין כרגע פריטים שדורשים טיפול")),
      hasAttentionRows: document.querySelectorAll(".ops-attention-row").length,
      hasRecent: document.querySelectorAll(".ops-recent-row").length,
      hasApex: Boolean(document.querySelector(".ops-commercial-apex .apexcharts-canvas")),
      hasFullAnalysis: Boolean(
        [...document.querySelectorAll("a")].some((a) => a.textContent?.includes("הצג ניתוח מלא")),
      ),
    };
  });

  report.viewports[vp.name] = { shot: path.basename(shot), ...metrics };
  await ctx.close();
}

report.checks.noHorizontalScroll = Object.values(report.viewports).every((v) => !v.horizontalOverflow);
report.checks.noTitleNoise = Object.values(report.viewports).every((v) => !v.titleNoise);
report.checks.noStatusNoise = Object.values(report.viewports).every((v) => !v.statusNoise);
report.checks.hierarchyOk = Object.values(report.viewports).every((v) => {
  const { attentionTop, todayTop, commercialTop } = v.order;
  if (attentionTop == null) return true;
  if (todayTop != null && todayTop < attentionTop) return false;
  if (commercialTop != null && commercialTop < attentionTop) return false;
  return true;
});
report.checks.mobileCtasReachable = ["mobile-375", "mobile-390", "mobile-430"].every((k) => {
  const v = report.viewports[k];
  return (v.ctas || []).every((c) => !c.clipped && c.h >= 40);
});
report.checks.chipsTappable = ["mobile-375", "mobile-390", "mobile-430"].every((k) => {
  const v = report.viewports[k];
  return (v.chips || []).every((c) => c.h >= 40);
});

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
