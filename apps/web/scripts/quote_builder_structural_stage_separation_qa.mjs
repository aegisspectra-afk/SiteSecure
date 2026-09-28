/**
 * Structural Stage Separation visual QA — Stage 2 solution vs Stage 3 commercial (populated).
 * Uses production CSS from apps/web/dist when available.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/quote-builder-structural-stage-separation-qa");
fs.mkdirSync(OUT, { recursive: true });

const cssPath = path.join(ROOT, "apps/web/dist/assets");
let css = "";
try {
  const cssFile = fs.readdirSync(cssPath).find((f) => f.endsWith(".css"));
  css = cssFile ? fs.readFileSync(path.join(cssPath, cssFile), "utf8") : "";
} catch {
  css = "";
}

function solutionCard({ title, meta, qty, sku, kind }) {
  return `
  <article class="cpq-solution-card ${kind === "service" ? "is-service" : "is-equipment"}" data-testid="solution-item-card">
    <div class="cpq-solution-card-main">
      <div class="cpq-solution-card-copy">
        <h4 class="cpq-solution-card-title">${title}</h4>
        <div class="cpq-solution-card-meta">
          <span class="cpq-solution-chip">${meta}</span>
          ${sku ? `<span class="cpq-solution-sku ltr-meta" dir="ltr">מק״ט: ${sku}</span>` : ""}
        </div>
      </div>
      <div class="cpq-solution-card-qty">
        <label style="font-size:12px;color:var(--color-fg-muted)">כמות
          <input class="ltr-meta" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--color-border);border-radius:8px" value="${qty}" />
        </label>
      </div>
    </div>
  </article>`;
}

function commercialRow({ sku, desc, qty, price, discount, total }) {
  return `
  <div class="cpq-line-row cpq-line-row-kai is-pricing grid gap-2 p-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_5rem_7rem_5.5rem_auto]" data-testid="commercial-line-row">
    <div><label style="font-size:11px;color:var(--color-fg-muted)">מק״ט</label><div class="ltr-meta font-mono text-xs">${sku}</div></div>
    <div><label style="font-size:11px;color:var(--color-fg-muted)">תיאור</label><div>${desc}</div></div>
    <div><label style="font-size:11px;color:var(--color-fg-muted)">כמות</label><div class="ltr-meta">${qty}</div></div>
    <div><label style="font-size:11px;color:var(--color-fg-muted)">מחיר יחידה</label><div class="ltr-meta">₪${price}</div></div>
    <div><label style="font-size:11px;color:var(--color-fg-muted)">הנחה %</label><div class="ltr-meta">${discount}</div></div>
    <div class="cpq-line-total-cell"><span class="cpq-line-total-label">סה״כ שורה</span><span class="cpq-line-total ltr-meta" dir="ltr">₪${total}</span></div>
  </div>`;
}

function stage2(theme) {
  return `
  <section class="cpq-content-panel cpq-content-kai is-planning-mode flex flex-col gap-4 p-5" data-workspace-mode="planning" data-testid="stage2-solution-workspace" dir="rtl">
    <div class="cpq-stage-intro">
      <h2 class="cpq-stage-intro-title">התכנון והציוד</h2>
      <p class="cpq-stage-intro-sub">3 פריטים בפתרון</p>
      <p class="cpq-stage-intro-meta">תכננו את המערכת ובחרו את הציוד והשירותים הנדרשים.</p>
    </div>
    <div class="cpq-scope-toolbar" style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button">+ תכנון מערכת</button>
      <button type="button">+ קטלוג</button>
      <button type="button">+ פריט</button>
      <button type="button">הוסף סעיף</button>
    </div>
    <article class="cpq-planning-design-card" data-testid="planning-system-design">
      <div class="cpq-planning-design-copy">
        <h3 class="cpq-planning-design-title">מערכת מצלמות</h3>
        <p class="cpq-planning-design-status">התכנון ההנדסי הושלם</p>
        <p class="cpq-planning-design-chips">4 מצלמות · מקליט · אחסון · תקשורת</p>
        <p class="cpq-planning-design-intent">יש ציוד שהוגדר ללא קטלוג</p>
      </div>
      <button type="button">פתיחת התכנון</button>
    </article>
    <div class="cpq-solution-bucket" data-testid="solution-equipment-bucket">
      <h4 class="cpq-solution-bucket-title">ציוד</h4>
      ${solutionCard({ title: "Hikvision DS-2CD2347G2-LU", meta: "נבחר מהקטלוג", qty: 4, sku: "CAM-8MP", kind: "equipment" })}
      ${solutionCard({ title: "Hikvision", meta: "ציוד הוגדר ללא קטלוג · דגם טרם נבחר", qty: 2, sku: "", kind: "equipment" })}
    </div>
    <div class="cpq-solution-bucket" data-testid="solution-services-bucket">
      <h4 class="cpq-solution-bucket-title">שירותים ועבודה</h4>
      ${solutionCard({ title: "התקנה והגדרה", meta: "שירות / עבודה", qty: 1, sku: "", kind: "service" })}
    </div>
    <div class="cpq-stage-nav-footer" style="display:flex;justify-content:space-between;margin-top:12px">
      <button type="button">חזרה</button>
      <button type="button">המשך להצעה ומחיר</button>
    </div>
    ${theme === "mobile" ? `<div class="quote-builder-actions is-planning-dock" data-summary-mode="planning" style="position:relative;margin-top:16px">
      <div class="cpq-mobile-actions-row">
        <button type="button" class="cpq-mobile-actions-total"><span class="cpq-mobile-total-label">תכנון וציוד</span><span class="cpq-mobile-total">3 פריטים בפתרון</span></button>
        <button type="button" class="cpq-mobile-action-primary">המשך למחיר</button>
      </div>
    </div>` : ""}
  </section>`;
}

function stage3(theme) {
  return `
  <section class="cpq-content-panel cpq-content-kai is-pricing-mode flex flex-col gap-4 p-5" data-workspace-mode="pricing" data-testid="stage3-commercial-workspace" dir="rtl">
    <div class="cpq-stage-intro">
      <h2 class="cpq-stage-intro-title">ההצעה המסחרית</h2>
      <p class="cpq-stage-intro-sub">3 שורות בהצעה</p>
      <p class="cpq-stage-intro-meta">בדקו את הפריטים, הכמויות והמחירים לפני הצגת ההצעה ללקוח.</p>
    </div>
    <div class="cpq-scope-toolbar" style="display:flex;gap:8px">
      <button type="button">חזרה לתכנון וציוד</button>
      <button type="button">הוסף סעיף</button>
    </div>
    <div class="cpq-commercial-lines" data-testid="commercial-quote-lines">
      ${commercialRow({ sku: "CAM-8MP", desc: "Hikvision DS-2CD2347G2-LU", qty: 4, price: "120.00", discount: "0", total: "480.00" })}
      ${commercialRow({ sku: "—", desc: "Hikvision (ללא קטלוג)", qty: 2, price: "0.00", discount: "0", total: "0.00" })}
      ${commercialRow({ sku: "LAB-01", desc: "התקנה והגדרה", qty: 1, price: "100.00", discount: "0", total: "100.00" })}
    </div>
    <div class="cpq-quote-discount-block">
      <p class="cpq-quote-discount-title">הנחת הצעה</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <label style="font-size:12px">הנחה ₪<input value="" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--color-border);border-radius:8px"/></label>
        <label style="font-size:12px">הנחה %<input value="0" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--color-border);border-radius:8px"/></label>
      </div>
    </div>
    <section class="cpq-commercial-summary" data-testid="stage3-financial-summary">
      <p class="cpq-commercial-summary-title">סיכום כספי</p>
      <dl class="cpq-commercial-summary-rows">
        <div class="cpq-commercial-summary-row"><dt>סה״כ לפני מע״מ</dt><dd class="ltr-meta" dir="ltr">₪580.00</dd></div>
        <div class="cpq-commercial-summary-row"><dt>מע״מ (18%)</dt><dd class="ltr-meta" dir="ltr">₪104.40</dd></div>
      </dl>
      <div class="cpq-commercial-summary-total">
        <span class="cpq-commercial-summary-total-label">סה״כ כולל מע״מ</span>
        <p class="cpq-commercial-summary-total-value ltr-meta" dir="ltr">₪684.40</p>
      </div>
    </section>
    <div class="cpq-stage-nav-footer" style="display:flex;justify-content:space-between;margin-top:12px">
      <button type="button">חזרה לתכנון וציוד</button>
      <button type="button">המשך לתנאים ושליחה</button>
    </div>
    ${theme === "mobile" ? `<div class="quote-builder-actions" data-summary-mode="commercial" style="position:relative;margin-top:16px">
      <div class="cpq-mobile-actions-row">
        <button type="button" class="cpq-mobile-actions-total"><span class="cpq-mobile-total-label">סה״כ</span><span class="cpq-mobile-total ltr-meta">₪684.40</span></button>
        <button type="button" class="cpq-mobile-action-primary">המשך לתנאים</button>
      </div>
    </div>` : ""}
  </section>`;
}

function page(stage, theme, widthLabel) {
  const dark = theme === "dark";
  const mobile = widthLabel.startsWith("mobile");
  const body = stage === 2 ? stage2(mobile ? "mobile" : "desktop") : stage3(mobile ? "mobile" : "desktop");
  return `<!doctype html><html lang="he" dir="rtl" class="${dark ? "dark" : ""}"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
:root{--color-fg:#0f172a;--color-fg-muted:#64748b;--color-border:#e2e8f0;--color-surface:#fff;--color-bg:#f8fafc;--color-bg-2:#f1f5f9;--color-action:#0f172a;--color-action-fg:#fff}
.dark{--color-fg:#f8fafc;--color-fg-muted:#94a3b8;--color-border:#334155;--color-surface:#0f172a;--color-bg:#020617;--color-bg-2:#0b1220;--color-action:#e2e8f0;--color-action-fg:#0f172a}
body{margin:0;font-family:Heebo,Assistant,system-ui,sans-serif;background:var(--color-bg);color:var(--color-fg)}
.wrap{max-width:1100px;margin:0 auto;padding:24px}
${css}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

function sideBySide(theme, mobile) {
  const dark = theme === "dark";
  return `<!doctype html><html lang="he" dir="rtl" class="${dark ? "dark" : ""}"><head>
<meta charset="utf-8"/><style>
:root{--color-fg:#0f172a;--color-fg-muted:#64748b;--color-border:#e2e8f0;--color-surface:#fff;--color-bg:#f8fafc;--color-bg-2:#f1f5f9;--color-action:#0f172a}
.dark{--color-fg:#f8fafc;--color-fg-muted:#94a3b8;--color-border:#334155;--color-surface:#0f172a;--color-bg:#020617;--color-bg-2:#0b1220}
body{margin:0;font-family:Heebo,Assistant,system-ui,sans-serif;background:var(--color-bg);color:var(--color-fg)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px}
.col{min-width:0}
.caption{font-size:11px;color:var(--color-fg-muted);margin:0 0 8px;letter-spacing:.04em;text-transform:uppercase}
/* Hide stage titles for screenshot test */
.cpq-stage-intro-title,.cpq-stage-intro-sub,.cpq-stage-intro-meta{visibility:hidden;height:0;margin:0;overflow:hidden}
${css}
</style></head><body>
<div class="grid">
  <div class="col"><p class="caption">A — no title</p>${stage2(mobile ? "mobile" : "desktop")}</div>
  <div class="col"><p class="caption">B — no title</p>${stage3(mobile ? "mobile" : "desktop")}</div>
