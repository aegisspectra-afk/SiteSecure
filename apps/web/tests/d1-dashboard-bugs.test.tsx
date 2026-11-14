import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardResponse, WorkspaceUsageMeter } from "@site-secure/api-client";
import { OpsDashboard } from "../src/components/dashboard/OpsDashboard";
import { QuotePipeline } from "../src/components/dashboard/QuotePipeline";
import { UsageThresholdBanner } from "../src/components/dashboard/UsageThresholdBanner";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className, params: _p, search: _s, ...rest }: { to: string; children: ReactNode; className?: string; [key: string]: unknown }) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    api: { listCustomers: vi.fn(async () => ({ items: [] })), listSites: vi.fn(async () => ({ items: [] })) },
    session: { memberships: [{ workspace_id: "ws" }] },
  }),
}));

vi.mock("../src/components/quotes/quote-creation/NewQuoteDialog", () => ({ NewQuoteDialog: () => null }));

const summary = {
  quotes_draft: 11,
  quotes_sent: 3,
  quotes_viewed: 6,
  quotes_approved: 4,
  quotes_rejected: 0,
  quotes_open: 9,
  quotes_approved_value: 7976.8,
  quotes_open_value: 19717.8,
  jobs_open: 0,
  jobs_overdue: 0,
  jobs_unassigned: 0,
};

describe("D1 bug: recent quotes card was empty", () => {
  it("renders the quotes the API returns, even ones also listed under attention", () => {
    // The API already decides which quotes to show; when every quote needs attention it
    // falls back to the newest ones. The web must not filter them away again.
    const data: DashboardResponse = {
      home_variant: "ops",
      generated_at: "2026-11-14T10:00:00Z",
      attention: [
        {
          kind: "quote_awaiting_us",
          label_he: "הצעות לאישור אצלנו",
          count: 1,
          items: [
            { entity_type: "quote", entity_id: "q21", number: "Q-00021", title_he: "הלקוח צפה", severity: "now", actions: [] },
          ],
        },
      ],
      today: { label_he: "היום", items: [] },
      activity: [],
      summary,
      recent_quotes: [
        { id: "q21", number: "Q-00021", title: null, status: "viewed", customer_name: "לקוח", total_gross: 100, updated_at: "2026-11-14T09:00:00Z" },
      ],
    };
    render(<OpsDashboard data={data} roleKey="owner" features={["quotes", "crm", "jobs"]} customerCount={2} countsReady />);
    const card = screen.getByTestId("recent-quotes");
    expect(within(card).getAllByTestId("recent-quote-row")).toHaveLength(1);
    expect(within(card).queryByTestId("recent-quotes-empty")).not.toBeInTheDocument();
  });
});

describe("D1 bug: a bare 0 under the approved value", () => {
  it("renders no unlabeled number when there are no rejected quotes", () => {
    render(<QuotePipeline summary={summary} />);
    expect(screen.queryByTestId("quote-pipeline-rejected")).not.toBeInTheDocument();
    const pipeline = screen.getByTestId("quote-pipeline");
    const bareNumbers = Array.from(pipeline.querySelectorAll("*")).filter(
      (el) => el.children.length === 0 && /^\d+$/.test((el.textContent ?? "").trim()),
    );
    for (const el of bareNumbers) {
      // Every count sits in a station next to its Hebrew label.
      const station = el.closest(".ops-quote-pipeline-station");
      expect(station, `"${el.textContent}" has no label`).not.toBeNull();
      expect(station?.querySelector(".ops-quote-pipeline-label")?.textContent).toBeTruthy();
    }
  });

  it("still shows rejected with its label when there are some", () => {
    render(<QuotePipeline summary={{ ...summary, quotes_rejected: 2 }} />);
    const rejected = screen.getByTestId("quote-pipeline-rejected");
    expect(rejected).toHaveTextContent(he.quoteStatuses.rejected);
    expect(rejected).toHaveTextContent("2");
  });
});

describe("D1 bug: office users 2/1 read ambiguously in RTL", () => {
  const meter = (current: number, limit: number): WorkspaceUsageMeter => ({
    key: "seats_operator",
    label_he: "משתמשים במשרד",
    current,
    limit,
    unlimited: false,
    unit: "seats",
    at_limit: current >= limit,
    occupants: [],
  });

  it("spells out usage in words and names the overage", () => {
    render(<UsageThresholdBanner meters={[meter(2, 1)]} canManageTeam />);
    expect(screen.getByRole("heading", { name: he.usageThresholdMeterOver("משתמשים במשרד") })).toBeInTheDocument();
    const line = screen.getByTestId("usage-threshold-line");
    expect(line).toHaveTextContent("משתמשים במשרד: 2 מתוך 1 · חריגה של 1");
    expect(line.textContent).not.toMatch(/\d\/\d/);
  });

  it("at the limit says full, without an overage", () => {
    render(<UsageThresholdBanner meters={[meter(1, 1)]} canManageTeam />);
    expect(screen.getByRole("heading", { name: he.usageThresholdMeterFull("משתמשים במשרד") })).toBeInTheDocument();
    expect(screen.getByTestId("usage-threshold-line")).toHaveTextContent("משתמשים במשרד: 1 מתוך 1");
    expect(screen.getByTestId("usage-threshold-line").textContent).not.toContain("חריגה");
  });
});
