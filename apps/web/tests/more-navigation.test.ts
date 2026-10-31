import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import { appNav, mobileCommandSections, mobileMoreNav, mobileQuickActions, mobileWorkNav } from "../src/lib/app-nav";

const solo = ["core", "crm", "sales", "catalog", "quotes", "projects", "service", "settings"];
const business = [...solo, "team", "audit"];

function morePaths(role: string, features: string[] = solo) {
  return mobileMoreNav(role, features).flatMap((g) => g.items.map((i) => i.to));
}

function salesOpsManagePaths(role: string, features: string[] = solo) {
  return mobileCommandSections(role, features)
    .filter((s) => s.id !== "work")
    .flatMap((s) => s.items.map((i) => i.to));
}

describe("More UX — current command center", () => {
  it("uses current More section labels without implying Customers in the overflow title", () => {
    const sections = mobileCommandSections("owner", solo);
    expect(sections.map((s) => s.id)).toEqual(["work", "sales", "ops", "manage"]);
    expect(sections.find((s) => s.id === "sales")?.label).toBe(he.navGroupSales);
    expect(he.navMoreFilterPlaceholder).toBe("חיפוש באפשרויות נוספות");
    expect(he.navMoreFilterHint).toContain("רשימה זו");
  });

  it("keeps Work destinations in the Work section only — not duplicated in sales/ops/manage", () => {
    const work = new Set(mobileWorkNav("owner", solo).map((i) => i.to));
    for (const path of salesOpsManagePaths("owner")) {
      expect(work.has(path)).toBe(false);
    }
    expect(salesOpsManagePaths("owner")).not.toContain("/app/customers");
    expect(salesOpsManagePaths("owner")).not.toContain("/app/tasks");
    expect(salesOpsManagePaths("owner")).not.toContain("/app/jobs");
    expect(salesOpsManagePaths("owner")).toContain("/app/analytics");
  });

  it("keeps lead create as a quick action and does not invent a jobs shortcut", () => {
    const owner = mobileQuickActions("owner", solo);
    expect(owner.map((a) => a.id)).toContain("lead");
    expect(owner.map((a) => a.to)).not.toContain("/app/jobs");
    expect(owner.map((a) => a.to)).not.toContain("/app/analytics");
  });

  it("aligns Settings visibility with catalog grants", () => {
    expect(appNav("owner", solo).find((g) => g.id === "system")?.items.some((i) => i.to === "/app/settings")).toBe(
      true,
    );
    expect(morePaths("owner")).toContain("/app/settings");
    expect(morePaths("manager")).toContain("/app/settings");
    expect(morePaths("sales")).toContain("/app/settings");
    expect(appNav("administrator", business).find((g) => g.id === "system")).toBeTruthy();
  });

  it("keeps owner/manager More commercial destinations and reports, without duplicating jobs", () => {
    for (const role of ["owner", "manager"] as const) {
      const paths = morePaths(role);
      expect(paths).toEqual(expect.arrayContaining(["/app/leads", "/app/quotes", "/app/catalog", "/app/knowledge", "/app/analytics", "/app/jobs"]));
      expect(salesOpsManagePaths(role)).not.toContain("/app/jobs");
    }
  });

  it("keeps sales More commercial and reports, without duplicating jobs", () => {
    const paths = morePaths("sales");
    expect(paths).toEqual(expect.arrayContaining(["/app/leads", "/app/quotes", "/app/catalog", "/app/knowledge", "/app/analytics", "/app/jobs"]));
    expect(salesOpsManagePaths("sales")).not.toContain("/app/jobs");
  });

  it("keeps technician More without commercial leak", () => {
    const paths = morePaths("technician");
    expect(paths).toContain("/app/knowledge");
    expect(paths).not.toContain("/app/leads");
    expect(paths).not.toContain("/app/quotes");
    expect(paths).not.toContain("/app/analytics");
    expect(paths).not.toContain("/app/catalog");
    expect(appNav("technician", solo).flatMap((g) => g.items.map((i) => i.to))).not.toContain("/app/quotes");
  });

  it("keeps viewer More without create-oriented jobs shortcuts", () => {
    const paths = morePaths("viewer");
    expect(paths).toContain("/app/leads");
    expect(paths).toContain("/app/knowledge");
    expect(mobileQuickActions("viewer", solo).map((a) => a.id)).not.toContain("lead");
  });
});
