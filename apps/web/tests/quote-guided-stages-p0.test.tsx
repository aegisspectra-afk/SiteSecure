import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteBuilder } from "../src/components/quotes/QuoteBuilder";
import { he } from "../src/i18n/he";
import { unsavedQuote } from "../src/lib/quote-builder";
import {
  adjacentQuoteWorkspaceStep,
  initialQuoteWorkspaceStep,
} from "../src/components/quotes/workspace/types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

const createQuote = vi.fn();
const api = {
  listCustomers: vi.fn(async () => ({ items: [] })),
  getCustomer: vi.fn(),
  listCustomerContacts: vi.fn(async () => []),
  listSites: vi.fn(async () => ({ items: [] })),
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
  createQuote,
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
    sections: [],
    validation: { can_send: false, gaps: [] },
    ...partial,
  };
}

const FEATURES = ["quotes", "catalog", "crm", "sales", "projects"];

function renderBuilder(row: QuoteOut) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuoteBuilder quote={row} workspaceId="ws" roleKey="sales" features={FEATURES} />
    </QueryClientProvider>,
  );
}

function clickStage(name: string) {
  fireEvent.click(screen.getAllByRole("button", { name })[0]!);
}

describe("guided workspace helpers", () => {
  it("picks initial stage from item count", () => {
    expect(initialQuoteWorkspaceStep(0)).toBe("details");
    expect(initialQuoteWorkspaceStep(2)).toBe("items");
  });

  it("computes adjacent stages without wrapping", () => {
    expect(adjacentQuoteWorkspaceStep("details", -1)).toBeNull();
    expect(adjacentQuoteWorkspaceStep("details", 1)).toBe("items");
    expect(adjacentQuoteWorkspaceStep("review", 1)).toBeNull();
  });
});

describe("QuoteBuilder guided stages P0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens empty draft on Stage 1 and keeps Stage 2 composition inactive", () => {
    renderBuilder(quote());
    expect(screen.getAllByRole("button", { name: he.cpqWorkflowDetails, current: "step" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: he.quoteApplyTemplate })).toBeDisabled();
    const items = document.getElementById("quote-items");
    expect(items?.closest("[data-active]")?.getAttribute("data-active")).toBe("false");
  });

  it("opens populated draft on Stage 2", () => {
    renderBuilder(
      quote({
        items: [
          {
            id: "i1",
            quote_id: "q1",
            item_type: "catalog",
            description: "מצלמה",
            qty: 1,
            unit_price: 100,
            line_net: 100,
          },
        ],
      }),
    );
    expect(screen.getAllByRole("button", { name: he.cpqWorkflowContent, current: "step" }).length).toBeGreaterThan(0);
    const items = document.getElementById("quote-items");
    expect(items?.closest("[data-active]")?.getAttribute("data-active")).toBe("true");
  });

  it("switches stages freely without createOnce", () => {
    renderBuilder(unsavedQuote("ws"));
    clickStage(he.cpqWorkflowContent);
    clickStage(he.cpqWorkflowPricing);
    clickStage(he.cpqWorkflowChecks);
    fireEvent.click(screen.getAllByRole("button", { name: he.cpqStageBack })[0]!);
    expect(createQuote).not.toHaveBeenCalled();
  });

  it("keeps composition mounted while inactive for dirty-state safety", () => {
    renderBuilder(quote());
    const items = document.getElementById("quote-items");
    expect(items).toBeTruthy();
    expect(items?.closest(".cpq-stage-panel")?.hasAttribute("hidden")).toBe(true);
    clickStage(he.cpqWorkflowContent);
    expect(items?.closest(".cpq-stage-panel")?.hasAttribute("hidden")).toBe(false);
  });

  it("shows readiness primarily on Stage 4", () => {
    renderBuilder(quote());
    expect(screen.queryByRole("region", { name: he.cpqReadinessTitle })).not.toBeInTheDocument();
    clickStage(he.cpqWorkflowChecks);
    expect(screen.getByRole("region", { name: he.cpqReadinessTitle })).toBeInTheDocument();
  });

  it("preserves title draft across stage switches", () => {
    renderBuilder(quote());
    const title = screen.getByLabelText(he.quoteTitle);
    fireEvent.change(title, { target: { value: "הצעת בדיקה" } });
    clickStage(he.cpqWorkflowContent);
    clickStage(he.cpqWorkflowDetails);
    expect((screen.getByLabelText(he.quoteTitle) as HTMLInputElement).value).toBe("הצעת בדיקה");
    expect(createQuote).not.toHaveBeenCalled();
  });
});
