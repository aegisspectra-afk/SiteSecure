/**
 * Dashboard visual redesign QA — viewports + Commercial Pulse isolation check.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "_dashboard_visual_qa");
const TOKEN_PATH = path.join(ROOT, "apps/api/scripts/.tmp_import_token");
const API = process.env.API_URL || "http://127.0.0.1:8010";
const WEB = process.env.WEB_URL || "http://127.0.0.1:5173";

if (!fs.existsSync(TOKEN_PATH)) {
  console.error("Missing token", TOKEN_PATH);
  process.exit(1);
}
const TOKEN = fs.readFileSync(TOKEN_PATH, "utf8").trim();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");

const session = await fetch(`${API}/api/v1/auth/session`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
const ws = session.memberships?.[0]?.workspace_id;
if (!ws) throw new Error("No workspace");

fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
];

const browser = await chromium.launch({ headless: true });
const report = { web: WEB, api: API, workspace: ws, viewports: {}, commercial: {} };

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
        user: { id: "qa" },
      }),
    },
  );
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".ops-dashboard-visual, .ops-attention-card, .ops-commercial-card", {
    timeout: 90000,
  });
  await page.waitForSelector(".ops-dash-hero-hello, #command-heading, #commercial-pulse-heading", {
    timeout: 90000,
  });
  // Allow secondary queries (usage/leads) to settle without blocking forever.
  await page.waitForTimeout(2500);

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowX: doc.scrollWidth > doc.clientWidth + 1,
    };
  });

  const commercial = await page.evaluate(() => {
    const el = document.querySelector(".ops-commercial-card");
    if (!el) return { present: false };
    const cs = getComputedStyle(el);
    const strip = el.querySelector(".ops-commercial-strip");
    return {
      present: true,
      className: el.className,
      padding: cs.padding,
      borderTop: cs.borderTop,
      borderRadius: cs.borderRadius,
      background: cs.backgroundColor,
      opacity: cs.opacity,
      stripItemCount: strip ? strip.querySelectorAll(".ops-commercial-strip-item").length : 0,
      hasChart: Boolean(el.querySelector(".ops-commercial-chart, .ops-commercial-apex")),
      title: el.querySelector("#commercial-pulse-heading")?.textContent?.trim() || null,
    };
  });

  const shot = path.join(OUT, `${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  report.viewports[vp.name] = { overflow, shot: path.basename(shot), commercial };
  if (vp.name === "1280") report.commercial = commercial;
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
