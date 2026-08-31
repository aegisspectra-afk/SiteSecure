import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteBuilder } from "../src/components/quotes/QuoteBuilder";
import { SystemPickerModal } from "../src/components/quotes/cpq/SystemPickerModal";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

const applyQuotePackage = vi.fn();
const listQuotePackages = vi.fn();
const createQuoteSection = vi.fn();

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
  applyQuotePackage,
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
  createQuoteSection,
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
    customer_id: "c1",
    site_id: null,
    owner_user_id: "u1",
    currency: "ILS",
    items: [{ id: "i1", quote_id: "q1", item_type: "catalog", description: "קיים", qty: 1, unit_price: 100, line_net: 100 }],
    sections: [],
    validation: { can_send: false, gaps: [] },
    ...partial,
  };
}

const FEATURES = ["quotes", "catalog", "crm", "sales", "projects"];

function renderBuilder(row: QuoteOut, roleKey = "sales") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuoteBuilder quote={row} workspaceId="ws" roleKey={roleKey} features={FEATURES} />
    </QueryClientProvider>,
  );
}

describe("SystemPickerModal", () => {
  it("uses system terminology and calls apply", async () => {
    const onApply = vi.fn();
    render(
      <SystemPickerModal
        open
        onClose={() => undefined}
        systems={[
          {
            id: "sys1",
            name: "CCTV 4 Cameras",
            description: "Standard small-business CCTV installation",
            item_count: 6,
          },
        ]}
        onApply={onApply}
      />,
    );
    expect(screen.getByText("CCTV 4 Cameras")).toBeInTheDocument();
    expect(screen.getByText(he.cpqSystemItemCount(6))).toBeInTheDocument();
    expect(screen.queryByText(/Package|חבילה/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: he.cpqAddSystemToQuote }));
    expect(onApply).toHaveBeenCalledWith("sys1");
  });
});

describe("QuoteBuilder system apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listQuotePackages.mockResolvedValue({
      items: [{ id: "sys1", name: "CCTV 4 Cameras", description: "CCTV kit", item_count: 4 }],
    });
    createQuoteSection.mockResolvedValue({
      ...quote(),
      sections: [{ id: "sec-new", name: "CCTV 4 Cameras", sort_order: 10 }],
    });
    applyQuotePackage.mockResolvedValue({
      ...quote(),
      sections: [{ id: "sec-new", name: "CCTV 4 Cameras", sort_order: 10 }],
      items: [
        {
          id: "i2",
          quote_id: "q1",
          item_type: "catalog",
          description: "Camera",
          qty: 4,
          unit_price: 500,
          line_net: 2000,
          package_name: "CCTV 4 Cameras",
          section_id: "sec-new",
        },
      ],
    });
  });

  it("opens picker from toolbar and applies system with section", async () => {
    renderBuilder(quote());
    fireEvent.click(screen.getByRole("button", { name: he.cpqAddSystem }));
    await waitFor(() => expect(listQuotePackages).toHaveBeenCalled());
    const dialog = await screen.findByRole("dialog", { name: he.cpqAddSystemTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: he.cpqAddSystemToQuote }));
    await waitFor(() => expect(createQuoteSection).toHaveBeenCalled());
    expect(createQuoteSection).toHaveBeenCalledWith("ws", "q1", expect.objectContaining({ name: "CCTV 4 Cameras" }));
    await waitFor(() => expect(applyQuotePackage).toHaveBeenCalled());
    expect(applyQuotePackage).toHaveBeenCalledWith("ws", "q1", {
      package_id: "sys1",
      section_id: "sec-new",
    });
  });

  it("quick add addSystem opens picker not save-as", async () => {
    renderBuilder(quote());
    fireEvent.click(screen.getByRole("button", { name: he.cpqAddCommand }));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByRole("option", { name: new RegExp(he.cpqQuickAddAddSystem) }));
    await waitFor(() => expect(listQuotePackages).toHaveBeenCalled());
    expect(api.saveQuoteAsPackage).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: he.cpqAddSystemTitle })).toBeInTheDocument();
  });

  it("quick add template opens apply modal", async () => {
    renderBuilder(quote());
    fireEvent.click(screen.getByRole("button", { name: he.cpqAddCommand }));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByRole("option", { name: new RegExp(he.cpqQuickAddTemplate) }));
    expect(await screen.findByRole("dialog", { name: he.cpqApplyProposalTemplateTitle })).toBeInTheDocument();
  });

  it("shows save as system label for managers", async () => {
    window.prompt = vi.fn(() => "My System");
    renderBuilder(quote(), "manager");
    fireEvent.click(screen.getByRole("button", { name: he.cpqTemplateActions }));
    fireEvent.click(screen.getByRole("menuitem", { name: he.cpqSaveAsPackage }));
    await waitFor(() => expect(api.saveQuoteAsPackage).toHaveBeenCalled());
    expect(screen.queryByText("שמור כחבילה")).not.toBeInTheDocument();
  });
});
