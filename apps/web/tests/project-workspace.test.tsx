import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectWorkspace } from "../src/components/projects/ProjectWorkspace";
import { he } from "../src/i18n/he";
import { ApiClientError } from "@site-secure/api-client";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    params,
    search,
    ...rest
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
    search?: Record<string, unknown>;
    [key: string]: unknown;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    if (search) {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(search)) {
        if (value != null && value !== "") qs.set(key, String(value));
      }
      const s = qs.toString();
      if (s) href += `?${s}`;
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
    permission === "jobs.view" ||
    permission === "jobs.create" ||
    permission === "quotes.view" ||
    permission === "crm.view" ||
    permission === "sites.view",
);

vi.mock("../src/lib/can", () => ({
  can: (...args: unknown[]) => canMock(...(args as [string | undefined, string])),
}));

const api = {
  getProject: vi.fn(),
  getCustomer: vi.fn(),
  getSite: vi.fn(),
  getQuote: vi.fn(),
  listJobs: vi.fn(),
  listProjectPlannedItems: vi.fn(),
  previewCreateInstalledAssets: vi.fn(),
  createInstalledAssets: vi.fn(),
  createJob: vi.fn(),
  patchProject: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: "manager",
          features: ["core", "crm", "quotes", "projects", "service"],
        },
      ],
    },
    api,
  }),
}));

function renderWorkspace(projectId = "p1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectWorkspace projectId={projectId} />
    </QueryClientProvider>,
  );
}

