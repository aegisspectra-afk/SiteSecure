/**
 * BETA-E2E-1 UI smoke screenshots against production web.
 * Uses disposable password login (no secrets written to disk).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/beta-e2e-1-certification/screenshots");
const REPORT = JSON.parse(
  fs.readFileSync(path.join(ROOT, "Docs/beta-e2e-1-certification/artifacts/report.json"), "utf8"),
);
const WEB = REPORT.web || "https://site-secure-umber.vercel.app";
fs.mkdirSync(OUT, { recursive: true });

const ownerEmail = REPORT.accounts?.owner;
// Password not in report — read from env for UI only
const ownerPass = process.env.BETA_E2E_OWNER_PASS;
const results = { web: WEB, shots: [], ok: true };

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  results.shots.push(name);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const [label, viewport] of [
    ["desktop-1440", { width: 1440, height: 900 }],
    ["mobile-390", { width: 390, height: 844 }],
  ]) {
    const ctx = await browser.newContext({
      viewport,
      locale: "he-IL",
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => {
      results.ok = false;
      results.lastError = String(e);
    });
    await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await shot(page, `${label}-login`);
    if (ownerEmail && ownerPass) {
      await page.getByLabel(/אימייל|email/i).fill(ownerEmail).catch(() => page.locator('input[type="email"]').fill(ownerEmail));
      await page.locator('input[type="password"]').fill(ownerPass);
      await page.getByRole("button", { name: /התחבר|כניסה|login/i }).click();
      await page.waitForTimeout(4000);
      await shot(page, `${label}-after-login`);
    } else {
      results.note = "Skipped authenticated UI shots — set BETA_E2E_OWNER_PASS to capture post-login";
    }
    await page.goto(`${WEB}/forgot-password`, { waitUntil: "domcontentloaded" });
    await shot(page, `${label}-forgot-password`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, "ui-smoke.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
