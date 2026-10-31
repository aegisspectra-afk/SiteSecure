import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import {
  appNav,
  bottomNav,
  isMoreNavSelected,
  isNavSelected,
  isWorkNavSelected,
  mobileMoreNav,
  mobileWorkNav,
} from "../src/lib/app-nav";

const solo = ["core", "crm", "sales", "catalog", "quotes", "projects", "service", "settings"];

describe("Work navigation — current IA", () => {
  it("exposes overview / sales / ops / system on desktop", () => {
    expect(appNav("owner", solo).map((g) => g.id)).toEqual(["overview", "sales", "ops", "system"]);
    expect(appNav("owner", solo).find((g) => g.id === "sales")?.items[0]?.to).toBe("/app/customers");
    expect(appNav("owner", solo).find((g) => g.id === "overview")?.items.some((i) => i.to === "/app/tasks")).toBe(
      true,
    );
    expect(appNav("owner", solo).find((g) => g.id === "system")?.items.some((i) => i.to === "/app/settings")).toBe(
      true,
    );
  });

  it("surfaces jobs in ops and reports in overview for entitled office roles", () => {
    const desktop = appNav("owner", solo).flatMap((g) => g.items.map((i) => i.to));
    const work = mobileWorkNav("owner", solo).map((i) => i.to);
    expect(desktop).toContain("/app/jobs");
    expect(desktop).toContain("/app/analytics");
    expect(work).toContain("/app/jobs");
    expect(work).not.toContain("/app/analytics");
  });

  it("marks Work destinations as selected", () => {
    const work = mobileWorkNav("owner", solo);
    expect(isWorkNavSelected("/app/projects", work)).toBe(true);
    expect(isWorkNavSelected("/app/projects/x", work)).toBe(true);
    expect(isWorkNavSelected("/app/customers", work)).toBe(false);
    expect(isNavSelected("/app/customers", "/app/customers/c1")).toBe(true);
  });

  it("lists authorized Work destinations for owner/manager", () => {
    expect(mobileWorkNav("owner", solo).map((i) => i.to)).toEqual([
      "/app/today",
      "/app/projects",
      "/app/jobs",
      "/app/service",
      "/app/sites",
    ]);
    expect(mobileWorkNav("manager", solo).map((i) => i.to)).toEqual([
      "/app/today",
      "/app/projects",
      "/app/jobs",
      "/app/service",
      "/app/sites",
    ]);
  });

  it("keeps technician Work operational without commercial leak", () => {
    const work = mobileWorkNav("technician", solo);
    expect(work.map((i) => i.to)).toEqual(["/app/projects", "/app/jobs", "/app/service", "/app/sites"]);
    expect(work.map((i) => i.to)).not.toContain("/app/today");

    const paths = appNav("technician", solo).flatMap((g) => g.items.map((i) => i.to));
    expect(paths).toContain("/app/today");
    expect(paths).toContain("/app/customers");
    expect(paths).toContain("/app/tasks");
    expect(paths).toContain("/app/knowledge");
    expect(paths).toContain("/app/jobs");
    expect(paths).not.toContain("/app/quotes");
    expect(paths).not.toContain("/app/leads");
    expect(paths).not.toContain("/app/analytics");
  });

  it("omits unauthorized Work links", () => {
    expect(mobileWorkNav("viewer", ["core"]).map((i) => i.to)).not.toContain("/app/projects");
  });

  it("keeps Customers and Tasks reachable without redesigning their destinations", () => {
    const bottom = bottomNav("owner", solo);
    expect(bottom.some((i) => i.kind === "route" && i.to === "/app/customers")).toBe(true);
    expect(bottom.some((i) => i.kind === "route" && i.to === "/app/tasks")).toBe(true);
    expect(bottom.some((i) => i.kind === "more")).toBe(true);
    expect(bottom.some((i) => i.kind === "work")).toBe(true);
  });

  it("keeps Settings reachable under desktop system and mobile More", () => {
    expect(appNav("owner", solo).find((g) => g.id === "system")?.items.some((i) => i.to === "/app/settings")).toBe(
      true,
    );
    expect(mobileMoreNav("owner", solo).some((g) => g.items.some((i) => i.to === "/app/settings"))).toBe(true);
  });

  it("does not let More steal Work active state", () => {
    const work = mobileWorkNav("owner", solo);
    const more = mobileMoreNav("owner", solo);
    expect(isMoreNavSelected("/app/projects", more, work)).toBe(false);
    expect(isMoreNavSelected("/app/quotes", more, work)).toBe(true);
  });

  it("Founding Technician badge does not appear in nav authorization", () => {
    /* Nav uses role_key + permissions only — recognition badges never consulted. */
    const catalogWork = mobileWorkNav("technician", solo);
    const sessionWork = mobileWorkNav("technician", solo, ["jobs.view", "sites.view", "dashboard.view", "crm.view"]);
    expect(catalogWork.map((i) => i.to)).toContain("/app/jobs");
    expect(sessionWork.map((i) => i.to)).toContain("/app/jobs");
    expect(he.navWork).toBe("עבודה");
  });

  it("mobile spine stays בית · לקוחות · עבודה · משימות · עוד", () => {
    const labels = bottomNav("technician", solo).map((item) => item.label);
    expect(labels).toEqual([he.navHome, he.navCustomers, he.navWork, he.navTasks, he.navMore]);
  });
});
