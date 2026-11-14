import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteBuilder } from "../src/components/quotes/QuoteBuilder";
import { QuotesWorkspace } from "../src/components/quotes/QuotesWorkspace";
import { QuoteSaveIndicator, formatSavedTime } from "../src/components/quotes/workspace/QuoteSaveIndicator";
import { initialQuoteWorkspaceStep } from "../src/components/quotes/workspace/types";
import { he } from "../src/i18n/he";
import { unsavedQuote } from "../src/lib/quote-builder";
import type { QuoteTab } from "../src/lib/quote-workspace";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to }: { children: ReactNode; className?: string; to?: string }) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

const api = {
  listCustomers: vi.fn(async () => ({ items: [] })),
  getCustomer: vi.fn(async () => ({ id: "c1", display_name: "לקוח" })),
  listCustomerContacts: vi.fn(async () => []),
  listSites: vi.fn(async () => ({ items: [] })),
  listLeads: vi.fn(async () => ({ items: [] })),
  listCatalogProducts: vi.fn(async () => ({ items: [] })),
  listQuoteTemplates: vi.fn(async () => ({ items: [] })),
  listQuotePackages: vi.fn(async () => ({ items: [] })),
  getWorkspace: vi.fn(async () => ({ id: "ws", name: "Aegis", status: "active", timezone: "Asia/Jerusalem", vat_percent: 18 })),
  createQuote: vi.fn(),
  patchQuote: vi.fn(),
  addQuoteItem: vi.fn(),
  patchQuoteItem: vi.fn(),
  deleteQuoteItem: vi.fn(),
  listProjects: vi.fn(async () => ({ items: [] })),
  listQuoteEvents: vi.fn(async () => ({ items: [] })),
  listQuoteVersions: vi.fn(async () => ({ items: [], current_version: 1 })),
  recordQuoteEvent: vi.fn(async () => ({ ok: true })),
  createCustomer: vi.fn(),
  createSite: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({ api, session: { memberships: [{ workspace_id: "ws" }] } }),
}));

vi.mock("../src/components/quotes/quote-creation/NewQuoteDialog", () => ({
  CreateQuoteDialog: () => null,
  NewQuoteDialog: () => null,
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
    items: [],
    sections: [],
    validation: { can_send: false, gaps: [] },
    updated_at: "2026-11-14T21:58:00Z",
    ...partial,
  };
}

const ITEM = {
  id: "i1",
  description: "מצלמה",
  quantity: 1,
  unit_price: 100,
  line_total: 100,
  kind: "product",
} as unknown as NonNullable<QuoteOut["items"]>[number];

function renderBuilder(row: QuoteOut, props: Partial<Parameters<typeof QuoteBuilder>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuoteBuilder quote={row} workspaceId="ws" roleKey="owner" features={FEATURES} {...props} />
    </QueryClientProvider>,
  );
}

function header(container: HTMLElement) {
  return container.querySelector("header.cpq-builder-header") as HTMLElement;
}

beforeEach(() => vi.clearAllMocks());

describe("Q1.1 customer + site in the URL open on step 2", () => {
  it("helper starts at items only when both are known", () => {
    expect(initialQuoteWorkspaceStep(0, { customerId: "c1", siteId: "s1" })).toBe("items");
    expect(initialQuoteWorkspaceStep(0, { customerId: "c1" })).toBe("details");
    expect(initialQuoteWorkspaceStep(0)).toBe("details");
  });

  it("the builder opens on 'תכנון וציוד' for /app/quotes/new?customerId&siteId", () => {
    renderBuilder(unsavedQuote("ws", { customerId: "c1", siteId: "s1" }), {
      initialCustomerId: "c1",
      initialSiteId: "s1",
    });
    expect(screen.getAllByRole("button", { name: he.cpqWorkflowContent, current: "step" }).length).toBeGreaterThan(0);
  });

  it("an existing empty quote with customer + site still opens on step 1 (template fast path)", () => {
    renderBuilder(quote({ customer_id: "c1", site_id: "s1" }));
    expect(screen.getAllByRole("button", { name: he.cpqWorkflowDetails, current: "step" }).length).toBeGreaterThan(0);
  });
});

