import { render } from "@testing-library/react";
import type { DashboardResponse } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsDashboard } from "../src/components/dashboard/OpsDashboard";

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
    let href = to;
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
    api: {
      listCustomers: vi.fn(async () => ({ items: [] })),
      listSites: vi.fn(async () => ({ items: [] })),
      createCustomer: vi.fn(),
    },
    session: { memberships: [{ workspace_id: "ws" }] },
  }),
}));

vi.mock("../src/components/quotes/quote-creation/NewQuoteDialog", () => ({
  NewQuoteDialog: () => null,
}));

const dash: DashboardResponse = {
  home_variant: "ops",
  generated_at: "2026-09-27T10:00:00Z",
  attention: [],
  today: { label_he: "היום", items: [] },
  activity: [],
  summary: {
    quotes_draft: 2,
    quotes_sent: 1,
    quotes_viewed: 1,
    quotes_approved: 1,
    quotes_rejected: 0,
    quotes_open: 2,
    quotes_approved_value: 1000,
    quotes_open_value: 5000,
    jobs_open: 0,
    jobs_overdue: 0,
    jobs_unassigned: 0,
  },
  recent_quotes: [
    {
      id: "q1",
      number: "Q-1",
      status: "sent",
      title: "בדיקה",
      customer_name: "לקוח",
      total_gross: 500,
      updated_at: "2026-09-26T10:00:00Z",
    },
  ],
};

describe("DASH-7/8/9 final polish shell", () => {
  it("marks the dashboard with final polish hooks for responsive/theme CSS", () => {
    const { container } = render(
      <OpsDashboard
        data={dash}
        roleKey="owner"
        features={["quotes", "crm", "jobs", "projects", "catalog"]}
        customerCount={2}
        countsReady
      />,
    );
    expect(container.querySelector(".ops-dashboard-dash12.ops-dashboard-final")).toBeTruthy();
    expect(container.querySelector(".ops-command-primary.is-dash-final")).toBeTruthy();
    expect(container.querySelector(".ops-command-secondary.is-dash-final")).toBeTruthy();
    expect(container.querySelector(".ops-qa.is-dash6")).toBeTruthy();
    expect(container.querySelector(".ops-quote-pipeline.is-dash5")).toBeTruthy();
    expect(container.querySelector(".ops-recent-panel.is-dash5")).toBeTruthy();
    expect(container.querySelectorAll(".ltr-meta").length).toBeGreaterThan(0);
  });
});
