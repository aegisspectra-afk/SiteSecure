/**
 * Guided Workspace V1 — stage differentiation visual QA (static fixtures).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/quote-builder-guided-v1-qa");
fs.mkdirSync(OUT, { recursive: true });

let css = "";
try {
  const cssPath = path.join(ROOT, "apps/web/dist/assets");
  const cssFile = fs.readdirSync(cssPath).find((f) => f.endsWith(".css"));
  css = cssFile ? fs.readFileSync(path.join(cssPath, cssFile), "utf8") : "";
} catch {
  css = "";
}

function shell(stage, body, theme = "dark") {
  const dark = theme === "dark";
  const steps = [
    ["פרטי ההצעה", stage === "s1"],
    ["תכנון וציוד", stage === "s2"],
    ["הצעה ומחיר", stage === "s3"],
    ["תנאים ושליחה", stage === "s4"],
  ];
  return `<!doctype html>
<html lang="he" dir="rtl" data-theme="${theme}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>GW ${stage}</title>
<style>
${css}
:root {
  --color-fg: ${dark ? "#f8fafc" : "#0f172a"};
  --color-fg-muted: ${dark ? "#94a3b8" : "#64748b"};
  --color-border: ${dark ? "#334155" : "#e2e8f0"};
  --color-surface: ${dark ? "#0f172a" : "#fff"};
  --color-action: #0b6bcb;
  --radius-control: 10px;
}
body { margin:0; font-family: Heebo, system-ui, sans-serif; background:${dark ? "#020617" : "#f8fafc"}; color:var(--color-fg); }
.page { max-width: 980px; margin: 0 auto; padding: 20px; }
.stepper { display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap; }
.step { padding:8px 12px; border-radius:999px; font-size:12px; border:1px solid var(--color-border); color:var(--color-fg-muted); }
.step.is-active { color:var(--color-fg); border-color: color-mix(in srgb, var(--color-action) 50%, var(--color-border)); background: color-mix(in srgb, var(--color-action) 12%, transparent); font-weight:700; }
.panel { background:var(--color-surface); border:1px solid var(--color-border); border-radius:16px; padding:20px; }
</style>
</head>
<body>
<main class="page">
  <nav class="stepper">${steps.map(([l, a]) => `<span class="step${a ? " is-active" : ""}">${l}</span>`).join("")}</nav>
  <div class="panel">${body}</div>
</main>
</body></html>`;
}

const fixtures = {
  "s1-empty.html": shell(
    "s1",
    `<div class="cpq-stage-intro"><h2 class="cpq-stage-intro-title">פרטי ההצעה</h2><p class="cpq-stage-intro-sub">בחרו לקוח והגדירו את פרטי ההצעה.</p></div>
     <div style="margin-top:16px;padding:14px;border:1px solid var(--color-border);border-radius:12px">
       <p style="margin:0;font-size:10px;letter-spacing:.14em;color:var(--color-fg-muted)">לקוח</p>
       <p style="margin:6px 0 0;font-weight:600">לא נבחר לקוח</p>
       <p style="margin:4px 0 0;font-size:12px;color:var(--color-fg-muted)">בחרו לקוח קיים או צרו לקוח חדש.</p>
       <div style="display:flex;gap:8px;margin-top:12px">
         <button style="padding:8px 12px;border-radius:8px;border:0;background:#0b6bcb;color:#fff">בחירת לקוח</button>
         <button style="padding:8px 12px;border-radius:8px;border:1px solid var(--color-border);background:transparent">+ לקוח חדש</button>
       </div>
     </div>
     <div style="margin-top:16px;display:grid;gap:10px;grid-template-columns:1fr 1fr">
       <label style="font-size:13px">כותרת ההצעה<input style="display:block;width:100%;margin-top:4px;padding:10px;border-radius:8px;border:1px solid var(--color-border);background:transparent"/></label>
       <label style="font-size:13px">תוקף ההצעה<input type="date" style="display:block;width:100%;margin-top:4px;padding:10px;border-radius:8px;border:1px solid var(--color-border);background:transparent"/></label>
     </div>`,
    "dark",
  ),
  "s1-customer.html": shell(
    "s1",
    `<div class="cpq-stage-intro"><h2 class="cpq-stage-intro-title">פרטי ההצעה</h2><p class="cpq-stage-intro-sub">בחרו לקוח והגדירו את פרטי ההצעה.</p></div>
     <div style="margin-top:16px;padding:14px;border:1px solid var(--color-border);border-radius:12px">
       <p style="margin:0;font-weight:700">ישראל ישראלי</p>
       <p style="margin:4px 0 0;font-size:13px;color:var(--color-fg-muted)">ישראל מערכות בע״מ</p>
       <p style="margin:4px 0 0;font-size:13px;color:var(--color-fg-muted)">050-1234567</p>
       <button style="margin-top:10px;font-size:12px;color:#0b6bcb;background:none;border:0">שינוי לקוח</button>
     </div>
     <p style="margin:14px 0 6px;font-size:13px">אתר</p>
     <p style="margin:0;font-size:12px;color:var(--color-fg-muted)">ניתן לשייך את ההצעה לאתר של הלקוח.</p>`,
    "dark",
  ),
  "s2-empty.html": shell(
    "s2",
    `<div class="cpq-stage-intro"><h2 class="cpq-stage-intro-title">תכנון וציוד</h2><p class="cpq-stage-intro-sub">תכננו את המערכת ובחרו את הציוד והשירותים הנדרשים.</p></div>
     <p style="margin:18px 0 8px;font-weight:700">איך תרצו לבנות את הפתרון?</p>
     <div class="cpq-stage2-paths">
       <button class="cpq-stage2-path is-featured"><span class="cpq-stage2-path-title">תכנון מערכת</span><span class="cpq-stage2-path-body">תכנון מקצועי לפי דרישות הלקוח.</span><span class="cpq-stage2-path-hint">הגדירו את הצרכים והמערכת תסייע לחשב את דרישות הציוד.</span><span class="cpq-stage2-path-cta">התחל תכנון</span></button>
       <button class="cpq-stage2-path"><span class="cpq-stage2-path-title">בחירה מהקטלוג</span><span class="cpq-stage2-path-body">בחרו ציוד קיים ישירות מהקטלוג.</span><span class="cpq-stage2-path-cta">עיון בקטלוג</span></button>
       <button class="cpq-stage2-path"><span class="cpq-stage2-path-title">הוספה ידנית</span><span class="cpq-stage2-path-body">הוסיפו ציוד, שירות, עבודה או פריט אחר.</span><span class="cpq-stage2-path-cta">הוסף פריט</span></button>
     </div>`,
    "dark",
  ),
  "s2-populated.html": shell(
    "s2",
    `<div class="cpq-stage-intro"><h2 class="cpq-stage-intro-title">התכנון והציוד</h2><p class="cpq-stage-intro-sub">4 שורות</p></div>
     <div style="display:flex;gap:8px;margin:12px 0 16px"><button style="padding:6px 10px;border-radius:8px;border:1px solid var(--color-border);background:transparent">+ תכנון מערכת</button><button style="padding:6px 10px;border-radius:8px;border:1px solid var(--color-border);background:transparent">+ קטלוג</button><button style="padding:6px 10px;border-radius:8px;border:1px solid var(--color-border);background:transparent">+ פריט</button></div>
     <article style="padding:12px;border:1px solid var(--color-border);border-radius:12px;margin-bottom:8px">
       <p style="margin:0;font-weight:600">מצלמה · ×4</p>
       <p style="margin:8px 0 0;font-size:12px"><span style="color:var(--color-fg-muted)">דרישת תכנון · </span>8MP · חוץ · Turret · PoE</p>
       <p style="margin:4px 0 0;font-size:12px"><span style="color:var(--color-fg-muted)">ציוד מוגדר · </span>Hikvision · דגם טרם נבחר</p>
     </article>
     <article style="padding:12px;border:1px solid var(--color-border);border-radius:12px">
       <p style="margin:0;font-weight:600">התקנת מצלמות</p>
       <p style="margin:6px 0 0;font-size:12px;color:var(--color-fg-muted)">שירותים ועבודה</p>
     </article>`,
    "dark",
  ),
  "s3-empty.html": shell(
    "s3",
    `<div class="cpq-stage-intro"><h2 class="cpq-stage-intro-title">הצעה ומחיר</h2><p class="cpq-stage-intro-sub">בדקו את הפריטים, הכמויות והמחירים לפני הצגת ההצעה ללקוח.</p></div>
     <div class="cpq-empty-pricing" style="margin-top:20px">
       <p style="font-weight:700;margin:0">עדיין אין פריטים להצעה</p>
       <p style="margin:8px 0 0;color:var(--color-fg-muted);font-size:14px">הוסיפו ציוד או שירות בשלב התכנון לפני עריכת המחיר.</p>
       <button style="margin-top:14px;padding:10px 14px;border-radius:8px;border:0;background:#0b6bcb;color:#fff">חזרה לתכנון וציוד</button>
     </div>`,
    "dark",
  ),
  "s3-populated.html": shell(
    "s3",
    `<div class="cpq-stage-intro"><h2 class="cpq-stage-intro-title">ההצעה המסחרית</h2><p class="cpq-stage-intro-sub">בדקו את הפריטים, הכמויות והמחירים לפני הצגת ההצעה ללקוח.</p></div>
     <div style="margin-top:12px;display:grid;gap:8px">
       <div style="display:flex;justify-content:space-between;padding:12px;border:1px solid var(--color-border);border-radius:12px"><span>מצלמה Hikvision</span><strong class="ltr-meta" dir="ltr">₪4,800</strong></div>
       <div style="display:flex;justify-content:space-between;padding:12px;border:1px solid var(--color-border);border-radius:12px"><span>התקנה</span><strong class="ltr-meta" dir="ltr">₪920</strong></div>
     </div>
     <div style="margin-top:18px;padding:16px;border-radius:14px;border:1px solid var(--color-border)">
       <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--color-fg-muted)"><span>סכום ביניים</span><span class="ltr-meta" dir="ltr">₪5,720</span></div>
       <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--color-fg-muted);margin-top:6px"><span>הנחות</span><span class="ltr-meta" dir="ltr">-₪200</span></div>
       <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--color-fg-muted);margin-top:6px"><span>מע״מ</span><span class="ltr-meta" dir="ltr">₪994</span></div>
       <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:baseline">
         <span style="font-weight:700">סה״כ</span>
         <strong style="font-size:28px;font-variant-numeric:tabular-nums" class="ltr-meta" dir="ltr">₪6,514</strong>
       </div>
     </div>`,
    "dark",
  ),
  "s4-populated.html": shell(
    "s4",
    `<div class="cpq-stage-intro"><h2 class="cpq-stage-intro-title">תנאים ושליחה</h2><p class="cpq-stage-intro-sub">השלימו את התנאים ובדקו את ההצעה לפני השליחה ללקוח.</p></div>
     <p class="cpq-stage4-section-title">תנאי ההצעה</p>
     <div class="cpq-terms-row"><div class="cpq-terms-row-head"><span class="cpq-terms-row-label">תנאי תשלום</span><span class="cpq-terms-row-state">לפי ברירת המחדל של החברה</span><span class="cpq-terms-row-edit">עריכה</span></div></div>
     <div class="cpq-terms-row" style="margin-top:8px"><div class="cpq-terms-row-head"><span class="cpq-terms-row-label">אחריות</span><span class="cpq-terms-row-state">הותאם להצעה זו</span><span class="cpq-terms-row-edit">עריכה</span></div></div>
     <p style="margin:18px 0 8px;font-weight:700">בדיקה לפני שליחה</p>
     <ul style="list-style:none;padding:0;margin:0;display:grid;gap:6px;font-size:13px">
       <li>✓ לקוח · מוכן</li><li>✓ פריטים · מוכן</li><li>✓ מחירים · מוכן</li><li>○ אתר · מומלץ · לא נבחר אתר</li><li>✓ תנאים · מוכן</li>
     </ul>
     <section class="cpq-stage4-final-summary" style="margin-top:18px">
       <div><p class="cpq-stage4-final-customer">ישראל ישראלי</p><p class="cpq-stage4-final-meta">8 פריטים</p></div>
       <div class="cpq-stage4-final-total"><span class="cpq-stage4-final-total-label">סה״כ כולל מע״מ</span><p class="cpq-stage4-final-total-value ltr-meta" dir="ltr">₪6,514</p></div>
     </section>
     <div style="display:flex;gap:8px;margin-top:16px">
       <button style="padding:10px 14px;border-radius:8px;border:1px solid var(--color-border);background:transparent">תצוגת לקוח</button>
       <button style="padding:10px 16px;border-radius:8px;border:0;background:#0b6bcb;color:#fff;font-weight:700">שליחה לאישור הלקוח</button>
     </div>`,
    "dark",
  ),
};

fixtures["s2-populated-light.html"] = fixtures["s2-populated.html"].replace('data-theme="dark"', 'data-theme="light"').replace("#020617", "#f8fafc").replaceAll("#0f172a", "#fff").replaceAll("#f8fafc", "#0f172a");
// simplify light variants
fixtures["s2-pop-light.html"] = shell("s2", fixtures["s2-populated.html"].match(/<div class="panel">([\s\S]*)<\/div>\s*<\/main>/)?.[1] || "", "light");
fixtures["s3-pop-light.html"] = shell("s3", `<div class="cpq-stage-intro"><h2 class="cpq-stage-intro-title">ההצעה המסחרית</h2></div>
  <div style="margin-top:18px;padding:16px;border-radius:14px;border:1px solid var(--color-border)">
    <div style="display:flex;justify-content:space-between"><span>סכום ביניים</span><span class="ltr-meta" dir="ltr">₪5,720</span></div>
    <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:baseline"><strong>סה״כ</strong><strong style="font-size:28px" class="ltr-meta" dir="ltr">₪6,514</strong></div>
  </div>`, "light");
fixtures["s4-pop-light.html"] = shell("s4", `<div class="cpq-stage-intro"><h2 class="cpq-stage-intro-title">תנאים ושליחה</h2></div>
  <section class="cpq-stage4-final-summary"><div><p class="cpq-stage4-final-customer">ישראל ישראלי</p></div>
  <div class="cpq-stage4-final-total"><span class="cpq-stage4-final-total-label">סה״כ כולל מע״מ</span><p class="cpq-stage4-final-total-value ltr-meta" dir="ltr">₪6,514</p></div></section>
  <button style="margin-top:16px;padding:10px 16px;border-radius:8px;border:0;background:#0b6bcb;color:#fff">שליחה לאישור הלקוח</button>`, "light");

const server = createServer((req, res) => {
  const name = (req.url || "/").replace(/^\//, "") || "s1-empty.html";
  const html = fixtures[name] || fixtures["s1-empty.html"];
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
const shots = [];

async function shot(name, url, width, height, theme) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  shots.push({ name, file: path.relative(ROOT, file), width, height, theme });
  await ctx.close();
}

await shot("desktop-1440-dark-s1-empty", `${base}/s1-empty.html`, 1440, 900, "dark");
await shot("desktop-1440-dark-s1-customer", `${base}/s1-customer.html`, 1440, 900, "dark");
await shot("desktop-1440-dark-s2-empty", `${base}/s2-empty.html`, 1440, 900, "dark");
await shot("desktop-1440-dark-s2-populated", `${base}/s2-populated.html`, 1440, 900, "dark");
await shot("desktop-1440-dark-s3-empty", `${base}/s3-empty.html`, 1440, 900, "dark");
await shot("desktop-1440-dark-s3-populated", `${base}/s3-populated.html`, 1440, 900, "dark");
await shot("desktop-1440-dark-s4-populated", `${base}/s4-populated.html`, 1440, 900, "dark");
await shot("desktop-1440-light-s2-populated", `${base}/s2-pop-light.html`, 1440, 900, "light");
await shot("desktop-1440-light-s3-populated", `${base}/s3-pop-light.html`, 1440, 900, "light");
await shot("desktop-1440-light-s4-populated", `${base}/s4-pop-light.html`, 1440, 900, "light");
await shot("desktop-1100-dark-s2", `${base}/s2-populated.html`, 1100, 900, "dark");
await shot("desktop-1100-dark-s3", `${base}/s3-populated.html`, 1100, 900, "dark");
await shot("desktop-1280-dark-s4", `${base}/s4-populated.html`, 1280, 900, "dark");
await shot("mobile-390-dark-s1", `${base}/s1-empty.html`, 390, 844, "dark");
await shot("mobile-390-dark-s2-empty", `${base}/s2-empty.html`, 390, 844, "dark");
await shot("mobile-390-dark-s2-populated", `${base}/s2-populated.html`, 390, 844, "dark");
await shot("mobile-390-dark-s3-populated", `${base}/s3-populated.html`, 390, 844, "dark");
await shot("mobile-390-dark-s4", `${base}/s4-populated.html`, 390, 844, "dark");
await shot("mobile-390-light-s3", `${base}/s3-pop-light.html`, 390, 844, "light");
await shot("mobile-360-dark-s4", `${base}/s4-populated.html`, 360, 740, "dark");

await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), shots }, null, 2));
console.log(JSON.stringify({ out: OUT, shots: shots.length }, null, 2));
