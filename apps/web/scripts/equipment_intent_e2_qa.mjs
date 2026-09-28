/**
 * E2 visual QA — Equipment Intent durable states (static fixtures).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/equipment-intent-e2-qa");
fs.mkdirSync(OUT, { recursive: true });

const cssPath = path.join(ROOT, "apps/web/dist/assets");
let css = "";
try {
  const cssFile = fs.readdirSync(cssPath).find((f) => f.endsWith(".css"));
  css = cssFile ? fs.readFileSync(path.join(cssPath, cssFile), "utf8") : "";
} catch {
  css = "";
}

function actions(btns) {
  return `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px">${btns
    .map(
      (b) =>
        `<button type="button" style="font-size:12px;padding:6px 10px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface)">${b}</button>`,
    )
    .join("")}</div>`;
}

function card(title, qty, req, equipLabel, equip, note, btns = []) {
  return `
  <article class="cpq-e1-card" style="border:1px solid var(--color-border);border-radius:10px;padding:12px;margin-bottom:8px;background:var(--color-surface)">
    <p style="font-weight:600;margin:0">${title}${qty ? ` · ×${qty}` : ""}</p>
    <div style="margin-top:8px;font-size:12px;display:grid;gap:6px">
      <p style="margin:0"><span style="color:var(--color-fg-muted)">דרישת תכנון · </span>${req}</p>
      <p style="margin:0"><span style="color:var(--color-fg-muted)">${equipLabel} · </span>${equip}</p>
      ${note ? `<p style="margin:0;color:var(--color-fg-muted)">${note}</p>` : ""}
    </div>
    ${btns.length ? actions(btns) : ""}
  </article>`;
}

function editor() {
  return `
  <div class="cpq-e2-intent-editor" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--color-border);display:grid;gap:8px">
    <p style="margin:0;font-size:12px;font-weight:600">הגדר ציוד ללא קטלוג</p>
    <label style="font-size:12px;color:var(--color-fg-muted)">יצרן
      <input style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--color-border);border-radius:8px" value="Hikvision" list="mfr"/>
      <datalist id="mfr"><option value="Hikvision"/><option value="Dahua"/></datalist>
    </label>
    <label style="font-size:12px;color:var(--color-fg-muted)">דגם / מק״ט יצרן / אסמכתא
      <input style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--color-border);border-radius:8px" placeholder="אופציונלי — אינו יוצר מוצר בקטלוג"/>
    </label>
    <div style="display:flex;gap:8px">
      <button type="button" style="padding:8px 12px;border-radius:8px;background:#0f172a;color:#fff;border:0">שמור ציוד</button>
      <button type="button" style="padding:8px 12px;border-radius:8px;border:1px solid var(--color-border);background:transparent">ביטול</button>
    </div>
  </div>`;
}

function page(state, theme = "light") {
  const dark = theme === "dark";
  let body = "";
  if (state === "requirement-only" || state === "empty-catalog") {
    body = `
      <section class="cpq-e1-eng-banner" style="padding:12px;border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">✓ התכנון ההנדסי הושלם</p>
        <p style="margin:4px 0 0;color:var(--color-fg-muted)">מערכת CCTV · 4 מצלמות</p>
      </section>
      <section style="padding:12px;border:1px solid var(--color-border);border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">ציוד</p>
        <p style="margin:4px 0 0;color:var(--color-fg-muted)">נותר לבחור ציוד עבור 4 רכיבים.</p>
        ${state === "empty-catalog" ? `<p style="margin:8px 0 0;font-size:12px;color:var(--color-fg-muted)">אין עדיין מוצרים תואמים בקטלוג.</p>` : ""}
      </section>
      ${card("מצלמה", 4, "8MP · חוץ · Turret · PoE", "ציוד", "טרם נבחר", "לא נמצא מוצר תואם בקטלוג", ["הגדר ציוד ללא קטלוג"])}
      ${card("מקליט / NVR", 1, "לפחות 4 ערוצים", "ציוד", "טרם נבחר", "", ["הגדר ציוד ללא קטלוג"])}`;
  } else if (state === "intent-defined") {
    body = `
      <section class="cpq-e1-eng-banner" style="padding:12px;border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">✓ התכנון ההנדסי הושלם</p>
        <p style="margin:4px 0 0;color:var(--color-fg-muted)">מערכת CCTV · 4 מצלמות</p>
      </section>
      <section style="padding:12px;border:1px solid var(--color-border);border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">ציוד</p>
        <p style="margin:8px 0 0;font-size:14px">הציוד נשמר בתכנון. הוספה להצעה ללא מוצר קטלוגי תתאפשר בשלב הבא.</p>
      </section>
      ${card("מצלמה", 4, "8MP · חוץ · Turret · PoE", "ציוד מוגדר", "Hikvision · דגם טרם נבחר", "ציוד מוגדר", ["ערוך ציוד", "לבחירה מאוחרת"])}
      ${card("מקליט / NVR", 1, "לפחות 4 ערוצים", "ציוד", "טרם נבחר", "", ["הגדר ציוד ללא קטלוג"])}`;
  } else if (state === "catalog-resolved") {
    body = `
      <section class="cpq-e1-eng-banner" style="padding:12px;border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">✓ התכנון ההנדסי הושלם</p>
      </section>
      <section style="padding:12px;border:1px solid var(--color-border);border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">ציוד</p>
        <p style="margin:4px 0 0;color:var(--color-fg-muted)">מוכן להוספה להצעה</p>
      </section>
      ${card("מצלמה", 4, "8MP · חוץ · PoE", "ציוד", "Hikvision DS-2CD", "מקושר לקטלוג · תואם לדרישה", ["החלף", "הגדר ציוד ללא קטלוג", "לבחירה מאוחרת"])}`;
  } else if (state === "needs-review") {
    body = `
      <section class="cpq-e1-eng-banner" style="padding:12px;border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">✓ התכנון ההנדסי הושלם</p>
      </section>
      ${card("מצלמה", 4, "12MP · חוץ · Turret · PoE", "ציוד מוגדר", "Hikvision · DS-XXXX", "הציוד שהוגדר דורש בדיקה לאחר שינוי בתכנון", ["ערוך ציוד", "בחר מהקטלוג", "לבחירה מאוחרת"])}`;
  } else if (state === "intent-editor") {
    body = `
      <section class="cpq-e1-eng-banner" style="padding:12px;border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">✓ התכנון ההנדסי הושלם</p>
      </section>
      <article class="cpq-e1-card" style="border:1px solid var(--color-border);border-radius:10px;padding:12px;background:var(--color-surface)">
        <p style="font-weight:600;margin:0">מצלמה · ×4</p>
        <div style="margin-top:8px;font-size:12px;display:grid;gap:6px">
          <p style="margin:0"><span style="color:var(--color-fg-muted)">דרישת תכנון · </span>8MP · חוץ · Turret · PoE</p>
          <p style="margin:0"><span style="color:var(--color-fg-muted)">ציוד · </span>טרם נבחר</p>
        </div>
        ${editor()}
      </article>`;
  }

  return `<!doctype html>
<html lang="he" dir="rtl" data-theme="${theme}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>E2 ${state}</title>
<style>
${css}
:root {
  --color-fg-muted: ${dark ? "#94a3b8" : "#64748b"};
  --color-border: ${dark ? "#334155" : "#e2e8f0"};
  --color-surface: ${dark ? "#0f172a" : "#fff"};
  --color-fg: ${dark ? "#f8fafc" : "#0f172a"};
  --radius-control: 10px;
}
body { margin:0; font-family: Heebo, system-ui, sans-serif; background: ${dark ? "#020617" : "#f8fafc"}; color: var(--color-fg); }
.wrap { max-width: 480px; margin: 0 auto; padding: 16px; background: var(--color-surface); min-height: 100vh; box-shadow: 0 0 0 1px var(--color-border); }
.cpq-e1-eng-banner { border: 1px solid color-mix(in srgb, #16a34a 32%, var(--color-border)); background: color-mix(in srgb, #16a34a 8%, var(--color-surface)); }
</style>
</head>
<body>
<main class="wrap cpq-e1-review" data-state="${state}">
  <p style="font-size:12px;color:var(--color-fg-muted);margin:0 0 12px">System Builder · תכנון וציוד · ${state}</p>
  ${body}
</main>
</body></html>`;
}

const fixtures = {
  "requirement-only.html": page("requirement-only"),
  "intent-defined.html": page("intent-defined"),
  "catalog-resolved.html": page("catalog-resolved"),
  "needs-review.html": page("needs-review"),
  "empty-catalog.html": page("empty-catalog"),
  "intent-editor.html": page("intent-editor"),
  "intent-defined-dark.html": page("intent-defined", "dark"),
};

const server = createServer((req, res) => {
  const name = (req.url || "/").replace(/^\//, "") || "requirement-only.html";
  const html = fixtures[name] || fixtures["requirement-only.html"];
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

await shot("desktop-requirement-only", `${base}/requirement-only.html`, 1280, 900, "light");
await shot("desktop-intent-defined", `${base}/intent-defined.html`, 1280, 900, "light");
await shot("desktop-catalog-resolved", `${base}/catalog-resolved.html`, 1280, 900, "light");
await shot("desktop-needs-review", `${base}/needs-review.html`, 1280, 900, "light");
await shot("desktop-empty-catalog", `${base}/empty-catalog.html`, 1280, 900, "light");
await shot("desktop-dark-intent", `${base}/intent-defined-dark.html`, 1280, 900, "dark");
await shot("mobile-390-requirement-only", `${base}/requirement-only.html`, 390, 844, "light");
await shot("mobile-390-define-intent", `${base}/intent-editor.html`, 390, 844, "light");
await shot("mobile-390-intent-saved", `${base}/intent-defined.html`, 390, 844, "light");
await shot("mobile-390-empty-catalog", `${base}/empty-catalog.html`, 390, 844, "light");
await shot("mobile-360-intent-editor", `${base}/intent-editor.html`, 360, 740, "light");
await shot("mobile-360-saved", `${base}/intent-defined.html`, 360, 740, "light");

await browser.close();
server.close();

fs.writeFileSync(
  path.join(OUT, "report.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), shots }, null, 2),
);
console.log(JSON.stringify({ out: OUT, shots: shots.length }, null, 2));
