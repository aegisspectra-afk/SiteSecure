/**
 * P0 occlusion probe — measure why Quote Builder content can sit behind AppShell nav.
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
  ...process.env,
};

const WEB = env.WEB_URL || "http://127.0.0.1:5173";
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const OUT = path.join(ROOT, "Docs/quote-builder-mobile-qa");
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(
  ({ key, value }) => {
    localStorage.setItem("ss.remember-device", "1");
    localStorage.setItem("site-secure-theme", "light");
    localStorage.setItem(key, value);
  },
  {
    key: `sb-${ref}-auth-token`,
    value: JSON.stringify({
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token || "qa",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: "bearer",
      user: tokenJson.user,
    }),
  },
);

const page = await ctx.newPage();
await page.goto(`${WEB}/app/quotes/new`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForSelector(".quote-builder, .cpq-builder", { timeout: 60000 });
await page.waitForTimeout(600);

// Scroll absolute bottom
await page.evaluate(() => {
  const main = document.querySelector(".ops-main");
  if (main) main.scrollTop = main.scrollHeight;
  else window.scrollTo(0, document.body.scrollHeight);
});
await page.waitForTimeout(400);

const probe = await page.evaluate(() => {
  const main = document.querySelector(".ops-main");
  const builder = document.querySelector(".quote-builder.cpq-builder");
  const dock = document.querySelector(".quote-builder-actions");
  const nav = document.querySelector(".ops-bottom-nav");
  const vh = window.innerHeight;

  function box(el) {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      class: el.className?.toString?.().slice(0, 80),
      position: cs.position,
      overflow: cs.overflow,
      overflowY: cs.overflowY,
      paddingBottom: cs.paddingBottom,
      marginBottom: cs.marginBottom,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      height: Math.round(r.height),
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
      z: cs.zIndex,
      bg: cs.backgroundColor,
      bottomCss: cs.bottom,
    };
  }

  // Find text nodes / elements that intersect the nav band
  const navR = nav?.getBoundingClientRect();
  const dockR = dock?.getBoundingClientRect();
  const bandTop = dockR ? dockR.top : navR ? navR.top : vh - 100;
  const occluded = [];

  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  while (walk.nextNode()) {
    const el = walk.currentNode;
    if (!(el instanceof HTMLElement)) continue;
    if (el.closest(".ops-bottom-nav, .quote-builder-actions, .cpq-mobile-sheet-root")) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // Intersects persistent bottom zone (dock top → viewport bottom)
    if (r.bottom > bandTop + 2 && r.top < vh - 2) {
      const text = (el.innerText || el.textContent || "").trim().slice(0, 60);
      if (!text && !["INPUT", "BUTTON", "TEXTAREA", "SELECT", "A"].includes(el.tagName)) continue;
      // Prefer leaf-ish
      if (el.children.length > 3 && !["INPUT", "BUTTON", "TEXTAREA"].includes(el.tagName)) continue;
      occluded.push({
        tag: el.tagName,
        cls: (el.className?.toString?.() || "").slice(0, 60),
        text,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        behindDock: dockR ? r.bottom > dockR.top && r.top < dockR.bottom : false,
        behindNav: navR ? r.bottom > navR.top && r.top < navR.bottom : false,
        inGapBelowDock:
          dockR && navR ? r.top < navR.top && r.bottom > dockR.bottom : false,
        belowNav: navR ? r.bottom > navR.bottom && r.top < vh : false,
      });
    }
  }

  // Last content bottom inside builder
  let lastContentBottom = 0;
  if (builder) {
    builder.querySelectorAll("*").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.closest(".quote-builder-actions, .cpq-mobile-sheet-root")) return;
      const r = el.getBoundingClientRect();
      if (r.height > 2 && r.width > 2) lastContentBottom = Math.max(lastContentBottom, r.bottom);
    });
  }

  const mainCs = main ? getComputedStyle(main) : null;
  const builderCs = builder ? getComputedStyle(builder) : null;

  return {
    vh,
    scrollTop: main ? Math.round(main.scrollTop) : 0,
    scrollHeight: main ? Math.round(main.scrollHeight) : 0,
    clientHeight: main ? Math.round(main.clientHeight) : 0,
    main: box(main),
    builder: box(builder),
    dock: box(dock),
    nav: box(nav),
    mainPadBottomPx: mainCs ? parseFloat(mainCs.paddingBottom) : null,
    builderPadBottomPx: builderCs ? parseFloat(builderCs.paddingBottom) : null,
    lastContentBottom: Math.round(lastContentBottom),
    clearanceAboveDock: dockR ? Math.round(dockR.top - lastContentBottom) : null,
    clearanceAboveNav: navR ? Math.round(navR.top - lastContentBottom) : null,
    occludedSample: occluded.slice(0, 25),
    occludedCount: occluded.length,
    behindNavCount: occluded.filter((o) => o.behindNav).length,
    behindDockCount: occluded.filter((o) => o.behindDock).length,
  };
});

await page.screenshot({ path: path.join(OUT, "p0-occlusion-390-bottom.png"), fullPage: false });
fs.writeFileSync(path.join(OUT, "p0-occlusion-probe.json"), JSON.stringify(probe, null, 2));
console.log(JSON.stringify(probe, null, 2));
await browser.close();
