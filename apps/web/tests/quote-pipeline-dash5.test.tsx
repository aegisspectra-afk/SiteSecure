import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuotePipeline } from "../src/components/dashboard/QuotePipeline";
import { RecentQuotes } from "../src/components/dashboard/RecentQuotes";
import { ObserveDashboard, OpsDashboard } from "../src/components/dashboard/OpsDashboard";
import type { DashboardResponse } from "@site-secure/api-client";
import { he } from "../src/i18n/he";
import { homeVariant } from "../src/lib/home";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    params,
    search,
    ...rest
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    [key: string]: unknown;
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
      <a href={href} className={className} {...rest}>
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

const summary = {
  quotes_draft: 7,
  quotes_sent: 3,
  quotes_viewed: 2,
  quotes_approved: 1,
  quotes_rejected: 1,
  quotes_open: 5,
  quotes_approved_value: 12000,
  quotes_open_value: 84200,
  jobs_open: 0,
  jobs_overdue: 0,
  jobs_unassigned: 0,
};

const dashBase: DashboardResponse = {
  home_variant: "ops",
  generated_at: "2026-09-27T10:00:00Z",
  attention: [],
  today: { label_he: "היום", items: [] },
  activity: [],
  summary,
  recent_quotes: [
    {
      id: "q1",
      number: "Q-100",
      title: "מערכת מצלמות",
      status: "sent",
      customer_name: "לקוח א",
      total_gross: 4200,
      updated_at: "2026-09-26T10:00:00Z",
    },
    {
      id: "q2",
      number: "Q-101",
      title: null,
      status: "viewed",
      customer_name: "לקוח ב",
      total_gross: 0,
      updated_at: "2026-09-25T10:00:00Z",
    },
  ],
};

describe("DASH-5 QuotePipeline", () => {
  it("renders real status counts with tabular LTR values", () => {
    render(<QuotePipeline summary={summary} />);
    expect(screen.getByTestId("quote-pipeline")).toBeInTheDocument();
    expect(screen.getByTestId("quote-pipeline-draft")).toHaveTextContent("7");
    expect(screen.getByTestId("quote-pipeline-sent")).toHaveTextContent("3");
    expect(screen.getByTestId("quote-pipeline-viewed")).toHaveTextContent("2");
    expect(screen.getByTestId("quote-pipeline-approved")).toHaveTextContent("1");
    expect(screen.getByTestId("quote-pipeline-rejected")).toHaveTextContent("1");
    expect(screen.getByText(he.snapshotOpenValue)).toBeInTheDocument();
    expect(screen.getByText(/84,200/)).toBeInTheDocument();
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
    expect(document.querySelectorAll(".ops-quote-pipeline-count.ltr-meta").length).toBeGreaterThan(0);
  });

  it("links stages to real Quotes tabs only", () => {
    render(<QuotePipeline summary={summary} />);
    expect(screen.getByTestId("quote-pipeline-draft")).toHaveAttribute("href", "/app/quotes?tab=draft");
    expect(screen.getByTestId("quote-pipeline-sent")).toHaveAttribute("href", "/app/quotes?tab=open");
    expect(screen.getByTestId("quote-pipeline-viewed")).toHaveAttribute("href", "/app/quotes?tab=open");
    expect(screen.getByTestId("quote-pipeline-approved")).toHaveAttribute("href", "/app/quotes?tab=approved");
    expect(screen.getByTestId("quote-pipeline-rejected")).toHaveAttribute("href", "/app/quotes?tab=rejected");
  });

  it("stays informational when linked=false (no dead controls)", () => {
    render(<QuotePipeline summary={summary} linked={false} />);
    expect(screen.queryByRole("link", { name: /טיוטה/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("quote-pipeline-draft").tagName).toBe("DIV");
  });

  it("shows compact empty copy when all counts are zero", () => {
    render(
      <QuotePipeline
        summary={{
          ...summary,
          quotes_draft: 0,
          quotes_sent: 0,
          quotes_viewed: 0,
          quotes_approved: 0,
          quotes_rejected: 0,
          quotes_open: 0,
          quotes_open_value: 0,
          quotes_approved_value: 0,
        }}
      />,
    );
    expect(screen.getByText(he.dashboardEmptyQuotes)).toBeInTheDocument();
  });
});

describe("DASH-5 RecentQuotes", () => {
  it("renders dense rows with real fields and quote navigation", () => {
    render(<RecentQuotes quotes={dashBase.recent_quotes} />);
    const rows = screen.getAllByTestId("recent-quote-row");
    expect(rows[0]).toHaveAttribute("href", "/app/quotes/q1");
    expect(screen.getByText("Q-100")).toBeInTheDocument();
    expect(screen.getByText("מערכת מצלמות")).toBeInTheDocument();
    expect(screen.getByText("לקוח א")).toBeInTheDocument();
    expect(screen.getByText(/4,200/)).toBeInTheDocument();
    expect(screen.getByText(he.quoteStatuses.sent)).toBeInTheDocument();
    expect(screen.getAllByText(he.recentQuotesOpen).length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows compact empty state without competing hero CTA", () => {
    render(<RecentQuotes quotes={[]} canCreate />);
    expect(screen.getByTestId("recent-quotes-empty")).toBeInTheDocument();
    expect(screen.getByText(he.recentQuotesEmptyTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.newQuoteAction })).toBeInTheDocument();
  });

  it("hides create on empty when read-only", () => {
    render(<RecentQuotes quotes={[]} canCreate={false} />);
    expect(screen.getByText(he.recentQuotesEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.newQuoteAction })).not.toBeInTheDocument();
  });
});

describe("DASH-5 OpsDashboard commercial zone", () => {
  it("wires pipeline + recent for owner/manager", () => {
    render(
      <OpsDashboard
        data={dashBase}
        roleKey="owner"
        features={["quotes", "crm", "jobs"]}
        customerCount={2}
        countsReady
      />,
    );
    expect(screen.getByTestId("quote-pipeline")).toBeInTheDocument();
    expect(screen.getByTestId("recent-quotes")).toBeInTheDocument();
    expect(screen.getByText(he.quotePipelineStages.sent)).toBeInTheDocument();
  });

  it("shows commercial surface for sales", () => {
    render(
      <OpsDashboard
        data={{ ...dashBase, home_variant: "sales" }}
        roleKey="sales"
        features={["quotes", "crm"]}
        customerCount={2}
        countsReady
      />,
    );
    expect(screen.getByTestId("quote-pipeline")).toBeInTheDocument();
    expect(screen.getByTestId("recent-quotes")).toBeInTheDocument();
  });

  it("viewer gets read-only commercial data (no create)", () => {
    render(
      <ObserveDashboard
        data={{ ...dashBase, home_variant: "observe" }}
        roleKey="viewer"
        features={["quotes"]}
      />,
    );
    expect(screen.getByTestId("quote-pipeline")).toBeInTheDocument();
    expect(screen.getByTestId("recent-quotes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.newQuoteAction })).not.toBeInTheDocument();
  });

  it("technician homeVariant stays today — no commercial leak expectation on ops home", () => {
    expect(homeVariant("technician")).toBe("today");
  });
});
