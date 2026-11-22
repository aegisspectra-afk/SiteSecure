/**
 * Portal acceptance screenshots — 390 / 768 / 1440 (RTL).
 * Usage: pnpm --filter web dev (or vite preview) then:
 *   node apps/web/scripts/portal_acceptance_screens.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "Docs/acceptance/portal-screens");
const WEB = (process.env.WEB_URL || "http://127.0.0.1:5173").replace(/\/$/, "");

const ACCESS_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const mockSession = {
  grants: [{ access_id: ACCESS_ID, customer_id: "cust-1", customer_name: "לקוח לדוגמה", capabilities: [] }],
};
const mockHome = {
  access_id: ACCESS_ID,
  customer_name: "לקוח לדוגמה",
  installer_brand: "חברת התקנות לדוגמה",
  profile: { display_name: "לקוח לדוגמה", type: "private", email: "portal@example.com", phone: "0500000000" },
  sites: [
    {
      id: "site-1",
      name: "אתר ראשי",
      code: "AS-S-00001",
      installation_status: "completed",
      address: { city: "תל אביב", street: "הרצל", house_number: "1" },
    },
  ],
  installations: [
    { id: "j1", number: "J-100", title: "התקנת מצלמות", status: "completed", completed_at: "2026-01-10T10:00:00Z", site_id: "site-1" },
  ],
  equipment: [
    { id: "e1", site_id: "site-1", name: "מצלמת חוץ", category: "camera", manufacturer: "Hikvision", model: "DS-2CD", serial: "SN1", installed_at: "2026-01-10", status: "installed" },
  ],
  warranties: [{ id: "w1", number: "W-1", type: "installation", status: "active", starts_on: "2026-01-10", ends_on: "2027-01-10", site_id: "site-1" }],
  quotes: [{ id: "q1", number: "Q-100", status: "sent", total_gross: 4200, sent_at: "2026-01-05", valid_until: "2026-02-05", can_open: true }],
  service: [{ id: "sc1", number: "SC-1", title: "בדיקת מערכת", status: "open", created_at: "2026-01-12", site_id: "site-1" }],
  documents: [{ id: "d1", filename: "אישור התקנה.pdf", mime_type: "application/pdf", created_at: "2026-01-10" }],
};

const widths = [390, 768, 1440];
const pages = [
  { slug: "login", path: "/portal/login", needsAuth: false },
  { slug: "home", path: "/portal/", needsAuth: true },
  { slug: "service", path: "/portal/service", needsAuth: true },
];

const { chromium } = await import("playwright");

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ locale: "he-IL", colorScheme: "light" });
const page = await context.newPage();

async function installPortalMocks() {
  await page.route("**/api/v1/portal/session**", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockSession) });
  });
  await page.route(`**/api/v1/portal/access/${ACCESS_ID}**`, (route) => {
    const url = route.request().url();
    if (url.includes("/service-calls") || url.includes("/documents")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockHome) });
  });
}

for (const spec of pages) {
  if (spec.needsAuth) {
    await installPortalMocks();
    await page.addInitScript(() => {
      window.localStorage.setItem("ss_portal_bearer", "acceptance-screenshot-token");
    });
  } else {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }

  for (const width of widths) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
    await page.goto(`${WEB}${spec.path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(spec.needsAuth ? 400 : 200);
    const file = path.join(OUT, `portal-${spec.slug}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("wrote", file);
  }
}

await browser.close();
console.log("done:", OUT);