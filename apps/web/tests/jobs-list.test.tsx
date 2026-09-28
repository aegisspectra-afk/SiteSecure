import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobsListPage } from "../src/components/jobs/JobsListPage";
import { he } from "../src/i18n/he";
import { ApiClientError } from "@site-secure/api-client";

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
}));

const canMock = vi.fn((_role: string | undefined, permission: string) =>
  ["jobs.view", "projects.view", "crm.view", "sites.view"].includes(permission),
);

vi.mock("../src/lib/can", () => ({
  can: (...args: unknown[]) => canMock(...(args as [string | undefined, string])),
}));

const api = {
  listJobs: vi.fn(),
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: "manager",
          features: ["core", "crm", "projects", "service"],
        },
      ],
    },
    api,
  }),
}));

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <JobsListPage />
    </QueryClientProvider>,
  );
}

const sampleJobs = [
  {
    id: "j1",
    workspace_id: "ws1",
    number: "J-001",
    title: "התקנה פעילה",
    status: "in_progress",
    customer_id: "c1",
    site_id: "s1",
    project_id: "p1",
    customer_name: "לקוח א",
    site_name: "אתר א",
    project_name: "פרויקט א",
    is_assigned: true,
    assignees: [{ user_id: "t1", display_name: "דניאל" }],
    scheduled_for: "2026-09-25T08:00:00Z",
  },
  {
    id: "j2",
    workspace_id: "ws1",
    number: "J-002",
    title: "הושלמה",
    status: "completed",
    customer_id: "c1",
    site_id: "s1",
    customer_name: "לקוח א",
    site_name: "אתר א",
    is_assigned: true,
    assignees: [{ user_id: "t1", display_name: "דניאל" }],
  },
  {
    id: "j3",
    workspace_id: "ws1",
    number: "J-003",
    title: "ללא שיבוץ",
    status: "scheduled",
    customer_id: "c2",
    site_id: null,
    customer_name: "לקוח ב",
    is_assigned: false,
    assignees: [],
  },
];

describe("JobsListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    canMock.mockImplementation((_role: string | undefined, permission: string) =>
      ["jobs.view", "projects.view", "crm.view", "sites.view"].includes(permission),
    );
    api.listJobs.mockResolvedValue({ items: sampleJobs });
  });

  it("renders jobs with context, assignee, and open links", async () => {
    renderList();
    expect(await screen.findByTestId("jobs-list-page")).toBeTruthy();
    expect(screen.getByRole("heading", { name: he.jobsListTitle })).toBeTruthy();
    expect(await screen.findAllByTestId("project-job-card")).toHaveLength(3);
    expect(screen.getAllByText("לקוח א").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(he.projectJobUnassigned).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("project-job-open")[0].getAttribute("href")).toBe(
      "/app/jobs/j1?from=jobs",
    );
    expect(api.listJobs).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({
        include_assignees: true,
        include_context: true,
        limit: 100,
      }),
    );
  });

  it("marks completed rows quieter", async () => {
    renderList();
    const cards = await screen.findAllByTestId("project-job-card");
    const completed = cards.find((el) => el.getAttribute("data-job-id") === "j2");
    expect(completed?.getAttribute("data-quiet")).toBe("true");
    expect(completed?.className).toContain("is-quiet");
  });

  it("shows list skeleton while loading", async () => {
    let resolveJobs: (value: { items: typeof sampleJobs }) => void = () => undefined;
    api.listJobs.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveJobs = resolve;
        }),
    );
    renderList();
    expect(await screen.findByTestId("jobs-list-loading")).toBeTruthy();
    resolveJobs({ items: sampleJobs });
    expect(await screen.findByTestId("jobs-list-rows")).toBeTruthy();
  });

  it("shows empty state when no jobs exist", async () => {
    api.listJobs.mockResolvedValue({ items: [] });
    renderList();
    expect(await screen.findByTestId("jobs-list-empty")).toBeTruthy();
    expect(screen.getByText(he.jobsListEmptyTitle)).toBeTruthy();
  });

  it("shows filtered empty and reset", async () => {
    api.listJobs.mockResolvedValue({ items: [] });
    renderList();
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText(he.jobsFilterStatus), "completed");
    expect(await screen.findByTestId("jobs-list-filtered-empty")).toBeTruthy();
    expect(screen.getByText(he.jobsListFilteredEmptyBody)).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: he.jobsFilterReset })[0]);
    await waitFor(() =>
      expect(api.listJobs).toHaveBeenCalledWith(
        "ws1",
        expect.objectContaining({ status: undefined }),
      ),
    );
  });

  it("applies assignment filter", async () => {
    renderList();
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText(he.jobsFilterAssignment), "unassigned");
    await waitFor(() =>
      expect(api.listJobs).toHaveBeenCalledWith(
        "ws1",
        expect.objectContaining({ assignment: "unassigned" }),
      ),
    );
  });

  it("debounces search before calling listJobs", async () => {
    renderList();
    await waitFor(() => expect(api.listJobs).toHaveBeenCalledTimes(1));
    api.listJobs.mockClear();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const input = screen.getByLabelText(he.jobsListSearch);
    fireEvent.change(input, { target: { value: "J" } });
    fireEvent.change(input, { target: { value: "J-00" } });
    expect(api.listJobs).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(api.listJobs).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(api.listJobs).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({ q: "J-00" }),
    );
    vi.useRealTimers();
  });

  it("shows API error", async () => {
    api.listJobs.mockRejectedValue(new ApiClientError(500, "ERR", "כשל טעינה"));
    renderList();
    expect(await screen.findByText("כשל טעינה")).toBeTruthy();
    expect(screen.getByTestId("jobs-list-error")).toBeTruthy();
  });
});