describe("Q1.2 send and customer view need items", () => {
  it("are disabled with a reason when the quote has no items", () => {
    const { container } = renderBuilder(quote());
    const view = within(header(container)).getByRole("button", { name: he.cpqCustomerView });
    expect(view).toBeDisabled();
    expect(view.closest("[title]")).toHaveAttribute("title", he.quoteNeedsItemsHint);
    const send = header(container).querySelector(".cpq-header-primary-cta") as HTMLButtonElement;
    expect(send).toBeDisabled();
    expect(send.closest("[data-disabled-reason]")).toHaveAttribute("data-disabled-reason", he.quoteNeedsItemsHint);
  });

  it("customer view is enabled once there is an item", () => {
    const { container } = renderBuilder(quote({ items: [ITEM] }));
    expect(within(header(container)).getByRole("button", { name: he.cpqCustomerView })).toBeEnabled();
  });
});

describe("Q1.3 autosave, no manual save button", () => {
  it("has no 'שמירה' button in the header", () => {
    const { container } = renderBuilder(quote({ items: [ITEM] }));
    expect(within(header(container)).queryByRole("button", { name: he.save })).not.toBeInTheDocument();
  });

  it("shows the time of the last save from the server row", () => {
    const { container } = renderBuilder(quote({ items: [ITEM] }));
    const at = Date.parse("2026-11-14T21:58:00Z");
    expect(within(header(container)).getByTestId("quote-save-indicator")).toHaveTextContent(
      he.cpqSavedAt(formatSavedTime(at)),
    );
  });

  it("formats 'נשמר · HH:MM'", () => {
    const at = new Date(2026, 10, 14, 23, 58).getTime();
    render(<QuoteSaveIndicator saveState="saved" savedAt={at} dirty={false} hasLiveId />);
    expect(screen.getByText("נשמר · 23:58")).toBeInTheDocument();
  });

  it("autosaves the draft after a pause, without a click", async () => {
    vi.useFakeTimers();
    try {
      api.patchQuote.mockResolvedValue(quote({ title: "חדש" }));
      renderBuilder(quote({ items: [ITEM] }));
      fireEvent.change(screen.getByLabelText(he.quoteNameOptional), { target: { value: "חדש" } });
      expect(api.patchQuote).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1000);
      expect(api.patchQuote).toHaveBeenCalledWith("ws", "q1", expect.objectContaining({ title: "חדש" }));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Q1.4 one 'טיוטה' label", () => {
  it("the save line never says 'טיוטה'; the status chip does", () => {
    const { container } = renderBuilder(unsavedQuote("ws", {}));
    expect(within(header(container)).getByTestId("quote-save-indicator").textContent).not.toContain("טיוטה");
    const desktop = header(container).querySelector(".cpq-header-identity-desktop") as HTMLElement;
    expect(within(desktop).getAllByText(/טיוטה/)).toHaveLength(1);
  });
});

describe("Q1.5 number placeholder", () => {
  it("says the number is assigned on save", () => {
    const { container } = renderBuilder(unsavedQuote("ws", {}));
    expect(within(header(container)).getByText("המספר יוקצה בשמירה")).toBeInTheDocument();
    expect(screen.queryByText("ללא מספר")).not.toBeInTheDocument();
  });
});

describe("Q1.6 optional quote name", () => {
  it("is labeled 'שם ההצעה (אופציונלי)' on step 1", () => {
    renderBuilder(unsavedQuote("ws", {}));
    expect(screen.getByLabelText(he.quoteNameOptional)).toBeInTheDocument();
  });

  it("shows in the quotes list", () => {
    function Harness() {
      const [tab, setTab] = useState<QuoteTab>("all");
      const [search, setSearch] = useState("");
      const client = new QueryClient();
      return (
        <QueryClientProvider client={client}>
          <QuotesWorkspace
            quotes={[quote({ title: "מצלמות למשרד", total_gross: 100 })]}
            search={search}
            tab={tab}
            canCreate
            canDelete={false}
            canViewCost={false}
            onSearch={setSearch}
            onTab={setTab}
            onOpenQuote={vi.fn()}
          />
        </QueryClientProvider>
      );
    }
    render(<Harness />);
    expect(screen.getByTestId("quote-row-name")).toHaveTextContent("מצלמות למשרד");
  });
});

describe("Q1.7 no 'back' on the first step", () => {
  it("hides back on step 1 and shows it on step 2", () => {
    const { container, unmount } = renderBuilder(unsavedQuote("ws", {}));
    const details = container.querySelector(".cpq-stage-details") as HTMLElement;
    expect(within(details).queryByTestId("cpq-stage-back")).not.toBeInTheDocument();
    unmount();
    const second = renderBuilder(quote({ items: [ITEM] }));
    const composition = second.container.querySelector(".cpq-stage-composition") as HTMLElement;
    expect(within(composition).getByTestId("cpq-stage-back")).toBeInTheDocument();
  });
});
