import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/beta-admin-4-visual-qa");
fs.mkdirSync(OUT, { recursive: true });

const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${k}`);
  return m[1].trim().replace(/^["']|["']$/g, "");
};
const supabaseUrl = get("SUPABASE_URL").replace(/\/$/, "");
const anon = get("SUPABASE_ANON_KEY");
const service = get("SUPABASE_SERVICE_ROLE_KEY");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const API = process.env.API_URL || "http://127.0.0.1:8000";
const WEB = process.env.WEB_URL || "http://localhost:5173";
const EMAIL = process.env.PLATFORM_ADMIN_EMAIL || "aegisspectra@gmail.com";

console.error("auth start", EMAIL, API, WEB);
const link = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email: EMAIL }),
}).then((r) => r.json());
const props = link.properties || link;
const payload = props.hashed_token
  ? { type: "magiclink", token_hash: props.hashed_token }
  : { type: "email", email: EMAIL, token: props.email_otp };
const grant = await fetch(`${supabaseUrl}/auth/v1/verify`, {
  method: "POST",
  headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
}).then((r) => r.json());
if (!grant.access_token) {
  console.error("auth failed", grant);
  process.exit(1);
}
console.error("auth ok");
const TOKEN = grant.access_token;
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
const sess = await fetch(`${API}/api/v1/auth/session`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then(async (r) => {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("session failed", r.status, body);
    process.exit(1);
  }
  return body;
});
console.error("session ok", { platform: sess.is_platform_admin, ws: sess.memberships?.[0]?.workspace_id });
const ws = sess.memberships?.[0]?.workspace_id;

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem("ss.theme", t);
    document.documentElement.dataset.theme = t;
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

const browser = await chromium.launch({ headless: true });
const report = {
  checkpoint: "BETA-ADMIN-4",
  date: new Date().toISOString().slice(0, 10),
  origin: `${WEB}/admin`,
  rtl: true,
  platform_admin: Boolean(sess.is_platform_admin),
  viewports: {},
  captures: [],
  checks: {},
};

const authInit = {
  key: `sb-${ref}-auth-token`,
  value: JSON.stringify({
    access_token: TOKEN,
    refresh_token: grant.refresh_token || "qa",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user,
  }),
  workspaceId: ws,
};

async function openAdmin(viewport, theme) {
  const ctx = await browser.newContext({
    viewport,
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  await ctx.addInitScript(
    ({ key, value, workspaceId, theme }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("ss.theme", theme);
      if (workspaceId) localStorage.setItem("ss.last-workspace-id", workspaceId);
      localStorage.setItem(key, value);
    },
    { ...authInit, theme },
  );
  const page = await ctx.newPage();
  console.error(`open ${viewport.width}x${viewport.height} ${theme}`);
  await page.goto(`${WEB}/admin`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("h1.admin-cc-title, text=אין גישה", { timeout: 30000 }).catch(() => null);
  // Wait until summary finishes (snapshot leaves ellipsis) or error appears.
  await page
    .waitForFunction(
      () => {
        const body = document.body?.innerText || "";
        if (/אין גישה ללוח הניהול|לא ניתן לטעון את מדדי/.test(body)) return true;
        const vals = [...document.querySelectorAll(".admin-cc-snap-value")].map((el) => el.textContent?.trim());
        return vals.length > 0 && vals.every((v) => v && v !== "…");
      },
      { timeout: 45000 },
    )
    .catch(() => null);
  await page.waitForTimeout(500);
  await setTheme(page, theme);
  await page.waitForTimeout(200);
  return { ctx, page };
}

const shots = [
  { name: "1440-dark.png", w: 1440, h: 1100, theme: "dark" },
  { name: "1440-light.png", w: 1440, h: 1100, theme: "light" },
  { name: "1032-dark.png", w: 1032, h: 1000, theme: "dark" },
  { name: "768-dark.png", w: 768, h: 1100, theme: "dark" },
  { name: "390-dark.png", w: 390, h: 900, theme: "dark" },
  { name: "360-dark.png", w: 360, h: 900, theme: "dark" },
];

for (const s of shots) {
  const { ctx, page } = await openAdmin({ width: s.w, height: s.h }, s.theme);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const title = await page.locator("h1.admin-cc-title").innerText().catch(() => "");
  const attentionEmpty = await page.locator(".admin-cc-empty-title").first().isVisible().catch(() => false);
  const attentionRows = await page.locator(".admin-cc-attention-row").count();
  const statusDisconnected = await page.locator(".admin-cc-status-chip.is-disconnected").count();
  const statusOk = await page.locator(".admin-cc-status-chip.is-ok").count();
  await shot(page, s.name);
  report.captures.push(s.name);
  report.viewports[`${s.w}-${s.theme}`] = {
    theme: s.theme,
    overflowX,
    title,
    attentionRows,
    attentionEmpty,
    statusOk,
    statusDisconnected,
    result: !overflowX && /Founding Beta Operations/.test(title) ? "PASS" : "FAIL",
  };
  await ctx.close();
}

// State captures at 1440 dark
{
  const { ctx, page } = await openAdmin({ width: 1440, height: 1100 }, "dark");
  const attentionRows = await page.locator(".admin-cc-attention-row").count();
  if (attentionRows > 0) {
    await shot(page, "attention-populated.png");
    report.captures.push("attention-populated.png");
  } else {
    await shot(page, "attention-empty.png");
    report.captures.push("attention-empty.png");
  }

  // Toggle to include QA noise
  const allBtn = page.getByRole("radio", { name: /כולל QA/ });
  if (await allBtn.isVisible().catch(() => false)) {
    await allBtn.click();
    await page.waitForTimeout(400);
    await shot(page, "grouped-qa-noise.png");
    report.captures.push("grouped-qa-noise.png");
  }

  // Long email visibility — use pending invite if present
  const longEmail = await page.locator(".admin-cc-data-title.ltr-meta").first().innerText().catch(() => "");
  if (longEmail) {
    await shot(page, "long-email.png");
    report.captures.push("long-email.png");
  }

  await shot(page, "status-connected-disconnected.png");
  report.captures.push("status-connected-disconnected.png");

  // If attention was populated, also force empty screenshot via filter if possible
  if (attentionRows > 0) {
    // capture empty state note from feedback if present
    const emptyFb = page.locator(".admin-cc-empty-title").filter({ hasText: /feedback|No real/i });
    if (await emptyFb.count()) {
      await emptyFb.first().scrollIntoViewIfNeeded();
      await shot(page, "attention-empty.png");
      report.captures.push("attention-empty-feedback.png");
    }
  }

  const body = await page.locator("body").innerText();
  report.checks = {
    heading: /Founding Beta Operations/.test(body),
    cta: /צרף Founding Technician/.test(body),
    attention: /דורש תשומת לב/.test(body),
    snapshot: /Beta Snapshot/.test(body),
    funnel: /משפך/.test(body),
    systemDetails: /פרטי מערכת/.test(body),
    requestId: /חקירת תקלה/.test(body),
    noSearch: /אין חיפוש לוגים מובנה/.test(body),
    classifierNote: /לא מסווג אמין|סיווג QA/.test(body),
    denied: /אין גישה ללוח הניהול/.test(body),
  };
  await ctx.close();
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
const ok =
  report.platform_admin &&
  !report.checks.denied &&
  report.checks.heading &&
  report.checks.attention &&
  Object.values(report.viewports).every((v) => v.result === "PASS");
process.exit(ok ? 0 : 2);
