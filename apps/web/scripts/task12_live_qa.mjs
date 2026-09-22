/**
 * Task 12 — quote approval → project continuity QA (Playwright).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "_task12_qa");
const TOKEN = fs.readFileSync(path.join(ROOT, "apps/api/scripts/.tmp_import_token"), "utf8").trim();
const API = "http://127.0.0.1:8000";
const WEB = process.env.WEB_URL || "http://localhost:5174";

async function api(token, url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, text };
  }
}

const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = supabaseUrl.match(/https:\/\/([^.]+)/)[1];
const anon = env.match(/SUPABASE_ANON_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: anon, Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

const session = await api(TOKEN, `${API}/api/v1/auth/session`);
const ws = session.memberships[0].workspace_id;

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
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

const report = { flows: {} };

// Find an approved quote or use known test quote
const quotes = (await api(TOKEN, `${API}/api/v1/workspaces/${ws}/quotes?limit=20`)).items || [];
const approved = quotes.find((q) => q.status === "approved");
const sent = quotes.find((q) => q.status === "sent" || q.status === "viewed");
const rejected = quotes.find((q) => q.status === "rejected");

if (approved) {
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/quotes/${approved.id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#quote-items", { timeout: 30000 });
  const projects = (
    await api(TOKEN, `${API}/api/v1/workspaces/${ws}/projects?source_quote_id=${approved.id}&limit=1`)
  ).items || [];
  const toolbar = page.getByRole("toolbar", { name: "פעולות הצעה" });
  const hasToolbar = await toolbar.count();
  report.flows.approved = {
    quote: approved.number,
    hasApprovedBanner: await page.getByText("ההצעה אושרה").count(),
    hasCreate: await page.getByRole("button", { name: "יצירת פרויקט" }).count(),
    hasOpen: await page.getByRole("button", { name: "פתיחת הפרויקט" }).count(),
    linkedProject: projects[0]?.id || null,
    mobileToolbar: hasToolbar > 0,
  };
  await page.screenshot({ path: path.join(OUT, "approved-390.png") });
  await page.close();
}

if (sent) {
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/quotes/${sent.id}`, { waitUntil: "networkidle" });
  report.flows.sent = {
    quote: sent.number,
    waitingBanner: await page.getByLabel("ממתין לאישור הלקוח").count(),
    statusWaiting: (await page.locator(".cpq-header-status-pill").innerText()).includes("ממתין"),
  };
  await page.close();
}

if (rejected) {
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/quotes/${rejected.id}`, { waitUntil: "networkidle" });
  report.flows.rejected = {
    quote: rejected.number,
    rejectedBanner: await page.getByText("ההצעה נדחתה").count(),
    reviseButton: await page.getByRole("button", { name: "גרסה חדשה" }).count(),
  };
  await page.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
