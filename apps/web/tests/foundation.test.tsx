import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "../src/components/OnboardingForm";
import { he } from "../src/i18n/he";
import { can, canAny, canAll } from "../src/lib/can";
import { appNav, bottomNav, liveTargetRouteHints, mobileMoreNav, mobileWorkNav, nextSidebarIndex, TARGET_IA } from "../src/lib/app-nav";
import { roleGranted } from "../src/lib/role-catalog";

describe("OnboardingForm", () => {
  it("profile step only completes the account identity", () => {
    render(
      <OnboardingForm
        profileDone={false}
        onSaveProfile={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onEnter={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(he.fullName)).toBeInTheDocument();
    expect(screen.queryByLabelText(he.businessName)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.profileContinue })).toBeInTheDocument();
  });

  it("names the signed-in email so workspace creation is not anonymous", () => {
    render(
      <OnboardingForm
        email="ilya@example.com"
        profileDone={false}
        onSaveProfile={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onEnter={vi.fn()}
      />,
    );
    expect(screen.getByText(he.onboardingAccount, { exact: false })).toBeInTheDocument();
    expect(screen.getByText("ilya@example.com")).toBeInTheDocument();
  });

  it("workspace step requires an explicit create action", () => {
    render(
      <OnboardingForm
        profileDone
        onSaveProfile={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onEnter={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: he.profileContinue })).toBeInTheDocument();
    expect(screen.getByLabelText(he.businessName)).toBeInTheDocument();
    expect(screen.getByLabelText(he.businessType)).toBeInTheDocument();
    expect(screen.queryByText(/לקוח/)).not.toBeInTheDocument();
    expect(screen.queryByText(/הצעת מחיר/)).not.toBeInTheDocument();
  });

  it("ready step waits for an explicit enter", () => {
    render(
      <OnboardingForm
        profileDone
        created
        workspaceName="אגיס מערכות בע״מ"
        onSaveProfile={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onEnter={vi.fn()}
      />,
    );
    expect(screen.getByText("אגיס מערכות בע״מ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.enterWorkspace })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.onboardingPrimary })).not.toBeInTheDocument();
  });

  it("shows beta welcome copy only for beta workspaces", () => {
    render(
      <OnboardingForm
        profileDone
        created
        isBeta
        workspaceName="אגיס מערכות בע״מ"
        onSaveProfile={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onEnter={vi.fn()}
      />,
    );
    expect(screen.getByText(he.onboardingBetaTitle, { exact: false })).toBeInTheDocument();
  });
});

describe("can()", () => {
  it("hides send quote for viewer and never treats UI as security", () => {
    expect(can("viewer", "quotes.send", ["quotes"])).toBe(false);
    expect(can("owner", "quotes.send", ["quotes"])).toBe(true);
    expect(can("technician", "users.invite", ["core"])).toBe(false);
    expect(canAny("manager", ["users.view", "audit.view"], ["audit"])).toBe(true);
    expect(canAll("manager", ["users.view", "audit.view"], ["audit"])).toBe(false);
  });
});

describe("appNav", () => {
  const solo = ["core", "crm", "sales", "catalog", "quotes", "projects", "service", "settings"];
  const business = [...solo, "inventory", "finance", "reports", "automation", "team", "audit", "api"];

  function paths(role: string, features: string[]) {
    return appNav(role, features).flatMap((g) => g.items.map((item) => item.to));
  }

  it("locks Target IA with all core modules live", () => {
    expect(TARGET_IA.map((group) => group.id)).toEqual(["overview", "sales", "ops", "admin", "system"]);
    const planned = TARGET_IA.flatMap((group) =>
      group.items.filter((item) => (item.status as string) === "planned").map((item) => item.id),
    );
    expect(planned).toEqual([]);
    expect(liveTargetRouteHints()).toEqual(
      expect.arrayContaining([
        "/app/dashboard",
        "/app/today",
        "/app/tasks",
        "/app/customers",
        "/app/leads",
        "/app/quotes",
        "/app/catalog",
        "/app/projects",
        "/app/sites",
        "/app/service",
        "/app/warranties",
        "/app/knowledge",
      ]),
    );
    expect(appNav("owner", solo).map((group) => group.id)).toEqual([
      "overview",
      "sales",
      "ops",
      "admin",
      "system",
    ]);
  });

  it("is RBAC-aware across the live Target IA", () => {
    const technician = paths("technician", solo);
    expect(technician).toContain("/app/today");
    expect(technician).toContain("/app/tasks");
    expect(technician).toContain("/app/customers");
    expect(technician).toContain("/app/sites");
    expect(technician).toContain("/app/service");
    expect(technician).not.toContain("/app/leads");
    expect(technician).not.toContain("/app/settings/users");

    const sales = paths("sales", solo);
    expect(sales).toContain("/app/dashboard");
    expect(sales).toContain("/app/customers");
    expect(sales).toContain("/app/leads");
    expect(sales).toContain("/app/quotes");
    expect(sales).not.toContain("/app/settings/users");

    const viewer = paths("viewer", solo);
    expect(viewer).toContain("/app/dashboard");
    expect(viewer).toContain("/app/customers");
    expect(viewer).toContain("/app/sites");
    expect(viewer).not.toContain("/app/settings/users");

    const manager = paths("manager", solo);
    expect(manager).toContain("/app/dashboard");
    expect(manager).toContain("/app/quotes");
    expect(manager).toContain("/app/projects");
    expect(manager).toContain("/app/settings/users");
    expect(manager).toContain("/app/settings/roles");
    expect(manager).toContain("/app/settings/security");
    expect(manager).not.toContain("/app/settings");
    expect(manager).not.toContain("/app/settings/audit");

    const soloOwner = paths("owner", solo);
    expect(soloOwner).toContain("/app/dashboard");
    expect(soloOwner).toContain("/app/customers");
    expect(soloOwner).toContain("/app/sites");
    expect(soloOwner).toContain("/app/quotes");
    expect(appNav("owner", solo)[0]?.items[0]?.label).toBe(he.navDashboard);
    expect(appNav("owner", solo).find((group) => group.id === "admin")?.items.map((item) => item.to)).toEqual([
      "/app/settings/users",
      "/app/settings/roles",
    ]);
    expect(soloOwner).toContain("/app/settings/users");
    expect(soloOwner).toContain("/app/settings/roles");
    expect(soloOwner).toContain("/app/settings/security");
    expect(soloOwner).toContain("/app/settings");
    expect(soloOwner).not.toContain("/app/settings/audit");

    const businessOwner = paths("owner", business);
    expect(businessOwner).toContain("/app/settings/audit");

    const admin = paths("administrator", business);
    expect(admin).toContain("/app/settings/users");
    expect(admin).toContain("/app/settings/audit");
    expect(admin).toContain("/app/settings");

    const ft = paths("founding_technician", solo);
    expect(ft).toContain("/app/today");
    expect(ft).toContain("/app/customers");
    expect(ft).toContain("/app/settings/security");
  });

  it("bottom nav is a short live spine, not a copied sidebar", () => {
    const kinds = (role: string, features: string[]) =>
      bottomNav(role, features).map((item) =>
        item.kind === "more" ? "more" : item.kind === "work" ? "work" : item.to,
      );

    expect(kinds("technician", solo)[0]).toBe("/app/today");
    expect(kinds("technician", solo)).toContain("/app/customers");
    expect(kinds("technician", solo)).toContain("work");
    expect(kinds("technician", solo)).toContain("/app/tasks");
    expect(kinds("technician", solo)).toContain("more");
    expect(kinds("technician", solo).length).toBeLessThanOrEqual(5);

    expect(kinds("sales", solo)[0]).toBe("/app/dashboard");
    expect(kinds("sales", solo)).toContain("/app/customers");
    expect(kinds("sales", solo)).toContain("work");
    expect(kinds("sales", solo)).not.toContain("/app/quotes");
    expect(kinds("sales", solo)).toContain("more");

    expect(kinds("owner", solo)[0]).toBe("/app/dashboard");
    expect(kinds("owner", solo)).toContain("work");
    expect(kinds("owner", solo)).toContain("more");
    expect(kinds("owner", solo)).not.toContain("/app/quotes");
    expect(kinds("owner", solo)).not.toContain("/app/settings");
    expect(kinds("owner", solo)).not.toContain("/app/settings/security");

    const ownerMore = bottomNav("owner", solo).find((item) => item.kind === "more");
    expect(ownerMore?.label).toBe(he.navMore);

    expect(kinds("founding_technician", solo)[0]).toBe("/app/today");
    expect(kinds("manager", solo)[0]).toBe("/app/dashboard");
    expect(bottomNav("owner", solo).length).toBeLessThanOrEqual(5);

    const owned = new Set(appNav("owner", solo).flatMap((group) => group.items.map((item) => item.to)));
    for (const item of bottomNav("owner", solo)) {
      if (item.kind === "route") expect(owned.has(item.to)).toBe(true);
    }
  });

  it("mobile more excludes primary bottom and work destinations", () => {
    const more = mobileMoreNav("owner", solo);
    const morePaths = more.flatMap((g) => g.items.map((i) => i.to));
    expect(morePaths).not.toContain("/app/dashboard");
    expect(morePaths).not.toContain("/app/customers");
    expect(morePaths).not.toContain("/app/tasks");
    expect(morePaths).toContain("/app/projects");
    expect(morePaths).toContain("/app/quotes");
    expect(morePaths).toContain("/app/leads");
    expect(mobileWorkNav("owner", solo).some((item) => item.to === "/app/sites")).toBe(true);
  });

  it("walks sidebar links with arrow keys and respects feature gates", () => {
    expect(nextSidebarIndex(0, "ArrowDown", 4)).toBe(1);
    expect(nextSidebarIndex(0, "ArrowUp", 4)).toBe(3);
    expect(nextSidebarIndex(2, "Home", 4)).toBe(0);
    expect(nextSidebarIndex(2, "End", 4)).toBe(3);
    expect(nextSidebarIndex(0, "Tab", 4)).toBeNull();
    expect(
      appNav("owner", ["core", "quotes", "catalog", "settings"]).some((group) =>
        group.items.some((item) => item.label === "לקוחות"),
      ),
    ).toBe(false);
    expect(
      appNav("owner", ["core", "quotes", "catalog", "settings"]).some((group) =>
        group.items.some((item) => item.label === "פרויקטים"),
      ),
    ).toBe(false);
  });
});

describe("role catalog display", () => {
  it("shows technician CRM read without create, and never grants user admin", () => {
    expect(roleGranted("technician", "crm.view")).toBe(true);
    expect(roleGranted("technician", "crm.create")).toBe(false);
    expect(roleGranted("technician", "sites.view")).toBe(true);
    expect(roleGranted("technician", "sites.create")).toBe(true);
    expect(roleGranted("technician", "jobs.view")).toBe(true);
    expect(roleGranted("technician", "jobs.assign")).toBe(false);
    expect(roleGranted("technician", "users.view")).toBe(false);
    expect(roleGranted("owner", "workspace.delete")).toBe(true);
    expect(roleGranted("administrator", "workspace.delete")).toBe(false);
  });
});

describe("direct URL hiding is not the boundary", () => {
  it("denies technician Users and Audit even if the URL is known", () => {
    expect(can("technician", "users.view", ["settings", "team"])).toBe(false);
    expect(can("technician", "audit.view", ["audit"])).toBe(false);
    expect(can("viewer", "users.manage", ["team"])).toBe(false);
    expect(can("sales", "users.invite", ["core"])).toBe(false);
  });
});
