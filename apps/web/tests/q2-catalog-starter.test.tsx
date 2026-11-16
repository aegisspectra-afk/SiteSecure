import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => <a className={className}>{children}</a>,
  useNavigate: () => vi.fn(),
  createFileRoute: () => (opts: { component: () => ReactNode }) => opts,
}));
vi.mock("../src/components/catalog/CatalogImportWizard", () => ({ CatalogImportWizard: () => null }));
vi.mock("../src/components/catalog/CatalogBulkPricing", () => ({ CatalogBulkPricing: () => null }));

let products: Record<string, unknown>[] = [];
let roleKey = "owner";
const loadStarterCatalog = vi.fn(async () => ({ inserted: 15, skipped: 0, missing_category: 0 }));
const api = {
  listCatalogCategories: vi.fn(async () => []),
  listCatalogProducts: vi.fn(async () => ({ items: products, next_cursor: null })),
  loadStarterCatalog,
};
vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    api,
    session: { memberships: [{ workspace_id: "ws", role_key: roleKey, features: ["quotes", "catalog", "crm"] }] },
  }),
}));

async function renderCatalog() {
  const { Route } = await import("../src/routes/app/catalog");
  const Page = (Route as unknown as { component: () => ReactNode }).component;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Page />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  products = [];
  roleKey = "owner";
  loadStarterCatalog.mockClear();
});

describe("Q2.7 starter catalog on the catalog page", () => {
  it("empty catalog offers to load the starter catalog and reports the result", async () => {
    await renderCatalog();
    await waitFor(() => expect(screen.getByText(he.catalogEmpty)).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: he.catalogStarterLoad })[0]!);
    await waitFor(() => expect(loadStarterCatalog).toHaveBeenCalledWith("ws"));
    await waitFor(() => expect(screen.getByTestId("catalog-starter-notice")).toHaveTextContent(he.catalogStarterDone(15, 0)));
  });

  it("the button stays available on a filled catalog and a second load reports 'already loaded'", async () => {
    products = [{ id: "p1", sku: "SS-CAM-4MP-DOME", name: "מצלמת IP כיפה 4MP", list_price: 390, description: he.catalogSamplePrice, is_active: true }];
    loadStarterCatalog.mockResolvedValueOnce({ inserted: 0, skipped: 15, missing_category: 0 });
    await renderCatalog();
    await waitFor(() => expect(screen.getByText("מצלמת IP כיפה 4MP")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("catalog-starter-load"));
    await waitFor(() => expect(screen.getByTestId("catalog-starter-notice")).toHaveTextContent(he.catalogStarterDone(0, 15)));
  });

  it("marks sample prices in the list", async () => {
    products = [
      { id: "p1", sku: "SS-HDD-4TB", name: "HDD 4TB", list_price: 490, description: he.catalogSamplePrice, is_active: true },
      { id: "p2", sku: "REAL-1", name: "פריט אמיתי", list_price: 100, description: "", is_active: true },
    ];
    await renderCatalog();
    await waitFor(() => expect(screen.getByText("פריט אמיתי")).toBeInTheDocument());
    expect(screen.getAllByTestId("catalog-sample-price")).toHaveLength(1);
  });

  it("a role without catalog.edit sees no load button", async () => {
    roleKey = "sales";
    products = [{ id: "p2", sku: "REAL-1", name: "פריט אמיתי", list_price: 100, description: "", is_active: true }];
    await renderCatalog();
    await waitFor(() => expect(screen.getByText("פריט אמיתי")).toBeInTheDocument());
    expect(screen.queryByTestId("catalog-starter-load")).not.toBeInTheDocument();
  });
});
