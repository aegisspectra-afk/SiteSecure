
import { chromium } from "playwright";
const WEB = "http://localhost:5173";
const email = "beta.ui.1b01fcc0@sitesecure.test";
const password = "BetaQA-1b01fcc0-2026!";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
try {
  await page.goto(WEB + "/register", { waitUntil: "networkidle", timeout: 60000 });
  await page.fill("#fullName", "UI Smoke 1b01fcc0");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.fill("#confirm", password);
  await page.getByRole("button", { name: /הרשמ|יצירת|Register|Sign/i }).click();
  await page.waitForTimeout(4000);
  const url = page.url();
  const body = await page.locator("body").innerText();
  console.log(JSON.stringify({ ok: /onboarding|verify-email|app|login/i.test(url) || /אימות|onboarding|workspace/i.test(body), url, consoleErrors: consoleErrors.slice(0,5), detail: body.slice(0,120) }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, detail: String(e) }));
} finally {
  await browser.close();
}
