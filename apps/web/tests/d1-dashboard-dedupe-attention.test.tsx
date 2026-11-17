import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttentionGroup, DashboardResponse } from "@site-secure/api-client";
import { OpsDashboard } from "../src/components/dashboard/OpsDashboard";
import { he } from "../src/i18n/he";
import { formatDashboardMoney } from "../src/lib/quotes";
import { AttentionPage } from "../src/routes/app/attention";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className, params: _p, search: _s, ...rest }: { to: string; children: ReactNode; className?: string; [key: string]: unknown }) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  createFileRoute: () => (opts: unknown) => opts,
}));

const getDashboard = vi.fn();
const listLeads = vi.fn(async () => ({ items: [] }));
let roleKey = "owner";

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    api: { getDashboard, listLeads, listCustomers: vi.fn(async () => ({ items: [] })), listSites: vi.fn(async () => ({ items: [] })) },
    session: {
      memberships: [{ workspace_id: "ws", role_key: roleKey, features: ["quotes", "crm", "jobs", "projects", "leads"] }],
    },
  }),
}));

vi.mock("../src/components/quotes/quote-creation/NewQuoteDialog", () => ({ NewQuoteDialog: () => null }));

const summary = {
  quotes_draft: 1,
  quotes_sent: 7,
  quotes_viewed: 0,
  quotes_approved: 0,
  quotes_rejected: 0,
  quotes_open: 7,
  quotes_approved_value: 7976.8,
  quotes_open_value: 19717.8,
  jobs_open: 0,
  jobs_overdue: 0,
  jobs_unassigned: 0,
};

function sentGroup(n: number): AttentionGroup {
  return {
    kind: "quote_awaiting_customer",
    label_he: "ממתינות לאישור הלקוח",
    count: n,
    items: Array.from({ length: n }, (_, i) => ({
      entity_type: "quote",
      entity_id: `q${i}`,
      number: `Q-${String(i).padStart(5, "0")}`,
      title_he: "נשלחה",
      severity: "next" as const,
      actions: [],
    })),
  };
}

function dash(attention: AttentionGroup[], recent: DashboardResponse["recent_quotes"] = []): DashboardResponse {
  return {
    home_variant: "ops",
    generated_at: "2026-11-14T10:00:00Z",
    attention,
    today: { label_he: "היום", items: [] },
    activity: [],
    summary,
    recent_quotes: recent,
  };
}

function withQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  roleKey = "owner";
  getDashboard.mockReset();
  listLeads.mockClear();
});

describe("D1 duplicates on the dashboard", () => {
  it("shows the open value once and the new-quote button once", () => {
    const { container } = render(
      <OpsDashboard data={dash([sentGroup(2)])} roleKey="owner" features={["quotes", "crm", "jobs"]} customerCount={2} countsReady />,
    );
    // D3: whole-shekel dashboard money (19717.8 → 19,718 ₪), not decimals.
    const norm = (s: string) => s.replace(/[\u200f\u00a0\s]/g, "");
    const openNorm = norm(formatDashboardMoney(summary.quotes_open_value).text);
    const moneyNodes = Array.from(container.querySelectorAll(".ss-dashboard-money")).filter((el) =>
      norm(el.textContent || "").includes(openNorm),
    );
    expect(moneyNodes.length).toBeGreaterThanOrEqual(1);
    expect(moneyNodes).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: he.newQuoteAction })).toHaveLength(1);
    // The recent-quotes empty state no longer repeats the button.
    expect(within(screen.getByTestId("recent-quotes")).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe('D1 "הצג הכל" opens the unified list', () => {
  it("links to /app/attention, not to the quotes list", () => {
    render(<OpsDashboard data={dash([sentGroup(7)])} roleKey="owner" features={["quotes", "crm", "jobs"]} customerCount={2} countsReady />);
    expect(screen.getByTestId("attention-view-all")).toHaveAttribute("href", "/app/attention");
  });

  it("the unified page asks for the full list and renders every item", async () => {
    getDashboard.mockResolvedValue(dash([sentGroup(9)]));
    render(withQuery(<AttentionPage />));
    await waitFor(() => expect(screen.getByTestId("attention-page")).toBeInTheDocument());
    expect(getDashboard).toHaveBeenCalledWith("ws", { attention: "full" });
    expect(screen.getByRole("heading", { level: 1, name: he.attentionPageTitle(9) })).toBeInTheDocument();
    for (let i = 0; i < 9; i += 1) expect(screen.getByText(`Q-${String(i).padStart(5, "0")}`)).toBeInTheDocument();
  });

  it("shows an empty state when nothing needs attention", async () => {
    getDashboard.mockResolvedValue(dash([]));
    render(withQuery(<AttentionPage />));
    await waitFor(() => expect(screen.getByTestId("attention-page-empty")).toBeInTheDocument());
    expect(screen.getByText(he.commandQuietBody)).toBeInTheDocument();
  });

  it("shows an error with retry when loading fails", async () => {
    getDashboard.mockRejectedValue(new Error("boom"));
    render(withQuery(<AttentionPage />));
    await waitFor(() => expect(screen.getByText(he.attentionPageError)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: he.retry })).toBeInTheDocument();
  });

  it("shows no-permission without fetching for a role without dashboard.view", async () => {
    roleKey = "no_such_role";
    render(withQuery(<AttentionPage />));
    expect(screen.getByText(he.noDashboardPermission)).toBeInTheDocument();
    expect(getDashboard).not.toHaveBeenCalled();
  });
});
