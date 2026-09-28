import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CustomerPortalAccess } from "../src/components/customers/CustomerPortalAccess";
import {
  portalBuildPlan,
  portalBuildSegmentAt,
  portalBuildTotal,
  portalContactChoices,
  portalShareText,
  portalVisibleDocumentCount,
  portalVisibleQuoteCount,
} from "../src/components/customers/portal-build";
import { he } from "../src/i18n/he";

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

describe("portal build quantity", () => {
  it("weights the ring by how much of each kind exists", () => {
    const plan = portalBuildPlan({ sites: 8, quotes: 1, warranties: 0, documents: 0 });
    const total = portalBuildTotal(plan);
    const sites = plan.find((segment) => segment.id === "sites");
    const quotes = plan.find((segment) => segment.id === "quotes");
    expect(sites?.units).toBe(8);
    expect(quotes?.units).toBe(1);
    expect(sites!.units / total).toBeGreaterThan((quotes!.units / total) * 3);
    expect(plan.some((segment) => segment.id === "warranties")).toBe(false);
    const sitesStart = ((1 + 1) / total) * 100;
    expect(portalBuildSegmentAt(plan, sitesStart + 1).id).toBe("sites");
    expect(portalBuildSegmentAt(plan, 0).id).toBe("access");
  });

  it("counts only quotes and documents the customer can see", () => {
    expect(
      portalVisibleQuoteCount([{ status: "draft" }, { status: "sent" }, { status: "approved" }]),
    ).toBe(2);
    expect(
      portalVisibleDocumentCount([{ visibility: "internal" }, { visibility: "customer" }, {}]),
    ).toBe(1);
  });

  it("offers saved emails and writes them into the share message", () => {
    const choices = portalContactChoices({
      customerName: "דנה",
      customerEmail: "Dana@Example.com",
      contacts: [{ name: "יוסי", email: "yossi@example.com" }],
    });
    expect(choices.map((choice) => choice.email)).toEqual(["dana@example.com", "yossi@example.com"]);
    const message = portalShareText({
      workspaceName: "אגיס",
      customerName: "דנה",
      email: "dana@example.com",
      link: "https://app.example/portal/invite/abc",
    });
    expect(message).toContain("אגיס");
    expect(message).toContain("דנה");
    expect(message).toContain("dana@example.com");
    expect(message).toContain("/portal/invite/abc");
  });
});

