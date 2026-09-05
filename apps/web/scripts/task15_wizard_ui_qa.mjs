/**
 * Minimal wizard open + opacity check (mirrors working _debug_wizard_open auth).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "_task15_wizard_ui_qa");
const TOKEN_PATH = path.join(ROOT, "apps/api/scripts/.tmp_import_token");
const API = process.env.API_URL || "http://127.0.0.1:8000";
const WEB = process.env.WEB_URL || "http://127.0.0.1:5180";

fs.mkdirSync(OUT, { recursive: true });
spawnSync("python", ["scripts/get_owner_token.py"], {
  cwd: path.join(ROOT, "apps/api"),
  stdio: "inherit",
  shell: true,
});
const TOKEN = fs.readFileSync(TOKEN_PATH, "utf8").trim();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
const session = await fetch(`${API}/api/v1/auth/session`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
const ws = session.memberships?.[0]?.workspace_id;
console.log("ws", ws, "user", user?.id);

const browser = await chromium.launch({ headless: true });
const report = { checks: {}, screenshots: {} };

async function withAuth(viewport, theme) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(
    ({ key, value, workspaceId, theme }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("ss.last-workspace-id", workspaceId);
      localStorage.setItem("ss-theme", theme);
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
      workspaceId: ws,
      theme,
    },
  );
  return ctx;
}

for (const theme of ["light", "dark"]) {
  for (const vp of [
    { name: "desktop-1280", width: 1280, height: 800 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "mobile-390", width: 390, height: 844 },
  ]) {
    const label = `${theme}-${vp.name}`;
    const ctx = await withAuth({ width: vp.width, height: vp.height }, theme);
    const page = await ctx.newPage();
    if (theme === "dark") {
      await page.addInitScript(() => document.documentElement.classList.add("dark"));
    }
    await page.goto(`${WEB}/app/catalog`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => !document.body.innerText.includes("טוען"), null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(500);

    const storage = await page.evaluate(() => ({
      remember: localStorage.getItem("ss.remember-device"),
      ws: localStorage.getItem("ss.last-workspace-id"),
      keys: Object.keys(localStorage).filter((k) => k.includes("auth") || k.startsWith("sb-")),
      url: location.href,
    }));
    console.log(label, "storage", storage);

    const btn = page.getByRole("button", { name: "ייבוא קטלוג" });
    if ((await btn.count()) === 0) {
      await page.screenshot({ path: path.join(OUT, `fail-${label}.png`) });
      throw new Error(`no button ${label} url=${page.url()}`);
    }
    await btn.first().click();
    await page.waitForSelector(".catalog-import-panel", { timeout: 15000 });
    if (theme === "dark") {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await page.waitForTimeout(200);
    }

    const metrics = await page.evaluate(() => {
      const panel = document.querySelector(".catalog-import-panel");
      const backdrop = document.querySelector(".catalog-import-backdrop");
      const pcs = getComputedStyle(panel);
      const bcs = backdrop ? getComputedStyle(backdrop) : null;
      const bg = pcs.backgroundColor;
      let alpha = 1;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(",").map((x) => x.trim());
        if (parts.length === 4) alpha = Number(parts[3]);
      }
      return {
        panelBg: bg,
        panelAlpha: alpha,
        panelOpacity: Number(pcs.opacity),
        panelOpaque: alpha >= 0.98 && Number(pcs.opacity) >= 0.98,
        backdropBg: bcs?.backgroundColor ?? null,
        hasDropzone: Boolean(document.querySelector(".catalog-import-dropzone")),
        hasStepper: Boolean(document.querySelector(".catalog-import-stepper")),
        title: document.querySelector(".catalog-import-header h2")?.textContent ?? null,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        rootZ: getComputedStyle(document.querySelector(".catalog-import-root")).zIndex,
      };
    });

    const shot = path.join(OUT, `${label}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    report.checks[label] = metrics;
    report.screenshots[label] = shot;
    console.log(label, metrics);

    if (theme === "light" && vp.name === "desktop-1280") {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      report.checks.escape_closes = (await page.locator('[role="dialog"]').count()) === 0;
    }
    await ctx.close();
  }
}

report.workspace = ws;
report.web = WEB;
report.api = API;
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const allOpaque = Object.values(report.checks)
  .filter((c) => c && typeof c === "object" && "panelOpaque" in c)
  .every((c) => c.panelOpaque && c.hasDropzone && c.hasStepper && !c.overflowX);

process.exit(allOpaque && report.checks.escape_closes ? 0 : 2);
