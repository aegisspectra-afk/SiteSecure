/**
 * ActiveWork visual regression QA — long-content stress + tablet widths.
 * Out: Docs/core-app-ux-qa/dashboard/active-work-regression/
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/core-app-ux-qa/dashboard/active-work-regression");

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
const SUPABASE_URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const WS = env.QA_WORKSPACE_ID || "50339413-11c7-4903-820c-7541fbd2a476";

fs.mkdirSync(OUT, { recursive: true });

if (!SUPABASE_URL || !ANON) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];

const STRESS = {
  title: "התקנת מערכת אבטחה מקיפה למבנה מסחרי רב-קומתי עם דגש על היקף חיצוני",
  context:
    "לקוח בדיקה ארוך לשם עיצוב · אתר בדיקה — שדרות הרצל 42 תל אביב קומה 7 אגף מזרחי מול הכניסה הראשית",
};

async function login(email, password) {
  const tok = await (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  ).json();
  if (!tok.access_token) throw new Error(`auth_failed:${email}:${JSON.stringify(tok)}`);
  return tok;
}

const ownerTok = await login(EMAIL, PASSWORD);
const browser = await chromium.launch({ headless: true });

const report = {
  email: EMAIL,
  web: WEB,
  shots: [],
  checks: {},
  started: new Date().toISOString(),
  stress: STRESS,
};

async function openApp(tok, { width, height, colorScheme }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme,
  });
  await ctx.addInitScript(
    ({ key, value, ws, theme }) => {
      localStorage.setItem("ss.remember-device", "1");
      localStorage.setItem("site-secure-theme", theme);
      localStorage.setItem("ss.last-workspace-id", ws);
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      ws: WS,
      theme: colorScheme === "light" ? "light" : "dark",
      value: JSON.stringify({
        access_token: tok.access_token,
        refresh_token: tok.refresh_token || "qa",
        expires_at: Math.floor(Date.now() / 1000) + 7200,
        expires_in: 7200,
        token_type: "bearer",
        user: tok.user,
      }),
    },
  );
  const page = await ctx.newPage();
  await page.goto(`${WEB}/app/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(".ops-dashboard-final, .ops-dashboard-dash12, #command-today", {
    timeout: 90000,
  });
  await page.waitForTimeout(colorScheme === "light" ? 2800 : 2000);
  return { ctx, page };
}

/** Inject long title/context into first Today row (or seed a fixture row if empty). */
async function applyStressFixtures(page) {
  return page.evaluate((stress) => {
    const card = document.querySelector("#command-today.ops-today-card");
    if (!card) return { ok: false, reason: "no_card" };

    let row = card.querySelector(".ops-today-row.is-queue");
    if (!row) {
      const list = card.querySelector(".ops-today-list") || (() => {
        const ul = document.createElement("ul");
        ul.className = "ops-today-list is-queue";
        const empty = card.querySelector(".ops-today-empty-text, .ops-today-empty-stack");
        empty?.remove();
        card.appendChild(ul);
        return ul;
      })();

      const li = document.createElement("li");
      li.innerHTML = `
        <a class="ops-today-row is-queue is-tone-active is-interactive" href="#">
          <div class="ss-activity-row ops-today-activity">
            <div class="ss-activity-row-leading"><span class="ops-today-lead-time ltr-meta" dir="ltr">09:00</span></div>
            <div class="ss-activity-row-body">
              <p class="ss-activity-row-title"><span class="ops-today-what"></span></p>
              <p class="ss-activity-row-subtitle"><span class="ops-today-context"></span></p>
              <p class="ops-today-meta"><span class="ops-today-time ltr-meta" dir="ltr">09:00–11:00</span>
                <span class="ops-today-meta-sep">·</span>
                <span class="ops-today-status is-active">בביצוע</span>
              </p>
            </div>
            <div class="ss-activity-row-trailing"><span class="ops-today-cta is-quiet">פתח עבודה</span></div>
          </div>
        </a>`;
      list.appendChild(li);
      row = li.querySelector(".ops-today-row");
    }

    const targets = [...card.querySelectorAll(".ops-today-row.is-queue")];
    for (const rowEl of targets) {
      const what = rowEl.querySelector(".ops-today-what");
      let context = rowEl.querySelector(".ops-today-context");
      if (what) what.textContent = stress.title;
      if (context) context.textContent = stress.context;
      else {
        const body = rowEl.querySelector(".ss-activity-row-body");
        if (body) {
          const p = document.createElement("p");
          p.className = "ss-activity-row-subtitle";
          const span = document.createElement("span");
          span.className = "ops-today-context";
          span.textContent = stress.context;
          p.appendChild(span);
          const title = body.querySelector(".ss-activity-row-title");
          if (title?.nextSibling) body.insertBefore(p, title.nextSibling);
          else body.appendChild(p);
          context = span;
        }
      }
      let cta = rowEl.querySelector(".ops-today-cta");
      if (!cta) {
        let trailing = rowEl.querySelector(".ss-activity-row-trailing");
        if (!trailing) {
          trailing = document.createElement("div");
          trailing.className = "ss-activity-row-trailing";
          rowEl.querySelector(".ss-activity-row")?.appendChild(trailing);
        }
        cta = document.createElement("span");
        cta.className = "ops-today-cta is-quiet";
        cta.textContent = "פתח עבודה";
        trailing.appendChild(cta);
      }
    }

    return { ok: true, seeded: true, rows: targets.length };
  }, STRESS);
}

