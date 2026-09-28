import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardQuickActions } from "../src/components/dashboard/DashboardQuickActions";
import { buildCreateActions } from "../src/components/dashboard/DashboardCreateMenu";
import { DashboardCommandHero } from "../src/components/dashboard/DashboardCommandHero";
import { he } from "../src/i18n/he";
import { homeVariant } from "../src/lib/home";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    ...rest
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a href={typeof to === "string" ? to : "#"} className={className} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    api: {},
    session: { memberships: [{ workspace_id: "ws", role_key: "owner", features: ["quotes", "crm", "jobs"] }] },
  }),
}));

vi.mock("../src/components/quotes/quote-creation/NewQuoteDialog", () => ({
  NewQuoteDialog: () => null,
}));

const ownerFeatures = ["quotes", "crm", "jobs", "projects", "catalog"];
const salesFeatures = ["quotes", "crm", "catalog"];

describe("buildCreateActions (DASH-6)", () => {
  it("lists real permitted routes only for owner/manager", () => {
    const keys = buildCreateActions("owner", ownerFeatures).map((a) => a.key);
    expect(keys).toEqual([
      "quote",
      "customer",
      "site",
      "lead",
      "task",
      "project",
      "job",
      "catalog",
    ]);
    expect(buildCreateActions("owner", ownerFeatures).every((a) => a.quote || a.href)).toBe(true);
  });

  it("sales stays commercial — quote/customer/lead/catalog; no ops/task/site creates", () => {
    const keys = buildCreateActions("sales", salesFeatures).map((a) => a.key);
    expect(keys).toContain("quote");
    expect(keys).toContain("customer");
    expect(keys).toContain("lead");
    expect(keys).toContain("catalog");
    expect(keys).not.toContain("task");
    expect(keys).not.toContain("site");
    expect(keys).not.toContain("job");
    expect(keys).not.toContain("project");
  });

  it("viewer has no create actions", () => {
    expect(buildCreateActions("viewer", ["quotes", "crm", "catalog"])).toEqual([]);
  });
});

describe("DashboardQuickActions (DASH-6)", () => {
  it("keeps Create Quote as the only primary CTA and demotes tools", () => {
    render(<DashboardQuickActions roleKey="owner" features={ownerFeatures} showCreate />);
    const nav = screen.getByTestId("dash-quick-actions");
    expect(nav.className).toContain("is-dash6");
    expect(screen.getByRole("button", { name: he.newQuoteAction })).toHaveClass("ops-qa-primary", "is-quote-cta");
    expect(document.querySelectorAll(".ops-qa-primary.is-quote-cta").length).toBe(1);
    expect(screen.queryByRole("link", { name: he.newQuoteAction })).not.toBeInTheDocument();
    expect(screen.getByTestId("dash-qa-customer")).toHaveAttribute("href", "/app/customers");
    expect(screen.getByTestId("dash-qa-site")).toHaveAttribute("href", "/app/sites");
    expect(screen.getByTestId("dash-qa-lead")).toHaveAttribute("href", "/app/leads");
    expect(screen.getByTestId("dash-qa-task")).toHaveAttribute("href", "/app/tasks");
    // Overflow after 4 tools
    expect(screen.getByRole("button", { name: he.dashQuickMoreAria })).toBeInTheDocument();
    expect(screen.queryByTestId("dash-qa-catalog")).not.toBeInTheDocument();
  });

  it("hides the module when showCreate is false (viewer/read-only)", () => {
    const { container } = render(
      <DashboardQuickActions roleKey="viewer" features={["quotes"]} showCreate={false} />,
    );
    expect(container.querySelector("[data-testid='dash-quick-actions']")).toBeNull();
    expect(screen.queryByRole("button", { name: he.newQuoteAction })).not.toBeInTheDocument();
  });

  it("does not invent dead actions without href/dialog", () => {
    render(<DashboardQuickActions roleKey="sales" features={salesFeatures} showCreate />);
    const tools = [...document.querySelectorAll("[data-qa-key]")].map((el) => el.getAttribute("data-qa-key"));
    expect(tools.every((k) => k && k !== "quote")).toBe(true);
    for (const el of document.querySelectorAll<HTMLAnchorElement>("[data-testid^='dash-qa-']")) {
      expect(el.getAttribute("href")).toMatch(/^\/app\//);
    }
  });

  it("technician homeVariant remains today — no commercial dashboard assumption", () => {
    expect(homeVariant("technician")).toBe("today");
  });
});

describe("hero CTA hierarchy", () => {
  it("CommandHero keeps quote primary above secondary tools", () => {
    render(
      <DashboardCommandHero
        displayName="דני"
        roleKey="owner"
        features={ownerFeatures}
        showQuotes
        showCreate
      />,
    );
    expect(document.querySelector(".ops-qa.is-dash6")).toBeTruthy();
    expect(document.querySelector(".ops-qa-primary.is-quote-cta")).toBeTruthy();
    expect(document.querySelector(".ops-qa-tools")).toBeTruthy();
  });
});
