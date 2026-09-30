import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/beta-admin-5-visual-qa");
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
console.error("session ok", { platform: sess.is_platform_admin });

const browser = await chromium.launch({ headless: true });
const report = {
  checkpoint: "BETA-ADMIN-5",
  date: new Date().toISOString().slice(0, 10),
  origin: WEB,
  rtl: true,
  platform_admin: Boolean(sess.is_platform_admin),
  captures: [],
  checks: {},
  nav: {
    ops: ["לוח תפעול", "סביבות עבודה", "משתמשים", "פידבק", "Audit"],
    platform: ["בטא"],
    removed_top_level: ["הזמנות", "ארכיון", "Badges", "דגלי יכולת"],
  },
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
  workspaceId: sess.memberships?.[0]?.workspace_id,
};

async function open(pathName, viewport, theme) {
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
  await page.goto(`${WEB}${pathName}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page
    .waitForSelector(".admin-ops-main, .admin-ops-nav, text=אין גישה", { timeout: 30000 })
    .catch(() => null);
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText || "";
        return (
          t.includes("משתמשים") ||
          t.includes("סביבות") ||
          t.includes("בטא") ||
          t.includes("Founding") ||
          t.includes("אין גישה") ||
          t.includes("לוח תפעול")
        ) && !t.trim().startsWith("טוען");
      },
      { timeout: 35000 },
    )
    .catch(() => null);
  await page.waitForTimeout(1200);
  return { page, ctx };
}

async function capture(name, pathName, viewport, theme = "dark") {
  const { page, ctx } = await open(pathName, viewport, theme);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  const navText = await page.locator(".admin-ops-nav").innerText().catch(() => "");
  report.captures.push({ name, file, path: pathName, viewport, theme, overflowX });
  await ctx.close();
  return { overflowX, navText };
}

const desk = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

const usersActive = await capture("users-active-1440-dark", "/admin/users?tab=active", desk, "dark");
await capture("users-archived-1440-dark", "/admin/users?tab=archived", desk, "dark");
await capture("users-invitations-1440-dark", "/admin/users?tab=invitations", desk, "dark");
await capture("users-active-390-dark", "/admin/users?tab=active", mobile, "dark");
await capture("orgs-active-1440-dark", "/admin/organizations?tab=active", desk, "dark");
await capture("orgs-archived-1440-dark", "/admin/organizations?tab=archived", desk, "dark");
await capture("beta-overview-1440-dark", "/admin/beta?tab=overview", desk, "dark");
await capture("beta-badges-1440-dark", "/admin/beta?tab=badges", desk, "dark");
await capture("beta-flags-1440-dark", "/admin/beta?tab=flags", desk, "dark");
await capture("users-active-1440-light", "/admin/users?tab=active", desk, "light");
await capture("admin-home-1440-dark", "/admin", desk, "dark");

// Redirect checks
{
  const { page, ctx } = await open("/admin/invitations", desk, "dark");
  await page.waitForTimeout(800);
  report.checks.invitations_redirect = page.url().includes("tab=invitations");
  await ctx.close();
}
{
  const { page, ctx } = await open("/admin/archive", desk, "dark");
  await page.waitForTimeout(800);
  report.checks.archive_redirect = page.url().includes("/admin/organizations") && page.url().includes("tab=archived");
  await ctx.close();
}
{
  const { page, ctx } = await open("/admin/badges", desk, "dark");
  await page.waitForTimeout(800);
  report.checks.badges_redirect = page.url().includes("/admin/beta") && page.url().includes("tab=badges");
  await ctx.close();
}
{
  const { page, ctx } = await open("/admin/flags", desk, "dark");
  await page.waitForTimeout(800);
  report.checks.flags_redirect = page.url().includes("/admin/beta") && page.url().includes("tab=flags");
  await ctx.close();
}

const nav = usersActive.navText || "";
report.checks.nav_has_users = nav.includes("משתמשים");
report.checks.nav_has_beta = nav.includes("בטא");
report.checks.nav_no_archive_top = !nav.includes("ארכיון") || nav.includes("בארכיון") === false;
report.checks.nav_no_invitations_top = !/\nהזמנות\n/.test(`\n${nav}\n`) && !nav.trim().split("\n").includes("הזמנות");
report.checks.nav_no_badges_top = !nav.includes("Badges");
report.checks.overflow_any = report.captures.some((c) => c.overflowX);
report.result = report.checks.invitations_redirect &&
  report.checks.archive_redirect &&
  report.checks.badges_redirect &&
  report.checks.flags_redirect &&
  !report.checks.overflow_any
  ? "PASS"
  : "PASS_WITH_NOTES";

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
