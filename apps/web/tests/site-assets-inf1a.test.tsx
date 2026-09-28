import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetDetail } from "../src/components/sites/AssetDetail";
import { SiteAssetsPanel } from "../src/components/sites/SiteAssetsPanel";
import { he } from "../src/i18n/he";
import { filterSiteAssets, warrantyForAsset } from "../src/lib/site-assets";
import type { EquipmentOut, WarrantyOut } from "@site-secure/api-client";

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
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
}));

const canMock = vi.fn(() => true);

vi.mock("../src/lib/can", () => ({
  can: (...args: unknown[]) => canMock(...(args as [])),
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
  listDocuments: vi.fn().mockResolvedValue({ items: [] }),
  listServiceCalls: vi.fn().mockResolvedValue({ items: [] }),
  listEquipmentLifecycleActivity: vi.fn().mockResolvedValue({ items: [], source: "derived+audit" }),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: "owner",
          features: ["systems", "sites", "warranties", "projects", "catalog", "quotes"],
        },
      ],
    },
    api,
  }),
}));

const baseAsset: EquipmentOut = {
  id: "eq1",
  workspace_id: "ws1",
  site_id: "s1",
  category: "camera",
  status: "installed",
  name: "Camera Lobby",
  asset_code: "CAM-001",
  manufacturer: "QA Vision",
  model: "QV-T4",
  serial: null,
  ip: null,
  mac: null,
  system_id: "sys1",
  project_id: "p1",
  product_id: null,
  location_note: "FLOOR 01",
  installed_at: "2026-09-01",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AssetDetail siteId="s1" assetId="eq1" />
    </QueryClientProvider>,
  );
}

describe("site-assets helpers", () => {
  it("filters by code name serial manufacturer model ip", () => {
    const items: EquipmentOut[] = [
      { ...baseAsset, id: "1", asset_code: "CAM-001", name: "Cam A", serial: "S1", ip: "10.0.0.1" },
      { ...baseAsset, id: "2", asset_code: "NVR-001", name: "Recorder", manufacturer: "Hik", model: "N16", ip: null },
    ];
    expect(filterSiteAssets(items, { q: "cam-001" })).toHaveLength(1);
    expect(filterSiteAssets(items, { q: "hik" })).toHaveLength(1);
    expect(filterSiteAssets(items, { q: "10.0.0.1" })).toHaveLength(1);
    expect(filterSiteAssets(items, { status: "installed" })).toHaveLength(2);
    expect(filterSiteAssets(items, { category: "nvr" })).toHaveLength(0);
  });

  it("matches warranty by equipment_id", () => {
    const warranties = [
      { id: "w1", equipment_id: "other", status: "active" },
      { id: "w2", equipment_id: "eq1", status: "active", starts_on: "2026-01-01", ends_on: "2027-01-01" },
    ] as WarrantyOut[];
    expect(warrantyForAsset(warranties, "eq1")?.id).toBe("w2");
    expect(warrantyForAsset(warranties, "missing")).toBeNull();
  });
});

describe("SiteAssetsPanel", () => {
  it("renders dense list with asset_code and links to detail", () => {
    render(
      <SiteAssetsPanel
        siteId="s1"
        systems={[{ id: "sys1", workspace_id: "ws1", site_id: "s1", type: "cctv", name: "CCTV", status: "active", created_at: "", updated_at: "" }]}
        equipment={[baseAsset, { ...baseAsset, id: "eq2", asset_code: null, name: "Legacy Cam", serial: null, ip: null, system_id: null }]}
      />,
    );
    expect(screen.getByTestId("site-assets-panel")).toBeTruthy();
    expect(screen.getAllByText("CAM-001").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Camera Lobby").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Legacy Cam").length).toBeGreaterThanOrEqual(1);
    const link = screen.getByTestId("site-asset-row-eq1");
    expect(link.getAttribute("href")).toContain("/app/sites/s1/assets/eq1");
  });

  it("shows empty state", () => {
    render(<SiteAssetsPanel siteId="s1" systems={[]} equipment={[]} />);
    expect(screen.getByTestId("site-assets-empty")).toBeTruthy();
  });
});

