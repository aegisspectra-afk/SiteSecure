import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteBuilder } from "../src/components/quotes/QuoteBuilder";
import { QuoteQuickAdd } from "../src/components/quotes/cpq/QuoteQuickAdd";
import { TemplateApplyModal } from "../src/components/quotes/cpq/TemplateApplyModal";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

const addQuoteItem = vi.fn();
const listCatalogProducts = vi.fn();
const applyQuoteTemplate = vi.fn();
const listQuotePackages = vi.fn();

const api = {
  listCustomers: vi.fn(async () => ({ items: [{ id: "c1", display_name: "לקוח א" }] })),
  getCustomer: vi.fn(async () => ({ id: "c1", display_name: "לקוח א", phone: "0585378423" })),
  listCustomerContacts: vi.fn(async () => []),
  listSites: vi.fn(async () => ({ items: [{ id: "s1", name: "אתר א" }] })),
  listLeads: vi.fn(async () => ({ items: [] })),
  listCatalogProducts,
  listQuoteTemplates: vi.fn(async () => ({
    items: [{ id: "t1", key: "apartment", name_he: "דירה", item_count: 3 }],
  })),
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
  addQuoteItem,
  patchQuoteItem: vi.fn(),
  deleteQuoteItem: vi.fn(),
  applyQuoteTemplate,
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
  getQuoteVersionDocument: vi.fn(),
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
    number: "Q-00001",
    status: "draft",
    customer_id: "c1",
    site_id: "s1",
    owner_user_id: "u1",
    currency: "ILS",
    items: [],
    sections: [],
    validation: { can_send: false, gaps: [] },
    ...partial,
  };
}

const FEATURES = ["quotes", "catalog", "crm", "sales", "projects"];

function renderBuilder(row: QuoteOut, roleKey = "owner") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuoteBuilder quote={row} workspaceId="ws" roleKey={roleKey} features={FEATURES} />
    </QueryClientProvider>,
  );
}

describe("Q3 catalog fast add", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCatalogProducts.mockResolvedValue({
      items: [
        {
          id: "p1",
          name: "Camera Pro",
          sku: "CAM-4",
          model: "IPC-4MP",
          manufacturer: "Hikvision",
          selling_price: 450,
          cost: 220,
          kind: "product",
        },
      ],
    });
    addQuoteItem.mockImplementation(async (_ws: string, _qid: string, body: { product_id?: string }) =>
      quote({
        items: [
          {
            id: `i-${body.product_id || "x"}`,
            quote_id: "q1",
            item_type: "catalog",
            description: "Camera Pro",
            qty: 1,
            unit_price: 450,
            line_net: 450,
            product_id: body.product_id,
          },
        ],
      }),
    );
  });

  it("autofocuses search, shows dense catalog fields, keeps overlay for multi-add", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <QuoteQuickAdd
        open
        onClose={onClose}
        onAction={() => undefined}
        catalogResults={[
          {
            id: "p1",
            name: "Camera Pro",
            sku: "CAM-4",
            model: "IPC-4MP",
            manufacturer: "Hikvision",
            selling_price: 450,
            cost: 220,
          },
        ]}
        onCatalogQuery={() => undefined}
        onPickCatalog={onPick}
        canCatalog
        browseCatalog
        canViewCost
        currency="ILS"
      />,
    );
    const input = screen.getByPlaceholderText(he.cpqQuickAddPlaceholderCatalog);
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(screen.getByText(/CAM-4 · Camera Pro/)).toBeInTheDocument();
    expect(screen.getByText(/Hikvision/)).toBeInTheDocument();
    expect(screen.getByText(/IPC-4MP/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(he.cpqQuickAddCost))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option"));
    expect(onPick).toHaveBeenCalledWith("p1");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("hides cost when role cannot view cost", () => {
    render(
      <QuoteQuickAdd
        open
        onClose={() => undefined}
        onAction={() => undefined}
        catalogResults={[
          {
            id: "p1",
            name: "Camera Pro",
            sku: "CAM-4",
            selling_price: 450,
            cost: 220,
          },
        ]}
        onCatalogQuery={() => undefined}
        onPickCatalog={() => undefined}
        canCatalog
        browseCatalog
        canViewCost={false}
      />,
    );
    expect(screen.queryByText(new RegExp(he.cpqQuickAddCost))).not.toBeInTheDocument();
  });

  it("fast-start catalog opens browse quick-add without stacking", async () => {
    renderBuilder(quote());
    fireEvent.click(within(await screen.findByTestId("quote-fast-start")).getByRole("button", {
      name: new RegExp(he.cpqFastStartCatalog),
    }));
    await waitFor(() => expect(listCatalogProducts).toHaveBeenCalled());
    expect(screen.getByPlaceholderText(he.cpqQuickAddPlaceholderCatalog)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: he.cpqAddSystemTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: he.cpqApplyProposalTemplateTitle })).not.toBeInTheDocument();
  });
});

describe("Q3 template apply", () => {
  it("distinguishes template from package and applies once", async () => {
    const onApply = vi.fn();
    render(
      <TemplateApplyModal
        open
        onClose={() => undefined}
        templates={[{ id: "t1", key: "apartment", name_he: "דירה", item_count: 3 }]}
        onApply={onApply}
      />,
    );
    expect(screen.getByText(he.cpqTemplateVsPackageHint)).toBeInTheDocument();
    expect(screen.getByText(he.cpqTemplateStructureHint)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: he.quoteApplyTemplate }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith("t1");
  });

  it("fast-start template opens apply modal once", async () => {
    renderBuilder(quote());
    fireEvent.click(within(await screen.findByTestId("quote-fast-start")).getByRole("button", {
      name: new RegExp(he.cpqFastStartTemplate),
    }));
    const dialog = await screen.findByRole("dialog", { name: he.cpqApplyProposalTemplateTitle });
    expect(within(dialog).getByText(he.cpqTemplateVsPackageHint)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: he.cpqAddSystemTitle })).not.toBeInTheDocument();
  });
});

describe("Q3 package apply from fast-start", () => {
  beforeEach(() => {
    listQuotePackages.mockResolvedValue({
      items: [
        {
          id: "sys1",
          name: "CCTV 4 Cameras",
          item_count: 4,
          items_preview: [{ description: "Camera", qty: 4 }],
        },
      ],
    });
  });

  it("opens package picker from fast-start", async () => {
    renderBuilder(quote());
    fireEvent.click(within(await screen.findByTestId("quote-fast-start")).getByRole("button", {
      name: new RegExp(he.cpqFastStartPackage),
    }));
    await waitFor(() => expect(listQuotePackages).toHaveBeenCalled());
    const dialog = await screen.findByRole("dialog", { name: he.cpqAddSystemTitle });
    expect(within(dialog).getAllByText(/Camera/).length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText(he.cpqQuickAddPlaceholderCatalog)).not.toBeInTheDocument();
  });
});
