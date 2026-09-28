import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardCommandHero } from "../src/components/dashboard/DashboardCommandHero";
import { ActiveWork } from "../src/components/dashboard/ActiveWork";
import { RecentQuotes } from "../src/components/dashboard/RecentQuotes";
import { WorkspaceSystemStatus } from "../src/components/WorkspaceSystemStatus";
import { he } from "../src/i18n/he";
import { workspaceSystemChecks } from "../src/lib/workspace-header";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    params,
    search,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
  }) => {
    let href = typeof to === "string" ? to : "#";
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    if (search) {
      const qs = new URLSearchParams(search).toString();
      if (qs) href = `${href}?${qs}`;
    }
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
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

vi.mock("../src/lib/use-theme", () => ({
  useTheme: () => ({ theme: "dark", resolved: "dark", setTheme: vi.fn() }),
}));

describe("dashboard premium command center", () => {
  it("never surfaces מוכן לפעולה in the status control", () => {
    render(
      <WorkspaceSystemStatus
        checks={workspaceSystemChecks({
          workspaceStatus: "active",
          hasSession: true,
          online: true,
          authenticated: true,
        })}
      />,
    );
    expect(screen.queryByText("מוכן לפעולה")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: he.systemStatusTitle }));
    expect(within(screen.getByRole("dialog")).queryByText("מוכן לפעולה")).not.toBeInTheDocument();
  });

  it("renders a compact today empty state with schedule CTA", () => {
    render(<ActiveWork items={[]} compactEmpty />);
    expect(screen.getByText(he.todayTitle)).toBeInTheDocument();
    expect(screen.getByText(he.todaySectionEmptyCompact)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.todayScheduleCta })).toBeInTheDocument();
    expect(document.querySelector(".ops-today-card.is-empty")).toBeTruthy();
  });

  it("renders recent quotes as a scannable list, not an admin table", () => {
    render(
      <RecentQuotes
        quotes={[
          {
            id: "q1",
            number: "Q-100",
            title: "מערכת",
            customer_name: "לקוח א",
            status: "sent",
            total_gross: 1200,
            updated_at: "2026-09-20T10:00:00Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("Q-100")).toBeInTheDocument();
    expect(screen.getByText("לקוח א")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.recentQuotesViewAll })).toBeInTheDocument();
    expect(document.querySelector(".ops-recent-panel.is-dash5")).toBeTruthy();
  });

  it("keeps hierarchical quick actions with a primary create", () => {
    render(
      <DashboardCommandHero
        displayName="דני כהן"
        roleKey="owner"
        features={["quotes", "crm", "jobs"]}
        attentionCount={2}
        todayCount={0}
        quotesOpen={3}
        showQuotes
        showToday
        showCreate
      />,
    );
    expect(screen.getByText(/דני/)).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(document.querySelector(".ops-qa.is-premium")).toBeTruthy();
    expect(document.querySelector(".ops-command-hero.is-compact-cc")).toBeTruthy();
    expect(document.querySelector(".ops-command-hero.is-dash12-hero")).toBeTruthy();
    expect(screen.getByRole("button", { name: he.newQuoteAction })).toBeInTheDocument();
    expect(document.querySelector(".ops-qa-primary.is-quote-cta")).toBeTruthy();
  });

  it("shows pipeline balance metric with LTR isolation when summary provided", () => {
    render(
      <DashboardCommandHero
        displayName="דני"
        roleKey="owner"
        features={["quotes", "crm", "jobs"]}
        showQuotes
        showCreate
        summary={{
          quotes_draft: 1,
          quotes_sent: 2,
          quotes_viewed: 1,
          quotes_approved: 3,
          quotes_rejected: 0,
          quotes_open: 4,
          quotes_approved_value: 8200,
          quotes_open_value: 12500,
          jobs_open: 0,
          jobs_overdue: 0,
          jobs_unassigned: 0,
        }}
      />,
    );
    const balance = document.querySelector(".ops-command-balance");
    expect(balance).toBeTruthy();
    expect(document.querySelector(".ops-command-hero.has-balance")).toBeTruthy();
    expect(document.querySelector(".ops-command-balance-value.ltr-meta")).toBeTruthy();
    expect(balance?.getAttribute("href")).toContain("/app/analytics");
    // Greeting + signals share one lead cell so signals never sit in the balance column.
    const lead = document.querySelector(".ops-command-hero-lead");
    expect(lead).toBeTruthy();
    expect(lead?.querySelector(".ops-command-hero-body.is-signals")).toBeTruthy();
    expect(lead?.querySelector(".ops-command-balance")).toBeNull();
    expect(document.querySelector(".ops-command-hero-signals.is-chips")).toBeTruthy();
  });

  it("hides create CTA for read-only hero", () => {
    render(
      <DashboardCommandHero
        displayName="צופה"
        roleKey="viewer"
        features={["quotes"]}
        showQuotes
        showCreate={false}
        summary={{
          quotes_draft: 0,
          quotes_sent: 1,
          quotes_viewed: 0,
          quotes_approved: 0,
          quotes_rejected: 0,
          quotes_open: 1,
          quotes_approved_value: 0,
          quotes_open_value: 500,
          jobs_open: 0,
          jobs_overdue: 0,
          jobs_unassigned: 0,
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: he.newQuoteAction })).not.toBeInTheDocument();
    expect(document.querySelector(".ops-qa-primary")).toBeNull();
  });

  it("never greets with technical email or QA identifiers", () => {
    const { rerender } = render(
      <DashboardCommandHero
        displayName="phase1b.owner.1790012816@sitesecure.test"
        showCreate={false}
      />,
    );
    const hello = () => document.querySelector(".ops-command-hero-hello")?.textContent ?? "";
    expect(hello()).not.toMatch(/phase1b/i);
    expect(hello()).not.toMatch(/@/);
    expect(hello()).not.toMatch(/,/);

    rerender(<DashboardCommandHero displayName="phase1b.owner.1790012816" showCreate={false} />);
    expect(hello()).not.toMatch(/phase1b/i);
    expect(hello()).not.toMatch(/,/);

    rerender(<DashboardCommandHero displayName={null} showCreate={false} />);
    expect(hello()).not.toMatch(/,/);
  });

  it("stacks overview compose without reserving an empty side column", () => {
    render(
      <DashboardCommandHero
        displayName="דניאל"
        attentionCount={1}
        todayCount={0}
        quotesOpen={0}
        showQuotes
        showToday
        showCreate={false}
      />,
    );
    const compose = document.querySelector(".ops-command-hero-compose");
    expect(compose).toBeTruthy();
    expect(compose?.children.length).toBeGreaterThan(0);
    // No ghost metric/action column node beside identity
    expect(document.querySelector(".ops-command-hero-grid")).toBeNull();
    expect(document.querySelector(".ops-command-hero-primary")).toBeNull();
  });
});
