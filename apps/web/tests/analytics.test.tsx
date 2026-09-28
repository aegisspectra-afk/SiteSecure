import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsWorkspace } from "../src/components/dashboard/AnalyticsWorkspace";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    params,
    ...rest
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  },
  createFileRoute: () => (opts: { component: () => ReactNode }) => opts,
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

vi.mock("../src/lib/can", () => ({
  can: (_role: string | undefined, permission: string) =>
    ["dashboard.view", "quotes.view"].includes(permission),
}));

vi.mock("../src/lib/home", () => ({
  hasFeature: () => true,
  homeVariant: (role?: string) => (role === "technician" ? "today" : "ops"),
}));

const api = {
  getDashboard: vi.fn(),
};

const sessionState = {
  role_key: "owner" as string,
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: sessionState.role_key,
          features: ["core", "quotes", "crm"],
        },
      ],
      profile: { full_name: "בודק" },
    },
    api,
  }),
}));

vi.mock("../src/components/settings/RequirePermission", () => ({
  RequirePermission: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { AnalyticsPage } from "../src/routes/app/analytics";

const summary = {
  quotes_draft: 2,
  quotes_sent: 3,
  quotes_viewed: 1,
  quotes_approved: 4,
  quotes_rejected: 1,
  quotes_open: 4,
  quotes_open_value: 12000,
  quotes_approved_value: 8000,
  jobs_open: 0,
  jobs_overdue: 0,
  jobs_unassigned: 0,
};

describe("AnalyticsWorkspace", () => {
  it("renders snapshot, funnel, signals and recent quotes from real summary data", () => {
    render(
      <AnalyticsWorkspace
        summary={summary}
        chart={{
          labels_he: ["אפר", "מאי"],
          revenue: [1000, 2000],
          quotes: [1, 2],
        }}
        attention={[
          {
            kind: "quote_awaiting_customer",
            label_he: "ממתינות",
            count: 2,
            items: [],
          },
          {
            kind: "quote_expiring",
            label_he: "פגות",
            count: 1,
            items: [],
          },
        ]}
        recentQuotes={[
          {
            id: "q1",
            number: "Q-1",
            status: "sent",
            title: "הצעה",
            customer_name: "לקוח א",
            total_gross: 1500,
            updated_at: "2026-09-26T10:00:00Z",
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: he.analyticsSnapshotTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.analyticsFunnelTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.analyticsTrendTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.analyticsSignalsTitle })).toBeInTheDocument();
    expect(screen.getByText(he.analyticsSignalAwaitingCustomer)).toBeInTheDocument();
    expect(screen.getByText("לקוח א")).toBeInTheDocument();
    expect(screen.queryByText("דופק מסחרי")).not.toBeInTheDocument();
  });
});

describe("Analytics page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.role_key = "owner";
    api.getDashboard.mockResolvedValue({
      home_variant: "ops",
      generated_at: "2026-09-26T12:00:00Z",
      attention: [],
      today: { label_he: "היום", items: [] },
      activity: [],
      summary,
      recent_quotes: [],
      business_chart: {
        labels_he: ["ספט"],
        revenue: [500],
        quotes: [1],
      },
    });
  });

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AnalyticsPage />
      </QueryClientProvider>,
    );
  }

  it("loads analytics for owner", async () => {
    renderPage();
    expect(await screen.findByTestId("analytics-page")).toBeInTheDocument();
    expect(await screen.findByTestId("analytics-workspace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.analyticsTitle })).toBeInTheDocument();
  });

  it("redirects technician field home to Today", () => {
    sessionState.role_key = "technician";
    renderPage();
    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/app/today");
  });
});
