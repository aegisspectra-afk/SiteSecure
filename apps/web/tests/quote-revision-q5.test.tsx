import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteBuilder } from "../src/components/quotes/QuoteBuilder";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

const reviseQuote = vi.fn(async () =>
  quote({ status: "draft", version: 2, sent_at: null, viewed_at: null, approved_at: null }),
);

const api = {
  listCustomers: vi.fn(async () => ({ items: [{ id: "c1", display_name: "לקוח א" }] })),
  getCustomer: vi.fn(async () => ({ id: "c1", display_name: "לקוח א", phone: "0500000000" })),
  listCustomerContacts: vi.fn(async () => []),
  listSites: vi.fn(async () => ({ items: [{ id: "s1", name: "אתר 1" }] })),
  listLeads: vi.fn(async () => ({ items: [] })),
  listCatalogProducts: vi.fn(async () => ({ items: [] })),
  listQuoteTemplates: vi.fn(async () => ({ items: [] })),
  listQuotePackages: vi.fn(async () => ({ items: [] })),
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
  applyQuotePackage: vi.fn(),
  sendQuote: vi.fn(),
  reviseQuote,
  shareQuote: vi.fn(),
  revokeQuoteLink: vi.fn(),
  deleteQuote: vi.fn(),
  downloadQuotePdf: vi.fn(async () => ({ blob: new Blob(["%PDF"], { type: "application/pdf" }), filename: "q.pdf" })),
  recordQuoteEvent: vi.fn(async () => ({ ok: true, event_type: "preview_opened" })),
  createCustomer: vi.fn(),
  createSite: vi.fn(),
  listProjects: vi.fn(async () => ({ items: [] })),
  createProjectFromQuote: vi.fn(),
  listQuoteEvents: vi.fn(async () => ({ items: [] })),
  createQuoteSection: vi.fn(),
  patchQuoteSection: vi.fn(),
  deleteQuoteSection: vi.fn(),
  duplicateQuoteSection: vi.fn(),
  saveQuoteAsTemplate: vi.fn(),
  saveQuoteAsPackage: vi.fn(),
  overrideQuoteMargin: vi.fn(),
  compareQuoteVersions: vi.fn(async () => ({
    from_version: 1,
    to_version: 2,
    total_from: 500,
    total_to: 600,
    changes: [{ key: "CAM-1", change: "modified", from: { qty: 1 }, to: { qty: 2 } }],
  })),
  listQuoteVersions: vi.fn(async () => ({
    items: [
      {
        id: "v1",
        version: 1,
        created_at: "2026-09-01T10:00:00Z",
        snapshot_status: "sent",
        total_gross: 500,
      },
    ],
    current_version: 2,
    current_status: "draft",
  })),
  getQuoteVersionDocument: vi.fn(async () => ({
    id: "q1",
    number: "Q-00020",
    version: 1,
    status: "sent",
    historical: true,
    currency: "ILS",
    subtotal_net: 500,
    vat_amount: 0,
    total_gross: 500,
    items: [{ id: "i1", description: "מצלמה", qty: 1, unit_price: 500, line_net: 500 }],
    sections: [],
    company: { name: "Aegis" },
    customer: { display_name: "לקוח א" },
  })),
  downloadQuoteVersionPdf: vi.fn(async () => new Blob(["%PDF"], { type: "application/pdf" })),
  listSystemDesigns: vi.fn(async () => ({ items: [] })),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({ api }),
}));

function quote(partial: Partial<QuoteOut> = {}): QuoteOut {
  return {
    id: "q1",
    workspace_id: "ws",
    number: "Q-00020",
    status: "rejected",
    version: 1,
    currency: "ILS",
    vat_percent: 18,
    customer_id: "c1",
    site_id: "s1",
    title: "הצעה",
    items: [],
    sections: [],
    lines_subtotal: 500,
    subtotal_net: 500,
    vat_amount: 0,
    total_gross: 500,
    ...partial,
  } as QuoteOut;
}

function renderBuilder(row: QuoteOut) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuoteBuilder
        workspaceId="ws"
        quote={row}
        features={["quotes", "catalog", "crm", "sales", "projects"]}
        roleKey="owner"
      />
    </QueryClientProvider>,
  );
}

describe("Q5 revision UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("shows revision badge and confirms before revise", async () => {
    renderBuilder(quote({ status: "rejected", version: 1 }));
    expect(screen.getAllByText(he.quotesVersion(1)).length).toBeGreaterThan(0);
    const reviseButtons = screen.getAllByRole("button", { name: he.quoteRevise });
    fireEvent.click(reviseButtons[0]!);
    expect(window.confirm).toHaveBeenCalledWith(he.quoteReviseConfirm);
    await waitFor(() => expect(reviseQuote).toHaveBeenCalled());
  });

  it("cancels revise when confirmation is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderBuilder(quote({ status: "rejected", version: 1 }));
    fireEvent.click(screen.getAllByRole("button", { name: he.quoteRevise })[0]!);
    expect(reviseQuote).not.toHaveBeenCalled();
  });

  it("loads revision timeline and historical document from snapshots", async () => {
    renderBuilder(quote({ status: "draft", version: 2 }));
    fireEvent.click(screen.getAllByRole("button", { name: he.cpqMoreActionsAria })[0]!);
    fireEvent.click(screen.getByRole("menuitem", { name: he.cpqVersionHistory }));
    await waitFor(() => expect(api.listQuoteVersions).toHaveBeenCalled());
    expect(await screen.findByText(he.cpqVersionTimeline)).toBeTruthy();
    expect(screen.getByText(he.cpqRevisionHistorical)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: he.cpqViewHistorical }));
    await waitFor(() => expect(api.getQuoteVersionDocument).toHaveBeenCalledWith("ws", "q1", 1));
    expect(await screen.findByText(he.cpqHistoricalReadOnly)).toBeTruthy();
  });
});
