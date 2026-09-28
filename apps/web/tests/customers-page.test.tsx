import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClientError } from "@site-secure/api-client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CustomerDirectoryEmpty,
  CustomerDirectoryList,
  CustomerDirectorySearchEmpty,
  CustomerDirectorySkeleton,
  CustomerMobileCard,
} from "../src/components/customers/CustomerDirectory";
import { he } from "../src/i18n/he";
import {
  customerInitials,
  customerMatchesDirectoryQuery,
  filterDirectoryRows,
  secondaryIdentityLine,
} from "../src/lib/customer-directory";

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
  createFileRoute: () => (opts: { component: () => ReactNode }) => opts,
  useNavigate: () => vi.fn(),
}));

vi.mock("../src/components/settings/RequirePermission", () => ({
  RequirePermission: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../src/components/workflow/NextActionDialog", () => ({
  NextActionDialog: () => null,
}));

const canMock = vi.fn((_role: string | undefined, permission: string) =>
  ["crm.view", "crm.create", "quotes.create"].includes(permission),
);

vi.mock("../src/lib/can", () => ({
  can: (...args: unknown[]) => canMock(...(args as [string | undefined, string])),
}));

const api = {
  listCustomers: vi.fn(),
  createCustomer: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: "manager",
          features: ["core", "crm"],
        },
      ],
    },
    api,
  }),
}));

import { CustomersPage } from "../src/routes/app/customers/index";

const sampleCustomers = [
  {
    id: "c1",
    workspace_id: "ws1",
    display_name: "שנידי הלר",
    type: "private",
    status: "active",
    legal_name: null,
    tax_id: null,
    email: "shnidi@example.com",
    phone: "0585378423",
    billing_address: { city: "תל אביב" },
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "c2",
    workspace_id: "ws1",
    display_name: "חברת אבטחה בע״מ",
    type: "business",
    status: "active",
    legal_name: "חברת אבטחה בע״מ",
    tax_id: null,
    email: null,
    phone: "03-1234567",
    billing_address: {},
    notes: null,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CustomersPage />
    </QueryClientProvider>,
  );
}

describe("customer directory helpers", () => {
  it("builds initials from Hebrew names", () => {
    expect(customerInitials("שנידי הלר")).toBe("שה");
    expect(customerInitials("איליה")).toBe("א");
  });

  it("matches search on name phone email address only", () => {
    const row = sampleCustomers[0];
    expect(customerMatchesDirectoryQuery(row, "שנידי")).toBe(true);
    expect(customerMatchesDirectoryQuery(row, "0585")).toBe(true);
    expect(customerMatchesDirectoryQuery(row, "shnidi")).toBe(true);
    expect(customerMatchesDirectoryQuery(row, "תל אביב")).toBe(true);
    expect(customerMatchesDirectoryQuery(row, "לא קיים")).toBe(false);
  });

  it("filters by status and type without invented counts", () => {
    expect(filterDirectoryRows(sampleCustomers, { type: "business" })).toHaveLength(1);
    expect(filterDirectoryRows(sampleCustomers, { status: "archived" })).toHaveLength(0);
  });

  it("shows legal_name only when distinct from display_name", () => {
    expect(secondaryIdentityLine(sampleCustomers[0])).toBeNull();
    expect(
      secondaryIdentityLine({
        ...sampleCustomers[1],
        display_name: "אבטחה",
        legal_name: "חברת אבטחה בע״מ",
      }),
    ).toBe("חברת אבטחה בע״מ");
  });
});

