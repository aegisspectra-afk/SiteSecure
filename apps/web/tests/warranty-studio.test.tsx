import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClientError } from "@site-secure/api-client";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WarrantyStudio } from "../src/components/warranties/WarrantyStudio";
import { he } from "../src/i18n/he";

const persisted = {
  id: "w1",
  workspace_id: "ws1",
  number: "W-00012",
  title: "אחריות כניסה",
  type: "installation",
  status: "active",
  customer_id: "c1",
  site_id: "s1",
  equipment_id: "e1",
  customer_name: "אלון בע״מ",
  site_name: "משרד ראשי",
  starts_on: "2026-01-01",
  ends_on: "2027-01-01",
  policy: { subject_label: "מצלמה", disclaimer_accepted: true, versions: [] },
  created_at: "2026-09-27T00:00:00Z",
  updated_at: "2026-09-27T00:00:00Z",
};

const api = {
  getWarranty: vi.fn(),
  patchWarranty: vi.fn(),
  createWarranty: vi.fn(),
  listCustomers: vi.fn(),
  listSites: vi.fn(),
  listQuotes: vi.fn(),
  listServiceCalls: vi.fn(),
  listJobs: vi.fn(),
  listEquipment: vi.fn(),
  createCustomer: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      email: "owner@example.com",
      profile: { full_name: "בעלים" },
      memberships: [{ workspace_id: "ws1", workspace_name: "אתר בדיקה", role_key: "owner", features: ["core"] }],
    },
    api,
  }),
}));

function renderStudio(mode: "create" | "edit" = "edit") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WarrantyStudio
        open
        mode={mode}
        source={mode === "edit" ? { ...persisted, title: "stale list title" } : null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("WarrantyStudio GET/PATCH", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    api.getWarranty.mockResolvedValue(persisted);
    api.patchWarranty.mockResolvedValue({ ...persisted, title: "אחריות כניסה" });
    api.listCustomers.mockResolvedValue({
      items: [{ id: "c1", display_name: "אלון בע״מ", phone: null, email: null, tax_id: null }],
    });
    api.listSites.mockResolvedValue({ items: [{ id: "s1", name: "משרד ראשי" }] });
    api.listQuotes.mockResolvedValue({ items: [] });
    api.listServiceCalls.mockResolvedValue({ items: [] });
    api.listJobs.mockResolvedValue({ items: [] });
    api.listEquipment.mockResolvedValue({ items: [] });
  });

  it("loads the persisted warranty with GET before edit", async () => {
    renderStudio("edit");
    expect(await screen.findByTestId("warranty-studio-loading")).toBeTruthy();
    expect(await screen.findByTestId("warranty-studio")).toBeTruthy();
    expect(api.getWarranty).toHaveBeenCalledWith("ws1", "w1");
    expect(screen.getByText("אחריות כניסה")).toBeTruthy();
    expect(screen.queryByText("stale list title")).toBeNull();
  });

  it("saves edits with PATCH and not create", async () => {
    const user = userEvent.setup();
    renderStudio("edit");
    expect(await screen.findByTestId("warranty-studio")).toBeTruthy();
    await user.click(screen.getByTestId("warranty-studio-save-draft"));
    await waitFor(() => expect(api.patchWarranty).toHaveBeenCalled());
    expect(api.createWarranty).not.toHaveBeenCalled();
    const [, id, body] = api.patchWarranty.mock.calls[0];
    expect(id).toBe("w1");
    expect(body.title).toBe("אחריות כניסה");
    expect(body.starts_on).toBe("2026-01-01");
    expect(body.equipment_id).toBe("e1");
    expect(body.policy).toBeTruthy();
  });

  it("shows an error instead of list data when GET fails", async () => {
    api.getWarranty.mockRejectedValue(new ApiClientError("NOT_FOUND", he.warrantiesDetailError, 404));
    renderStudio("edit");
    expect(await screen.findByTestId("warranty-studio-error")).toBeTruthy();
    expect(screen.queryByTestId("warranty-studio")).toBeNull();
    expect(api.patchWarranty).not.toHaveBeenCalled();
  });

  it("does not GET when creating a new warranty", async () => {
    renderStudio("create");
    expect(await screen.findByTestId("warranty-studio")).toBeTruthy();
    expect(api.getWarranty).not.toHaveBeenCalled();
  });
});
