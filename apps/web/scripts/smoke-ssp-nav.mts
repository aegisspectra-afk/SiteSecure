import { SSP_UNIMPLEMENTED_NAV, sspBottomNav, sspNavDestinations, sspNavGroups } from "../src/lib/ssp-nav.ts";
import { productCan } from "../src/lib/ssp-product-authz.ts";

const TEN = [
  "/app/ssp",
  "/app/ssp/alerts",
  "/app/ssp/patrols",
  "/app/ssp/activity",
  "/app/ssp/events",
  "/app/ssp/sites",
  "/app/ssp/mobility",
  "/app/ssp/users",
  "/app/ssp/messages",
  "/app/ssp/templates",
];

const BOTTOM = ["/app/ssp", "/app/ssp/alerts", "/app/ssp/patrols", "/app/ssp/activity", "/app/ssp/sites"];

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const adminCan = (action: string) => productCan("org_admin", action) || action === "ssp.forms.view";
assert(sspNavGroups({ sspCan: adminCan, isOfficer: false }).map((g) => g.id).join() === "ops", "ops group");
assert(sspNavDestinations({ sspCan: adminCan, isOfficer: false }).join() === TEN.join(), "manager ten");
assert(!sspNavDestinations({ sspCan: adminCan }).includes("/app/ssp/forms"), "forms is hub sub-screen");

const officerCan = (action: string) => productCan("patrol_officer", action);
const officerPaths = sspNavDestinations({ sspCan: officerCan, isOfficer: true });
assert(officerPaths.join() === TEN.join(), "officer ten");
assert(!officerPaths.includes("/app/ssp/enrollments"), "no enrollments");
assert(
  sspBottomNav({ sspCan: officerCan, isOfficer: true })
    .map((item) => (item.kind === "route" ? item.to : item.kind))
    .join() === BOTTOM.join(),
  "officer bottom 5",
);
assert(SSP_UNIMPLEMENTED_NAV.includes("שליחת Push לספק חיצוני"), "push gap");
assert(SSP_UNIMPLEMENTED_NAV.includes("מיקום בזמן אמת לניידות"), "gps gap");
assert(SSP_UNIMPLEMENTED_NAV.includes("תזמון משימות אוטומטי"), "schedule gap");
assert(SSP_UNIMPLEMENTED_NAV.includes("דוחות וניתוחים מתקדמים"), "reports deferred");
console.log("ssp-nav smoke OK");
