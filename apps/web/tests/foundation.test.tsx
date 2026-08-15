import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "../src/components/OnboardingForm";
import { he } from "../src/i18n/he";
import { can, canAny, canAll } from "../src/lib/can";
import { appNav, bottomNav } from "../src/lib/app-nav";
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
    const items = screen.getAllByRole("listitem").map((el) => el.textContent ?? "");
    expect(items).toHaveLength(4);
    expect(items[0]).toContain(he.stepAccount);
    expect(items[0]).toContain("✓");
    expect(items[1]).toContain(he.stepProfile);
    expect(items[1]).toContain("●");
    expect(items[2]).toContain(he.stepWorkspace);
    expect(items[2]).toContain("○");
    expect(items[3]).toContain(he.stepReady);
    expect(items[3]).toContain("○");
    expect(screen.getByLabelText(he.fullName)).toBeInTheDocument();
    expect(screen.queryByLabelText(he.workspaceName)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.profileContinue })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.onboardingPrimary })).not.toBeInTheDocument();
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
    const items = screen.getAllByRole("listitem").map((el) => el.textContent ?? "");
    expect(items[1]).toContain("✓");
    expect(items[2]).toContain("●");
    expect(items[3]).toContain("○");
    expect(screen.getByRole("button", { name: he.onboardingPrimary })).toBeInTheDocument();
    expect(screen.getByLabelText(he.workspaceName)).toBeInTheDocument();
    expect(screen.getByLabelText(he.timezone)).toHaveValue("Asia/Jerusalem");
    expect(screen.getByLabelText(he.vat)).toHaveValue(18);
    expect(screen.getByText(he.currencyValue)).toBeInTheDocument();
    expect(screen.queryByText(/לקוח/)).not.toBeInTheDocument();
    expect(screen.queryByText(/הצעת מחיר/)).not.toBeInTheDocument();
  });

  it("ready step waits for an explicit enter", () => {
    render(
      <OnboardingForm
        profileDone
        created
        onSaveProfile={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onEnter={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("listitem").map((el) => el.textContent ?? "");
    expect(items[2]).toContain("✓");
    expect(items[3]).toContain("●");
    expect(screen.getByRole("button", { name: he.enterWorkspace })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.onboardingPrimary })).not.toBeInTheDocument();
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

  it("is RBAC-aware and does not invent CRM routes", () => {
    const technician = paths("technician", solo);
    expect(technician).toEqual(["/app/today", "/app/quotes"]);
    expect(technician.some((to) => to.includes("customer") || to.includes("site"))).toBe(false);

    const sales = paths("sales", solo);
    expect(sales).toEqual(["/app/dashboard", "/app/quotes"]);
    expect(sales).not.toContain("/app/settings/users");

    const viewer = paths("viewer", solo);
    expect(viewer).toEqual(["/app/dashboard", "/app/quotes"]);

    const manager = paths("manager", solo);
    expect(manager).toContain("/app/dashboard");
    expect(manager).toContain("/app/quotes");
    expect(manager).toContain("/app/settings/users");
    expect(manager).toContain("/app/settings/roles");
    expect(manager).toContain("/app/settings/security");
    expect(manager).not.toContain("/app/settings");
    expect(manager).not.toContain("/app/settings/audit");

    const soloOwner = paths("owner", solo);
    expect(soloOwner).toContain("/app/dashboard");
    expect(soloOwner).toContain("/app/quotes");
    expect(appNav("owner", solo)[0]?.items[0]?.label).toBe(he.navDashboard);
    expect(soloOwner).toContain("/app/settings/users");
    expect(soloOwner).toContain("/app/settings/roles");
    expect(soloOwner).toContain("/app/settings/security");
    expect(soloOwner).toContain("/app/settings");
    expect(soloOwner).not.toContain("/app/settings/audit");
    expect(appNav("owner", solo).some((group) => group.items.some((item) => item.label === "לקוחות" || item.label === "פרויקטים"))).toBe(
      false,
    );

    const businessOwner = paths("owner", business);
    expect(businessOwner).toContain("/app/settings/audit");

    const admin = paths("administrator", business);
    expect(admin).toContain("/app/settings/users");
    expect(admin).toContain("/app/settings/audit");
    expect(admin).toContain("/app/settings");

    const ft = paths("founding_technician", solo);
    expect(ft).toEqual(["/app/today", "/app/quotes", "/app/settings/security"]);
  });

  it("bottom nav is a short live spine, not a copied sidebar", () => {
    const kinds = (role: string, features: string[]) =>
      bottomNav(role, features).map((item) => (item.kind === "more" ? "more" : item.to));

    expect(kinds("technician", solo)).toEqual(["/app/today", "more"]);
    expect(kinds("technician", solo).some((to) => String(to).includes("job") || String(to).includes("customer"))).toBe(
      false,
    );

    expect(kinds("sales", solo)).toEqual(["/app/dashboard", "/app/quotes"]);
    expect(kinds("owner", solo)).toEqual(["/app/dashboard", "/app/quotes", "more"]);
    expect(kinds("owner", solo)).not.toContain("/app/settings");
    expect(kinds("owner", solo)).not.toContain("/app/settings/security");

    const ownerMore = bottomNav("owner", solo).find((item) => item.kind === "more");
    expect(ownerMore?.label).toBe(he.navMore);

    expect(kinds("founding_technician", solo)).toEqual(["/app/today", "more"]);
    expect(kinds("manager", solo)).toEqual(["/app/dashboard", "/app/quotes", "more"]);
    expect(bottomNav("owner", solo).length).toBeLessThanOrEqual(5);

    const owned = new Set(appNav("owner", solo).flatMap((group) => group.items.map((item) => item.to)));
    for (const item of bottomNav("owner", solo)) {
      if (item.kind === "route") expect(owned.has(item.to)).toBe(true);
    }
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
