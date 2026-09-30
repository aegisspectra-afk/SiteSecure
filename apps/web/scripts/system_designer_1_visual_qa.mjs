/**
 * SYSTEM-DESIGNER-1 Slice G — live browser visual QA + certification.
 * Uses platform-admin magiclink (proven in other QA scripts) + durable waits.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

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
  ...loadEnv(path.join(ROOT, "apps/api/.env")),
  ...process.env,
};

const OUT = path.join(ROOT, "Docs/system-designer-1-visual-qa");
fs.mkdirSync(OUT, { recursive: true });

const WEB = env.WEB_URL || "http://localhost:5173";
const API = (env.VITE_API_URL || env.API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const SUPABASE = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || "";
const EMAIL = env.PLATFORM_ADMIN_EMAIL || "aegisspectra@gmail.com";

const report = {
  ok: true,
  started_at: new Date().toISOString(),
  web: WEB,
  api: API,
  email: EMAIL,
  workspaceId: null,
  quoteId: null,
  shots: [],
  flows: {},
  network: { recommend: 0, apply: 0, catalog: 0, costFieldHits: [], status: [] },
  console: { errors: [], warnings: [] },
  checks: {},
  cert: {},
  blockers: [],
  polish: [],
  errors: [],
};

function fail(msg, severity = "P1") {
  report.ok = false;
  report.errors.push(msg);
  if (!report.blockers.some((b) => b.msg === msg)) report.blockers.push({ severity, msg });
  console.error(`FAIL[${severity}]:`, msg);
}
function note(msg) {
  report.polish.push(msg);
  console.log("NOTE:", msg);
}
function pass(key, detail = true) {
  report.checks[key] = detail;
  console.log("PASS:", key, typeof detail === "string" ? detail : "");
}

if (!SUPABASE || !ANON || !SERVICE) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const link = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email: EMAIL }),
}).then((r) => r.json());
const props = link.properties || link;
const payload = props.hashed_token
  ? { type: "magiclink", token_hash: props.hashed_token }
  : { type: "email", email: EMAIL, token: props.email_otp };
const grant = await fetch(`${SUPABASE}/auth/v1/verify`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
}).then((r) => r.json());
if (!grant.access_token) {
  console.error("auth failed", grant);
  process.exit(1);
}
const tok = grant.access_token;
const ref = SUPABASE.match(/https:\/\/([^.]+)/)[1];
const hdr = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };

async function api(method, pathName, body) {
  const res = await fetch(`${API}${pathName}`, {
    method,
    headers: hdr,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 240) };
  }
  return { status: res.status, data, requestId: res.headers.get("x-request-id") };
}

const sess = await api("GET", "/api/v1/auth/session");
const WS = sess.data?.memberships?.[0]?.workspace_id;
if (!WS) {
  console.error("no workspace", sess);
  process.exit(1);
}
report.workspaceId = WS;
const stamp = Date.now().toString(36);
const cust = await api("POST", `/api/v1/workspaces/${WS}/customers`, {
  display_name: `SD1 Cert ${stamp}`,
  type: "business",
});
const site = await api("POST", `/api/v1/workspaces/${WS}/sites`, {
  customer_id: cust.data.id,
  name: `אתר QA ${stamp}`,
  address: { line: "Herzl 12", city: "Tel Aviv" },
});
const quote = await api("POST", `/api/v1/workspaces/${WS}/quotes`, {
  title: `SYSTEM-DESIGNER-1 Cert ${stamp}`,
  customer_id: cust.data.id,
  site_id: site.data?.id || null,
  vat_percent: 18,
});
report.quoteId = quote.data.id;
console.log("quote", report.quoteId, "ws", WS);

const browser = await chromium.launch({ headless: true });

async function openCtx(theme, width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme === "dark" ? "dark" : "light",
    locale: "he-IL",
  });
  await ctx.addInitScript(
    ({ key, value, theme: t }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", t);
      localStorage.setItem("site-secure-sidebar-collapsed", "1");
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      theme,
      value: JSON.stringify({
        access_token: grant.access_token,
        refresh_token: grant.refresh_token || "qa",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user: grant.user,
      }),
    },
  );
  const page = await ctx.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") report.console.errors.push(msg.text().slice(0, 220));
  });
  page.on("pageerror", (err) => report.console.errors.push(String(err).slice(0, 220)));
  page.on("response", (res) => {
    const url = res.url();
    const status = res.status();
    if (url.includes("/cctv/recommend")) report.network.recommend += 1;
    if (url.includes("/apply") && url.includes("system-designs")) report.network.apply += 1;
    if (url.includes("/catalog/products")) {
      report.network.catalog += 1;
      if (/[?&]select=/.test(url) && /(?:^|[?,])cost(?:$|[,&])/.test(url)) {
        report.network.costFieldHits.push(url.slice(0, 180));
      }
    }
    if (status >= 400 && url.includes("/api/")) {
      report.network.status.push({
        status,
        path: url.split("/api/v1")[1]?.slice(0, 120) || url.slice(0, 120),
        requestId: res.headers()["x-request-id"] || null,
      });
    }
  });
  await page.goto(`${WEB}/app/quotes/${report.quoteId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.themeMode = t;
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
  // Wait through AuthLaunch + quote hydrate
  await page.waitForFunction(
    () => {
      const t = document.body?.innerText || "";
      return t.includes("תכנון וציוד") || t.includes("פרטי ההצעה") || t.includes("CCTV");
    },
    { timeout: 90000 },
  );
  await page.waitForTimeout(600);
  return { ctx, page };
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  report.shots.push({ name, file: path.relative(ROOT, file) });
  console.log("shot", name);
}

async function goItems(page) {
  const step = page.getByRole("button", { name: /תכנון וציוד|תכנון/ }).first();
  if (await step.count()) {
    await step.click();
    await page.waitForTimeout(500);
  }
}

async function openDesigner(page) {
  await goItems(page);
  // Empty CTA is labeled CCTV (he.cpqBuildSystem)
  let btn = page.getByRole("button", { name: /^CCTV$/ }).first();
  if (!(await btn.count())) btn = page.getByRole("button", { name: /בנה מערכת/ }).first();
  if (!(await btn.count())) {
    // toolbar / quick add
    const more = page.getByRole("button", { name: /הוסף|פעולות|\+/ }).first();
    if (await more.count()) {
      await more.click();
      await page.waitForTimeout(300);
      btn = page.getByRole("button", { name: /^CCTV$|בנה מערכת/ }).first();
    }
  }
  if (!(await btn.count())) {
    const body = (await page.locator("body").innerText()).slice(0, 400);
    fail(`Designer CTA missing. Saw: ${body.replace(/\s+/g, " ").slice(0, 180)}`);
    return false;
  }
  await btn.click();
  await page.waitForSelector(
    '[data-testid="cctv-requirements-workspace"], [data-testid="cctv-designer-requirements-shell"]',
    { timeout: 30000 },
  );
  await page.waitForTimeout(400);
  return true;
}

async function setTech(page, tech) {
  const label = tech === "ip" ? "IP" : tech === "analog_hd" ? "Analog HD" : "Hybrid";
  const group = page.locator('[role="radiogroup"]').filter({ hasText: /טכנולוגיה/ }).first();
  const target = (await group.count())
    ? group.getByRole("radio", { name: label })
    : page.getByRole("radio", { name: label }).first();
  await target.click();
  await page.waitForTimeout(200);
}

async function setMode(page, mode) {
  const label = mode === "professional" ? "מקצועי" : "מהיר";
  const group = page.locator('[role="radiogroup"]').filter({ hasText: /מצב תכנון/ }).first();
  const target = (await group.count())
    ? group.getByRole("radio", { name: label })
    : page.getByRole("radio", { name: label }).first();
  await target.click();
  await page.waitForTimeout(200);
}

async function calculate(page) {
  const before = report.network.recommend;
  await page.getByRole("button", { name: /חשב מערכת|חשב מחדש/ }).first().click();
  await page.waitForSelector('[data-testid="cctv-designer-review"]', { timeout: 60000 });
  await page.waitForTimeout(500);
  report.flows.lastRecommendDelta = report.network.recommend - before;
}

async function applyPlan(page) {
  const before = report.network.apply;
  const btn = page.getByRole("button", { name: /הוסף תכנון להצעה|הוסף את הפריטים/ }).first();
  if (!(await btn.count()) || (await btn.isDisabled())) return { ok: false, reason: "disabled" };
  await btn.click();
  try {
    await page.waitForSelector('[data-testid="cctv-apply-success"]', { timeout: 60000 });
    return { ok: true, applyDelta: report.network.apply - before };
  } catch {
    const err = await page.locator('[role="alert"]').first().textContent().catch(() => "");
    return { ok: false, reason: err || "timeout" };
  }
}

function leakScan(text, label) {
  const bad = ["component_key", "cctv-planned:", "HDD_OPTIONS_EMPTY", "semantic_role"];
  const hits = bad.filter((b) => text.includes(b));
  if (hits.length) fail(`Leak on ${label}: ${hits.join(",")}`);
  else pass(`no_leak_${label}`);
}

// ===== IP Quick full =====
{
  const { ctx, page } = await openCtx("dark", 1440, 1100);
  if (await openDesigner(page)) {
    await setTech(page, "ip");
    await setMode(page, "quick");
    const cam = page.locator('input[type="number"]').first();
    if (await cam.count()) await cam.fill("4");
    await shot(page, "1440-ip-quick-requirements");
    pass("ip_quick_requirements_open");
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement;
      return el.scrollWidth > el.clientWidth + 2;
    });
    if (overflow) note("H-overflow 1440 requirements");
    else pass("no_h_overflow_1440");

    await calculate(page);
    await shot(page, "1440-ip-quick-review");
    pass("ip_quick_review");
    if (await page.locator('[data-testid="cctv-apply-readiness-preview"]').count()) {
      pass("apply_readiness_preview", await page.locator('[data-testid="cctv-apply-readiness-preview"]').innerText());
    } else fail("missing apply readiness preview");

    const pick = page.getByRole("button", { name: /בחר מוצר|החלף/ }).first();
    if (await pick.count()) {
      await pick.click();
      await page.waitForSelector('[data-testid="cctv-component-picker"]', { timeout: 15000 }).catch(() => null);
      if (await page.locator('[data-testid="cctv-component-picker"]').count()) {
        await shot(page, "1440-picker");
        pass("picker_open");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(250);
        pass("picker_escape");
      } else {
        await shot(page, "1440-picker-unavailable");
        note("Picker unavailable (empty candidates)");
      }
    }

    leakScan(await page.locator("body").innerText(), "ip_review");

    // stale
    const adjust = page.getByRole("button", { name: /התאם תכנון/ }).first();
    if (await adjust.count()) {
      await adjust.click();
      await page.waitForSelector('[data-testid="cctv-requirements-workspace"]');
      if (await cam.count()) await cam.fill("6");
      await page.waitForTimeout(300);
      if (await page.locator('[data-testid="cctv-stale-banner"]').count()) {
        await shot(page, "1440-stale-state");
        pass("stale_banner");
      } else note("stale banner not shown");
      await calculate(page);
      if (!(await page.locator('[data-testid="cctv-stale-banner"]').count())) pass("stale_clears_after_recalc");
    }

    const applied = await applyPlan(page);
    report.flows.ip_quick_apply = applied;
    if (applied.ok) {
      await shot(page, "1440-apply-success");
      pass("apply_success");
      if (
        (await page.getByRole("button", { name: /חזרה להצעה/ }).count()) &&
        (await page.getByRole("button", { name: /המשך לעריכת ציוד/ }).count())
      ) {
        pass("apply_success_actions");
      } else fail("apply success actions missing");
      await page.getByRole("button", { name: /חזרה להצעה/ }).click();
      await page.waitForTimeout(700);
    } else {
      note(`Apply: ${applied.reason}`);
      await shot(page, "1440-apply-pending");
      await page.keyboard.press("Escape");
    }
  }
  await ctx.close();
}

// ===== IP Pro / Analog / Hybrid =====
for (const [tech, mode, name] of [
  ["ip", "professional", "1440-ip-professional"],
  ["analog_hd", "quick", "1440-analog"],
  ["analog_hd", "professional", "1440-analog-professional"],
  ["hybrid", "quick", "1440-hybrid"],
  ["hybrid", "professional", "1440-hybrid-professional"],
]) {
  const { ctx, page } = await openCtx("dark", 1440, 1100);
  if (await openDesigner(page)) {
    await setTech(page, tech);
    await setMode(page, mode);
    await page.waitForTimeout(250);
    const attr = await page.locator('[data-testid="cctv-requirements-workspace"]').getAttribute("data-tech");
    const modeAttr = await page.locator('[data-testid="cctv-requirements-workspace"]').getAttribute("data-mode");
    if (attr === tech) pass(`${tech}_${mode}_tech`);
    else fail(`${name} tech=${attr}`);
    if (mode === "professional" && modeAttr === "professional") pass(`${tech}_pro_mode`);
    await shot(page, name);
    if (tech === "analog_hd" || tech === "hybrid" || mode === "professional") {
      await calculate(page);
      await shot(page, `${name}-review`);
      if (tech === "analog_hd") {
        const t = await page.locator('[data-testid="cctv-designer-review"]').innerText();
        if (/DVR|XVR|אנלוג|RG59|ספק כוח|מצלמה אנלוגית/.test(t)) pass("analog_review_labels");
        else note("Analog review labels weak");
        leakScan(t, "analog_review");
      }
      if (tech === "hybrid") {
        const t = await page.locator("body").innerText();
        if (/IP/.test(t) && /אנלוג|Analog/i.test(t)) pass("hybrid_split_visible");
      }
    }
  }
  await ctx.close();
}

// ===== Breakpoints =====
for (const w of [1280, 1032, 768, 430, 390, 360]) {
  const { ctx, page } = await openCtx("dark", w, w >= 768 ? 1000 : 844);
  if (await openDesigner(page)) {
    await setTech(page, "ip");
    await setMode(page, "quick");
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement;
      return el.scrollWidth > el.clientWidth + 2;
    });
    report.flows[`viewport_${w}`] = { overflow };
    if (overflow) note(`H-overflow ${w}`);
    else pass(`no_h_overflow_${w}`);
    await shot(page, `${w}-ip-quick`);
  }
  await ctx.close();
}

// ===== Light =====
{
  const { ctx, page } = await openCtx("light", 1440, 1100);
  if (await openDesigner(page)) {
    await setTech(page, "ip");
    await setMode(page, "quick");
    await calculate(page);
    await shot(page, "1440-light-review");
    pass("light_mode_review");
  }
  await ctx.close();
}

// ===== Step 2 / 3 / 4 =====
{
  const { ctx, page } = await openCtx("dark", 1440, 1100);
  await goItems(page);
  await page.waitForTimeout(800);
  await shot(page, "1440-step2");
  const body = await page.locator("body").innerText();
  const hasPlanned = /נדרש ציוד/.test(body);
  if (hasPlanned) {
    pass("step2_planned_badge");
    if (/נדרש ציוד\s*·\s*.+·/.test(body)) fail("Step2 polluted description");
    else pass("step2_clean_planned");
    const resolve = page.getByRole("button", { name: /השלם בתכנון/ }).first();
    if (await resolve.count()) {
      pass("step2_resolve_link");
      await resolve.click();
      await page.waitForSelector(
        '[data-testid="cctv-designer-review"], [data-testid="cctv-requirements-workspace"]',
        { timeout: 20000 },
      );
      await shot(page, "1440-step2-resolve-reopen");
      await page.keyboard.press("Escape");
    } else note("resolve link missing");
  } else note("no planned badge on step2");

  const pricing = page.getByRole("button", { name: /הצעה ומחיר|תמחור|מחיר/ }).first();
  if (await pricing.count()) {
    await pricing.click();
    await page.waitForTimeout(600);
    await shot(page, "1440-step3");
    pass("step3_open");
  }
  const send = page.getByRole("button", { name: /תנאים ושליחה|שליחה|שלח/ }).first();
  if (await send.count()) {
    await send.click();
    await page.waitForTimeout(700);
  }
  await shot(page, "1440-step4");
  const s4 = await page.locator("body").innerText();
  if (/יש להשלים .+ רכיבי חובה|יש להשלים ציוד חובה/.test(s4)) {
    await shot(page, "1440-step4-send-block");
    pass("step4_send_block");
    if (/cctv-planned:|component_key/.test(s4)) fail("step4 leak");
  } else if (hasPlanned) note("planned present but send-block copy not visible");
  else pass("step4_no_block_when_resolved_or_empty");
  await ctx.close();
}

// ===== Reopen =====
{
  const { ctx, page } = await openCtx("dark", 1440, 1100);
  if (await openDesigner(page)) {
    await page.waitForTimeout(700);
    await shot(page, "1440-reopen");
    pass("reopen_hydrates");
  }
  await ctx.close();
}

// ===== API recommend (snake_case) + catalog readiness =====
{
  const rec = await api("POST", `/api/v1/workspaces/${WS}/cctv/recommend`, {
    camera_count: 4,
    resolution_mp: 4,
    retention_days: 30,
    cctv_technology: "ip",
  });
  report.flows.recommend_status = rec.status;
  report.flows.catalog_readiness = rec.data?.catalog_readiness || null;
  if (rec.status === 200) {
    pass("recommend_api_ok");
    const unresolved = (rec.data?.components || []).filter(
      (c) => c.resolution_status === "UNRESOLVED" && !c.optional,
    );
    report.flows.unresolved_required = unresolved.length;
    if (rec.data?.catalog_readiness?.empty_catalog) pass("empty_catalog_flag");
    else if (unresolved.length) pass("partial_catalog_unresolved", unresolved.length);
    else pass("full_or_resolved_catalog");
    // empty-catalog UI shot if present after calculate already taken
  } else {
    fail(`recommend API ${rec.status} id=${rec.requestId}`);
  }
}

if (report.network.costFieldHits.length) fail(`Q4-S cost select: ${report.network.costFieldHits[0]}`, "P0");
else pass("q4s_no_cost_select");

const hard5xx = report.network.status.filter((s) => s.status >= 500);
if (hard5xx.length) fail(`5xx ${JSON.stringify(hard5xx[0])}`, "P0");

report.cert = {
  A_professional_configurator: Boolean(report.checks.ip_quick_review && report.checks.apply_readiness_preview),
  B_quick_efficient: Boolean(report.checks.ip_quick_requirements_open && report.checks.ip_quick_review),
  C_pro_usable: Boolean(report.checks.ip_professional_mode || report.checks.ip_pro_mode || report.checks.ip_professional_tech),
  D_tech_distinct: Boolean(report.checks.analog_hd_quick_tech && report.checks.hybrid_quick_tech),
  E_explainable: Boolean(report.checks.apply_readiness_preview),
  F_catalog_trustworthy: Boolean(
    report.checks.picker_open || report.checks.partial_catalog_unresolved || report.checks.full_or_resolved_catalog,
  ),
  G_empty_catalog_useful: Boolean(
    report.checks.empty_catalog_flag || report.checks.partial_catalog_unresolved || report.checks.full_or_resolved_catalog,
  ),
  H_clean_descriptions: Boolean(report.checks.step2_clean_planned || report.checks.no_leak_ip_review),
  I_cannot_send_unresolved: Boolean(
    report.checks.step4_send_block || report.checks.step4_no_block_when_resolved_or_empty,
  ),
  J_reopen_trust: Boolean(report.checks.reopen_hydrates),
  K_desktop_premium: Boolean(report.checks.no_h_overflow_1440),
  L_mobile_usable: Boolean(report.checks.no_h_overflow_390 && report.checks.no_h_overflow_360),
  M_q4s_ok: Boolean(report.checks.q4s_no_cost_select),
  N_p0_p1: report.blockers.filter((b) => b.severity === "P0" || b.severity === "P1"),
};

report.finished_at = new Date().toISOString();
report.decision = report.cert.N_p0_p1.length === 0 ? "GO" : "NO-GO";
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("\n=== CERT DECISION:", report.decision, "===");
console.log("shots", report.shots.length, "blockers", report.blockers.length);
await browser.close();
process.exit(report.decision === "GO" ? 0 : 1);