describe("CustomerPortalAccess", () => {
  it("shows enable when no grant exists and create is allowed", async () => {
    const user = userEvent.setup();
    const api = {
      listCustomerPortal: vi.fn().mockResolvedValue({ access: [] }),
      enableCustomerPortal: vi.fn(),
      copyCustomerPortalLink: vi.fn(),
      resendCustomerPortal: vi.fn(),
      revokeCustomerPortal: vi.fn(),
    };
    render(
      wrap(
        <CustomerPortalAccess
          workspaceId="ws"
          customerId="cu"
          api={api}
          defaultEmail="a@example.com"
          canView
          canCreate
          canManage
          canRevoke
        />,
      ),
    );
    await user.click(await screen.findByRole("button", { name: he.portalEnable }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("a@example.com")).toBeInTheDocument();
  });

  it("hides enable and revoke from a view-only technician", async () => {
    const api = {
      listCustomerPortal: vi.fn().mockResolvedValue({
        access: [{ id: "1", email: "a@example.com", status: "active", last_login_at: null }],
      }),
      enableCustomerPortal: vi.fn(),
      copyCustomerPortalLink: vi.fn(),
      resendCustomerPortal: vi.fn(),
      revokeCustomerPortal: vi.fn(),
    };
    render(
      wrap(
        <CustomerPortalAccess
          workspaceId="ws"
          customerId="cu"
          api={api}
          defaultEmail=""
          canView
          canCreate={false}
          canManage={false}
          canRevoke={false}
        />,
      ),
    );
    expect(await screen.findByText("a@example.com")).toBeInTheDocument();
    expect(screen.getByText(he.portalStatusActive)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.portalEnable })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.portalRevoke })).not.toBeInTheDocument();
  });

  it("does not offer portal setup on a completed job without create permission", () => {
    const api = {
      listCustomerPortal: vi.fn(),
      enableCustomerPortal: vi.fn(),
      copyCustomerPortalLink: vi.fn(),
      resendCustomerPortal: vi.fn(),
      revokeCustomerPortal: vi.fn(),
    };
    const { container } = render(
      wrap(
        <CustomerPortalAccess
          variant="field"
          workspaceId="ws"
          customerId="cu"
          api={api}
          defaultEmail=""
          canView
          canCreate={false}
          canManage={false}
          canRevoke={false}
        />,
      ),
    );
    expect(container).toBeEmptyDOMElement();
    expect(api.listCustomerPortal).not.toHaveBeenCalled();
  });

  it("creates an invite from the enable form", async () => {
    const user = userEvent.setup();
    const api = {
      listCustomerPortal: vi.fn().mockResolvedValue({ access: [] }),
      enableCustomerPortal: vi.fn().mockResolvedValue({
        id: "1",
        email: "a@example.com",
        status: "invited",
        token: "abcDEF1234567890token",
        expires_at: "2026-10-03T12:00:00.000Z",
      }),
      copyCustomerPortalLink: vi.fn(),
      resendCustomerPortal: vi.fn(),
      revokeCustomerPortal: vi.fn(),
    };
    render(
      wrap(
        <CustomerPortalAccess
          workspaceId="ws"
          customerId="cu"
          api={api}
          defaultEmail="a@example.com"
          canView
          canCreate
          canManage
          canRevoke
        />,
      ),
    );
    await user.click(await screen.findByRole("button", { name: he.portalEnable }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: he.portalEnable }));
    expect(api.enableCustomerPortal).toHaveBeenCalledWith("ws", "cu", { email: "a@example.com" });
    expect(await within(dialog).findByRole("progressbar")).toHaveAttribute("aria-valuetext", expect.stringContaining("%"));
    expect(await screen.findByDisplayValue(/\/portal\/invite\/abcDEF1234567890token/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: he.portalQrLabel })).toBeInTheDocument();
    expect(screen.getAllByText(he.portalCustomerSteps).length).toBeGreaterThan(0);
    expect(screen.getByText(/בתוקף עד/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.portalCopyLink })).toBeInTheDocument();
    const mail = screen.getByRole("link", { name: he.portalShareEmail });
    expect(mail).toHaveAttribute("href", expect.stringContaining("mailto:"));
    expect(mail.getAttribute("href")).toContain(encodeURIComponent("a@example.com"));
    expect(mail.getAttribute("href")).toContain(encodeURIComponent("/portal/invite/abcDEF1234567890token"));
  });

  it("opens the device share sheet with the invite link", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    const api = {
      listCustomerPortal: vi.fn().mockResolvedValue({ access: [] }),
      enableCustomerPortal: vi.fn().mockResolvedValue({
        id: "1",
        email: "a@example.com",
        status: "invited",
        token: "abcDEF1234567890token",
      }),
      copyCustomerPortalLink: vi.fn(),
      resendCustomerPortal: vi.fn(),
      revokeCustomerPortal: vi.fn(),
    };
    render(
      wrap(
        <CustomerPortalAccess
          workspaceId="ws"
          customerId="cu"
          api={api}
          defaultEmail="a@example.com"
          canView
          canCreate
          canManage
          canRevoke
        />,
      ),
    );
    await user.click(await screen.findByRole("button", { name: he.portalEnable }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: he.portalEnable }));
    await user.click(await within(dialog).findByRole("button", { name: he.portalShare }, { timeout: 3000 }));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/portal/invite/abcDEF1234567890token"),
      }),
    );
    expect(share.mock.calls[0]?.[0].text).toContain("a@example.com");
    Reflect.deleteProperty(navigator, "share");
  });

  it("replaces the invited email from the window", async () => {
    const user = userEvent.setup();
    const api = {
      listCustomerPortal: vi.fn().mockResolvedValue({ access: [] }),
      enableCustomerPortal: vi.fn().mockResolvedValue({
        id: "access-1",
        email: "a@example.com",
        status: "invited",
        token: "abcDEF1234567890token",
        expires_at: "2026-10-03T12:00:00.000Z",
      }),
      copyCustomerPortalLink: vi.fn(),
      resendCustomerPortal: vi.fn(),
      revokeCustomerPortal: vi.fn().mockResolvedValue({ id: "access-1", email: "a@example.com", status: "revoked" }),
    };
    render(
      wrap(
        <CustomerPortalAccess
          workspaceId="ws"
          customerId="cu"
          api={api}
          defaultEmail="a@example.com"
          customerName="דנה"
          contacts={[{ name: "יוסי", email: "yossi@example.com" }]}
          canView
          canCreate
          canManage
          canRevoke
        />,
      ),
    );
    await user.click(await screen.findByRole("button", { name: he.portalEnable }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("יוסי")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: he.portalEnable }));
    await user.click(await within(dialog).findByRole("button", { name: he.portalReplaceEmail }, { timeout: 3000 }));
    expect(api.revokeCustomerPortal).toHaveBeenCalledWith("ws", "cu", "access-1");
    expect(await within(dialog).findByRole("button", { name: he.portalEnable })).toBeInTheDocument();
  });
});
