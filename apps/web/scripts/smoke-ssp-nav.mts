import { readFileSync } from "node:fs";
import { SSP_UNIMPLEMENTED_NAV, sspBottomNav, sspNavDestinations, sspNavGroups } from "../src/lib/ssp-nav.ts";
import { productCan } from "../src/lib/ssp-product-authz.ts";

const ADMIN = [
  "/app/ssp",
  "/app/ssp/offices",
  "/app/ssp/users",
  "/app/ssp/forms",
  "/app/ssp/assignments",
  "/app/ssp/submissions",
  "/app/ssp/reports",
  "/app/ssp/templates",
];

const OFFICER = ["/app/ssp/my-forms", "/app/ssp/my-submissions", "/app/ssp/profile"];
const BOTTOM = ["/app/ssp", "/app/ssp/offices", "/app/ssp/users", "/app/ssp/forms", "/app/ssp/submissions"];
const OFFICER_BOTTOM = ["/app/ssp/my-forms", "/app/ssp/my-submissions", "/app/ssp/profile"];

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const adminCan = (action: string) => productCan("org_admin", action) || action === "ssp.forms.view";
assert(sspNavGroups({ sspCan: adminCan, isOfficer: false }).map((g) => g.id).join() === "ops", "ops group");
assert(sspNavDestinations({ sspCan: adminCan, isOfficer: false }).join() === ADMIN.join(), "manager ia");
assert(sspNavDestinations({ sspCan: adminCan }).includes("/app/ssp/forms"), "forms in admin nav");

const officerCan = (action: string) => productCan("patrol_officer", action);
const officerPaths = sspNavDestinations({ sspCan: officerCan, isOfficer: true });
assert(officerPaths.join() === OFFICER.join(), "officer ia");
assert(!officerPaths.includes("/app/ssp/users"), "officer has no people admin");
assert(
  sspBottomNav({ sspCan: officerCan, isOfficer: true })
    .map((item) => (item.kind === "route" ? item.to : item.kind))
    .join() === OFFICER_BOTTOM.join(),
  "officer bottom",
);
assert(
  sspBottomNav({ sspCan: adminCan, isOfficer: false })
    .map((item) => (item.kind === "route" ? item.to : item.kind))
    .join() === BOTTOM.join(),
  "admin bottom",
);
assert(SSP_UNIMPLEMENTED_NAV.includes("שליחת Push לספק חיצוני"), "push gap");
assert(SSP_UNIMPLEMENTED_NAV.includes("מיקום בזמן אמת לניידות"), "gps gap");
assert(SSP_UNIMPLEMENTED_NAV.includes("תזמון משימות אוטומטי"), "schedule gap");
assert(SSP_UNIMPLEMENTED_NAV.includes("דוחות וניתוחים מתקדמים"), "reports deferred");

const hub = readFileSync(new URL("../src/components/ssp/SspHubLinks.tsx", import.meta.url), "utf8");
assert(hub.includes("border-border"), "hub links are buttons");
assert(hub.includes("min-h-11"), "hub links have touch target");
assert(!hub.includes("ops-section-link"), "hub links are not plain text");
console.log("ssp-nav smoke OK");
