import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteBuilder } from "../src/components/quotes/QuoteBuilder";
import { he } from "../src/i18n/he";
import {
  quoteLifecycleStatusLabel,
  resolveQuoteLifecyclePrimary,
} from "../src/lib/quote-lifecycle";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

const createProjectFromQuote = vi.fn();
const listProjects = vi.fn(async () => ({ items: [] as Array<{ id: string; name: string }> }));

const api = {
  listCustomers: vi.fn(async () => ({ items: [{ id: "c1", display_name: "לקוח א" }] })),
  getCustomer: vi.fn(async () => ({ id: "c1", display_name: "לקוח א", phone: "0585378423" })),
  listCustomerContacts: vi.fn(async () => []),
  listSites: vi.fn(async () => ({ items: [{ id: "s1", name: "אתר 1", address: "רחוב 1" }] })),
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
  shareQuote: vi.fn(),
  revokeQuoteLink: vi.fn(),
  deleteQuote: vi.fn(),
  downloadQuotePdf: vi.fn(async () => ({ blob: new Blob(["%PDF"], { type: "application/pdf" }), filename: "q.pdf" })),
  recordQuoteEvent: vi.fn(async () => ({ ok: true, event_type: "preview_opened" })),
  createCustomer: vi.fn(),
  createSite: vi.fn(),
  listProjects,
  createProjectFromQuote,
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
    site_id: "s1",
    owner_user_id: "u1",
    currency: "ILS",
    items: [{ id: "i1", quote_id: "q1", item_type: "catalog", description: "קיים", qty: 1, unit_price: 100, line_net: 100 }],
    validation: { can_send: true, gaps: [] },
    ...partial,
  };
}

function mockMobileViewport() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("min-width: 1024px") ? false : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderBuilder(row: QuoteOut, roleKey = "owner") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuoteBuilder quote={row} workspaceId="ws" roleKey={roleKey} features={FEATURES} />
    </QueryClientProvider>,
  );
}

describe("quote lifecycle helpers", () => {
  it("maps sent status to waiting label", () => {
    expect(quoteLifecycleStatusLabel("sent", false)).toBe(he.cpqWaitingForApproval);
  });

  it("resolves create project for approved quote without linked project", () => {
    const action = resolveQuoteLifecyclePrimary({
      status: "approved",
      siteId: "s1",
      linkedProjectId: null,
      canCreateProject: true,
      canViewProjects: true,
      canRevise: true,
      canSend: true,
      canSendNow: true,
    });
    expect(action.kind).toBe("create_project");
    expect(action.label).toBe(he.workflowCreateProject);
  });

  it("resolves select site when approved without site", () => {
    const action = resolveQuoteLifecyclePrimary({
      status: "approved",
      siteId: null,
      linkedProjectId: null,
      canCreateProject: true,
      canViewProjects: true,
      canRevise: true,
      canSend: true,
      canSendNow: true,
    });
    expect(action.kind).toBe("select_site");
  });

  it("resolves open project when linked project exists", () => {
    const action = resolveQuoteLifecyclePrimary({
      status: "approved",
      siteId: "s1",
      linkedProjectId: "p1",
      canCreateProject: true,
      canViewProjects: true,
      canRevise: true,
      canSend: true,
      canSendNow: true,
    });
    expect(action.kind).toBe("open_project");
  });
});

describe("QuoteBuilder lifecycle continuity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProjects.mockResolvedValue({ items: [] });
    createProjectFromQuote.mockResolvedValue({ id: "p1", name: "פרויקט", status: "planned" });
  });

  it("shows approved state banner and create project primary action", () => {
    renderBuilder(
      quote({
        status: "approved",
        approved_at: "2026-08-31T10:00:00Z",
        approved_name: "ישראל ישראלי",
        version: 2,
        site_id: "s1",
      }),
    );
    expect(screen.getByText(he.cpqLifecycleApprovedTitle)).toBeInTheDocument();
    expect(screen.getByText(he.cpqLifecycleApprovedBy("ישראל ישראלי"))).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.workflowCreateProject }).length).toBeGreaterThan(0);
  });

  it("shows select site primary when approved without site", () => {
    renderBuilder(quote({ status: "approved", site_id: null }));
    expect(screen.getAllByRole("button", { name: he.cpqSelectSiteForProject }).length).toBeGreaterThan(0);
    expect(screen.getByText(he.cpqSelectSiteBeforeProject)).toBeInTheDocument();
  });

  it("shows open project instead of create when project exists", async () => {
    listProjects.mockResolvedValue({ items: [{ id: "p1", name: "פרויקט מקושר" }] });
    renderBuilder(quote({ status: "approved", site_id: "s1" }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: he.workflowOpenProject }).length).toBeGreaterThan(0),
    );
    expect(screen.queryByRole("button", { name: he.workflowCreateProject })).not.toBeInTheDocument();
  });

  it("shows rejected banner with reason and revise action", () => {
    renderBuilder(
      quote({
        status: "rejected",
        rejection_reason: "המחיר גבוה מדי",
        rejected_at: "2026-08-31T09:00:00Z",
      }),
    );
    expect(screen.getByText(he.cpqLifecycleRejectedTitle)).toBeInTheDocument();
    expect(screen.getByText("המחיר גבוה מדי")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.quoteRevise }).length).toBeGreaterThan(0);
  });

  it("shows waiting banner for sent quote", () => {
    renderBuilder(quote({ status: "sent", sent_at: "2026-08-31T08:00:00Z" }));
    expect(screen.getByLabelText(he.cpqWaitingForApproval)).toBeInTheDocument();
    expect(screen.getByText(he.cpqLifecycleWaitingHint)).toBeInTheDocument();
  });

  it("approved create project reachable on mobile toolbar", async () => {
    mockMobileViewport();
    renderBuilder(quote({ status: "approved", site_id: "s1" }));
    const toolbar = screen.getByRole("toolbar", { name: he.cpqMobileActionsBarAria });
    expect(within(toolbar).getByRole("button", { name: he.workflowCreateProject })).toBeInTheDocument();
  });

  it("does not show create project for sales role without projects.create", () => {
    renderBuilder(quote({ status: "approved", site_id: "s1" }), "sales");
    expect(screen.queryByRole("button", { name: he.workflowCreateProject })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.cpqApprovedCta }).length).toBeGreaterThan(0);
  });
});
