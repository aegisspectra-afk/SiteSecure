import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetDetail } from "../src/components/sites/AssetDetail";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    params,
    ...rest
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    let href = to;
    if (params) for (const [k, v] of Object.entries(params)) href = href.replace(`$${k}`, v);
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
}));

vi.mock("../src/lib/can", () => ({
  can: (_role?: string, permission?: string) => permission !== "deny",
}));

const api = {
  getEquipment: vi.fn(),
  getSite: vi.fn(),
  listSystems: vi.fn(),
  listWarranties: vi.fn(),
  getProject: vi.fn(),
  getQuote: vi.fn(),
  getCatalogProduct: vi.fn(),
  patchEquipment: vi.fn(),
  listEquipmentIpAddresses: vi.fn(),
  listEquipmentAssetConnections: vi.fn(),
  listDocuments: vi.fn(),
  listServiceCalls: vi.fn(),
  listEquipmentLifecycleActivity: vi.fn(),
  createDocumentUpload: vi.fn(),
  completeDocumentUpload: vi.fn(),
  getDocumentUrl: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: "owner",
          features: ["systems", "sites", "warranties", "projects", "documents", "service"],
        },
      ],
    },
    api,
  }),
}));

describe("INF-1D Asset lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getEquipment.mockResolvedValue({
      id: "eq1",
      workspace_id: "ws1",
      site_id: "s1",
      category: "camera",
      status: "installed",
      name: "Camera",
      asset_code: "CAM-001",
      created_at: "",
      updated_at: "",
    });
    api.getSite.mockResolvedValue({ id: "s1", name: "Site", customer_id: "c1" });
    api.listSystems.mockResolvedValue({ items: [] });
    api.getProject.mockRejectedValue(new Error("none"));
    api.getQuote.mockRejectedValue(new Error("none"));
    api.getCatalogProduct.mockRejectedValue(new Error("none"));
    api.listEquipmentIpAddresses.mockResolvedValue({ items: [], legacy_ip: null, legacy_mac: null });
    api.listEquipmentAssetConnections.mockResolvedValue({ items: [] });
    api.listDocuments.mockResolvedValue({
      items: [
        {
          id: "d1",
          workspace_id: "ws1",
          entity_type: "equipment",
          entity_id: "eq1",
          kind: "document",
          original_filename: "manual.pdf",
          created_at: "2026-09-28T12:00:00Z",
        },
      ],
    });
    api.listServiceCalls.mockResolvedValue({
      items: [
        {
          id: "svc1",
          workspace_id: "ws1",
          site_id: "s1",
          customer_id: "c1",
          equipment_id: "eq1",
          title: "No video",
          status: "open",
          priority: "normal",
          number: "SC-9",
          created_at: "2026-09-28T11:00:00Z",
          updated_at: "2026-09-28T11:00:00Z",
        },
      ],
    });
    api.listEquipmentLifecycleActivity.mockResolvedValue({
      items: [
        { id: "a1", kind: "asset_created", at: "2026-09-01T00:00:00Z", title: "נכס נוצר", detail: "CAM-001" },
        { id: "a2", kind: "service", at: "2026-09-28T11:00:00Z", title: "No video", detail: "open" },
      ],
      source: "derived+audit",
    });
    api.listWarranties.mockResolvedValue({
      items: [
        {
          id: "w1",
          workspace_id: "ws1",
          number: "WR-1",
          type: "installation",
          status: "active",
          customer_id: "c1",
          site_id: "s1",
          equipment_id: "eq1",
          starts_on: "2026-01-01",
          ends_on: "2027-01-01",
          created_at: "",
          updated_at: "",
        },
      ],
    });
  });

  it("shows documents service warranty activity sections", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AssetDetail siteId="s1" assetId="eq1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("asset-detail")).toBeTruthy();
    // open collapsed sections via summary click by expanding details in DOM
    for (const id of ["warranty", "documents", "service", "activity"]) {
      const el = screen.getByTestId(`asset-section-${id}`);
      el.setAttribute("open", "");
    }
    expect(await screen.findByTestId("asset-documents-list")).toBeTruthy();
    expect(screen.getByText("manual.pdf")).toBeTruthy();
    expect(await screen.findByTestId("asset-service-list")).toBeTruthy();
    expect(screen.getAllByText("No video").length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByTestId("asset-warranty")).toBeTruthy();
    expect(screen.getByText("WR-1")).toBeTruthy();
    expect(await screen.findByTestId("asset-activity-list")).toBeTruthy();
    expect(screen.getByText(he.assetSectionActivity)).toBeTruthy();
  });

  it("legacy asset with empty relations", async () => {
    api.listDocuments.mockResolvedValue({ items: [] });
    api.listServiceCalls.mockResolvedValue({ items: [] });
    api.listWarranties.mockResolvedValue({ items: [] });
    api.listEquipmentLifecycleActivity.mockResolvedValue({ items: [], source: "derived+audit" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AssetDetail siteId="s1" assetId="eq1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("asset-detail")).toBeTruthy();
    for (const id of ["documents", "service", "activity", "warranty"]) {
      screen.getByTestId(`asset-section-${id}`).setAttribute("open", "");
    }
    expect(await screen.findByTestId("asset-documents-empty")).toBeTruthy();
    expect(screen.getByTestId("asset-service-empty")).toBeTruthy();
    expect(screen.getByTestId("asset-warranty-empty")).toBeTruthy();
    expect(screen.getByTestId("asset-activity-empty")).toBeTruthy();
  });
});
