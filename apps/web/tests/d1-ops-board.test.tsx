import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardResponse, OpsBoard } from "@site-secure/api-client";
import { OpsBoardCard } from "../src/components/dashboard/OpsBoardCard";
import { OpsDashboard } from "../src/components/dashboard/OpsDashboard";
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

const board: OpsBoard = {
  technicians: [
    { user_id: "u1", name: "דנה כהן", jobs_today: 3, in_progress: 1, completed: 1 },
    { user_id: "u2", name: "לא ידוע", jobs_today: 1, in_progress: 0, completed: 0 },
  ],
  jobs_today: 5,
  unassigned_today: 1,
  unassigned_open: 2,
};

const summary = {
  quotes_draft: 0,
  quotes_sent: 0,
  quotes_viewed: 0,
  quotes_approved: 0,
  quotes_rejected: 0,
  quotes_open: 0,
  quotes_approved_value: 0,
  quotes_open_value: 0,
  jobs_open: 3,
  jobs_overdue: 0,
  jobs_unassigned: 2,
};

function dash(opsBoard: OpsBoard | null): DashboardResponse {
  return {
    home_variant: "ops",
    generated_at: "2026-11-14T10:00:00Z",
    attention: [],
    today: { label_he: "היום", items: [] },
    activity: [],
    summary,
    recent_quotes: [],
    ops_board: opsBoard,
  };
}

describe("D1 ops card", () => {
  it("lists today's jobs per technician and the unassigned jobs", () => {
    render(<OpsBoardCard board={board} />);
    const rows = screen.getAllByTestId("ops-board-tech");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("דנה כהן")).toBeInTheDocument();
    expect(within(rows[0]).getByText(he.opsBoardTechLine(3, 1, 1))).toBeInTheDocument();
    expect(within(rows[1]).getByText("לא ידוע")).toBeInTheDocument();
    const unassigned = screen.getByTestId("ops-board-unassigned");
    expect(unassigned).toHaveTextContent(he.opsBoardUnassignedLine(2, 1));
    expect(screen.getByTestId("ops-board-unassigned-link")).toHaveAttribute("href", "/app/attention");
  });

  it("has a calm empty state and no dead link when everything is assigned", () => {
    render(<OpsBoardCard board={{ technicians: [], jobs_today: 0, unassigned_today: 0, unassigned_open: 0 }} />);
    expect(screen.getByTestId("ops-board-no-techs")).toHaveTextContent(he.opsBoardNoAssignedToday);
    expect(screen.getByTestId("ops-board-unassigned")).toHaveTextContent(he.opsBoardUnassignedLine(0, 0));
    expect(screen.queryByTestId("ops-board-unassigned-link")).not.toBeInTheDocument();
  });

  it("does not claim a billing state that the data does not have", () => {
    render(<OpsBoardCard board={board} />);
    expect(screen.getByTestId("ops-board").textContent).not.toMatch(/חיוב|חשבונית/);
  });

  it("renders for manager too", () => {
    render(<OpsDashboard data={dash(board)} roleKey="manager" features={["quotes", "crm", "jobs"]} customerCount={2} countsReady />);
    expect(screen.getByTestId("ops-board")).toBeInTheDocument();
  });

  it("renders on the owner dashboard when the API sends it, and not otherwise", () => {
    const { unmount } = render(<OpsDashboard data={dash(board)} roleKey="owner" features={["quotes", "crm", "jobs"]} customerCount={2} countsReady />);
    expect(screen.getByTestId("ops-board")).toBeInTheDocument();
    unmount();
    render(<OpsDashboard data={dash(null)} roleKey="owner" features={["quotes", "crm", "jobs"]} customerCount={2} countsReady />);
    expect(screen.queryByTestId("ops-board")).not.toBeInTheDocument();
  });

  it("is hidden for a role that cannot assign jobs even if a payload slips through", () => {
    render(<OpsDashboard data={dash(board)} roleKey="sales" features={["quotes", "crm", "jobs"]} customerCount={2} countsReady />);
    expect(screen.queryByTestId("ops-board")).not.toBeInTheDocument();
  });
});
