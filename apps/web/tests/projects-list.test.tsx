import { ApiClientError } from "@site-secure/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsListPage } from "../src/components/projects/ProjectsListPage";
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
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  },
  useNavigate: () => navigate,
}));

const canMock = vi.fn(
  (_role: string | undefined, permission: string) =>
    permission === "projects.view" ||
    permission === "projects.create" ||
    permission === "crm.view" ||
    permission === "sites.view",
);

vi.mock("../src/lib/can", () => ({
  can: (...args: unknown[]) => canMock(...(args as [string | undefined, string])),
}));

const api = {
  listProjects: vi.fn(),
  listCustomers: vi.fn(),
  listSites: vi.fn(),
  getSite: vi.fn(),
  createProject: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: "manager",
          features: ["core", "crm", "projects"],
        },
      ],
    },
    api,
  }),
}));

function renderList(search?: { quoteId?: string; customerId?: string; siteId?: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectsListPage search={search} />
    </QueryClientProvider>,
  );
}

describe("ProjectsListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canMock.mockImplementation(
      (_role: string | undefined, permission: string) =>
        permission === "projects.view" ||
        permission === "projects.create" ||
        permission === "crm.view" ||
        permission === "sites.view",
    );
    api.listCustomers.mockResolvedValue({
      items: [
        { id: "c1", display_name: "לקוח א" },
        { id: "c2", display_name: "לקוח ב" },
      ],
    });
    api.listSites.mockResolvedValue({
      items: [{ id: "s1", name: "אתר מרכז" }],
    });
    api.getSite.mockImplementation(async (_ws: string, id: string) => ({
      id,
      name: id === "s1" ? "אתר מרכז" : "אתר אחר",
    }));
    api.listProjects.mockResolvedValue({
      items: [
        {
          id: "p1",
          workspace_id: "ws1",
          name: "התקנת חניון",
          status: "in_progress",
          customer_id: "c1",
          site_id: "s1",
          created_at: "2026-09-20T10:00:00Z",
          updated_at: "2026-09-22T10:00:00Z",
        },
        {
          id: "p2",
          workspace_id: "ws1",
          name: "שדרוג מצלמות",
          status: "planned",
          customer_id: "c2",
          site_id: null,
          created_at: "2026-09-21T10:00:00Z",
          updated_at: "2026-09-21T10:00:00Z",
        },
      ],
    });
  });

  it("enriches list rows with customer, site, and status clarity", async () => {
    renderList();
    expect(await screen.findByTestId("projects-list-rows")).toBeTruthy();
    expect(screen.getByText("התקנת חניון")).toBeTruthy();
    expect(screen.getAllByText(he.projectStatuses.in_progress).length).toBeGreaterThanOrEqual(1);
    await waitFor(() => {
      const metas = screen.getAllByTestId("project-list-meta");
      expect(metas[0].textContent).toContain("לקוח א");
      expect(metas[0].textContent).toContain("אתר מרכז");
      expect(metas[1].textContent).toContain("לקוח ב");
      expect(metas[1].textContent).toContain(he.projectNoSite);
    });
    expect(api.getSite).toHaveBeenCalledWith("ws1", "s1");
  });

  it("honors search params as list filters and create prefill", async () => {
    renderList({ quoteId: "q1", customerId: "c1", siteId: "s1" });
    await waitFor(() =>
      expect(api.listProjects).toHaveBeenCalledWith(
        "ws1",
        expect.objectContaining({
          source_quote_id: "q1",
          customer_id: "c1",
        }),
      ),
    );
    expect(await screen.findByTestId("projects-source-quote-filter")).toBeTruthy();
    expect(screen.getByTestId("projects-create-panel")).toBeTruthy();
    expect((screen.getByLabelText(he.pickCustomer) as HTMLSelectElement).value).toBe("c1");
    await waitFor(() => {
      expect((screen.getByLabelText(he.pickSite) as HTMLSelectElement).value).toBe("s1");
    });
  });

  it("filters by status and customer through the API", async () => {
    renderList();
    await screen.findByTestId("projects-list-rows");
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(he.projectsFilterStatus), "planned");
    await user.selectOptions(screen.getByLabelText(he.projectsFilterCustomer), "c2");
    await waitFor(() =>
      expect(api.listProjects).toHaveBeenCalledWith(
        "ws1",
        expect.objectContaining({ status: "planned", customer_id: "c2" }),
      ),
    );
  });

  it("passes real search q to listProjects", async () => {
    renderList();
    await screen.findByTestId("projects-list-rows");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(he.projectsSearch), "חניון");
    await waitFor(() =>
      expect(api.listProjects).toHaveBeenCalledWith(
        "ws1",
        expect.objectContaining({ q: "חניון" }),
      ),
    );
  });

  it("requires site when customer has multiple sites on manual create", async () => {
    api.listSites.mockResolvedValue({
      items: [
        { id: "s1", name: "אתר מרכז" },
        { id: "s2", name: "אתר צפון" },
      ],
    });
    renderList();
    await screen.findByTestId("projects-list-rows");
    const user = userEvent.setup();
    await user.click(screen.getByTestId("projects-create-toggle"));
    await user.selectOptions(screen.getByLabelText(he.pickCustomer), "c1");
    await user.type(screen.getByLabelText(he.name), "פרויקט חדש");
    await waitFor(() => expect(api.listSites).toHaveBeenCalled());
    await waitFor(() => {
      expect((screen.getByLabelText(he.pickSite) as HTMLSelectElement).value).toBe("");
    });
    expect(screen.getByRole("button", { name: he.save })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(he.pickSite), "s2");
    expect(screen.getByRole("button", { name: he.save })).not.toBeDisabled();
  });

  it("shows truthful empty and error states", async () => {
    api.listProjects.mockResolvedValue({ items: [] });
    const { unmount } = renderList();
    expect(await screen.findByTestId("projects-list-empty")).toBeTruthy();
    expect(screen.getByText(he.projectsEmptyTitle)).toBeTruthy();
    unmount();

    api.listProjects.mockRejectedValue(new ApiClientError(500, "ERROR", "כשל שרת"));
    renderList();
    expect(await screen.findByText("כשל שרת")).toBeTruthy();
    expect(screen.getByRole("button", { name: he.retry })).toBeTruthy();
  });

  it("shows filtered empty when filters yield no rows", async () => {
    api.listProjects.mockResolvedValue({ items: [] });
    renderList({ customerId: "c1" });
    expect(await screen.findByTestId("projects-list-filtered-empty")).toBeTruthy();
    expect(screen.getByText(he.projectsFilteredEmptyTitle)).toBeTruthy();
  });
});
