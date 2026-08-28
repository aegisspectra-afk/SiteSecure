import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  quotePrimaryCtaKind,
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
  getCustomer: vi.fn(async () => ({ id: "c1", display_name: "לקוח א", phone: "0585378423" })),
  listCustomerContacts: vi.fn(async () => []),
  listSites: vi.fn(async () => ({ items: [] as { id: string; name: string }[] })),
  listLeads: vi.fn(async () => ({ items: [] })),
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
  revokeQuoteLink: vi.fn(),
  deleteQuote: vi.fn(),
  downloadQuotePdf: vi.fn(async () => ({ blob: new Blob(["%PDF"], { type: "application/pdf" }), filename: "q.pdf" })),
  recordQuoteEvent: vi.fn(async () => ({ ok: true, event_type: "preview_opened" })),
  createCustomer: vi.fn(),
  createSite: vi.fn(),
  listProjects: vi.fn(async () => ({ items: [] as Array<{ id: string; name: string; status?: string; customer_id?: string; workspace_id?: string; created_at?: string; updated_at?: string }> })),
  listQuoteEvents: vi.fn(async () => ({ items: [] })),
  createQuoteSection: vi.fn(),
  patchQuoteSection: vi.fn(),
  deleteQuoteSection: vi.fn(),
  duplicateQuoteSection: vi.fn(),
  saveQuoteAsTemplate: vi.fn(),
  saveQuoteAsPackage: vi.fn(),
  overrideQuoteMargin: vi.fn(),
  compareQuoteVersions: vi.fn(),
  listQuoteVersions: vi.fn(async () => ({ items: [], current_version: 1 })),
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

const FEATURES = ["quotes", "catalog", "crm", "sales", "projects"];

function renderBuilder(
  row: QuoteOut,
  roleKey = "owner",
  extra?: { initialCustomerId?: string; initialSiteId?: string },
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuoteBuilder
        quote={row}
        workspaceId="ws"
        roleKey={roleKey}
        features={FEATURES}
        initialCustomerId={extra?.initialCustomerId}
        initialSiteId={extra?.initialSiteId}
      />
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

  it("sends null to clear customer and site FKs", () => {
    const draft = headerFromQuote(quote({ customer_id: "c1", site_id: "s1", title: "x" }));
    draft.customer_id = "";
    draft.site_id = "";
    const patch = headerPatch(draft);
    expect(patch.customer_id).toBeNull();
    expect(patch.site_id).toBeNull();
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

  it("shows go-to-field when the quote is not sendable", async () => {
    renderBuilder(quote());
    expect(screen.getByText(he.cpqReadinessTitle)).toBeInTheDocument();
    const readiness = screen.getByRole("region", { name: he.cpqReadinessTitle });
    expect(within(readiness).getByRole("button", { name: new RegExp(he.cpqReadinessCustomer) })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.cpqCustomerView }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: he.quoteApplyTemplate })).toBeDisabled();
    expect(screen.getByRole("heading", { name: he.cpqHeaderTitle("Q-00001") })).toBeInTheDocument();
    expect(screen.getByText(he.cpqEmptyTitle)).toBeInTheDocument();

    const submitButtons = screen.getAllByRole("button", { name: he.cpqSendForApproval });
    expect(submitButtons.length).toBeGreaterThanOrEqual(2);
    submitButtons.forEach((button) => expect(button).toBeEnabled());

    fireEvent.click(submitButtons[0]);
    expect(within(readiness).getByRole("alert")).toHaveTextContent(he.cpqSendBlockedHint(2));
  });

  it("opens an unsaved quote locally without creating a draft", async () => {
    vi.useFakeTimers();
    renderBuilder(unsavedQuote("ws"));
    expect(screen.getByText(he.quoteUnsaved)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.cpqCustomerView })[0]).toBeDisabled();
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

  it("maps quote status to the correct primary CTA", () => {
    expect(quotePrimaryCtaKind("draft")).toBe("send");
    expect(quotePrimaryCtaKind("sent")).toBe("show_link");
    expect(quotePrimaryCtaKind("viewed")).toBe("show_activity");
    expect(quotePrimaryCtaKind("approved")).toBe("approved");
    expect(quotePrimaryCtaKind("expired")).toBe("revise");
    expect(quotePrimaryCtaKind("cancelled")).toBe("cancelled");
  });

  it("shows show-link CTA for a sent quote instead of send", async () => {
    renderBuilder(quote({ status: "sent", customer_id: "c1", number: "Q-00012", version: 2 }));
    expect(screen.getByRole("heading", { name: he.cpqHeaderTitle("Q-00012") })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.cpqShowLink }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: he.cpqSendForApproval })).not.toBeInTheDocument();
  });

  it("shows approved CTA when quote is approved", () => {
    renderBuilder(quote({ status: "approved", customer_id: "c1", number: "Q-00012" }));
    expect(screen.getAllByRole("button", { name: he.cpqApprovedCta }).length).toBeGreaterThan(0);
  });

  it("seeds customer context from initial props", async () => {
    api.listSites.mockResolvedValueOnce({ items: [{ id: "s1", name: "אתר 1" }] });
    renderBuilder(unsavedQuote("ws", { customerId: "c1" }), "owner", { initialCustomerId: "c1" });
    await waitFor(() => expect(api.getCustomer).toHaveBeenCalled());
    await waitFor(() => expect(document.getElementById("customer_id")).toBeTruthy());
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

  it("shows create project CTA on approved quote without linked project", async () => {
    api.listProjects.mockResolvedValue({ items: [] });
    renderBuilder(quote({ status: "approved", customer_id: "c1", title: "מצלמות", number: "1042" }));
    await waitFor(() => expect(api.listProjects).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: he.workflowCreateProject })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.workflowOpenProjectArrow })).not.toBeInTheDocument();
  });

  it("shows open project CTA when linked project exists", async () => {
    api.listProjects.mockResolvedValue({
      items: [
        {
          id: "p1",
          name: "פרויקט",
          status: "planned",
          customer_id: "c1",
          workspace_id: "ws",
          created_at: "",
          updated_at: "",
        },
      ],
    });
    renderBuilder(quote({ status: "approved", customer_id: "c1", number: "1042" }));
    await waitFor(() => expect(screen.getByRole("button", { name: he.workflowOpenProjectArrow })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: he.workflowCreateProject })).not.toBeInTheDocument();
  });

  it("does not show create project on draft quotes", () => {
    renderBuilder(quote({ status: "draft" }));
    expect(screen.queryByRole("button", { name: he.workflowCreateProject })).not.toBeInTheDocument();
  });
});
