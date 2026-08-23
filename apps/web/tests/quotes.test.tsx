import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuotesWorkspace } from "../src/components/quotes/QuotesWorkspace";
import { QuoteCustomerView } from "../src/components/quotes/QuoteCustomerView";
import { SendQuoteConfirm } from "../src/components/quotes/SendQuoteConfirm";
import { he } from "../src/i18n/he";
import { formatMoney } from "../src/lib/quotes";
import {
  filterQuotes,
  quoteDraftGap,
  quoteIsDeletable,
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

vi.mock("../src/components/quotes/CreateQuoteDialog", () => ({
  CreateQuoteDialog: () => null,
  NewQuoteDialog: () => null,
}));

vi.mock("../src/components/quotes/quote-creation/NewQuoteDialog", () => ({
  CreateQuoteDialog: () => null,
  NewQuoteDialog: () => null,
}));

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

function withClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

function Harness({
  quotes,
  canCreate = true,
  canDelete = false,
  canViewCost = false,
  onOpenQuote = vi.fn(),
  onDelete,
  onDuplicate,
}: {
  quotes: QuoteOut[];
  canCreate?: boolean;
  canDelete?: boolean;
  canViewCost?: boolean;
  onOpenQuote?: (id: string) => void;
  onDelete?: (ids: string[]) => Promise<void>;
  onDuplicate?: (ids: string[]) => Promise<void>;
}) {
  const [tab, setTab] = useState<QuoteTab>("all");
  const [search, setSearch] = useState("");
  return withClient(
    <QuotesWorkspace
      quotes={quotes}
      search={search}
      tab={tab}
      canCreate={canCreate}
      canDelete={canDelete}
      canViewCost={canViewCost}
      onSearch={setSearch}
      onTab={setTab}
      onOpenQuote={onOpenQuote}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
    />,
  );
}

describe("Quotes workspace", () => {
  it("renders CPQ onboarding empty state without fake modules", () => {
    render(<Harness quotes={[]} />);
    expect(screen.getByRole("heading", { name: he.quotesTitle })).toBeInTheDocument();
    expect(screen.getByText(he.quotesLead)).toBeInTheDocument();
    expect(screen.getByText(he.quotesEmptyLead)).toBeInTheDocument();
    expect(screen.getByText(he.quotesEmptyBody)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.newQuoteAction }).length).toBeGreaterThan(0);
    expect(screen.getByText(he.quotesFlowCreate)).toBeInTheDocument();
    expect(screen.getByText(he.quotesFlowPrice)).toBeInTheDocument();
    expect(screen.getByText(he.quotesFlowTrack)).toBeInTheDocument();
    expect(screen.queryByText(he.quotesKpiOpenValue)).not.toBeInTheDocument();
    expect(screen.queryByText("קטלוג")).not.toBeInTheDocument();
    expect(screen.queryByText("CATALOG")).not.toBeInTheDocument();
    expect(screen.queryByText(he.quotesColCustomer)).not.toBeInTheDocument();
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
        customer_name: "רומן קופן",
        title: "התקנת מערכת מצלמות",
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
    render(<Harness quotes={quotes} />);
    expect(screen.queryByText(he.quotesEmptyLead)).not.toBeInTheDocument();
    expect(screen.getByText("Q-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("רומן קופן")).toBeInTheDocument();
    expect(screen.getByText("התקנת מערכת מצלמות")).toBeInTheDocument();
    expect(screen.getByText("Q-2026-0002")).toBeInTheDocument();
    expect(screen.getAllByText(he.quotesNoCustomer).length).toBeGreaterThan(0);
    expect(screen.getByText("Q-2026-0003")).toBeInTheDocument();
    expect(screen.getByText(he.quotesVersion(2))).toBeInTheDocument();
    expect(screen.getByText(he.quotesKpiDraft)).toBeInTheDocument();
    expect(screen.getAllByText(he.quoteStatuses.sent).length).toBeGreaterThan(0);
    expect(screen.getByText(he.quotesKpiApproved)).toBeInTheDocument();
    expect(screen.getByText(he.quotesKpiOpenValue)).toBeInTheDocument();
    expect(screen.getByText(he.quotesTabAll)).toBeInTheDocument();
    expect(screen.getByLabelText(he.quotesSearchLabel)).toBeInTheDocument();
    expect(screen.getByText(he.quotePipelineTitle)).toBeInTheDocument();
    expect(screen.queryByText(he.kpiViewQuotes)).not.toBeInTheDocument();
    expect(screen.getByText(he.quotesColCustomer)).toBeInTheDocument();
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

  it("searches by customer name from the backend field", () => {
    const quotes = [
      quote({ id: "q1", number: "Q-0001", status: "draft", customer_name: "רומן קופן" }),
      quote({ id: "q2", number: "Q-0002", status: "sent", customer_name: "לקוח אחר" }),
    ];
    render(<Harness quotes={quotes} />);
    fireEvent.change(screen.getByLabelText(he.quotesSearchLabel), { target: { value: "רומן" } });
    expect(screen.getByText("Q-0001")).toBeInTheDocument();
    expect(screen.queryByText("Q-0002")).not.toBeInTheDocument();
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

  it("selects quotes for bulk delete without opening the row", async () => {
    const onOpenQuote = vi.fn();
    const onDelete = vi.fn(async () => undefined);
    render(
      <Harness
        quotes={[
          quote({ id: "q1", number: "Q-0001", status: "draft" }),
          quote({ id: "q2", number: "Q-0002", status: "approved" }),
        ]}
        canDelete
        onOpenQuote={onOpenQuote}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByLabelText(he.quotesSelectRow("Q-0001")));
    expect(onOpenQuote).not.toHaveBeenCalled();
    expect(screen.getByText(he.quotesSelectedCount(1))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: he.quotesDelete }));
    fireEvent.click(screen.getByRole("button", { name: he.quotesDeleteConfirm }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(["q1"]));
  });

  it("hides selection for viewers", () => {
    render(
      <Harness quotes={[quote({ id: "q1", number: "Q-0001", status: "draft" })]} canCreate={false} />,
    );
    expect(screen.queryByLabelText(he.quotesSelectAll)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.quotesDelete })).not.toBeInTheDocument();
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
    const quotes = [
      quote({ id: "a", number: "Q-1", status: "draft" }),
      quote({ id: "b", number: "Q-2", status: "sent" }),
      quote({ id: "c", number: "Q-3", status: "approved" }),
    ];
    render(<Harness quotes={quotes} />);
    expect(
      screen.getByText(`${he.uxQuoteConversion}: ${he.uxPercent(33)} · ${he.uxQuoteConversionHint(1, 3)}`),
    ).toBeInTheDocument();
  });

  it("does not treat empty drafts as a conversion rate", () => {
    render(
      <Harness
        quotes={[
          quote({ id: "a", number: "Q-1", status: "draft" }),
          quote({ id: "b", number: "Q-2", status: "draft" }),
          quote({ id: "c", number: "Q-3", status: "draft" }),
        ]}
      />,
    );
    expect(screen.queryByText(he.uxQuoteConversion, { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText(he.quotesNoneApproved)).toBeInTheDocument();
  });

  it("keeps the row checkbox label off-screen", () => {
    render(
      <Harness quotes={[quote({ id: "q1", number: "Q-0001", status: "draft" })]} canDelete />,
    );
    expect(screen.queryByText(he.quotesSelectRow("Q-0001"))).not.toBeInTheDocument();
    expect(screen.getByLabelText(he.quotesSelectRow("Q-0001"))).toBeInTheDocument();
  });

  it("marks an empty draft so it can be cleaned up", () => {
    render(<Harness quotes={[quote({ id: "q9", number: "Q-00009", status: "draft" })]} canDelete />);
    expect(screen.getByText(he.quotesDraftEmpty)).toBeInTheDocument();
    expect(screen.getByText(he.quotesDraftNoCustomer)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `${he.quoteStatuses.draft} 1` }));
    expect(screen.getByText("Q-00009")).toBeInTheDocument();
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

  it("allows delete for drafts and sent quotes but not approved", () => {
    expect(quoteIsDeletable("draft")).toBe(true);
    expect(quoteIsDeletable("sent")).toBe(true);
    expect(quoteIsDeletable("approved")).toBe(false);
  });

  it("filters search across number and notes", () => {
    const quotes = [
      quote({ id: "1", number: "Q-2026-0001", status: "draft", customer_notes: "DEMO SITE" }),
      quote({ id: "2", number: "Q-9", status: "sent", customer_notes: "רומן" }),
    ];
    expect(filterQuotes(quotes, "all", "Q-2026-0001").map((row) => row.id)).toEqual(["1"]);
    expect(filterQuotes(quotes, "all", "רומן").map((row) => row.id)).toEqual(["2"]);
    expect(filterQuotes(quotes, "all", "DEMO").map((row) => row.id)).toEqual(["1"]);
    expect(
      filterQuotes(
        [quote({ id: "3", number: "Q-3", status: "draft", title: "בקרת כניסה" })],
        "all",
        "בקרת",
      ).map((row) => row.id),
    ).toEqual(["3"]);
  });

  it("hides margin totals when cost fields are absent or only one priced draft exists", () => {
    expect(quotesMarginTotals([quote({ id: "1", number: "A", status: "draft", total_gross: 10 })])).toBeNull();
    expect(
      quotesMarginTotals([quote({ id: "1", number: "A", status: "draft", margin_amount: 4, total_gross: 10 })]),
    ).toBeNull();
    expect(
      quotesMarginTotals([quote({ id: "1", number: "A", status: "approved", margin_amount: 4, total_gross: 10 })]),
    ).toEqual({
      amount: 4,
      percent: 40,
    });
    expect(quoteDraftGap(quote({ id: "1", number: "A", status: "draft" }))).toBe("empty");
  });
});

describe("quote money helper used in KPIs", () => {
  it("formats open value in ILS", () => {
    expect(formatMoney(48250)).toMatch(/48,250/);
  });
});

describe("customer-facing quote document", () => {
  it("shows commercial fields and hides cost, margin and internal notes", () => {
    render(
      <QuoteCustomerView
        quote={{
          id: "q1",
          number: "Q-00009",
          version: 1,
          status: "draft",
          superseded: false,
          can_approve: false,
          can_reject: false,
          title: "התקנת מצלמות",
          issued_at: "2026-08-01",
          valid_until: "2026-09-01",
          currency: "ILS",
          vat_percent: 18,
          discount_type: "percent",
          discount_value: 10,
          subtotal_net: 900,
          vat_amount: 162,
          total_gross: 1062,
          company: { name: "אגיס מערכות בע״מ" },
          customer: { display_name: "רומן קופן" },
          site: { name: "אתר הרצליה", address: {} },
          project_address: "הרצליה",
          payment_terms: "שוטף 30",
          warranty: "12 חודשים",
          customer_notes: "גישה מהחניה",
          items: [
            {
              id: "i1",
              quote_id: "q1",
              description: "מצלמה",
              qty: 2,
              unit_price: 500,
              line_net: 1000,
              item_type: "catalog",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("אגיס מערכות בע״מ")).toBeInTheDocument();
    expect(screen.getByText(/Q-00009/)).toBeInTheDocument();
    expect(screen.getByText("רומן קופן")).toBeInTheDocument();
    expect(screen.getByText("אתר הרצליה")).toBeInTheDocument();
    expect(screen.getByText(he.quoteDiscount)).toBeInTheDocument();
    expect(screen.getByText(he.quoteWarranty)).toBeInTheDocument();
    expect(screen.getByText("גישה מהחניה")).toBeInTheDocument();
    expect(screen.queryByText(he.quoteCost)).not.toBeInTheDocument();
    expect(screen.queryByText(he.quoteMargin)).not.toBeInTheDocument();
    expect(screen.queryByText(he.quoteInternalNotes)).not.toBeInTheDocument();
    expect(screen.queryByText("cost_total")).not.toBeInTheDocument();
  });
});

describe("send confirmation", () => {
  it("asks to confirm with customer, number and amount before sending", () => {
    const onConfirm = vi.fn();
    render(
      <SendQuoteConfirm
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        customer="רומן קופן"
        number="Q-00009"
        amount={1062}
      />,
    );
    expect(screen.getByRole("dialog", { name: he.quoteSendTitle })).toBeInTheDocument();
    expect(screen.getByText("רומן קופן")).toBeInTheDocument();
    expect(screen.getByText("Q-00009")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: he.quoteSendAction }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
