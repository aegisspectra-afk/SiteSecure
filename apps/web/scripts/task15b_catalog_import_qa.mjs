/**
 * Task 15B — Catalog Import browser QA (desktop 1280 + mobile 390 smoke).
 * Uses a disposable generated XLSX only (never private supplier files).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "_task15b_qa");
const TOKEN_PATH = path.join(ROOT, "apps/api/scripts/.tmp_import_token");
const API = process.env.API_URL || "http://127.0.0.1:8000";
const WEB_CANDIDATES = [
  process.env.WEB_URL,
  "http://127.0.0.1:5180",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5174",
  "http://localhost:5180",
].filter(Boolean);

async function pickWeb() {
  if (process.env.WEB_URL) return process.env.WEB_URL;
  for (const url of WEB_CANDIDATES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!(res.ok || res.status < 500)) continue;
      const html = await res.text();
      if (/Heart Animation/i.test(html)) continue;
      if (/site.?secure|SiteSecure|sitesecure|id=\"root\"/i.test(html)) return url;
    } catch {
      /* next */
    }
  }
  throw new Error("No SiteSecure web server found");
}

async function apiJson(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, json };
}

function buildFixtureXlsx(filePath) {
  const sku = `QA-${Date.now().toString(36).slice(-6)}`;
  const script = path.join(OUT, "_mk_xlsx.py");
  fs.writeFileSync(
    script,
    `
from openpyxl import Workbook
wb = Workbook()
menu = wb.active
menu.title = "תפריט"
menu.append(["מחירון דמו QA"])
cam = wb.create_sheet("IPC מצלמות")
cam.append(["חזרה"])
cam.append(['מק"ט', "דגם", "מחיר מתקין", "תאור מקוצר", "רזולוציה", "סוג מצלמה", "גודל עדשה"])
cam.append([None, "Series Banner"])
cam.append(["${sku}", "IPC-QA", 227, "מצלמת QA", "4MP", "צינור", "2.8mm"])
wb.save(r"${filePath.replace(/\\/g, "\\\\")}")
print("${sku}")
`,
    "utf8",
  );
  const r = spawnSync("python", [script], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "xlsx build failed");
  return (r.stdout || "").trim().split(/\r?\n/).pop();
}

fs.mkdirSync(OUT, { recursive: true });

