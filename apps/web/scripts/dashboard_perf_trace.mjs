/**
 * Dashboard load timing profiler — captures API waterfall for Beta 0.1.4 stabilization.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "_dashboard_perf");
const TOKEN_PATH = path.join(ROOT, "apps/api/scripts/.tmp_import_token");
const API = process.env.API_URL || "http://127.0.0.1:8010";
const WEB = process.env.WEB_URL || "http://localhost:5174";

const TOKEN = fs.readFileSync(TOKEN_PATH, "utf8").trim();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

fs.mkdirSync(OUT, { recursive: true });

async function timeApi(name, url) {
  const t0 = performance.now();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const text = await res.text();
  const ms = Math.round(performance.now() - t0);
  return { name, url, status: res.status, ms, bytes: text.length };
}

const sessionBody = await (
  await fetch(`${API}/api/v1/auth/session`, { headers: { Authorization: `Bearer ${TOKEN}` } })
).json();
const workspaceId = sessionBody.memberships?.[0]?.workspace_id;
if (!workspaceId) throw new Error("no workspace");

const direct = [];
for (const [name, pathSuffix] of [
  ["dashboard", `/api/v1/workspaces/${workspaceId}/dashboard`],
  ["usage", `/api/v1/workspaces/${workspaceId}/usage`],
  ["leads", `/api/v1/workspaces/${workspaceId}/leads?limit=20`],
  ["customers_probe", `/api/v1/workspaces/${workspaceId}/customers?limit=1`],
]) {
  direct.push(await timeApi(name, `${API}${pathSuffix}`));
  direct.push({ ...(await timeApi(`${name}_warm`, `${API}${pathSuffix}`)), warm: true });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
const network = [];
const wall0 = Date.now();
page.on("response", (res) => {
  const u = res.url();
  if (!(u.includes("/api/") || u.includes(":8010") || u.includes(":8000"))) return;
  network.push({
    atMs: Date.now() - wall0,
    url: u.replace(/^https?:\/\/[^/]+/, "").slice(0, 160),
    method: res.request().method(),
    status: res.status(),
  });
});

const tNav = Date.now();
const marks = {};
await page.goto(`${WEB}/app/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
marks.dom = Date.now() - tNav;

try {
  await page.waitForSelector(".ops-dashboard-skeleton, .ops-dashboard-v3", { timeout: 30000 });
  marks.skeletonOrShell = Date.now() - tNav;
} catch {
  marks.skeletonOrShell = null;
}

try {
  await page.waitForFunction(
    () =>
      Boolean(document.querySelector(".ops-dashboard-v3:not(.ops-dashboard-skeleton) .ops-cmd-header")),
    { timeout: 90000 },
  );
  marks.firstUseful = Date.now() - tNav;
} catch (e) {
  marks.firstUsefulError = String(e);
}

try {
  await page.waitForSelector("#command-attention", { timeout: 30000 });
  marks.commandQueue = Date.now() - tNav;
} catch {
  marks.commandQueue = null;
}

try {
  await page.waitForSelector("#commercial-pulse-heading", { timeout: 30000 });
  marks.commercialPulse = Date.now() - tNav;
} catch {
  marks.commercialPulse = null;
}

await page.waitForTimeout(1200);
marks.settle = Date.now() - tNav;

const body = (await page.locator("body").innerText()).slice(0, 500);
await page.screenshot({ path: path.join(OUT, "perf-1280.png"), fullPage: true });

const report = {
  web: WEB,
  api: API,
  workspaceId,
  direct,
  marks,
  network,
  bodyPreview: body.replace(/\s+/g, " "),
  loadFail: body.includes("לא ניתן לטעון את הסקירה"),
};
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