function measure(page) {
  return page.evaluate(() => {
    const card = document.querySelector("#command-today.ops-today-card");
    const row = card?.querySelector(".ops-today-row.is-queue");
    const cta = row?.querySelector(".ops-today-cta");
    const context = row?.querySelector(".ops-today-context");
    const what = row?.querySelector(".ops-today-what");
    const activity = row?.querySelector(".ss-activity-row");
    const body = row?.querySelector(".ss-activity-row-body");
    const trailing = row?.querySelector(".ss-activity-row-trailing");

    const pad = 1.5;
    const within = (parent, child) => {
      if (!parent || !child) return null;
      const p = parent.getBoundingClientRect();
      const c = child.getBoundingClientRect();
      return {
        ok:
          c.left >= p.left - pad &&
          c.right <= p.right + pad &&
          c.top >= p.top - pad &&
          c.bottom <= p.bottom + pad,
        parent: { l: p.left, r: p.right, t: p.top, b: p.bottom, w: p.width },
        child: { l: c.left, r: c.right, t: c.top, b: c.bottom, w: c.width, h: c.height },
      };
    };

    const cs = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        display: s.display,
        flexWrap: s.flexWrap,
        minWidth: s.minWidth,
        maxWidth: s.maxWidth,
        whiteSpace: s.whiteSpace,
        overflowWrap: s.overflowWrap,
        overflow: s.overflow,
        flex: `${s.flexGrow} ${s.flexShrink} ${s.flexBasis}`,
        width: s.width,
        marginInlineStart: s.marginInlineStart,
      };
    };

    const cardRect = card?.getBoundingClientRect();
    const pageOverflow =
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;

    const ctaInCard = within(card, cta);
    const contextInCard = within(card, context);
    const whatInCard = within(card, what);
    const rowInCard = within(card, row);
    const trailingInCard = within(card, trailing);

    return {
      dir: getComputedStyle(document.documentElement).direction,
      pageOverflow,
      cardWidth: cardRect?.width ?? null,
      hasRow: Boolean(row),
      hasCta: Boolean(cta),
      ctaText: cta?.textContent?.trim() || null,
      ctaMinHeight: cta ? Math.round(cta.getBoundingClientRect().height) : null,
      ctaFullyVisible: ctaInCard?.ok === true,
      contextContained: contextInCard?.ok === true,
      whatContained: whatInCard?.ok === true,
      rowContained: rowInCard?.ok === true,
      trailingContained: trailingInCard?.ok === true,
      bounds: {
        cta: ctaInCard,
        context: contextInCard,
        what: whatInCard,
        trailing: trailingInCard,
      },
      css: {
        activity: cs(activity),
        body: cs(body),
        trailing: cs(trailing),
        context: cs(context),
        what: cs(what),
        cardOverflowX: card ? getComputedStyle(card).overflowX : null,
      },
    };
  });
}

const viewports = [
  { name: "1440-dark", width: 1440, height: 900, colorScheme: "dark" },
  { name: "1440-light", width: 1440, height: 900, colorScheme: "light" },
  { name: "1024-dark", width: 1024, height: 900, colorScheme: "dark" },
  { name: "1024-light", width: 1024, height: 900, colorScheme: "light" },
  { name: "850-dark", width: 850, height: 900, colorScheme: "dark" },
  { name: "850-light", width: 850, height: 900, colorScheme: "light" },
  { name: "768-dark", width: 768, height: 1024, colorScheme: "dark" },
  { name: "768-light", width: 768, height: 1024, colorScheme: "light" },
  { name: "700-dark", width: 700, height: 900, colorScheme: "dark" },
  { name: "700-light", width: 700, height: 900, colorScheme: "light" },
  { name: "430-dark", width: 430, height: 900, colorScheme: "dark" },
  { name: "390-dark", width: 390, height: 844, colorScheme: "dark" },
  { name: "390-light", width: 390, height: 844, colorScheme: "light" },
  { name: "360-dark", width: 360, height: 740, colorScheme: "dark" },
];

for (const vp of viewports) {
  const { ctx, page } = await openApp(ownerTok, vp);
  const seed = await applyStressFixtures(page);
  await page.waitForTimeout(400);

  // Scroll Today into view for screenshots
  await page.locator("#command-today").scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(200);

  const metrics = await measure(page);
  const file = `${vp.name}-stress.png`;
  const today = page.locator("#command-today");
  if (await today.count()) {
    await today.screenshot({ path: path.join(OUT, file) });
  } else {
    await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  }
  report.shots.push(file);

  const pass =
    seed.ok &&
    metrics.hasRow &&
    metrics.hasCta &&
    metrics.dir === "rtl" &&
    !metrics.pageOverflow &&
    metrics.ctaFullyVisible &&
    metrics.contextContained &&
    metrics.whatContained &&
    metrics.rowContained &&
    metrics.trailingContained &&
    (metrics.ctaMinHeight ?? 0) >= 44;

  report.checks[vp.name] = {
    pass,
    seed,
    width: vp.width,
    theme: vp.colorScheme,
    ...metrics,
  };

  await ctx.close();
}

report.pass = Object.values(report.checks).every((c) => c.pass);
report.finished = new Date().toISOString();

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.pass ? 0 : 1);
