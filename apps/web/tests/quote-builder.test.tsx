import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteBuilder } from "../src/components/quotes/QuoteBuilder";
import { he } from "../src/i18n/he";
import {
  draftHasContent,
  headerFromQuote,
  headerPatch,
  parseNonNegative,
  unsavedQuote,
} from "../src/lib/quote-builder";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <a className={className}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

const api = {
  listCustomers: vi.fn(async () => ({ items: [{ id: "c1", display_name: "לקוח א" }] })),
  getCustomer: vi.fn(async () => ({ id: "c1", display_name: "לקוח א" })),
  listSites: vi.fn(async () => ({ items: [] })),
  listCatalogProducts: vi.fn(async () => ({ items: [] })),
  listQuoteTemplates: vi.fn(async () => ({ items: [{ id: "t1", key: "apartment", name_he: "דירה", item_count: 2 }] })),
  getWorkspace: vi.fn(async () => ({
    id: "ws",
    name: "Aegis",
    status: "active",
    timezone: "Asia/Jerusalem",
    vat_percent: 18,
  })),
  createQuote: vi.fn(),
  patchQuote: vi.fn(),
  addQuoteItem: vi.fn(),
  patchQuoteItem: vi.fn(),
  deleteQuoteItem: vi.fn(),
  applyQuoteTemplate: vi.fn(),
  sendQuote: vi.fn(),
  reviseQuote: vi.fn(),
  shareQuote: vi.fn(),
  createCustomer: vi.fn(),
  createSite: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({ api }),
}));

function quote(partial: Partial<QuoteOut> = {}): QuoteOut {
  return {
    id: "q1",
    workspace_id: "ws",
    number: "Q-00001",
    status: "draft",
    customer_id: null,
    site_id: null,
    owner_user_id: "u1",
    currency: "ILS",
    items: [],
    validation: {
      can_send: false,
      gaps: [
        { field: "customer_id", code: "customer", message: "בחרו לקוח." },
        { field: "title", code: "title", message: "הוסיפו כותרת להצעה." },
      ],
    },
    ...partial,
  };
}

const FEATURES = ["quotes", "catalog", "crm", "sales"];

function renderBuilder(row: QuoteOut, roleKey = "owner") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuoteBuilder quote={row} workspaceId="ws" roleKey={roleKey} features={FEATURES} />
    </QueryClientProvider>,
  );
}

describe("quote builder helpers", () => {
  it("does not send client totals in a header patch", () => {
    const patch = headerPatch(headerFromQuote(quote({ title: "התקנה", total_gross: 999 })));
    expect(patch).not.toHaveProperty("total_gross");
    expect(patch).not.toHaveProperty("subtotal_net");
    expect(patch.title).toBe("התקנה");
  });

  it("rejects invalid quantity and discount input", () => {
    expect(parseNonNegative("2")).toBe(2);
    expect(parseNonNegative("-3")).toBe(0);
    expect(parseNonNegative("abc")).toBe(0);
    expect(parseNonNegative("NaN")).toBe(0);
  });

  it("treats an empty unsaved header as having no content", () => {
    const empty = headerFromQuote(unsavedQuote("ws"));
    expect(draftHasContent(empty)).toBe(false);
    expect(draftHasContent({ ...empty, title: "התקנה" })).toBe(true);
    expect(draftHasContent({ ...empty, discount_value: "0" })).toBe(false);
  });
});

describe("CPQ builder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows go-to-field when the quote is not sendable", () => {
    renderBuilder(quote());
    expect(screen.getByText(he.quoteSendBlocked)).toBeInTheDocument();
    expect(screen.getByText("בחרו לקוח.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.quoteGoToField }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: he.quotePreview })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.quoteSend })).toBeDisabled();
    expect(screen.getByRole("button", { name: he.quoteApplyTemplate })).toBeDisabled();
    expect(screen.getByText(he.quoteBackToList)).toBeInTheDocument();
  });

  it("opens an unsaved quote locally without creating a draft", async () => {
    vi.useFakeTimers();
    renderBuilder(unsavedQuote("ws"));
    expect(screen.getByText(he.quoteUnsaved)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.quotePreview })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(api.createQuote).not.toHaveBeenCalled();
    expect(api.listCustomers).not.toHaveBeenCalled();
    expect(api.listCatalogProducts).not.toHaveBeenCalled();
    expect(api.listQuoteTemplates).not.toHaveBeenCalled();
    expect(api.getWorkspace).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("hides cost until quotes.view_cost is granted", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <QuoteBuilder
          quote={quote({ cost_total: 80, margin_amount: 20, margin_percent: 20 })}
          workspaceId="ws"
          roleKey="sales"
          features={FEATURES}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByText(he.quoteCost)).not.toBeInTheDocument();
    expect(screen.queryByText(he.quoteMargin)).not.toBeInTheDocument();
  });
});
