import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))[1].trim().replace(/^["']|["']$/g, "");
const supabaseUrl = get("SUPABASE_URL").replace(/\/$/, "");
const anon = get("SUPABASE_ANON_KEY");
const service = get("SUPABASE_SERVICE_ROLE_KEY");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const API = process.env.API_URL || "http://127.0.0.1:8010";
const WEB = process.env.WEB_URL || "http://localhost:5173";
const OUT = path.join(__dirname, "_platform_admin_ui");
fs.mkdirSync(OUT, { recursive: true });

const link = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email: "aegisspectra@gmail.com" }),
}).then((r) => r.json());
const props = link.properties || link;
const payload = props.hashed_token
  ? { type: "magiclink", token_hash: props.hashed_token }
  : { type: "email", email: "aegisspectra@gmail.com", token: props.email_otp };
const grant = await fetch(`${supabaseUrl}/auth/v1/verify`, {
  method: "POST",
  headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
}).then((r) => r.json());
const TOKEN = grant.access_token;
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
const sess = await fetch(`${API}/api/v1/auth/session`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());
const ws = sess.memberships?.[0]?.workspace_id;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(
  ({ key, value, workspaceId }) => {
    localStorage.setItem("ss.remember-device", "1");
    if (workspaceId) localStorage.setItem("ss.last-workspace-id", workspaceId);
    localStorage.setItem(key, value);
  },
  {
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
  },
);
const page = await ctx.newPage();
await page.goto(`${WEB}/app/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const dashText = await page.locator("body").innerText();
await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const adminBody = await page.locator("body").innerText();
await page.screenshot({ path: path.join(OUT, "admin.png"), fullPage: true });
const back = page.getByRole("button", { name: /חזרה ל-SITE SECURE|חזרה לסביבת/ });
const backVisible = await back.isVisible().catch(() => false);
if (backVisible) {
  await back.click();
  await page.waitForTimeout(2500);
}
const report = {
  dash_ok: !/אין גישה ללוח הניהול/.test(dashText) && /SITE SECURE|לוח|דשבורד|מוכן/.test(dashText),
  admin_ok: /PLATFORM ADMIN|לוח ניהול|ניהול פלטפורמה/.test(adminBody),
  admin_denied: /אין גישה ללוח הניהול/.test(adminBody),
  back_visible: backVisible,
  after_back: page.url(),
  platform_role: sess.platform_role,
  is_platform_admin: sess.is_platform_admin,
};
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.admin_ok && !report.admin_denied && report.back_visible ? 0 : 2);
