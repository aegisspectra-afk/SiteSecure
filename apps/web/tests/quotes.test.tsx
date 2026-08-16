import { fireEvent, render, screen } from "@testing-library/react";
import type { DashboardSummary, QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuotesWorkspace } from "../src/components/quotes/QuotesWorkspace";
import { he } from "../src/i18n/he";
import { formatMoney } from "../src/lib/quotes";
import {
  filterQuotes,
  quotesMarginTotals,
  quotesOpenValue,
  quotesWorkspaceKpis,
  type QuoteTab,
} from "../src/lib/quote-workspace";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    onClick,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    onClick?: (event: { stopPropagation: () => void }) => void;
  }) => (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

const emptySummary: DashboardSummary = {
  quotes_draft: 0,
  quotes_sent: 0,
  quotes_viewed: 0,
  quotes_approved: 0,
  quotes_rejected: 0,
  quotes_open: 0,
  quotes_approved_value: 0,
  jobs_open: 0,
  jobs_overdue: 0,
  jobs_unassigned: 0,
};

function quote(partial: Partial<QuoteOut> & Pick<QuoteOut, "id" | "number" | "status">): QuoteOut {
  return {
    workspace_id: "ws",
    customer_id: null,
    site_id: null,
    owner_user_id: null,
    currency: "ILS",
    total_gross: 0,
    ...partial,
  };
}

function Harness({
  quotes,
  summary = null,
  canCreate = true,
  canViewCost = false,
  onOpenQuote = vi.fn(),
}: {
  quotes: QuoteOut[];
  summary?: DashboardSummary | null;
  canCreate?: boolean;
  canViewCost?: boolean;
  onOpenQuote?: (id: string) => void;
}) {
  const [tab, setTab] = useState<QuoteTab>("all");
  const [search, setSearch] = useState("");
  return (
    <QuotesWorkspace
      quotes={quotes}
      summary={summary}
      search={search}
      tab={tab}
      canCreate={canCreate}
      canViewCost={canViewCost}
      onSearch={setSearch}
      onTab={setTab}
      onOpenQuote={onOpenQuote}
    />
  );
}

describe("Quotes workspace", () => {
  it("renders CPQ onboarding empty state without fake modules", () => {
    render(<Harness quotes={[]} />);
    expect(screen.getByRole("heading", { name: he.quotesTitle })).toBeInTheDocument();
    expect(screen.getByText(he.quotesLead)).toBeInTheDocument();
    expect(screen.getByText(he.quotesEmptyLead)).toBeInTheDocument();
    expect(screen.getByText(he.quotesEmptyBody)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: he.newQuoteAction }).length).toBeGreaterThan(0);
    expect(screen.getByText(he.quotesFlowCreate)).toBeInTheDocument();
    expect(screen.getByText(he.quotesFlowPrice)).toBeInTheDocument();
    expect(screen.getByText(he.quotesFlowTrack)).toBeInTheDocument();
    expect(screen.queryByText(he.quotesKpiOpenValue)).not.toBeInTheDocument();
    expect(screen.queryByText("קטלוג")).not.toBeInTheDocument();
    expect(screen.queryByText("CATALOG")).not.toBeInTheDocument();
    expect(screen.queryByText("לקוח")).not.toBeInTheDocument();
    expect(screen.queryByText("פרויקט")).not.toBeInTheDocument();
    expect(screen.queryByText("ממתינות לאישור")).not.toBeInTheDocument();
  });

  it("switches to management workspace when quotes exist", () => {
    const quotes = [
      quote({
        id: "q1",
        number: "Q-2026-0001",
        status: "draft",
        total_gross: 8400,
        customer_notes: "התקנת מצלמות",
        updated_at: new Date().toISOString(),
      }),
      quote({
        id: "q2",
        number: "Q-2026-0002",
        status: "sent",
        total_gross: 5200,
        valid_until: "2026-09-20",
      }),
      quote({
        id: "q3",
        number: "Q-2026-0003",
        status: "approved",
        total_gross: 12400,
        version: 2,
      }),
    ];
    const summary: DashboardSummary = {
      ...emptySummary,
      quotes_draft: 1,
      quotes_sent: 1,
      quotes_approved: 1,
      quotes_open: 2,
      quotes_approved_value: 12400,
    };
    render(<Harness quotes={quotes} summary={summary} />);
    expect(screen.queryByText(he.quotesEmptyLead)).not.toBeInTheDocument();
    expect(screen.getByText("Q-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Q-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Q-2026-0003")).toBeInTheDocument();
    expect(screen.getByText(he.quotesVersion(2))).toBeInTheDocument();
    expect(screen.getByText(he.quotesKpiDraft)).toBeInTheDocument();
    expect(screen.getAllByText(he.quoteStatuses.sent).length).toBeGreaterThan(0);
    expect(screen.getByText(he.quotesKpiApproved)).toBeInTheDocument();
    expect(screen.getByText(he.quotesKpiOpenValue)).toBeInTheDocument();
    expect(screen.getByText(he.quotesKpiOpenHint(2))).toBeInTheDocument();
    expect(screen.getByText(he.quotesTabAll)).toBeInTheDocument();
    expect(screen.getByLabelText(he.quotesSearchLabel)).toBeInTheDocument();
    expect(screen.getByText(he.quotePipelineTitle)).toBeInTheDocument();
    expect(screen.queryByText(he.kpiViewQuotes)).not.toBeInTheDocument();
    expect(screen.queryByText("לקוח")).not.toBeInTheDocument();
    expect(screen.queryByText("פרויקט")).not.toBeInTheDocument();
    expect(screen.queryByText(he.quotesKpiMargin)).not.toBeInTheDocument();
  });

  it("filters by sent tab and search", () => {
    const quotes = [
      quote({ id: "q1", number: "Q-0001", status: "draft", customer_notes: "מצלמות" }),
      quote({ id: "q2", number: "Q-0002", status: "sent", customer_notes: "אזעקה" }),
      quote({ id: "q3", number: "Q-0003", status: "viewed", customer_notes: "בקרת כניסה" }),
    ];
    render(<Harness quotes={quotes} />);
    fireEvent.click(screen.getByRole("tab", { name: he.quotesTabOpen }));
    expect(screen.queryByText("Q-0001")).not.toBeInTheDocument();
    expect(screen.getByText("Q-0002")).toBeInTheDocument();
    expect(screen.getByText("Q-0003")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(he.quotesSearchLabel), { target: { value: "אזעקה" } });
    expect(screen.getByText("Q-0002")).toBeInTheDocument();
    expect(screen.queryByText("Q-0003")).not.toBeInTheDocument();
  });

  it("opens a quote from the row", () => {
    const onOpenQuote = vi.fn();
    render(
      <Harness
        quotes={[quote({ id: "q1", number: "Q-0001", status: "draft" })]}
        onOpenQuote={onOpenQuote}
      />,
    );
    fireEvent.click(screen.getByText("Q-0001"));
    expect(onOpenQuote).toHaveBeenCalledWith("q1");
  });

  it("shows margin only when cost fields exist and the user may view them", () => {
    const quotes = [
      quote({
        id: "q1",
        number: "Q-0001",
        status: "approved",
        total_gross: 10000,
        margin_amount: 3400,
        cost_total: 6600,
      }),
    ];
    const { rerender } = render(<Harness quotes={quotes} canViewCost={false} />);
    expect(screen.queryByText(he.quotesKpiMargin)).not.toBeInTheDocument();
    rerender(<Harness quotes={quotes} canViewCost />);
    expect(screen.getByText(he.quotesKpiMargin, { exact: false })).toBeInTheDocument();
  });

  it("shows conversion after enough real quotes", () => {
    const summary: DashboardSummary = {
      ...emptySummary,
      quotes_draft: 1,
      quotes_sent: 1,
      quotes_approved: 1,
    };
    const quotes = [
      quote({ id: "a", number: "Q-1", status: "draft" }),
      quote({ id: "b", number: "Q-2", status: "sent" }),
      quote({ id: "c", number: "Q-3", status: "approved" }),
    ];
    render(<Harness quotes={quotes} summary={summary} />);
    expect(
      screen.getByText(`${he.uxQuoteConversion}: ${he.uxPercent(33)} · ${he.uxQuoteConversionHint(1, 3)}`),
    ).toBeInTheDocument();
  });
});