// Ensure token
spawnSync("python", ["scripts/get_owner_token.py"], {
  cwd: path.join(ROOT, "apps/api"),
  stdio: "inherit",
  shell: true,
});
if (!fs.existsSync(TOKEN_PATH)) {
  console.error("Missing token");
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

const health = await fetch(`${API}/health`).then((r) => r.json());
const WEB = await pickWeb();

// Create disposable empty workspace for empty-state UX
const wsRes = await fetch(`${supabaseUrl}/rest/v1/rpc/create_workspace`, {
  method: "POST",
  headers: {
    apikey: anon,
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({ p_name: `Import QA ${Date.now().toString(36).slice(-5)}`, p_plan_key: "solo" }),
});
const wsBody = await wsRes.json();
const ws = typeof wsBody === "string" ? wsBody : wsBody;
if (!ws || wsRes.status >= 400) {
  console.error("create_workspace failed", wsRes.status, wsBody);
  process.exit(1);
}

const xlsxPath = path.join(OUT, "disposable-import.xlsx");
const sku = buildFixtureXlsx(xlsxPath);

const report = {
  web: WEB,
  api: API,
  health,
  workspace: ws,
  checks: {},
  screenshots: {},
};

const browser = await chromium.launch({ headless: true });

async function withAuthContext(viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(
    ({ key, value, workspaceId }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("ss.last-workspace-id", workspaceId);
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
    },
  );
  return ctx;
}

// Desktop flow
{
  const ctx = await withAuthContext({ width: 1280, height: 900 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);
  await page.goto(`${WEB}/app/catalog`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.body.innerText.includes("טוען"), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(500);

  const emptyImport = page.getByRole("button", { name: "ייבוא קטלוג" });
  const emptyManual = page.getByRole("button", { name: /הוסף מוצר ידנית|פריט חדש/ });
  const emptyTemplate = page.getByRole("button", { name: "הורד תבנית Excel" });
  report.checks.empty_import = await emptyImport.first().isVisible().catch(() => false);
  report.checks.empty_manual = await emptyManual.first().isVisible().catch(() => false);
  report.checks.empty_template = await emptyTemplate.first().isVisible().catch(() => false);
  report.checks.empty_copy = (await page.locator("body").innerText()).includes("הקטלוג שלך עדיין ריק");

  const shotEmpty = path.join(OUT, "desktop-1280-empty.png");
  await page.screenshot({ path: shotEmpty, fullPage: true });
  report.screenshots.empty = shotEmpty;

  await emptyImport.first().click();
  await page.waitForTimeout(400);
  const parseWait = page.waitForResponse(
    (r) => r.url().includes("/catalog/import/parse") && r.request().method() === "POST",
    { timeout: 90000 },
  );
  await page.locator('input[type="file"]').setInputFiles(xlsxPath);
  const parseRes = await parseWait;
  report.checks.parse_status = parseRes.status();
  await page.waitForTimeout(500);

  // Advance wizard: sheets → mapping → preview → commit
  for (let i = 0; i < 10; i++) {
    const confirm = page.getByRole("button", { name: /ייבא \d+ מוצרים/ });
    if (await confirm.isVisible().catch(() => false)) {
      const enabled = await confirm.isEnabled();
      if (!enabled) break;
      report.checks.confirm_label = await confirm.innerText();
      const commitWait = page.waitForResponse(
        (r) => r.url().includes("/catalog/import/commit") && r.request().method() === "POST",
        { timeout: 90000 },
      );
      await confirm.click();
      const commitRes = await commitWait;
      report.checks.commit_status = commitRes.status();
      break;
    }
    const validate = page.getByRole("button", { name: /בדיקה ותצוגה מקדימה/ });
    if (await validate.isVisible().catch(() => false)) {
      // Ensure category mapping for active sheet(s)
      const cat = page.locator("#imp-cat");
      if (await cat.count()) {
        const options = await cat.locator("option").allTextContents();
        const camOpt = options.find((t) => /מצלמ|cameras|IP/i.test(t)) || options.find((t) => t && !/הכל|all/i.test(t));
        if (camOpt) {
          await cat.selectOption({ label: camOpt });
        }
      }
      const mfr = page.locator("#imp-mfr");
      if (await mfr.count()) await mfr.fill("QABrand");
      if (!(await validate.isEnabled())) {
        // try next included sheet tabs if any
        const sheetTabs = page.locator("button").filter({ hasText: /IPC|NVR|HDD|Switch|מצלמ/ });
        const n = await sheetTabs.count();
        for (let si = 0; si < n; si++) {
          await sheetTabs.nth(si).click();
          await page.waitForTimeout(200);
          if (await cat.count()) {
            const options = await cat.locator("option").allTextContents();
            const hit = options.find((t) => /מצלמ|NVR|HDD|Switch|דיסק|מתג/i.test(t));
            if (hit) await cat.selectOption({ label: hit });
          }
        }
      }
      if (!(await validate.isEnabled())) {
        report.checks.validate_disabled = true;
        break;
      }
      const prevWait = page.waitForResponse(
        (r) => r.url().includes("/catalog/import/preview") && r.request().method() === "POST",
        { timeout: 60000 },
      );
      await validate.click();
      report.checks.preview_status = (await prevWait).status();
      await page.waitForTimeout(600);
      continue;
    }
    const nextBtn = page.getByRole("button", { name: "המשך" });
    if (await nextBtn.isVisible().catch(() => false) && (await nextBtn.isEnabled())) {
      await nextBtn.click();
      await page.waitForTimeout(700);
      continue;
    }
    break;
  }

  await page.waitForTimeout(1000);
  const shotDone = path.join(OUT, "desktop-1280-import.png");
  await page.screenshot({ path: shotDone, fullPage: true });
  report.screenshots.import = shotDone;

  // Prefer wizard close + refresh
  const openCatalog = page.getByRole("button", { name: "פתח קטלוג" });
  if (await openCatalog.isVisible().catch(() => false)) {
    await openCatalog.click();
    await page.waitForTimeout(800);
  } else {
    await page.goto(`${WEB}/app/catalog`, { waitUntil: "networkidle" });
  }
  await page.waitForFunction(() => !document.body.innerText.includes("טוען"), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const bodyText = await page.locator("body").innerText();
  report.checks.product_visible = bodyText.includes(sku) || bodyText.includes("IPC-QA") || bodyText.includes("מצלמת QA");
  const shotCatalog = path.join(OUT, "desktop-1280-catalog.png");
  await page.screenshot({ path: shotCatalog, fullPage: true });
  report.screenshots.catalog = shotCatalog;
  await ctx.close();
}

// API persistence proof (authoritative for refresh)
const products = await apiJson(TOKEN, `${API}/api/v1/workspaces/${ws}/catalog/products?limit=50&q=${encodeURIComponent(sku)}`);
report.checks.api_product_count = products.json?.items?.length ?? 0;
report.checks.api_product_sku = products.json?.items?.[0]?.sku ?? null;
report.checks.product_persisted = Boolean(products.json?.items?.some((p) => p.sku === sku));


// Mobile smoke
{
  const ctx = await withAuthContext({ width: 390, height: 844 });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/catalog`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.body.innerText.includes("טוען"), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() => {
    const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return { scrollWidth: sw, clientWidth: document.documentElement.clientWidth, overflow: sw > document.documentElement.clientWidth + 1 };
  });
  report.checks.mobile_overflow = overflow;
  const importBtn = page.getByRole("button", { name: "ייבוא קטלוג" });
  if (await importBtn.isVisible().catch(() => false)) {
    await importBtn.click();
    await page.waitForTimeout(500);
  }
  const shotMobile = path.join(OUT, "mobile-390.png");
  await page.screenshot({ path: shotMobile, fullPage: true });
  report.screenshots.mobile = shotMobile;
  await ctx.close();
}

await browser.close();

// HTTP template + authz smoke against live API
const targets = await apiJson(TOKEN, `${API}/api/v1/workspaces/${ws}/catalog/import/targets`);
report.checks.targets_status = targets.status;
const tpl = await fetch(`${API}/api/v1/workspaces/${ws}/catalog/import/template`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
report.checks.template_status = tpl.status;
report.checks.template_pk = (await tpl.arrayBuffer()).byteLength > 100 && true;

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

process.exit(
  report.checks.empty_import &&
    report.checks.empty_manual &&
    report.checks.empty_template &&
    report.checks.targets_status === 200 &&
    report.checks.template_status === 200 &&
    report.checks.parse_status === 200 &&
    report.checks.preview_status === 200 &&
    report.checks.commit_status === 200 &&
    report.checks.product_persisted &&
    !report.checks.mobile_overflow?.overflow
    ? 0
    : 2,
);
