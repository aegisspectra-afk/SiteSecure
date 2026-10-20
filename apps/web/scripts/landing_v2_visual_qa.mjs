/**
 * LANDING-V2 visual QA — capture homepage at required breakpoints (dark).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"));
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "Docs/landing-v2-visual-qa");
const WEB = process.env.LANDING_QA_URL || "http://localhost:5173";
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: "1440-dark", width: 1440, height: 900 },
  { name: "1280-dark", width: 1280, height: 800 },
  { name: "1032-dark", width: 1032, height: 800 },
  { name: "768-dark", width: 768, height: 1024 },
  { name: "390-dark", width: 390, height: 844 },
  { name: "360-dark", width: 360, height: 740 },
];

const browser = await chromium.launch({ headless: true });
const report = { url: WEB, captures: [], overflow: [], generatedAt: new Date().toISOString() };

for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  await ctx.addInitScript(() => {
    localStorage.setItem("site-secure-theme", "dark");
    document.documentElement.dataset.theme = "dark";
    document.documentElement.dataset.themeMode = "dark";
  });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.dataset.themeMode = "dark";
    document.documentElement.style.colorScheme = "dark";
  });
  await page.waitForSelector(".public-hero", { timeout: 20000 });
  await page.waitForTimeout(600);

  const heroPath = path.join(OUT, `${vp.name}-hero.png`);
  await page.screenshot({ path: heroPath, fullPage: false });

  const fullPath = path.join(OUT, `${vp.name}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 1,
    };
  });

  const sections = {};
  for (const id of ["quotes", "flow", "site-file", "assets", "field", "security", "pilot"]) {
    const el = page.locator(`#${id}`);
    if (await el.count()) {
      const sectionPath = path.join(OUT, `${vp.name}-section-${id}.png`);
      await el.screenshot({ path: sectionPath }).catch(() => undefined);
      sections[id] = path.basename(sectionPath);
    }
  }

  report.captures.push({
    viewport: vp.name,
    hero: path.basename(heroPath),
    full: path.basename(fullPath),
    sections,
    overflow,
  });
  if (overflow.overflow) report.overflow.push(vp.name);
  console.log(vp.name, overflow.overflow ? "OVERFLOW" : "ok");
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("done", OUT);
