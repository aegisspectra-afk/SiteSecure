/**
 * LANDING-V2 — seed a disposable demo workspace and capture real product UI.
 * Writes screenshots only. Does not print emails, passwords, or tokens.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/landing-v2-snapshots");
fs.mkdirSync(OUT, { recursive: true });

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    out[trimmed.slice(0, i)] = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...loadEnv(path.join(ROOT, ".env")),
  ...loadEnv(path.join(ROOT, "apps/api/.env")),
  ...loadEnv(path.join(ROOT, "apps/web/.env")),
};

const API = "http://127.0.0.1:8000";
const WEB = "http://localhost:5173";
const SUPABASE = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || "";
const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const ownerEmail = `landing.owner.${stamp}@aegis-demo.test`;
const techEmail = `landing.tech.${stamp}@aegis-demo.test`;
const ownerPass = `LandingV2-Owner-${stamp}-Qa!`;
const techPass = `LandingV2-Tech-${stamp}-Qa!`;

if (!SUPABASE || !ANON || !SERVICE) {
  console.error("missing supabase env");
  process.exit(1);
}

const ref = SUPABASE.match(/https:\/\/([^.]+)/)?.[1];
if (!ref) {
  console.error("bad supabase url");
  process.exit(1);
}

async function json(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 180) };
  }
  if (!res.ok) {
    const err = body?.error || body || {};
    const code = err.code || err.error_code || res.status;
    const message = String(err.message || err.msg || "").slice(0, 180);
    throw new Error(`${opts.method || "GET"} ${url.replace(SUPABASE, "supabase").replace(API, "api")} ${res.status} ${code} ${message}`);
  }
  return body;
}

async function ensureUser(email, password, fullName) {
  return json(`${SUPABASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });
}

async function tokenFor(email, password) {
  const body = await json(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!body.access_token) throw new Error("auth failed");
  return body;
}

function api(token, pathname, opts = {}) {
  return json(`${API}${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

await ensureUser(ownerEmail, ownerPass, "Aegis Demo");
await ensureUser(techEmail, techPass, "Daniel");
const ownerAuth = await tokenFor(ownerEmail, ownerPass);
const ownerTok = ownerAuth.access_token;

await api(ownerTok, "/api/v1/me", {
  method: "PATCH",
  body: JSON.stringify({ full_name: "Aegis Demo" }),
});

const workspace = await api(ownerTok, "/api/v1/workspaces", {
  method: "POST",
  body: JSON.stringify({ name: "Aegis Security Demo", business_type: "security_company" }),
});

await api(ownerTok, `/api/v1/workspaces/${workspace.id}`, {
  method: "PATCH",
  body: JSON.stringify({ timezone: "Asia/Jerusalem", vat_percent: 18 }),
});

const customer = await api(ownerTok, `/api/v1/workspaces/${workspace.id}/customers`, {
  method: "POST",
  body: JSON.stringify({
    display_name: "Golda Meir School",
    type: "business",
    legal_name: "Golda Meir School",
  }),
});

const site = await api(ownerTok, `/api/v1/workspaces/${workspace.id}/sites`, {
  method: "POST",
  body: JSON.stringify({
    customer_id: customer.id,
    name: "Herzl 12",
    address: { line: "Herzl 12, Tel Aviv", city: "Tel Aviv" },
    installation_status: "completed",
  }),
});

const quote = await api(ownerTok, `/api/v1/workspaces/${workspace.id}/quotes`, {
  method: "POST",
  body: JSON.stringify({
    customer_id: customer.id,
    site_id: site.id,
    title: "CCTV Installation",
    project_name: "CCTV Installation",
    project_address: "Herzl 12, Tel Aviv",
    summary: "Four dome cameras, recording, switching, cabling and installation.",
    vat_percent: 18,
    discount_type: "percent",
    discount_value: 5,
    payment_terms: "50% on approval, 50% on completion",
  }),
});

const lines = [
  { name: "Dome 4MP", description: "Dome 4MP", sku: "DOME-4", qty: 4, unit_price: 890, item_type: "free", sort_order: 1 },
  { name: "NVR 8ch", description: "NVR 8ch", sku: "NVR-8", qty: 1, unit_price: 2450, item_type: "free", sort_order: 2 },
  { name: "HDD 4TB", description: "HDD 4TB", sku: "HDD-4", qty: 1, unit_price: 520, item_type: "free", sort_order: 3 },
  { name: "PoE Switch", description: "PoE Switch", sku: "POE-8", qty: 1, unit_price: 740, item_type: "free", sort_order: 4 },
  { name: "Cat6", description: "Cat6", sku: "CAT6", qty: 1, unit_price: 960, item_type: "free", sort_order: 5 },
  { name: "Labor", description: "Labor", sku: "LABOR", qty: 1, unit_price: 1800, item_type: "labor", sort_order: 6 },
  {
    name: "Extra dome",
    description: "Extra dome",
    sku: "OPT-1",
    qty: 1,
    unit_price: 890,
    item_type: "free",
    sort_order: 7,
    is_optional: true,
  },
];

for (const line of lines) {
  await api(ownerTok, `/api/v1/workspaces/${workspace.id}/quotes/${quote.id}/items`, {
    method: "POST",
    body: JSON.stringify(line),
  });
}

const system = await api(ownerTok, `/api/v1/workspaces/${workspace.id}/systems`, {
  method: "POST",
  body: JSON.stringify({
    site_id: site.id,
    type: "cctv",
    name: "CCTV",
    status: "active",
    manufacturer: "Site Secure Demo",
    model: "School CCTV",
  }),
});

const assets = [
  ["CAM-001", "camera", "Dome Camera 4MP", "SS-CAM-001"],
  ["CAM-002", "camera", "Dome Camera 4MP", "SS-CAM-002"],
  ["CAM-003", "camera", "Dome Camera 4MP", "SS-CAM-003"],
  ["CAM-004", "camera", "Dome Camera 4MP", "SS-CAM-004"],
  ["NVR-001", "nvr", "NVR 8ch", "SS-NVR-001"],
  ["SW-001", "switch", "PoE Switch", "SS-SW-001"],
];

const createdAssets = [];
for (const [name, category, model, serial] of assets) {
  const row = await api(ownerTok, `/api/v1/workspaces/${workspace.id}/equipment`, {
    method: "POST",
    body: JSON.stringify({
      site_id: site.id,
      system_id: system.id,
      name,
      category,
      status: "installed",
      manufacturer: "Demo",
      model,
      serial,
      location_note: "Herzl 12, Tel Aviv",
    }),
  });
  createdAssets.push(row);
}

await api(ownerTok, `/api/v1/workspaces/${workspace.id}/warranties`, {
  method: "POST",
  body: JSON.stringify({
    customer_id: customer.id,
    site_id: site.id,
    type: "installation",
    starts_on: "2026-09-30",
    ends_on: "2028-09-30",
  }),
});

const project = await api(ownerTok, `/api/v1/workspaces/${workspace.id}/projects`, {
  method: "POST",
  body: JSON.stringify({
    name: "CCTV Installation",
    customer_id: customer.id,
    site_id: site.id,
    status: "in_progress",
  }),
});

const job = await api(ownerTok, `/api/v1/workspaces/${workspace.id}/jobs`, {
  method: "POST",
  body: JSON.stringify({
    title: "Camera Installation",
    customer_id: customer.id,
    site_id: site.id,
    project_id: project.id,
    kind: "installation",
    scheduled_for: "2026-09-30T06:30:00Z",
    scheduled_end: "2026-09-30T10:30:00Z",
    priority: "normal",
  }),
});

const invite = await api(ownerTok, `/api/v1/workspaces/${workspace.id}/invitations`, {
  method: "POST",
  body: JSON.stringify({ email: techEmail, role_key: "technician" }),
});
if (!invite.token) throw new Error("invite missing token");

const techAuth = await tokenFor(techEmail, techPass);
await api(techAuth.access_token, "/api/v1/me", {
  method: "PATCH",
  body: JSON.stringify({ full_name: "Daniel" }),
});
await api(techAuth.access_token, "/api/v1/invitations/accept", {
  method: "POST",
  body: JSON.stringify({ token: invite.token }),
});
const techSession = await api(techAuth.access_token, "/api/v1/auth/session");
const techUserId = techSession.user_id;
await api(ownerTok, `/api/v1/workspaces/${workspace.id}/jobs/${job.id}/assign`, {
  method: "POST",
  body: JSON.stringify({ user_id: techUserId }),
});

const manifest = {
  company: "Aegis Security Demo",
  customer: "Golda Meir School",
  site: "Herzl 12, Tel Aviv",
  quoteTitle: "CCTV Installation",
  technician: "Daniel",
  quoteId: quote.id,
  siteId: site.id,
  assetId: createdAssets[0]?.id ?? null,
  projectId: project.id,
  jobId: job.id,
  workspaceId: workspace.id,
};
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("seeded", JSON.stringify({ quote: quote.id, site: site.id, job: job.id, assets: createdAssets.length }));

function sessionValue(auth) {
  return JSON.stringify({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token || "qa",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: auth.user,
  });
}

const browser = await chromium.launch({ headless: true });

async function contextFor(auth, width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  await ctx.addInitScript(
    ({ key, value, ws }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", "dark");
      localStorage.setItem("site-secure-sidebar-collapsed", "1");
      localStorage.setItem("ss.last-workspace-id", ws);
      localStorage.setItem("ss.active_workspace_id", ws);
      localStorage.setItem(key, value);
    },
    { key: `sb-${ref}-auth-token`, value: sessionValue(auth), ws: workspace.id },
  );
  return ctx;
}

async function prep(page) {
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.dataset.themeMode = "dark";
    document.documentElement.style.colorScheme = "dark";
  });
}

async function privacyOk(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    return !text.includes("@");
  });
}

async function shotContent(page, name, height = 820) {
  const box = await page.locator(".ops-content").boundingBox();
  if (!box) throw new Error(`no content ${name}`);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({
    path: file,
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.min(box.width, page.viewportSize().width - box.x),
      height: Math.min(height, box.height, page.viewportSize().height - box.y),
    },
  });
  const ok = await privacyOk(page);
  console.log("shot", name, ok ? "private" : "EMAIL-VISIBLE");
  return ok;
}

async function shotViewport(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const ok = await privacyOk(page);
  console.log("shot", name, ok ? "private" : "EMAIL-VISIBLE");
  return ok;
}

const desktop = await contextFor(ownerAuth, 1440, 1280);
const page = await desktop.newPage();

await page.goto(`${WEB}/app/quotes/${quote.id}`, { waitUntil: "networkidle", timeout: 90000 });
await prep(page);
await page.waitForSelector(".cpq-workspace-v2, #quote-items", { timeout: 45000 });
await page.getByText(/Dome 4MP|DOME-4|NVR 8ch|#Q-/).first().waitFor({ timeout: 45000 });
await page.waitForTimeout(500);
await shotContent(page, "01-quote-builder-desktop", 1120);

const pricingTab = page.getByRole("button", { name: /הצעה ומחיר|Pricing/i }).first();
if (await pricingTab.count()) {
  await pricingTab.click();
  await page.waitForTimeout(700);
  await shotContent(page, "02-quote-review-desktop", 980);
} else {
  await page.goto(`${WEB}/app/quotes/${quote.id}/preview`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await prep(page);
  await page.waitForSelector(".quote-doc, #quote-document-print-root, .quote-preview-viewer", { timeout: 30000 });
  await page.waitForTimeout(600);
  await shotContent(page, "02-quote-review-desktop", 980);
}

await page.goto(`${WEB}/app/quotes/${quote.id}/preview`, { waitUntil: "domcontentloaded", timeout: 90000 });
await prep(page);
await page.waitForSelector(".quote-doc, #quote-document-print-root, .quote-preview-viewer", { timeout: 30000 }).catch(async () => {
  console.log("preview-url", page.url().replace(/https?:\/\/[^/]+/, ""));
});
await page.waitForTimeout(700);
await shotContent(page, "02b-quote-preview-desktop", 980);

await page.goto(`${WEB}/app/sites/${site.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await prep(page);
await page.waitForSelector(".site-file", { timeout: 30000 });
await page.getByText("Herzl 12").first().waitFor({ timeout: 20000 });
await page.waitForTimeout(500);
await shotContent(page, "03-site-file-desktop", 780);
const devicesTab = page.getByRole("tab", { name: /ציוד מותקן/ });
if (await devicesTab.count()) {
  await devicesTab.click();
  await page.getByText("CAM-001").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  await shotContent(page, "03b-site-equipment-desktop", 860);
}

const assetId = createdAssets[0].id;
await page.goto(`${WEB}/app/sites/${site.id}/assets/${assetId}`, { waitUntil: "networkidle", timeout: 90000 });
await prep(page);
try {
  await page.getByTestId("asset-detail").waitFor({ timeout: 25000 });
  await page.getByTestId("asset-name").waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  await shotContent(page, "04-asset-detail-desktop", 900);
} catch {
  console.log("asset-skip", page.url().replace(/https?:\/\/[^/]+/, ""));
  const text = await page.locator(".ops-content").innerText().catch(() => "");
  console.log("asset-fallback", text.replace(/\S+@\S+/g, "[redacted]").slice(0, 220));
  // Prefer equipment list as installed-assets marketing visual when detail fails to hydrate.
  if (fs.existsSync(path.join(OUT, "03b-site-equipment-desktop.png"))) {
    fs.copyFileSync(path.join(OUT, "03b-site-equipment-desktop.png"), path.join(OUT, "04-asset-detail-desktop.png"));
    console.log("asset-fallback-copy 03b");
  }
}

await page.goto(`${WEB}/app/projects/${project.id}`, { waitUntil: "networkidle", timeout: 90000 });
await prep(page);
try {
  await page.getByText(/CCTV Installation|פרויקט/).first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(500);
  await shotContent(page, "07-project-desktop", 860);
} catch {
  console.log("project-skip");
}
await desktop.close();

const mobile = await contextFor(techAuth, 390, 844);
const mpage = await mobile.newPage();
await mpage.goto(`${WEB}/app/today`, { waitUntil: "networkidle", timeout: 90000 });
await prep(mpage);
await mpage.waitForSelector(".field-today, .ops-content", { timeout: 30000 });
await mpage.waitForTimeout(1200);
await mpage.getByText(/Camera Installation|התקנת|Today|היום/).first().waitFor({ timeout: 20000 }).catch(async () => {
  const text = await mpage.locator("body").innerText().catch(() => "");
  console.log("today-fallback", text.replace(/\S+@\S+/g, "[redacted]").slice(0, 220));
});
await shotViewport(mpage, "05-today-mobile");

await mpage.goto(`${WEB}/app/jobs/${job.id}`, { waitUntil: "networkidle", timeout: 90000 });
await prep(mpage);
await mpage.waitForSelector(".field-job", { timeout: 30000 });
await mpage.getByText(/Camera Installation|Herzl 12|התקנה/).first().waitFor({ timeout: 15000 }).catch(() => undefined);
await mpage.waitForTimeout(500);
await shotViewport(mpage, "06-fieldjob-mobile");
await mobile.close();
await browser.close();
console.log("done");
