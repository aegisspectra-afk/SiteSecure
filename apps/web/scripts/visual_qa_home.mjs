import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "_visual_qa");
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1024", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
  { name: "360", width: 360, height: 800 },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(800);

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, `hero-${vp.name}.png`),
    fullPage: false,
  });
  await page.screenshot({
    path: path.join(outDir, `full-${vp.name}.png`),
    fullPage: true,
  });

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowX: doc.scrollWidth > doc.clientWidth + 1,
    };
  });
  console.log(JSON.stringify({ vp: vp.name, ...overflow }));
}

await page.setViewportSize({ width: 1440, height: 900 });
const sections = ["pain", "site-file", "twin", "operations", "field", "intelligence", "security", "pilot"];
for (const id of sections) {
  const el = page.locator(`#${id}`);
  if ((await el.count()) > 0) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await el.screenshot({ path: path.join(outDir, `section-${id}.png`) });
  }
}

await browser.close();
console.log("done");