describe("quote workspace helpers", () => {
  it("computes open value from draft, sent and viewed quotes", () => {
    const quotes = [
      quote({ id: "1", number: "A", status: "draft", total_gross: 100 }),
      quote({ id: "2", number: "B", status: "sent", total_gross: 250 }),
      quote({ id: "3", number: "C", status: "viewed", total_gross: 50 }),
      quote({ id: "4", number: "D", status: "approved", total_gross: 999 }),
    ];
    expect(quotesOpenValue(quotes)).toBe(400);
    expect(quotesWorkspaceKpis(null, quotes).openCount).toBe(3);
    expect(quotesWorkspaceKpis(null, quotes).awaiting).toBe(2);
  });

  it("filters search across number and notes", () => {
    const quotes = [
      quote({ id: "1", number: "Q-2026-0001", status: "draft", customer_notes: "DEMO SITE" }),
      quote({ id: "2", number: "Q-9", status: "sent", customer_notes: "רומן" }),
    ];
    expect(filterQuotes(quotes, "all", "Q-2026-0001").map((row) => row.id)).toEqual(["1"]);
    expect(filterQuotes(quotes, "all", "רומן").map((row) => row.id)).toEqual(["2"]);
    expect(filterQuotes(quotes, "all", "DEMO").map((row) => row.id)).toEqual(["1"]);
  });

  it("hides margin totals when cost fields are absent", () => {
    expect(quotesMarginTotals([quote({ id: "1", number: "A", status: "draft", total_gross: 10 })])).toBeNull();
    expect(
      quotesMarginTotals([quote({ id: "1", number: "A", status: "draft", margin_amount: 4, total_gross: 10 })]),
    ).toEqual({
      amount: 4,
      percent: 40,
    });
  });
});

describe("quote money helper used in KPIs", () => {
  it("formats open value in ILS", () => {
    expect(formatMoney(48250)).toMatch(/48,250/);
  });
});
