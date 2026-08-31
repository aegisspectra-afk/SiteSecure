import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteBuilder } from "../src/components/quotes/QuoteBuilder";
import { he } from "../src/i18n/he";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useNavigate: () => navigate,
}));

const listQuotePackages = vi.fn();

const api = {
  listCustomers: vi.fn(async () => ({ items: [{ id: "c1", display_name: "לקוח א" }] })),
  getCustomer: vi.fn(async () => ({ id: "c1", display_name: "לקוח א", phone: "0585378423" })),
  listCustomerContacts: vi.fn(async () => []),
  listSites: vi.fn(async () => ({ items: [] as { id: string; name: string }[] })),
  listLeads: vi.fn(async () => ({ items: [] })),
  listCatalogProducts: vi.fn(async () => ({ items: [] })),
  listQuoteTemplates: vi.fn(async () => ({ items: [{ id: "t1", key: "apartment", name_he: "דירה", item_count: 2 }] })),
  listQuotePackages,
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
  shareQuote: vi.fn(),
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
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({ api }),
}));

const FEATURES = ["quotes", "catalog", "crm", "sales", "projects"];

function quote(partial: Partial<QuoteOut> = {}): QuoteOut {
  return {
    id: "q1",
    workspace_id: "ws",
    number: "Q-00001",
    status: "draft",
    customer_id: "c1",
    site_id: null,
    owner_user_id: "u1",
    currency: "ILS",
    title: "התקנה",
    valid_until: "2099-01-01",
    payment_terms: "מזומן",
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
    validation: { can_send: true, gaps: [] },
    total_gross: 118,
    ...partial,
  };
}

function mockViewport(desktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: desktop ? query.includes("min-width: 1024px") : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  window.innerWidth = desktop ? 1280 : 390;
}

function renderBuilder(row: QuoteOut, roleKey = "owner") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuoteBuilder quote={row} workspaceId="ws" roleKey={roleKey} features={FEATURES} />
    </QueryClientProvider>,
  );
}

function mobileToolbar() {
  return screen.getByRole("toolbar", { name: he.cpqMobileActionsBarAria });
}

function openMobileOverflow() {
  fireEvent.click(within(mobileToolbar()).getByRole("button", { name: he.cpqMoreActionsAria }));
}

describe("Quote mobile actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockViewport(false);
    listQuotePackages.mockResolvedValue({
      items: [{ id: "sys1", name: "CCTV 4 Cameras", description: "CCTV kit", item_count: 4 }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces send, preview, and add directly on mobile", () => {
    renderBuilder(quote({ validation: { can_send: false, gaps: [{ field: "title", code: "title", message: "x" }] } }));
    const toolbar = mobileToolbar();
    expect(within(toolbar).getByRole("button", { name: he.cpqSendForApproval })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: he.quotePreviewPrimary })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: he.cpqAddCommand })).toBeInTheDocument();
  });

  it("disables send when quote is not ready", () => {
    renderBuilder(quote({ validation: { can_send: false, gaps: [{ field: "title", code: "title", message: "x" }] } }));
    expect(within(mobileToolbar()).getByRole("button", { name: he.cpqSendForApproval })).toBeDisabled();
  });

  it("enables send when quote is ready", () => {
    renderBuilder(quote());
    expect(within(mobileToolbar()).getByRole("button", { name: he.cpqSendForApproval })).toBeEnabled();
  });

  it("opens add menu with item, system, section, and build system", () => {
    renderBuilder(quote());
    fireEvent.click(within(mobileToolbar()).getByRole("button", { name: he.cpqAddCommand }));
    const menu = screen.getByRole("menu", { name: he.cpqMobileAddMenuAria });
    expect(within(menu).getByRole("menuitem", { name: he.cpqMobileAddItem })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: he.cpqMobileAddSystem })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: he.cpqMobileAddSection })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: he.cpqBuildSystem })).toBeInTheDocument();
  });

  it("opens system picker from mobile add menu", async () => {
    renderBuilder(quote());
    fireEvent.click(within(mobileToolbar()).getByRole("button", { name: he.cpqAddCommand }));
    fireEvent.click(screen.getByRole("menuitem", { name: he.cpqMobileAddSystem }));
    await waitFor(() => expect(listQuotePackages).toHaveBeenCalled());
    expect(screen.getByRole("dialog", { name: he.cpqAddSystemTitle })).toBeInTheDocument();
  });

  it("preview action is reachable from mobile toolbar", () => {
    renderBuilder(quote());
    fireEvent.click(within(mobileToolbar()).getByRole("button", { name: he.quotePreviewPrimary }));
    expect(navigate).toHaveBeenCalledWith({
      to: "/app/quotes/$quoteId/preview",
      params: { quoteId: "q1" },
    });
  });

  it("keeps low-frequency actions in overflow", () => {
    renderBuilder(quote());
    openMobileOverflow();
    expect(screen.getByRole("menuitem", { name: he.save })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: he.quotePdfDownload })).toBeInTheDocument();
  });

  it("does not show header hamburger on mobile", () => {
    renderBuilder(quote());
    expect(screen.queryByRole("button", { name: he.cpqHeaderMenuAria })).not.toBeInTheDocument();
  });

  it("keeps desktop header actions without mobile toolbar", () => {
    mockViewport(true);
    renderBuilder(quote());
    expect(screen.queryByRole("toolbar", { name: he.cpqMobileActionsBarAria })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.cpqMoreActionsAria })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.cpqSendForApproval }).length).toBeGreaterThanOrEqual(2);
  });
});
