import { describe, expect, it } from "vitest";
import { SSP_UNIMPLEMENTED_NAV, sspBottomNav, sspNavDestinations, sspNavGroups } from "../src/lib/ssp-nav";
import { productCan } from "../src/lib/ssp-product-authz";

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
] as const;

const BOTTOM = ["/app/ssp", "/app/ssp/alerts", "/app/ssp/patrols", "/app/ssp/activity", "/app/ssp/sites"] as const;

describe("ssp operational navigation", () => {
  it("exposes action-led hubs in order and keeps reports off the sidebar", () => {
    const sspCan = (action: string) => productCan("org_admin", action) || action === "ssp.forms.view";
    const groups = sspNavGroups({ sspCan, isOfficer: false });
    expect(groups.map((group) => group.id)).toEqual(["ops"]);
    expect(sspNavDestinations({ sspCan, isOfficer: false })).toEqual([...TEN]);
    expect(sspNavDestinations({ sspCan, isOfficer: false })).not.toContain("/app/ssp/forms");
    expect(sspNavDestinations({ sspCan, isOfficer: false })).not.toContain("/app/ssp/task-templates");
    expect(SSP_UNIMPLEMENTED_NAV).toEqual(
      expect.arrayContaining([
        "שליחת Push לספק חיצוני",
        "מיקום בזמן אמת לניידות",
        "תזמון משימות אוטומטי",
        "דוחות וניתוחים מתקדמים",
      ]),
    );
  });

  it("keeps the same hubs for officers without enrollments as a primary item", () => {
    const sspCan = (action: string) => productCan("patrol_officer", action);
    const paths = sspNavDestinations({ sspCan, isOfficer: true });
    expect(paths).toEqual([...TEN]);
    expect(paths).not.toContain("/app/ssp/enrollments");
    expect(paths).not.toContain("/app/ssp/officers");
    expect(sspBottomNav({ sspCan, isOfficer: true }).map((item) => (item.kind === "route" ? item.to : item.kind))).toEqual(
      [...BOTTOM],
    );
  });
});
