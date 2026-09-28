/**
 * Topbar Avatar man visibility QA.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/topbar-avatar-qa");

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
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
fs.mkdirSync(OUT, { recursive: true });

const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
const tokenJson = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());

if (!tokenJson.access_token) {
  console.error("auth failed", tokenJson);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const report = { shots: [], notes: [] };

async function shot(name, theme, width, height) {
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
        user: { id: "qa" },
      }),
    },
  );
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".ops-topbar", { timeout: 60000 });
  await page.waitForSelector(".ops-topbar .ops-account-avatar-img", { timeout: 30000 });
  const info = await page.evaluate(() => {
    const img = document.querySelector(".ops-topbar .ops-account-avatar-img");
    if (!img) return { present: false };
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    return {
      present: true,
      src: img.getAttribute("src"),
      w: Math.round(r.width),
      h: Math.round(r.height),
      visible: r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none",
      objectFit: cs.objectFit,
    };
  });
  report.notes.push({ name, ...info });
  const file = path.join(OUT, `${name}.png`);
  await page.locator(".ops-topbar").screenshot({ path: file });
  report.shots.push({ name, file: path.relative(ROOT, file), theme, width, height, info });
  await ctx.close();
}

await shot("desktop-1440-light", "light", 1440, 900);
await shot("desktop-1440-dark", "dark", 1440, 900);
await shot("mobile-390-light", "light", 390, 844);
await shot("mobile-390-dark", "dark", 390, 844);
await shot("mobile-360-dark", "dark", 360, 740);

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
