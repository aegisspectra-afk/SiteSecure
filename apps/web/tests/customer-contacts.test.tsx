import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerProfile } from "../src/components/customers/CustomerProfile";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("../src/components/quotes/CustomerNewQuoteButton", () => ({
  CustomerNewQuoteButton: () => null,
}));

vi.mock("../src/components/workflow/NextActionDialog", () => ({
  NextActionDialog: () => null,
}));

const contact = {
  id: "ct1",
  customer_id: "c1",
  full_name: "דנה כהן",
  role_title: "מנהלת",
  email: "dana@example.com",
  phone: "0500000000",
  is_primary: true,
};

const api = {
  getCustomer: vi.fn(),
  listCustomerContacts: vi.fn(),
  createCustomerContact: vi.fn(),
  patchCustomerContact: vi.fn(),
  deleteCustomerContact: vi.fn(),
  listSites: vi.fn(),
  listQuotes: vi.fn(),
  listProjects: vi.fn(),
  listServiceCalls: vi.fn(),
  listDocuments: vi.fn(),
  listWarranties: vi.fn(),
  listLeads: vi.fn(),
  patchCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
};

function renderProfile(opts: { canEdit?: boolean; canDelete?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CustomerProfile
        customerId="c1"
        workspaceId="ws1"
        api={api as never}
        canEdit={opts.canEdit ?? true}
        canDelete={opts.canDelete ?? true}
        canCreateSite={false}
        canCreateQuote={false}
        canCreateProject={false}
        canCreateService={false}
      />
    </QueryClientProvider>,
  );
}

describe("customer contacts PATCH/DELETE", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.setAttribute("open", "");
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close() {
        this.removeAttribute("open");
      };
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCustomer.mockResolvedValue({
      id: "c1",
      workspace_id: "ws1",
      display_name: "אלון בע״מ",
      type: "business",
      status: "active",
      email: null,
      phone: null,
      notes: null,
      billing_address: {},
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    api.listCustomerContacts.mockResolvedValue([contact]);
    api.listSites.mockResolvedValue({ items: [] });
    api.listQuotes.mockResolvedValue({ items: [] });
    api.listProjects.mockResolvedValue({ items: [] });
    api.listServiceCalls.mockResolvedValue({ items: [] });
    api.listDocuments.mockResolvedValue({ items: [] });
    api.listWarranties.mockResolvedValue({ items: [] });
    api.listLeads.mockResolvedValue({ items: [] });
    api.patchCustomerContact.mockResolvedValue({ ...contact, phone: "0522222222" });
    api.deleteCustomerContact.mockResolvedValue({ ok: true });
  });

  it("loads contacts and patches supplied fields", async () => {
    const user = userEvent.setup();
    renderProfile();
    expect(await screen.findByTestId("contact-card-ct1")).toBeTruthy();
    expect(api.listCustomerContacts).toHaveBeenCalledWith("ws1", "c1");
    await user.click(screen.getByTestId("contact-edit-ct1"));
    expect(await screen.findByTestId("contact-save")).toBeTruthy();
    const phone = screen.getByLabelText(he.phone);
    await user.clear(phone);
    await user.type(phone, "0522222222");
    await user.click(screen.getByTestId("contact-save"));
    await waitFor(() => expect(api.patchCustomerContact).toHaveBeenCalled());
    expect(api.createCustomerContact).not.toHaveBeenCalled();
    expect(api.patchCustomerContact).toHaveBeenCalledWith(
      "ws1",
      "c1",
      "ct1",
      expect.objectContaining({ full_name: "דנה כהן", phone: "0522222222" }),
    );
  });

  it("deletes a contact after confirm", async () => {
    const user = userEvent.setup();
    renderProfile();
    expect(await screen.findByTestId("contact-card-ct1")).toBeTruthy();
    await user.click(screen.getByTestId("contact-delete-ct1"));
    await user.click(screen.getByTestId("contact-delete-confirm"));
    await waitFor(() => expect(api.deleteCustomerContact).toHaveBeenCalledWith("ws1", "c1", "ct1"));
  });

  it("hides edit and delete without permission", async () => {
    renderProfile({ canEdit: false, canDelete: false });
    expect(await screen.findByTestId("contact-card-ct1")).toBeTruthy();
    expect(screen.queryByTestId("contact-edit-ct1")).toBeNull();
    expect(screen.queryByTestId("contact-delete-ct1")).toBeNull();
  });
});
