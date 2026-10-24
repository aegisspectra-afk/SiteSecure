import { describe, expect, it } from "vitest";
import { SSP_UNIMPLEMENTED_NAV, sspBottomNav, sspNavDestinations, sspNavGroups } from "../src/lib/ssp-nav";
import { canOpenSspOrganization, productCan, shouldHydrateSspFormFields } from "../src/lib/ssp-product-authz";

const ADMIN = [
  "/app/ssp",
  "/app/ssp/offices",
  "/app/ssp/users",
  "/app/ssp/forms",
  "/app/ssp/assignments",
  "/app/ssp/submissions",
  "/app/ssp/reports",
  "/app/ssp/templates",
] as const;

const OFFICER = ["/app/ssp/my-forms", "/app/ssp/my-submissions", "/app/ssp/profile"] as const;
const BOTTOM = ["/app/ssp", "/app/ssp/offices", "/app/ssp/users", "/app/ssp/forms", "/app/ssp/submissions"] as const;

describe("ssp operational navigation", () => {
  it("exposes admin IA: offices, users, builder, assignments, submissions", () => {
    const sspCan = (action: string) => productCan("org_admin", action) || action === "ssp.forms.view";
    const groups = sspNavGroups({ sspCan, isOfficer: false });
    expect(groups.map((group) => group.id)).toEqual(["ops"]);
    expect(sspNavDestinations({ sspCan, isOfficer: false })).toEqual([...ADMIN]);
    expect(sspNavDestinations({ sspCan, isOfficer: false })).toContain("/app/ssp/forms");
    expect(sspBottomNav({ sspCan, isOfficer: false }).map((item) => (item.kind === "route" ? item.to : item.kind))).toEqual(
      [...BOTTOM],
    );
    expect(SSP_UNIMPLEMENTED_NAV).toEqual(
      expect.arrayContaining([
        "שליחת Push לספק חיצוני",
        "מיקום בזמן אמת לניידות",
        "תזמון משימות אוטומטי",
        "דוחות וניתוחים מתקדמים",
      ]),
    );
  });

  it("limits officers to my-forms, my-submissions, and profile", () => {
    const sspCan = (action: string) => productCan("patrol_officer", action);
    const paths = sspNavDestinations({ sspCan, isOfficer: true });
    expect(paths).toEqual([...OFFICER]);
    expect(paths).not.toContain("/app/ssp/enrollments");
    expect(paths).not.toContain("/app/ssp/officers");
    expect(paths).not.toContain("/app/ssp/forms");
    expect(sspBottomNav({ sspCan, isOfficer: true }).map((item) => (item.kind === "route" ? item.to : item.kind))).toEqual(
      [...OFFICER],
    );
  });

  it("does not rehydrate builder fields after the first snapshot for a form", () => {
    expect(shouldHydrateSspFormFields(null, "form-1")).toBe(true);
    expect(shouldHydrateSspFormFields("form-1", "form-1")).toBe(false);
    expect(shouldHydrateSspFormFields("form-1", "form-2")).toBe(true);
  });

  it("lets a workspace owner open organization before SSP membership exists", () => {
    const sspCan = () => false;
    expect(canOpenSspOrganization({ sspCan, workspaceRole: "owner" })).toBe(true);
    expect(canOpenSspOrganization({ sspCan, workspaceRole: "administrator" })).toBe(true);
    expect(canOpenSspOrganization({ sspCan, workspaceRole: "technician" })).toBe(false);
    expect(canOpenSspOrganization({ sspCan: (action) => action === "ssp.org.view", workspaceRole: "technician" })).toBe(
      true,
    );
  });
});
