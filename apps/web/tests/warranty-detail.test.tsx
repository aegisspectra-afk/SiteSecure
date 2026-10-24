import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClientError } from "@site-secure/api-client";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: () => ReactNode }) => ({
    ...opts,
    useParams: () => ({ warrantyId: "w1" }),
  }),
  Link: ({
    children,
    className,
    to,
  }: {
    children: ReactNode;
    className?: string;
    to: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("../src/lib/can", () => ({
  can: () => true,
}));

vi.mock("../src/components/settings/RequirePermission", () => ({
  RequirePermission: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const api = {
  getWarranty: vi.fn(),
  patchWarranty: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [{ workspace_id: "ws1", workspace_name: "אתר", role_key: "owner", features: ["core"] }],
    },
    api,
  }),
}));

import { Route } from "../src/routes/app/warranties/$warrantyId";

const persisted = {
  id: "w1",
  workspace_id: "ws1",
  number: "W-00012",
  title: "אחריות כניסה",
  type: "installation",
  status: "active",
  customer_id: "c1",
  site_id: "s1",
  customer_name: "אלון בע״מ",
  site_name: "משרד ראשי",
  starts_on: "2026-01-01",
  ends_on: "2027-01-01",
  policy: null,
  created_at: "2026-09-27T00:00:00Z",
  updated_at: "2026-09-27T00:00:00Z",
};

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Page = Route.component;
  return render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
}

describe("warranty detail GET/PATCH", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    api.getWarranty.mockResolvedValue(persisted);
    api.patchWarranty.mockResolvedValue({ ...persisted, status: "expired" });
  });

  it("loads the record with GET and not list data", async () => {
    renderDetail();
    expect(screen.getByTestId("warranty-detail-loading")).toBeTruthy();
    expect(await screen.findByTestId("warranty-detail")).toBeTruthy();
    expect(api.getWarranty).toHaveBeenCalledWith("ws1", "w1");
    expect(screen.getByText("W-00012")).toBeTruthy();
  });

  it("saves supported fields with PATCH", async () => {
    const user = userEvent.setup();
    renderDetail();
    expect(await screen.findByTestId("warranty-detail")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText(he.status), "expired");
    await user.click(screen.getByTestId("warranty-detail-save"));
    await waitFor(() => expect(api.patchWarranty).toHaveBeenCalled());
    expect(api.patchWarranty).toHaveBeenCalledWith(
      "ws1",
      "w1",
      expect.objectContaining({ status: "expired", starts_on: "2026-01-01", ends_on: "2027-01-01" }),
    );
    expect(await screen.findByTestId("warranty-detail-saved")).toBeTruthy();
    expect(screen.getByText(he.warrantiesSaved)).toBeTruthy();
  });

  it("shows a not-found error when GET fails", async () => {
    api.getWarranty.mockRejectedValue(new ApiClientError("NOT_FOUND", he.warrantiesDetailError, 404));
    renderDetail();
    expect(await screen.findByText(he.warrantiesDetailError)).toBeTruthy();
    expect(screen.queryByTestId("warranty-detail")).toBeNull();
    expect(api.patchWarranty).not.toHaveBeenCalled();
  });
});
