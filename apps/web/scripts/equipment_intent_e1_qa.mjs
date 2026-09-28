/**
 * E1 visual QA — static fixture screenshots (no fake catalog SKUs).
 * Captures engineering-complete / empty-catalog, partial, and resolved layouts.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/equipment-intent-e1-qa");
fs.mkdirSync(OUT, { recursive: true });

const cssPath = path.join(ROOT, "apps/web/dist/assets");
const cssFile = fs.readdirSync(cssPath).find((f) => f.endsWith(".css"));
const css = cssFile ? fs.readFileSync(path.join(cssPath, cssFile), "utf8") : "";

function card(title, qty, req, equip, note) {
  return `
  <article class="cpq-e1-card rounded-[var(--radius-control)] border border-border p-3" style="border:1px solid var(--color-border);border-radius:10px;padding:12px;margin-bottom:8px;background:var(--color-surface)">
    <p style="font-weight:600;margin:0">${title}${qty ? ` · ×${qty}` : ""}</p>
    <div style="margin-top:8px;font-size:12px;display:grid;gap:6px">
      <p style="margin:0"><span style="color:var(--color-fg-muted)">דרישה הנדסית · </span>${req}</p>
      <p style="margin:0"><span style="color:var(--color-fg-muted)">ציוד · </span>${equip}</p>
      ${note ? `<p style="margin:0;color:var(--color-fg-muted)">${note}</p>` : ""}
    </div>
  </article>`;
}

function page(state) {
  const engOk = state !== "incomplete";
  let body = "";
  if (state === "empty") {
    body = `
      <section class="cpq-e1-eng-banner" style="padding:12px;border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">✓ התכנון ההנדסי הושלם</p>
        <p style="margin:4px 0 0;color:var(--color-fg-muted)">מערכת CCTV · 4 מצלמות</p>
      </section>
      <section style="padding:12px;border:1px solid var(--color-border);border-radius:10px;margin-bottom:12px;background:color-mix(in srgb, var(--color-surface-muted, #f4f4f5) 40%, transparent)">
        <p style="font-weight:600;margin:0">תכנון מערכת</p>
        <ul style="list-style:none;padding:0;margin:8px 0 0;display:grid;gap:8px;font-size:14px">
          <li style="display:flex;justify-content:space-between"><span style="color:var(--color-fg-muted)">מצלמות</span><strong>4</strong></li>
          <li style="display:flex;justify-content:space-between"><span style="color:var(--color-fg-muted)">מקליט</span><strong>לפחות 4 ערוצים</strong></li>
          <li style="display:flex;justify-content:space-between"><span style="color:var(--color-fg-muted)">אחסון</span><strong>כ־2.9TB</strong></li>
          <li style="display:flex;justify-content:space-between"><span style="color:var(--color-fg-muted)">PoE</span><strong>לפחות 4 פורטים</strong></li>
          <li style="display:flex;justify-content:space-between"><span style="color:var(--color-fg-muted)">ארכיטקטורה</span><strong>NVR + מתג PoE חיצוני</strong></li>
        </ul>
      </section>
      <section style="padding:12px;border:1px solid var(--color-border);border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">ציוד</p>
        <p style="margin:4px 0 0;color:var(--color-fg-muted)">נותר לבחור ציוד עבור 4 רכיבים.</p>
        <p style="margin:8px 0 0;font-size:12px;color:var(--color-fg-muted)">אין עדיין מוצרים תואמים בקטלוג. אפשר לבחור מוצר מהקטלוג בהמשך, או להשאיר רכיב לבחירה מאוחרת.</p>
        <p style="margin:8px 0 0;font-size:14px">התכנון הושלם, אך יש רכיבי ציוד שעדיין לא ניתן להוסיף להצעה.</p>
      </section>
      <h3 style="font-size:14px;margin:0 0 8px">מצלמות</h3>
      ${card("מצלמה", 4, "8MP · חוץ · turret · PoE", "טרם נבחר", "לא נמצא מוצר תואם בקטלוג")}
      <h3 style="font-size:14px;margin:16px 0 8px">הקלטה ואחסון</h3>
      ${card("מקליט / NVR", 1, "לפחות 4 ערוצים", "טרם נבחר", "לא נמצא מוצר תואם בקטלוג")}
      ${card("אחסון / HDD", 1, "כ־2.9TB", "טרם נבחר", "לא נמצאו כוננים תואמים בקטלוג")}
      <h3 style="font-size:14px;margin:16px 0 8px">רשת ו־PoE</h3>
      ${card("מתג PoE", 1, "מתג PoE חיצוני · לפחות 4 פורטים", "טרם נבחר", "לא נמצא מוצר תואם בקטלוג")}
      <div class="cpq-e1-services" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--color-border)">
        <h3 style="font-size:14px;margin:0 0 8px">שירותים ועבודה</h3>
        ${card("התקנת מצלמות", 4, "שירות", "טרם שויך", "")}
        ${card("בדיקות", 1, "שירות", "טרם שויך", "")}
      </div>`;
  } else if (state === "partial") {
    body = `
      <section class="cpq-e1-eng-banner" style="padding:12px;border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">✓ התכנון ההנדסי הושלם</p>
        <p style="margin:4px 0 0;color:var(--color-fg-muted)">מערכת CCTV · 4 מצלמות</p>
      </section>
      <section style="padding:12px;border:1px solid var(--color-border);border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">ציוד</p>
        <p style="margin:4px 0 0;color:var(--color-fg-muted)">נותר לבחור ציוד עבור 2 רכיבים.</p>
        <p style="margin:8px 0 0;font-size:12px;color:var(--color-fg-muted)">ניתן להוסיף להצעה את הפריטים שכבר נפתרו מהקטלוג.</p>
      </section>
      ${card("מצלמה", 4, "8MP · חוץ · PoE", "Hikvision DS-2CD", "מקושר לקטלוג · תואם לדרישה")}
      ${card("מקליט / NVR", 1, "לפחות 4 ערוצים", "טרם נבחר", "לא נמצא מוצר תואם בקטלוג")}
      ${card("אחסון / HDD", 1, "כ־2.9TB", "טרם נבחר", "לא נמצאו כוננים תואמים בקטלוג")}`;
  } else {
    body = `
      <section class="cpq-e1-eng-banner" style="padding:12px;border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">✓ התכנון ההנדסי הושלם</p>
        <p style="margin:4px 0 0;color:var(--color-fg-muted)">מערכת CCTV · 4 מצלמות</p>
      </section>
      <section style="padding:12px;border:1px solid var(--color-border);border-radius:10px;margin-bottom:12px">
        <p style="font-weight:600;margin:0">ציוד</p>
        <p style="margin:4px 0 0;color:var(--color-fg-muted)">מוכן להוספה להצעה</p>
      </section>
      ${card("מצלמה", 4, "8MP · חוץ · PoE", "Hikvision DS-2CD", "מקושר לקטלוג · תואם לדרישה")}
      ${card("מקליט / NVR", 1, "לפחות 4 ערוצים", "Hikvision DS-7604", "מקושר לקטלוג · תואם לדרישה")}
      ${card("אחסון / HDD", 2, "כ־2.9TB", "WD Purple 4TB", "מקושר לקטלוג · תואם לדרישה")}
      ${card("מתג PoE", 1, "מתג PoE חיצוני · לפחות 4 פורטים", "TP-Link SG1008P", "מקושר לקטלוג · תואם לדרישה")}`;
  }

  return `<!doctype html>
<html lang="he" dir="rtl" data-theme="light">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>E1 ${state}</title>
<style>
${css}
:root { --color-fg-muted: #64748b; --color-border: #e2e8f0; --color-surface: #fff; --color-fg: #0f172a; --radius-control: 10px; }
body { margin:0; font-family: Heebo, system-ui, sans-serif; background: #f8fafc; color: var(--color-fg); }
.wrap { max-width: 480px; margin: 0 auto; padding: 16px; background: #fff; min-height: 100vh; box-shadow: 0 0 0 1px var(--color-border); }
.cpq-e1-eng-banner { border: 1px solid color-mix(in srgb, #16a34a 32%, var(--color-border)); background: color-mix(in srgb, #16a34a 8%, #fff); }
</style>
</head>
<body>
<main class="wrap cpq-e1-review" data-state="${state}">
  <p style="font-size:12px;color:var(--color-fg-muted);margin:0 0 12px">System Builder · שלב תכנון וציוד · ${state}</p>
  ${body}
</main>
</body></html>`;
}

const fixtures = {
  "empty.html": page("empty"),
  "partial.html": page("partial"),
  "resolved.html": page("resolved"),
};

const server = createServer((req, res) => {
  const name = (req.url || "/").replace(/^\//, "") || "empty.html";
  const html = fixtures[name] || fixtures["empty.html"];
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ headless: true });
const shots = [];

async function shot(name, url, width, height, theme) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  shots.push({ name, file: path.relative(ROOT, file), width, height, theme });
  await ctx.close();
}

await shot("desktop-empty-catalog", `${base}/empty.html`, 1280, 900, "light");
await shot("desktop-partial-catalog", `${base}/partial.html`, 1280, 900, "light");
await shot("desktop-resolved-catalog", `${base}/resolved.html`, 1280, 900, "light");
await shot("mobile-390-empty", `${base}/empty.html`, 390, 844, "light");
await shot("mobile-360-empty", `${base}/empty.html`, 360, 740, "light");
await shot("mobile-390-resolved", `${base}/resolved.html`, 390, 844, "light");
await shot("dark-desktop-empty", `${base}/empty.html`, 1280, 900, "dark");

await browser.close();
server.close();

fs.writeFileSync(
  path.join(OUT, "report.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), shots }, null, 2),
);
console.log(JSON.stringify({ out: OUT, shots: shots.length }, null, 2));