describe("CustomerDirectory presentation states", () => {
  it("renders loading skeleton without dash placeholders", () => {
    const { container } = render(<CustomerDirectorySkeleton />);
    expect(screen.getByTestId("customers-loading")).toBeTruthy();
    expect(container.textContent).not.toContain("—");
  });

  it("renders empty with create CTA when authorized", async () => {
    const onCreate = vi.fn();
    render(<CustomerDirectoryEmpty canCreate onCreate={onCreate} />);
    expect(screen.getByText(he.customerDirectoryEmptyTitle)).toBeTruthy();
    await userEvent.click(screen.getByTestId("customers-empty-create"));
    expect(onCreate).toHaveBeenCalled();
  });

  it("renders empty without create when unauthorized", () => {
    render(<CustomerDirectoryEmpty canCreate={false} onCreate={() => undefined} />);
    expect(screen.queryByTestId("customers-empty-create")).toBeNull();
  });

  it("renders filtered empty with clear CTA", async () => {
    const onClear = vi.fn();
    render(<CustomerDirectorySearchEmpty onClear={onClear} />);
    expect(screen.getByText(he.customerDirectorySearchEmptyTitle)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: he.customerDirectoryClearSearchAndFilters }));
    expect(onClear).toHaveBeenCalled();
  });

  it("mobile card exposes open customer action", () => {
    render(<CustomerMobileCard customer={sampleCustomers[0]} />);
    const open = screen.getByTestId("customer-open");
    expect(open.getAttribute("href")).toContain("/app/customers/c1");
    expect(open.textContent).toContain(he.customerDirectoryOpen);
    expect(screen.getByText("0585378423").closest("[dir='ltr']")).toBeTruthy();
  });

  it("list switches between loading populated empty and filtered empty", () => {
    const { rerender } = render(
      <CustomerDirectoryList
        rows={[]}
        loading
        query=""
        filter={{}}
        canCreate
        onCreate={() => undefined}
        onClearSearch={() => undefined}
      />,
    );
    expect(screen.getByTestId("customers-loading")).toBeTruthy();

    rerender(
      <CustomerDirectoryList
        rows={sampleCustomers}
        loading={false}
        query=""
        filter={{}}
        canCreate
        onCreate={() => undefined}
        onClearSearch={() => undefined}
      />,
    );
    expect(screen.getByTestId("customers-mobile-list")).toBeTruthy();
    expect(screen.getByTestId("customers-desktop-table")).toBeTruthy();
    expect(screen.getAllByTestId("customer-open").length).toBeGreaterThan(0);

    rerender(
      <CustomerDirectoryList
        rows={[]}
        loading={false}
        query=""
        filter={{}}
        canCreate
        onCreate={() => undefined}
        onClearSearch={() => undefined}
      />,
    );
    expect(screen.getByTestId("customers-empty")).toBeTruthy();

    rerender(
      <CustomerDirectoryList
        rows={[]}
        loading={false}
        query="zzz"
        filter={{}}
        canCreate
        onCreate={() => undefined}
        onClearSearch={() => undefined}
      />,
    );
    expect(screen.getByTestId("customers-filtered-empty")).toBeTruthy();
  });
});

describe("Customers page", () => {
  beforeEach(() => {
    api.listCustomers.mockReset();
    api.createCustomer.mockReset();
    canMock.mockImplementation((_role: string | undefined, permission: string) =>
      ["crm.view", "crm.create", "quotes.create"].includes(permission),
    );
  });

  it("loads populated customers and opens via link", async () => {
    api.listCustomers.mockResolvedValue({ items: sampleCustomers, next_cursor: null });
    renderPage();
    expect(screen.getByTestId("customers-loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("customers-count")).toBeTruthy());
    expect(screen.getByText("2 לקוחות")).toBeTruthy();
    expect(screen.getAllByText("שנידי הלר").length).toBeGreaterThan(0);
    const opens = screen.getAllByTestId("customer-open");
    expect(opens.some((el) => el.getAttribute("href")?.includes("c1"))).toBe(true);
  });

  it("shows create control when authorized", async () => {
    api.listCustomers.mockResolvedValue({ items: sampleCustomers, next_cursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("customers-create-toggle")).toBeTruthy());
    await userEvent.click(screen.getByTestId("customers-create-toggle"));
    expect(screen.getByTestId("customers-create-form")).toBeTruthy();
  });

  it("hides create when crm.create is denied", async () => {
    canMock.mockImplementation((_role, permission) => permission === "crm.view");
    api.listCustomers.mockResolvedValue({ items: sampleCustomers, next_cursor: null });
    renderPage();
    await waitFor(() => expect(screen.getAllByText("שנידי הלר").length).toBeGreaterThan(0));
    expect(screen.queryByTestId("customers-create-toggle")).toBeNull();
  });

  it("renders empty workspace state", async () => {
    api.listCustomers.mockResolvedValue({ items: [], next_cursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("customers-empty")).toBeTruthy());
    expect(screen.getByText(he.customerDirectoryEmptyTitle)).toBeTruthy();
  });

  it("renders filtered empty after server search miss", async () => {
    api.listCustomers.mockResolvedValue({ items: [], next_cursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("customers-search")).toBeTruthy());
    await userEvent.type(screen.getByTestId("customers-search"), "איןתוצאה");
    await waitFor(() => expect(api.listCustomers).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("customers-filtered-empty")).toBeTruthy());
  });

  it("renders error state without zero customers", async () => {
    api.listCustomers.mockRejectedValue(new ApiClientError(500, "SERVER", "boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText(he.customersError)).toBeTruthy());
    expect(screen.queryByText("0 לקוחות")).toBeNull();
    expect(screen.queryByTestId("customers-empty")).toBeNull();
    expect(screen.getByTestId("customers-retry")).toBeTruthy();
  });

  it("passes search query to listCustomers", async () => {
    api.listCustomers.mockResolvedValue({ items: sampleCustomers, next_cursor: null });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("customers-search")).toBeTruthy());
    await userEvent.type(screen.getByTestId("customers-search"), "שנידי");
    await waitFor(() =>
      expect(api.listCustomers).toHaveBeenCalledWith(
        "ws1",
        expect.objectContaining({ q: "שנידי" }),
      ),
    );
  });
});
