import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetDetail } from "../src/components/sites/AssetDetail";

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

vi.mock("../src/lib/can", () => ({
  can: () => true,
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
  listSiteAssetConnections: vi.fn(),
  getSiteTopology: vi.fn(),
  getSiteNetworkOverview: vi.fn(),
  listSiteVlans: vi.fn(),
  listSiteNetworks: vi.fn(),
  createAssetConnection: vi.fn(),
  patchAssetConnection: vi.fn(),
  deleteAssetConnection: vi.fn(),
  listDocuments: vi.fn().mockResolvedValue({ items: [] }),
  listServiceCalls: vi.fn().mockResolvedValue({ items: [] }),
  listEquipmentLifecycleActivity: vi.fn().mockResolvedValue({ items: [], source: "derived+audit" }),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [{ workspace_id: "ws1", role_key: "owner", features: ["systems", "sites"] }],
    },
    api,
  }),
}));

describe("AssetDetail does not call unmounted IPAM/connections APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getEquipment.mockResolvedValue({
      id: "eq1",
      workspace_id: "ws1",
      site_id: "s1",
      category: "camera",
      status: "installed",
      name: "Camera Lobby",
      ip: "192.168.1.50",
      mac: "AA:BB:CC:DD:EE:FF",
      created_at: "",
      updated_at: "",
    });
    api.getSite.mockResolvedValue({ id: "s1", name: "Site", customer_id: "c1" });
    api.listSystems.mockResolvedValue({ items: [] });
    api.listWarranties.mockResolvedValue({ items: [] });
    api.getProject.mockRejectedValue(new Error("none"));
    api.getQuote.mockRejectedValue(new Error("none"));
    api.getCatalogProduct.mockRejectedValue(new Error("none"));
  });

  it("uses equipment IP/MAC only and never calls unmounted endpoints", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AssetDetail siteId="s1" assetId="eq1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("asset-detail")).toBeTruthy();
    expect(screen.getByTestId("asset-network-equipment")).toBeTruthy();
    expect(screen.getByText("192.168.1.50")).toBeTruthy();
    expect(screen.getByText("AA:BB:CC:DD:EE:FF")).toBeTruthy();
    expect(screen.queryByTestId("asset-ipam")).toBeNull();
    expect(screen.queryByTestId("asset-section-connections")).toBeNull();
    expect(screen.queryByTestId("asset-connections")).toBeNull();

    await waitFor(() => expect(api.getEquipment).toHaveBeenCalled());
    expect(api.listEquipmentIpAddresses).not.toHaveBeenCalled();
    expect(api.listEquipmentAssetConnections).not.toHaveBeenCalled();
    expect(api.listSiteAssetConnections).not.toHaveBeenCalled();
    expect(api.getSiteTopology).not.toHaveBeenCalled();
    expect(api.getSiteNetworkOverview).not.toHaveBeenCalled();
    expect(api.listSiteVlans).not.toHaveBeenCalled();
    expect(api.listSiteNetworks).not.toHaveBeenCalled();
    expect(api.createAssetConnection).not.toHaveBeenCalled();
    expect(api.patchAssetConnection).not.toHaveBeenCalled();
    expect(api.deleteAssetConnection).not.toHaveBeenCalled();
  });
});
