import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FieldJob } from "../src/components/field/FieldJob";
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
}));

const api = {
  getJob: vi.fn(),
  listJobChecklist: vi.fn(),
  getSite: vi.fn(),
  getCustomer: vi.fn(),
  listEquipment: vi.fn(),
  listDocuments: vi.fn(),
  startJob: vi.fn(),
  completeJob: vi.fn(),
  patchJobChecklistItem: vi.fn(),
  createDocumentUpload: vi.fn(),
  completeDocumentUpload: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: "technician",
          features: ["core", "service", "documents"],
        },
      ],
    },
    api,
  }),
}));

vi.mock("../src/lib/can", () => ({
  can: () => true,
}));

vi.mock("../src/lib/use-online-status", () => ({
  useOnlineStatus: () => true,
}));

function renderJob() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FieldJob jobId="j1" />
    </QueryClientProvider>,
  );
}

describe("FieldJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getJob.mockResolvedValue({
      id: "j1",
      workspace_id: "ws1",
      number: "J-00021",
      title: "התקנת מצלמות",
      kind: "installation",
      status: "in_progress",
      customer_id: "c1",
      site_id: "s1",
      scheduled_for: "2026-08-27T09:00:00Z",
      completion_notes: null,
    });
    api.listJobChecklist.mockResolvedValue([
      { id: "i1", label_he: "תשתית", completed: true },
      { id: "i2", label_he: "ציוד", completed: false },
    ]);
    api.getSite.mockResolvedValue({ id: "s1", customer_id: "c1", name: "בית ספר גולדה מאיר", code: "AS-S-1" });
    api.getCustomer.mockResolvedValue({ id: "c1", display_name: "לקוח דמו", phone: "0500000000" });
    api.listEquipment.mockResolvedValue({
      items: [
        {
          id: "eq1",
          workspace_id: "ws1",
          site_id: "s1",
          category: "camera",
          status: "installed",
          name: "CAM-018",
          location_note: "FLOOR 02",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    api.listDocuments.mockResolvedValue({ items: [] });
  });

  it("renders a field operating job surface with site, checklist, and equipment", async () => {
    renderJob();
    expect(await screen.findByText(he.fieldJobKicker)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "התקנת מצלמות" })).toBeInTheDocument();
    expect(await screen.findByText("בית ספר גולדה מאיר")).toBeInTheDocument();
    expect(screen.getByText(he.installationChecklist)).toBeInTheDocument();
    expect(screen.getByText("תשתית")).toBeInTheDocument();
    expect(await screen.findByText("CAM-018")).toBeInTheDocument();
    expect(screen.getByText(he.fieldPhotosTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.completeJob })).toBeInTheDocument();
  });
});
