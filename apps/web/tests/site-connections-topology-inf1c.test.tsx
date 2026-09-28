import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetDetail } from "../src/components/sites/AssetDetail";
import { SiteTopologyPanel } from "../src/components/sites/SiteTopologyPanel";
import { he } from "../src/i18n/he";

const navigate = vi.fn();

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
  useNavigate: () => navigate,
}));

vi.mock("../src/lib/can", () => ({
  can: () => true,
}));

const api = {
  getEquipment: vi.fn(),
  getSite: vi.fn(),
  listSystems: vi.fn(),
  listWarranties: vi.fn().mockResolvedValue({ items: [] }),
  getProject: vi.fn(),
  getQuote: vi.fn(),
  getCatalogProduct: vi.fn(),
  patchEquipment: vi.fn(),
  listEquipmentIpAddresses: vi.fn(),
  listEquipmentAssetConnections: vi.fn(),
  listEquipment: vi.fn(),
  createAssetConnection: vi.fn(),
  patchAssetConnection: vi.fn(),
  deleteAssetConnection: vi.fn(),
  getSiteTopology: vi.fn(),
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
          features: ["systems", "sites", "warranties", "projects"],
        },
      ],
    },
    api,
  }),
}));

describe("INF-1C Asset connections", () => {
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
      ip: null,
      mac: null,
      created_at: "",
      updated_at: "",
    });
    api.getSite.mockResolvedValue({ id: "s1", name: "Site", customer_id: "c1" });
    api.listSystems.mockResolvedValue({ items: [] });
    api.listWarranties.mockResolvedValue({ items: [] });
    api.getProject.mockRejectedValue(new Error("none"));
    api.getQuote.mockRejectedValue(new Error("none"));
    api.getCatalogProduct.mockRejectedValue(new Error("none"));
    api.listEquipmentIpAddresses.mockResolvedValue({ items: [], legacy_ip: null, legacy_mac: null });
    api.listEquipment.mockResolvedValue({
      items: [
        {
          id: "sw1",
          workspace_id: "ws1",
          site_id: "s1",
          category: "switch",
          status: "installed",
          name: "CCTV Switch",
          asset_code: "SW-CCTV-01",
          ip: "10.10.20.2",
          created_at: "",
          updated_at: "",
        },
      ],
    });
  });

  it("lists connections on Asset detail", async () => {
    api.listEquipmentAssetConnections.mockResolvedValue({
      items: [
        {
          id: "c1",
          workspace_id: "ws1",
          site_id: "s1",
          source_equipment_id: "eq1",
          target_equipment_id: "sw1",
          connection_type: "poe",
          source_port: "eth0",
          target_port: "1",
          notes: null,
          target_name: "CCTV Switch",
          target_asset_code: "SW-CCTV-01",
          target_category: "switch",
          target_ip: "10.10.20.2",
          created_at: "",
          updated_at: "",
        },
      ],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AssetDetail siteId="s1" assetId="eq1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("asset-connections-list")).toBeTruthy();
    expect(screen.getByText("CCTV Switch")).toBeTruthy();
    expect(screen.getByText(/PoE/)).toBeTruthy();
  });

  it("shows empty connections state", async () => {
    api.listEquipmentAssetConnections.mockResolvedValue({ items: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AssetDetail siteId="s1" assetId="eq1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("asset-connections-empty")).toBeTruthy();
    expect(screen.getByText(he.connectionEmpty)).toBeTruthy();
  });

  it("opens create connection form", async () => {
    api.listEquipmentAssetConnections.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AssetDetail siteId="s1" assetId="eq1" />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByTestId("connection-add-open"));
    expect(await screen.findByTestId("connection-form")).toBeTruthy();
  });
});

describe("INF-1C Topology", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockReset();
  });

  it("renders empty connections state without fake graph", async () => {
    api.getSiteTopology.mockResolvedValue({
      nodes: [
        {
          id: "eq1",
          site_id: "s1",
          name: "Camera",
          asset_code: "CAM-001",
          category: "camera",
          status: "installed",
        },
      ],
      edges: [],
      directional: true,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SiteTopologyPanel siteId="s1" canEdit />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("topology-empty-connections")).toBeTruthy();
    expect(screen.getByText(he.topologyNoConnections)).toBeTruthy();
    expect(screen.queryByTestId("site-topology")).toBeNull();
  });

  it("renders nodes/edges and navigates on node click", async () => {
    api.getSiteTopology.mockResolvedValue({
      nodes: [
        {
          id: "fw",
          site_id: "s1",
          name: "Firewall",
          asset_code: "FW-QA-01",
          category: "other",
          status: "installed",
          primary_ip: "10.10.10.1",
        },
        {
          id: "core",
          site_id: "s1",
          name: "Core Switch",
          asset_code: "CORE-SW-01",
          category: "switch",
          status: "installed",
          primary_ip: "10.10.10.2",
        },
      ],
      edges: [
        {
          id: "e1",
          workspace_id: "ws1",
          site_id: "s1",
          source_equipment_id: "fw",
          target_equipment_id: "core",
          connection_type: "wan",
          source_port: "wan0",
          target_port: "1",
          created_at: "",
          updated_at: "",
        },
      ],
      directional: true,
    });
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SiteTopologyPanel siteId="s1" canEdit />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("site-topology")).toBeTruthy();
    expect(screen.getByTestId("topology-canvas")).toBeTruthy();
    const node = screen.getByRole("button", { name: "Firewall" });
    await user.click(node);
    expect(navigate).toHaveBeenCalledWith({
      to: "/app/sites/$siteId/assets/$assetId",
      params: { siteId: "s1", assetId: "fw" },
    });
  });
});