describe("AssetDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canMock.mockImplementation((_role?: string, permission?: string) => permission !== "deny");
    canMock.mockImplementation(() => true);
    api.getEquipment.mockResolvedValue(baseAsset);
    api.getSite.mockResolvedValue({ id: "s1", name: "אתר בדיקה", customer_id: "c1" });
    api.listSystems.mockResolvedValue({
      items: [{ id: "sys1", workspace_id: "ws1", site_id: "s1", type: "cctv", name: "CCTV Main", status: "active" }],
    });
    api.listWarranties.mockResolvedValue({
      items: [
        {
          id: "w1",
          workspace_id: "ws1",
          number: "WR-1",
          type: "standard",
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
    api.getProject.mockResolvedValue({
      id: "p1",
      name: "התקנת חניון",
      source_quote_id: "q1",
      source_quote_version: 2,
    });
    api.getQuote.mockResolvedValue({ id: "q1", number: "Q-00009", version: 2 });
    api.getCatalogProduct.mockResolvedValue(null);
    api.patchEquipment.mockResolvedValue({ ...baseAsset, name: "Camera Lobby Updated" });
    api.listEquipmentIpAddresses.mockResolvedValue({ items: [], legacy_ip: null, legacy_mac: null });
    api.listEquipmentAssetConnections.mockResolvedValue({ items: [] });
    api.listDocuments.mockResolvedValue({ items: [] });
    api.listServiceCalls.mockResolvedValue({ items: [] });
    api.listEquipmentLifecycleActivity.mockResolvedValue({ items: [], source: "derived+audit" });
  });

  it("loads asset detail with code provenance warranty", async () => {
    renderDetail();
    expect(await screen.findByTestId("asset-detail")).toBeTruthy();
    expect(screen.getByTestId("asset-code")).toHaveTextContent("CAM-001");
    expect(screen.getByTestId("asset-name")).toHaveTextContent("Camera Lobby");
    expect(await screen.findByText("התקנת חניון")).toBeTruthy();
    expect(screen.getByTestId("asset-warranty")).toBeTruthy();
    expect(screen.getByText("WR-1")).toBeTruthy();
  });

  it("hides edit for read-only role", async () => {
    canMock.mockImplementation((_role?: string, permission?: string) => permission !== "systems.edit");
    renderDetail();
    expect(await screen.findByTestId("asset-detail")).toBeTruthy();
    expect(screen.queryByTestId("asset-edit-open")).toBeNull();
  });

  it("allows edit when systems.edit granted", async () => {
    renderDetail();
    const user = userEvent.setup();
    await user.click(await screen.findByTestId("asset-edit-open"));
    expect(screen.getByTestId("asset-edit-form")).toBeTruthy();
    const name = screen.getByLabelText(he.equipmentName);
    await user.clear(name);
    await user.type(name, "Camera Lobby Updated");
    await user.click(screen.getByTestId("asset-edit-save"));
    await waitFor(() =>
      expect(api.patchEquipment).toHaveBeenCalledWith(
        "ws1",
        "eq1",
        expect.objectContaining({ name: "Camera Lobby Updated", system_id: "sys1" }),
      ),
    );
  });

  it("handles legacy null fields without fabricating values", async () => {
    api.getEquipment.mockResolvedValue({
      ...baseAsset,
      asset_code: null,
      serial: null,
      ip: null,
      mac: null,
      project_id: null,
      product_id: null,
      system_id: null,
    });
    api.listWarranties.mockResolvedValue({ items: [] });
    renderDetail();
    expect(await screen.findByTestId("asset-detail")).toBeTruthy();
    expect(screen.queryByTestId("asset-code")).toBeNull();
    expect(screen.getByTestId("asset-warranty-empty")).toBeTruthy();
    expect(screen.getByText(he.assetNoProjectSource)).toBeTruthy();
  });
});