</div>
</body></html>`;
}

const shots = [
  { name: "desktop-1440-dark-stage2", w: 1440, h: 1100, theme: "dark", stage: 2 },
  { name: "desktop-1440-dark-stage3", w: 1440, h: 1100, theme: "dark", stage: 3 },
  { name: "desktop-1440-light-stage2", w: 1440, h: 1100, theme: "light", stage: 2 },
  { name: "desktop-1440-light-stage3", w: 1440, h: 1100, theme: "light", stage: 3 },
  { name: "desktop-1100-dark-stage2", w: 1100, h: 1000, theme: "dark", stage: 2 },
  { name: "desktop-1100-dark-stage3", w: 1100, h: 1000, theme: "dark", stage: 3 },
  { name: "mobile-390-dark-stage2", w: 390, h: 900, theme: "dark", stage: 2 },
  { name: "mobile-390-dark-stage3", w: 390, h: 900, theme: "dark", stage: 3 },
  { name: "mobile-390-light-stage2", w: 390, h: 900, theme: "light", stage: 2 },
  { name: "mobile-390-light-stage3", w: 390, h: 900, theme: "light", stage: 3 },
  { name: "mobile-360-dark-stage2", w: 360, h: 860, theme: "dark", stage: 2 },
  { name: "mobile-360-dark-stage3", w: 360, h: 860, theme: "dark", stage: 3 },
  { name: "desktop-1440-dark-side-by-side", w: 1600, h: 1100, theme: "dark", side: true, mobile: false },
  { name: "mobile-390-dark-side-by-side", w: 820, h: 1000, theme: "dark", side: true, mobile: true },
];

const server = createServer((req, res) => {
  const u = new URL(req.url || "/", "http://127.0.0.1");
  const stage = Number(u.searchParams.get("stage") || 2);
  const theme = u.searchParams.get("theme") || "dark";
  const widthLabel = u.searchParams.get("w") || "desktop";
  const side = u.searchParams.get("side") === "1";
  const mobile = u.searchParams.get("mobile") === "1";
  const html = side ? sideBySide(theme, mobile) : page(stage, theme, widthLabel);
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await chromium.launch();
const report = [];

for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
  const q = shot.side
    ? `/?side=1&theme=${shot.theme}&mobile=${shot.mobile ? 1 : 0}`
    : `/?stage=${shot.stage}&theme=${shot.theme}&w=${shot.name.includes("mobile") ? "mobile" : "desktop"}`;
  await page.goto(`http://127.0.0.1:${port}${q}`, { waitUntil: "networkidle" });
  const file = path.join(OUT, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.push({ name: shot.name, file: path.relative(ROOT, file) });
  await page.close();
}

await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), shots: report }, null, 2));
console.log(`Wrote ${report.length} screenshots → ${OUT}`);
