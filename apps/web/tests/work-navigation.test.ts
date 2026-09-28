import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import {
  appNav,
  bottomNav,
  isMoreNavSelected,
  isNavSelected,
  isWorkNavSelected,
  mobileMoreNav,
  workNav,
} from "../src/lib/app-nav";

const solo = ["core", "crm", "sales", "catalog", "quotes", "projects", "service", "settings"];

describe("Checkpoint B — Work navigation", () => {
  it("exposes top-level Customers / Work / Tasks / More groups on desktop", () => {
    expect(appNav("owner", solo).map((g) => g.id)).toEqual(["home", "customers", "work", "tasks", "more"]);
    expect(appNav("owner", solo).find((g) => g.id === "customers")?.items[0]?.to).toBe("/app/customers");
    expect(appNav("owner", solo).find((g) => g.id === "tasks")?.items[0]?.to).toBe("/app/tasks");
    expect(appNav("owner", solo).find((g) => g.id === "more")?.items.map((i) => i.to)).toEqual(
      expect.arrayContaining(["/app/quotes", "/app/settings", "/app/knowledge"]),
    );
  });

  it("marks Work and nested destinations as selected", () => {
    const work = workNav("owner", solo);
    expect(isWorkNavSelected("/app/jobs", work)).toBe(true);
    expect(isWorkNavSelected("/app/jobs/abc", work)).toBe(true);
    expect(isWorkNavSelected("/app/projects/x", work)).toBe(true);
    expect(isWorkNavSelected("/app/customers", work)).toBe(false);
    expect(isNavSelected("/app/customers", "/app/customers/c1")).toBe(true);
  });

  it("lists authorized Work destinations for owner/manager", () => {
    expect(workNav("owner", solo).map((i) => i.to)).toEqual([
      "/app/today",
      "/app/projects",
      "/app/jobs",
      "/app/service",
      "/app/sites",
    ]);
    expect(workNav("manager", solo).map((i) => i.to)).toEqual([
      "/app/today",
      "/app/projects",
      "/app/jobs",
      "/app/service",
      "/app/sites",
    ]);
  });

  it("keeps technician Work to assigned operational scope", () => {
    const work = workNav("technician", solo);
    expect(work.map((i) => i.to)).toEqual(["/app/jobs", "/app/sites"]);
    expect(work.map((i) => i.to)).not.toContain("/app/projects");
    expect(work.map((i) => i.to)).not.toContain("/app/service");
    expect(work.map((i) => i.to)).not.toContain("/app/today");

    const paths = appNav("technician", solo).flatMap((g) => g.items.map((i) => i.to));
    expect(paths).toContain("/app/today");
    expect(paths).toContain("/app/customers");
    expect(paths).toContain("/app/tasks");
    expect(paths).toContain("/app/knowledge");
    expect(paths).not.toContain("/app/quotes");
    expect(paths).not.toContain("/app/settings");
    expect(paths).not.toContain("/app/leads");
  });

  it("omits unauthorized Work links", () => {
    expect(workNav("viewer", ["core"]).map((i) => i.to)).not.toContain("/app/projects");
    expect(appNav("technician", solo).flatMap((g) => g.items.map((i) => i.to))).not.toContain("/app/service");
  });

  it("keeps Customers and Tasks reachable without redesigning their destinations", () => {
    const bottom = bottomNav("owner", solo);
    expect(bottom.some((i) => i.kind === "route" && i.to === "/app/customers")).toBe(true);
    expect(bottom.some((i) => i.kind === "route" && i.to === "/app/tasks")).toBe(true);
    expect(bottom.some((i) => i.kind === "more")).toBe(true);
    expect(bottom.some((i) => i.kind === "work")).toBe(true);
  });

  it("keeps Settings reachable under More for authorized roles", () => {
    expect(appNav("owner", solo).find((g) => g.id === "more")?.items.some((i) => i.to === "/app/settings")).toBe(
      true,
    );
    expect(mobileMoreNav("owner", solo).some((g) => g.items.some((i) => i.to === "/app/settings"))).toBe(true);
  });

  it("does not let More steal Work active state", () => {
    const work = workNav("owner", solo);
    const more = mobileMoreNav("owner", solo);
    expect(isMoreNavSelected("/app/jobs", more, work)).toBe(false);
    expect(isMoreNavSelected("/app/quotes", more, work)).toBe(true);
  });

  it("Founding Technician badge does not appear in nav authorization", () => {
    /* Nav uses role_key + permissions only — recognition badges never consulted. */
    const withPerms = workNav("technician", solo, ["jobs.view", "sites.view", "dashboard.view", "crm.view"]);
    const withoutExtra = workNav("technician", solo);
    expect(withPerms.map((i) => i.to)).toEqual(withoutExtra.map((i) => i.to));
    expect(he.navWork).toBe("עבודה");
  });

  it("mobile spine stays בית · לקוחות · עבודה · משימות · עוד", () => {
    const labels = bottomNav("technician", solo).map((item) =>
      item.kind === "route" ? item.label : item.label,
    );
    expect(labels).toEqual([he.navHome, he.navCustomers, he.navWork, he.navTasks, he.navMore]);
  });
});
