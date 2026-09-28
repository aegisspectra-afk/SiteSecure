import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetDetail } from "../src/components/sites/AssetDetail";
import { SiteNetworkPanel } from "../src/components/sites/SiteNetworkPanel";
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
  listEquipmentAssetConnections: vi.fn().mockResolvedValue({ items: [] }),
  listDocuments: vi.fn().mockResolvedValue({ items: [] }),
  listServiceCalls: vi.fn().mockResolvedValue({ items: [] }),
  listEquipmentLifecycleActivity: vi.fn().mockResolvedValue({ items: [], source: "derived+audit" }),
  getSiteNetworkOverview: vi.fn(),
  listSiteVlans: vi.fn(),
  listSiteNetworks: vi.fn(),
  listSiteIpAddresses: vi.fn(),
  createSiteVlan: vi.fn(),
  createSiteNetwork: vi.fn(),
  createSiteIpAddress: vi.fn(),
  patchSiteIpAddress: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [{ workspace_id: "ws1", role_key: "owner", features: ["systems", "sites", "warranties", "projects"] }],
    },
    api,
  }),
}));

describe("INF-1B SiteNetworkPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSiteNetworkOverview.mockResolvedValue({
      networks: 3,
      vlans: 3,
      ips: 3,
      assigned: 2,
      available: 1,
      reserved: 0,
    });
    api.listSiteVlans.mockResolvedValue({
      items: [{ id: "v20", workspace_id: "ws1", site_id: "s1", vlan_number: 20, name: "CCTV", created_at: "", updated_at: "" }],
    });
    api.listSiteNetworks.mockResolvedValue({
      items: [
        {
          id: "n1",
          workspace_id: "ws1",
          site_id: "s1",
          name: "CCTV",
          cidr: "10.10.20.0/24",
          dhcp_enabled: false,
          vlan_id: "v20",
          ip_count: 3,
          assigned_count: 2,
          created_at: "",
          updated_at: "",
        },
      ],
    });
    api.listSiteIpAddresses.mockResolvedValue({
      items: [
        {
          id: "ip1",
          workspace_id: "ws1",
          site_id: "s1",
          network_id: "n1",
          ip_address: "10.10.20.101",
          status: "assigned",
          assignment_type: "static",
          equipment_id: "eq1",
          equipment_name: "Camera",
          equipment_asset_code: "CAM-001",
          network_name: "CCTV",
          vlan_number: 20,
          vlan_name: "CCTV",
          created_at: "",
          updated_at: "",
        },
      ],
    });
  });

  it("renders overview networks and IPAM table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SiteNetworkPanel siteId="s1" equipment={[]} canEdit />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("site-network-panel")).toBeTruthy();
    expect(screen.getByTestId("site-network-overview")).toBeTruthy();
    expect((await screen.findAllByText("CCTV")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("10.10.20.101").length).toBeGreaterThanOrEqual(1);
  });
});

describe("INF-1B AssetDetail IPAM", () => {
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

  it("prefers IPAM assignment over legacy equipment.ip", async () => {
    api.listEquipmentIpAddresses.mockResolvedValue({
      items: [
        {
          id: "ip1",
          workspace_id: "ws1",
          site_id: "s1",
          network_id: "n1",
          ip_address: "10.10.20.101",
          status: "assigned",
          assignment_type: "static",
          network_name: "CCTV",
          network_cidr: "10.10.20.0/24",
          vlan_number: 20,
          vlan_name: "CCTV",
          created_at: "",
          updated_at: "",
        },
      ],
      legacy_ip: "192.168.1.50",
      legacy_mac: "AA:BB:CC:DD:EE:FF",
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AssetDetail siteId="s1" assetId="eq1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("asset-ipam")).toBeTruthy();
    expect(screen.getByText("10.10.20.101")).toBeTruthy();
    expect(screen.getAllByText(/CCTV/).length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to legacy equipment.ip when no IPAM rows", async () => {
    api.listEquipmentIpAddresses.mockResolvedValue({
      items: [],
      legacy_ip: "192.168.1.50",
      legacy_mac: "AA:BB:CC:DD:EE:FF",
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AssetDetail siteId="s1" assetId="eq1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("asset-ipam-legacy")).toBeTruthy();
    expect(screen.getByText("192.168.1.50")).toBeTruthy();
    expect(screen.getByText(he.assetIpamLegacyFallback)).toBeTruthy();
  });
});
