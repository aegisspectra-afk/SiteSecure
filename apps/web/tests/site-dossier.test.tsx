import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteDossier } from "../src/components/sites/SiteDossier";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    params,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
}));

const api = {
  getSite: vi.fn(),
  getCustomer: vi.fn(),
  listDocuments: vi.fn(),
  listSystems: vi.fn(),
  listEquipment: vi.fn(),
  listServiceCalls: vi.fn(),
  listJobs: vi.fn(),
  listWarranties: vi.fn(),
  patchSite: vi.fn(),
  createDocumentUpload: vi.fn(),
  completeDocumentUpload: vi.fn(),
  createSystem: vi.fn(),
  createEquipment: vi.fn(),
  createJob: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: "owner",
          features: ["sites", "systems", "documents", "service", "jobs", "quotes", "warranties", "crm"],
        },
      ],
    },
    api,
  }),
}));

vi.mock("../src/lib/can", () => ({
  can: () => true,
}));

function renderSite() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SiteDossier siteId="s1" />
    </QueryClientProvider>,
  );
}

describe("SiteDossier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSite.mockResolvedValue({
      id: "s1",
      customer_id: "c1",
      name: "בית ספר גולדה מאיר",
      code: "AS-S-2026-000142",
      address: { line: "תל אביב" },
      installation_status: "completed",
      access_notes: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    api.getCustomer.mockResolvedValue({
      id: "c1",
      display_name: "לקוח דמו",
      phone: "0500000000",
    });
    api.listDocuments.mockResolvedValue({ items: [] });
    api.listSystems.mockResolvedValue({
      items: [{ id: "sys1", workspace_id: "ws1", site_id: "s1", type: "cctv", name: "CCTV", status: "active" }],
    });
    api.listEquipment.mockResolvedValue({
      items: [
        {
          id: "eq1",
          workspace_id: "ws1",
          site_id: "s1",
          category: "camera",
          status: "installed",
          name: "CAM-018",
          model: "UNV 4MP Dome",
          serial: "UNV-XXXXXX",
          location_note: "FLOOR 02",
          installed_at: "2026-02-14T00:00:00Z",
          created_at: "2026-02-14T00:00:00Z",
          updated_at: "2026-02-14T00:00:00Z",
        },
      ],
    });
    api.listServiceCalls.mockResolvedValue({ items: [] });
    api.listJobs.mockResolvedValue({ items: [] });
    api.listWarranties.mockResolvedValue({ items: [] });
  });

  it("renders an operational Site File header instead of a form-first CRUD page", async () => {
    renderSite();
    expect(await screen.findByText(he.siteFileKicker)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "בית ספר גולדה מאיר" })).toBeInTheDocument();
    expect(screen.getByText("AS-S-2026-000142")).toBeInTheDocument();
    expect(screen.getByText(he.siteHealthKicker)).toBeInTheDocument();
    expect(screen.getByText(he.siteHealthOperational)).toBeInTheDocument();
    expect(screen.getByText(he.siteMetricCameras)).toBeInTheDocument();
    expect(screen.getByText(he.siteMetricNvrs)).toBeInTheDocument();
    expect(screen.queryByLabelText(he.name)).not.toBeInTheDocument();
  });

  it("exposes devices and history as first-class Site File navigation", async () => {
    renderSite();
    expect(await screen.findByRole("tab", { name: new RegExp(he.siteTabDevices) })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: he.siteTabHistory })).toBeInTheDocument();
  });
});