describe("ProjectWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canMock.mockImplementation(
      (_role: string | undefined, permission: string) =>
        permission === "jobs.view" ||
        permission === "jobs.create" ||
        permission === "quotes.view" ||
        permission === "crm.view" ||
        permission === "sites.view" ||
        permission === "projects.view" ||
        permission === "projects.edit" ||
        permission === "systems.edit",
    );
    api.getProject.mockResolvedValue({
      id: "p1",
      workspace_id: "ws1",
      name: "התקנת חניון",
      status: "in_progress",
      customer_id: "c1",
      site_id: "s1",
      source_quote_id: "q1",
      source_quote_version: 1,
      created_at: "2026-09-20T10:00:00Z",
      updated_at: "2026-09-22T10:00:00Z",
    });
    api.getCustomer.mockResolvedValue({ id: "c1", display_name: "לקוח בדיקה" });
    api.getSite.mockResolvedValue({
      id: "s1",
      name: "אתר בדיקה",
      address: { line: "שדרות הרצל 42" },
    });
    api.getQuote.mockResolvedValue({ id: "q1", number: "Q-00002", version: 1 });
    api.listJobs.mockResolvedValue({ items: [] });
    api.listProjectPlannedItems.mockResolvedValue({
      items: [
        {
          id: "pi1",
          workspace_id: "ws1",
          project_id: "p1",
          source_quote_id: "q1",
          source_quote_version: 1,
          description: "מצלמה 4MP",
          name: "מצלמה 4MP",
          qty: 8,
          scope_kind: "equipment",
          item_type: "catalog",
          section_name: "ציוד CCTV",
          sort_order: 10,
          created_at: "2026-09-20T10:00:00Z",
          assets_created: 0,
          assets_remaining: 8,
        },
        {
          id: "pi2",
          workspace_id: "ws1",
          project_id: "p1",
          source_quote_id: "q1",
          source_quote_version: 1,
          description: "התקנה",
          name: "התקנה",
          qty: 8,
          scope_kind: "labor",
          item_type: "service",
          section_name: "התקנה",
          sort_order: 20,
          created_at: "2026-09-20T10:00:00Z",
          assets_created: 0,
          assets_remaining: null,
        },
      ],
    });
    api.previewCreateInstalledAssets.mockResolvedValue({
      site_id: "s1",
      eligible: true,
      fully_materialized: false,
      total_to_create: 8,
      lines: [
        {
          planned_item_id: "pi1",
          label: "מצלמה 4MP",
          qty: 8,
          existing: 0,
          remaining: 8,
          category: "camera",
        },
      ],
    });
    api.createInstalledAssets.mockResolvedValue({
      requested: 8,
      created: 8,
      already_existing: 0,
      failed: 0,
      fully_materialized: true,
      equipment_ids: [],
      lines: [],
      message: "נוצרו 8 פריטי ציוד",
    });
  });

  it("renders identity, customer, site, and source quote", async () => {
    renderWorkspace();
    expect(await screen.findByRole("heading", { name: "התקנת חניון" })).toBeTruthy();
    expect((await screen.findAllByText("לקוח בדיקה")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("אתר בדיקה")).length).toBeGreaterThanOrEqual(1);
    const label = he.projectSourceQuoteValue("Q-00002", 1);
    expect((await screen.findAllByText(label)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("project-ops-summary").textContent).toBe(he.projectJobsSummaryEmpty);
  });

  it("shows planned scope from pinned quote revision", async () => {
    renderWorkspace();
    expect(await screen.findByTestId("project-planned-scope")).toBeTruthy();
    expect(screen.getByText(he.projectPlannedScopeTitle)).toBeTruthy();
    expect(screen.getByText(he.projectPlannedScopeFromRevision(1))).toBeTruthy();
    expect((await screen.findAllByText("מצלמה 4MP")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText(he.projectPlannedScopeKindLabor)).length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty planned scope for legacy projects without import", async () => {
    api.listProjectPlannedItems.mockResolvedValue({ items: [] });
    api.getProject.mockResolvedValue({
      id: "p1",
      workspace_id: "ws1",
      name: "התקנת חניון",
      status: "in_progress",
      customer_id: "c1",
      site_id: "s1",
      source_quote_id: "q1",
      source_quote_version: null,
      created_at: "2026-09-20T10:00:00Z",
      updated_at: "2026-09-22T10:00:00Z",
    });
    renderWorkspace();
    expect(await screen.findByTestId("project-planned-scope-empty")).toBeTruthy();
    expect(screen.getByText(he.projectPlannedScopeEmpty)).toBeTruthy();
  });

  it("keeps pinned revision when live quote later advances", async () => {
    api.getProject.mockResolvedValue({
      id: "p1",
      workspace_id: "ws1",
      name: "התקנת חניון",
      status: "in_progress",
      customer_id: "c1",
      site_id: "s1",
      source_quote_id: "q1",
      source_quote_version: 1,
      created_at: "2026-09-20T10:00:00Z",
      updated_at: "2026-09-22T10:00:00Z",
    });
    api.getQuote.mockResolvedValue({ id: "q1", number: "Q-00002", version: 2, status: "approved" });
    renderWorkspace();
    expect(await screen.findByTestId("project-source-quote-link")).toHaveTextContent(
      he.projectSourceQuoteValue("Q-00002", 1),
    );
    expect(screen.queryByText(he.projectSourceQuoteValue("Q-00002", 2))).toBeNull();
  });

  it("omits version for legacy projects without pin", async () => {
    api.getProject.mockResolvedValue({
      id: "p1",
      workspace_id: "ws1",
      name: "התקנת חניון",
      status: "in_progress",
      customer_id: "c1",
      site_id: "s1",
      source_quote_id: "q1",
      source_quote_version: null,
      created_at: "2026-09-20T10:00:00Z",
      updated_at: "2026-09-22T10:00:00Z",
    });
    api.getQuote.mockResolvedValue({ id: "q1", number: "Q-00002", version: 5 });
    renderWorkspace();
    expect(await screen.findByTestId("project-source-quote-link")).toHaveTextContent(
      he.projectSourceQuoteValue("Q-00002", null),
    );
    expect(screen.queryByText(/גרסה/)).toBeNull();
  });

  it("shows truthful empty jobs state and reuses existing createJob path once", async () => {
    api.createJob.mockResolvedValue({ id: "j-new", number: "J-9" });
    renderWorkspace();
    expect(await screen.findByTestId("project-jobs-empty")).toBeTruthy();
    expect(screen.getByText(he.projectJobsEmptyTitle)).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("project-start-install"));
    await waitFor(() => expect(api.createJob).toHaveBeenCalledTimes(1));
    expect(api.createJob).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({
        project_id: "p1",
        kind: "installation",
        customer_id: "c1",
        site_id: "s1",
      }),
    );
    expect(navigate).toHaveBeenCalledWith({
      to: "/app/jobs/$jobId",
      params: { jobId: "j-new" },
      search: { from: "project", projectId: "p1" },
    });
  });

  it("lists multiple jobs with assignee / unassigned and open links", async () => {
    api.listJobs.mockResolvedValue({
      items: [
        {
          id: "j1",
          workspace_id: "ws1",
          number: "J-001",
          title: "התקנה פעילה",
          status: "in_progress",
          is_assigned: true,
          assignees: [{ user_id: "t1", display_name: "דניאל" }],
          scheduled_for: "2026-09-24T16:00:00Z",
        },
        {
          id: "j2",
          workspace_id: "ws1",
          number: "J-002",
          title: "עבודה הושלמה",
          status: "completed",
          is_assigned: true,
          assignees: [{ user_id: "t1", display_name: "דניאל" }],
        },
        {
          id: "j3",
          workspace_id: "ws1",
          number: "J-003",
          title: "ממתינה לשיבוץ",
          status: "scheduled",
          is_assigned: false,
          assignees: [],
        },
        {
          id: "j4",
          workspace_id: "ws1",
          number: "J-004",
          title: "חסומה",
          status: "blocked",
          is_assigned: false,
          assignees: [],
        },
      ],
    });
    renderWorkspace();
    expect(await screen.findAllByTestId("project-job-card")).toHaveLength(4);
    expect(screen.getAllByText("דניאל").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(he.projectJobUnassigned).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(he.jobStatuses.completed).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(he.jobStatuses.blocked).length).toBeGreaterThanOrEqual(1);
    const open = screen.getAllByTestId("project-job-open");
    expect(open[0].getAttribute("href")).toBe("/app/jobs/j1?from=project&projectId=p1");
    expect(screen.getByTestId("project-ops-summary").textContent).toContain("4 עבודות");
  });

  it("hides source quote when quotes.view is denied", async () => {
    canMock.mockImplementation(
      (_role: string | undefined, permission: string) =>
        permission === "jobs.view" || permission === "crm.view" || permission === "sites.view",
    );
    renderWorkspace();
    expect(await screen.findByRole("heading", { name: "התקנת חניון" })).toBeTruthy();
    expect(api.getQuote).not.toHaveBeenCalled();
    expect(screen.queryByText(/Q-00002/)).toBeNull();
    expect(screen.queryByText(he.projectSourceQuoteLabel)).toBeNull();
  });

  it("hides source quote when quote fetch is forbidden", async () => {
    api.getQuote.mockRejectedValue(new ApiClientError(403, "FORBIDDEN", "אין הרשאה"));
    renderWorkspace();
    expect(await screen.findByRole("heading", { name: "התקנת חניון" })).toBeTruthy();
    await waitFor(() => expect(api.getQuote).toHaveBeenCalled());
    expect(screen.queryByText(/Q-00002/)).toBeNull();
  });

  it("handles project without site and without inventing create CTA", async () => {
    api.getProject.mockResolvedValue({
      id: "p1",
      workspace_id: "ws1",
      name: "בלי אתר",
      status: "active",
      customer_id: "c1",
      site_id: null,
      source_quote_id: null,
      created_at: "2026-09-20T10:00:00Z",
      updated_at: "2026-09-22T10:00:00Z",
    });
    renderWorkspace();
    expect(await screen.findByRole("heading", { name: "בלי אתר" })).toBeTruthy();
    expect(screen.getAllByText(he.projectNotDefined).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId("project-start-install")).toBeNull();
    expect(screen.getByText(he.projectJobsEmptyNeedsSite)).toBeTruthy();
  });

  it("hides job create when jobs.create is not allowed", async () => {
    canMock.mockImplementation(
      (_role: string | undefined, permission: string) =>
        permission === "jobs.view" ||
        permission === "quotes.view" ||
        permission === "crm.view" ||
        permission === "sites.view",
    );
    renderWorkspace();
    expect(await screen.findByTestId("project-jobs-empty")).toBeTruthy();
    expect(screen.queryByTestId("project-start-install")).toBeNull();
  });

  it("patches project status when projects.edit is granted", async () => {
    api.patchProject.mockResolvedValue({
      id: "p1",
      workspace_id: "ws1",
      name: "התקנת חניון",
      status: "on_hold",
      customer_id: "c1",
      site_id: "s1",
      source_quote_id: "q1",
      created_at: "2026-09-20T10:00:00Z",
      updated_at: "2026-09-22T10:00:00Z",
    });
    renderWorkspace();
    expect(await screen.findByTestId("project-status-edit")).toBeTruthy();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(he.status), "on_hold");
    await waitFor(() =>
      expect(api.patchProject).toHaveBeenCalledWith("ws1", "p1", { status: "on_hold" }),
    );
  });

  it("hides status editor without projects.edit", async () => {
    canMock.mockImplementation(
      (_role: string | undefined, permission: string) =>
        permission === "jobs.view" ||
        permission === "quotes.view" ||
        permission === "crm.view" ||
        permission === "sites.view",
    );
    renderWorkspace();
    expect(await screen.findByRole("heading", { name: "התקנת חניון" })).toBeTruthy();
    expect(screen.queryByTestId("project-status-edit")).toBeNull();
    expect(screen.getAllByText(he.projectStatuses.in_progress).length).toBeGreaterThanOrEqual(1);
  });

  it("shows not-found/error from project load", async () => {
    api.getProject.mockRejectedValue(new ApiClientError(404, "NOT_FOUND", "לא נמצא"));
    renderWorkspace();
    expect(await screen.findByText("לא נמצא")).toBeTruthy();
  });

  it("shows create-installed-assets action with systems.edit and remaining qty", async () => {
    renderWorkspace();
    expect(await screen.findByTestId("create-installed-assets-action")).toBeTruthy();
    expect(screen.getByText(he.projectCreateInstalledAssets)).toBeTruthy();
    expect((await screen.findAllByTestId("planned-scope-progress")).length).toBeGreaterThanOrEqual(1);
  });

  it("hides create-installed-assets without systems.edit", async () => {
    canMock.mockImplementation(
      (_role: string | undefined, permission: string) =>
        permission === "jobs.view" ||
        permission === "quotes.view" ||
        permission === "crm.view" ||
        permission === "sites.view" ||
        permission === "projects.view",
    );
    renderWorkspace();
    expect(await screen.findByTestId("project-planned-scope")).toBeTruthy();
    expect(screen.queryByTestId("create-installed-assets-action")).toBeNull();
  });

  it("confirms and creates installed assets once", async () => {
    renderWorkspace();
    const user = userEvent.setup();
    await user.click(await screen.findByTestId("create-installed-assets-action"));
    expect(await screen.findByTestId("create-installed-assets-confirm")).toBeTruthy();
    expect(api.previewCreateInstalledAssets).toHaveBeenCalledWith("ws1", "p1");
    await user.click(screen.getByTestId("create-installed-assets-submit"));
    await waitFor(() => expect(api.createInstalledAssets).toHaveBeenCalledWith("ws1", "p1"));
    expect(await screen.findByTestId("create-installed-assets-result")).toHaveTextContent(
      he.projectCreateInstalledAssetsSuccess(8),
    );
  });
});
