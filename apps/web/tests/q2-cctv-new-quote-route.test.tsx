import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { QuoteOut } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuoteBuilder } from "../src/components/quotes/QuoteBuilder";
import { unsavedQuote } from "../src/lib/quote-builder";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => <a className={className}>{children}</a>,
  useNavigate: () => navigate,
}));

type DrawerProps = { open: boolean; ensureQuoteId?: () => Promise<string>; onClose: () => void };
const drawer: { props: DrawerProps | null } = { props: null };
vi.mock("../src/components/quotes/cpq/SystemBuilderDrawer", () => ({
  AUTO_CALC_DEBOUNCE_MS: 600,
  SystemBuilderDrawer: (props: DrawerProps) => {
    drawer.props = props;
    return null;
  },
}));

const created = { ...unsavedQuote("ws", {}), id: "q-new", number: "Q-00099", status: "draft" } as QuoteOut;
const api = {
  createQuote: vi.fn(async () => created),
  patchQuote: vi.fn(async () => created),
  listCustomers: vi.fn(async () => ({ items: [] })),
  listSites: vi.fn(async () => ({ items: [] })),
  listLeads: vi.fn(async () => ({ items: [] })),
  listCatalogProducts: vi.fn(async () => ({ items: [] })),
  listQuoteTemplates: vi.fn(async () => ({ items: [] })),
  listProjects: vi.fn(async () => ({ items: [] })),
  getWorkspace: vi.fn(async () => ({ id: "ws", name: "x", status: "active", timezone: "Asia/Jerusalem", vat_percent: 18 })),
};
vi.mock("../src/lib/session", () => ({ useSession: () => ({ api }) }));

describe("Q2.3 the CCTV window stays open on a new quote", () => {
  it("defers /app/quotes/new -> /app/quotes/<id> until the designer closes", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <QuoteBuilder
          quote={unsavedQuote("ws", { customerId: "c1", siteId: "s1" })}
          workspaceId="ws"
          roleKey="owner"
          features={["quotes", "catalog", "crm"]}
          initialCustomerId="c1"
          initialSiteId="s1"
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "CCTV" })[0]!);
    expect(drawer.props?.open).toBe(true);
    navigate.mockClear();

    await act(async () => {
      await drawer.props!.ensureQuoteId!();
    });
    // The first design save created the quote; moving to /<id> now would remount and close the window.
    expect(api.createQuote).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    act(() => drawer.props!.onClose());
    expect(navigate).toHaveBeenCalledWith({ to: "/app/quotes/$quoteId", params: { quoteId: "q-new" }, replace: true });
  });
});
