import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import {
  appNav,
  canSettings,
  mobileCommandSections,
  mobileMoreNav,
  mobileQuickActions,
  workNav,
} from "../src/lib/app-nav";

const solo = ["core", "crm", "sales", "catalog", "quotes", "projects", "service", "settings"];
const business = [...solo, "team", "audit"];

function morePaths(role: string, features: string[] = solo) {
  return mobileMoreNav(role, features).flatMap((g) => g.items.map((i) => i.to));
}

function desktopMorePaths(role: string, features: string[] = solo) {
  return appNav(role, features).find((g) => g.id === "more")?.items.map((i) => i.to) ?? [];
}

describe("More UX cleanup — D1–D3", () => {
  it("uses honest More section labels without implying Customers", () => {
    const sections = mobileCommandSections("owner", solo);
    expect(sections.map((s) => s.label)).toEqual([
      he.navMoreSectionSales,
      he.navMoreSectionResources,
      he.navMoreSectionManage,
    ]);
    expect(sections.map((s) => s.label).join(" ")).not.toMatch(/לקוחות/);
    expect(he.navMoreFilterPlaceholder).toBe("חיפוש באפשרויות נוספות");
    expect(he.navMoreFilterHint).toContain("רשימה זו");
  });

  it("does not duplicate Work destinations inside More", () => {
    const work = new Set(workNav("owner", solo).map((i) => i.to));
    for (const path of morePaths("owner")) {
      expect(work.has(path)).toBe(false);
    }
    expect(morePaths("owner")).not.toContain("/app/customers");
    expect(morePaths("owner")).not.toContain("/app/tasks");
    expect(morePaths("owner")).not.toContain("/app/today");
    expect(morePaths("owner")).not.toContain("/app/jobs");
  });

  it("removes Quick Visit from More quick actions", () => {
    const owner = mobileQuickActions("owner", solo);
    expect(owner.map((a) => a.id)).toEqual(["lead"]);
    expect(owner.map((a) => a.id)).not.toContain("visit");
    expect(mobileQuickActions("technician", solo)).toEqual([]);
  });

  it("aligns Settings visibility via canSettings for desktop and mobile More", () => {
    expect(canSettings("owner", solo)).toBe(true);
    expect(canSettings("manager", solo)).toBe(true); // settings.general / users.view
    expect(canSettings("sales", solo)).toBe(false);
    expect(canSettings("technician", solo)).toBe(false);
    expect(canSettings("viewer", solo)).toBe(false);

    expect(desktopMorePaths("owner")).toContain("/app/settings");
    expect(morePaths("owner")).toContain("/app/settings");
    expect(desktopMorePaths("manager")).toContain("/app/settings");
    expect(morePaths("manager")).toContain("/app/settings");
    expect(desktopMorePaths("sales")).not.toContain("/app/settings");
    expect(morePaths("sales")).not.toContain("/app/settings");
  });

  it("keeps owner/manager More commercial destinations", () => {
    for (const role of ["owner", "manager"] as const) {
      const paths = morePaths(role);
    expect(paths).toEqual(
      expect.arrayContaining(["/app/leads", "/app/quotes", "/app/analytics", "/app/catalog", "/app/warranties", "/app/knowledge", "/app/settings"]),
    );
    }
  });

  it("keeps sales More commercial without Settings", () => {
    const paths = morePaths("sales");
    expect(paths).toEqual(
      expect.arrayContaining(["/app/leads", "/app/quotes", "/app/analytics", "/app/catalog", "/app/warranties", "/app/knowledge"]),
    );
    expect(paths).not.toContain("/app/settings");
  });

  it("keeps technician More minimal without commercial leak", () => {
    const paths = morePaths("technician");
    expect(paths).toEqual(["/app/knowledge"]);
    expect(paths).not.toContain("/app/leads");
    expect(paths).not.toContain("/app/quotes");
    expect(paths).not.toContain("/app/analytics");
    expect(paths).not.toContain("/app/catalog");
    expect(paths).not.toContain("/app/warranties");
    expect(paths).not.toContain("/app/settings");
    expect(desktopMorePaths("technician")).toEqual(["/app/knowledge"]);
  });

  it("keeps viewer More without Settings or create-oriented quicks", () => {
    const paths = morePaths("viewer");
    expect(paths).toContain("/app/leads");
    expect(paths).toContain("/app/knowledge");
    expect(paths).not.toContain("/app/settings");
    expect(mobileQuickActions("viewer", solo)).toEqual([]);
  });

  it("exports canSettings consistently for account gear alignment", () => {
    expect(canSettings("administrator", business)).toBe(true);
    expect(canSettings("manager", business)).toBe(true);
  });
});
