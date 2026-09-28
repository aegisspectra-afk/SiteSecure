import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteBuilder } from "../src/components/quotes/QuoteBuilder";
import { SendQuoteConfirm } from "../src/components/quotes/SendQuoteConfirm";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

const api = {
  listCustomers: vi.fn(async () => ({ items: [{ id: "c1", display_name: "לקוח א" }] })),
  getCustomer: vi.fn(async () => ({ id: "c1", display_name: "לקוח א", phone: null, email: null })),
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
  reviseQuote: vi.fn(),
  shareQuote: vi.fn(async () => ({ public_url: "https://example.test/q/t", public_token: "t", status: "draft" })),
  revokeQuoteLink: vi.fn(),
  deleteQuote: vi.fn(),
  downloadQuotePdf: vi.fn(async () => ({ blob: new Blob(["%PDF"], { type: "application/pdf" }), filename: "q.pdf" })),
  recordQuoteEvent: vi.fn(async () => ({ ok: true, event_type: "preview_opened" })),
  createCustomer: vi.fn(),
  createSite: vi.fn(),
  listProjects: vi.fn(async () => ({ items: [] })),
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
  getQuoteVersionDocument: vi.fn(),
  downloadQuoteVersionPdf: vi.fn(async () => ({ blob: new Blob(["%PDF"]), filename: "v.pdf" })),
  listSystemDesigns: vi.fn(async () => ({ items: [] })),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({ api }),
}));

function quote(partial: Partial<QuoteOut> = {}): QuoteOut {
  return {
    id: "q1",
    workspace_id: "ws",
    number: "Q-00030",
    status: "draft",
    version: 1,
    currency: "ILS",
    vat_percent: 18,
    customer_id: "c1",
    site_id: "s1",
    title: "הצעה",
    valid_until: "2099-01-01",
    payment_terms: "שוטף",
    warranty: "12",
    items: [
      {
        id: "i1",
        quote_id: "q1",
        item_type: "catalog",
        description: "מצלמה",
        qty: 1,
        unit_price: 100,
        discount: 0,
        discount_type: "amount",
        sort_order: 10,
        line_net: 100,
      },
    ],
    sections: [],
    lines_subtotal: 100,
    subtotal_net: 100,
    vat_amount: 18,
    total_gross: 118,
    ...partial,
  } as QuoteOut;
}

describe("Q7-A delivery UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: !String(query).includes("max-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("separates formal send from share helpers in confirm dialog", () => {
    render(
      <SendQuoteConfirm
        open
        onClose={() => undefined}
        onConfirm={() => undefined}
        customer="לקוח"
        number="Q-1"
        amount={100}
        canSend
      />,
    );
    expect(screen.getByText(he.quoteSendTitle)).toBeTruthy();
    expect(screen.getByText(he.cpqSendHowTitle)).toBeTruthy();
    expect(screen.getByText(he.cpqSendHowLead)).toBeTruthy();
    expect(screen.getByRole("button", { name: he.quoteSendAction })).toBeTruthy();
    expect(screen.getByRole("button", { name: he.quoteWhatsAppShort })).toBeTruthy();
    expect(screen.getByRole("button", { name: he.quoteMailtoShare })).toBeTruthy();
  });

  it("shows primary send and secondary delivery actions on review stage", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <QuoteBuilder
          workspaceId="ws"
          quote={quote()}
          features={["quotes", "catalog", "crm", "sales", "projects"]}
          roleKey="owner"
        />
      </QueryClientProvider>,
    );

    // Jump to review via stepper
    const reviewBtns = screen.getAllByRole("button", { name: he.cpqStepReview });
    fireEvent.click(reviewBtns[0]!);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: he.cpqSendForApproval }).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(he.cpqDeliverySecondaryLead)).toBeTruthy();
    expect(screen.getByRole("button", { name: he.quotePdfDownload })).toBeTruthy();
    expect(screen.getByRole("button", { name: he.cpqCopyCustomerLink })).toBeTruthy();
    expect(screen.getByRole("button", { name: he.quoteWhatsAppShort })).toBeTruthy();
    expect(screen.getByText(he.cpqDeliveryNoRecipient)).toBeTruthy();
  });
});
