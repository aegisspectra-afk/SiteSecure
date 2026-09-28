import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClientError } from "@site-secure/api-client";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { he } from "../src/i18n/he";
import {
  formatTaskDue,
  sortTasksForDisplay,
  taskStatusLabel,
  taskTypeLabel,
} from "../src/lib/tasks";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: () => ReactNode }) => opts,
  Link: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const canMock = vi.fn((_role: string | undefined, permission: string) =>
  ["calendar.view", "calendar.edit"].includes(permission),
);

vi.mock("../src/lib/can", () => ({
  can: (...args: unknown[]) => canMock(...(args as [string | undefined, string])),
}));

const api = {
  listTasks: vi.fn(),
  createTask: vi.fn(),
  patchTask: vi.fn(),
};

const sessionState = {
  role_key: "manager" as string,
  features: ["core"] as string[],
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: sessionState.role_key,
          features: sessionState.features,
        },
      ],
    },
    api,
  }),
}));

import { TasksPage } from "../src/routes/app/tasks/index";

const sampleTasks = [
  {
    id: "t-open",
    workspace_id: "ws1",
    type: "other",
    status: "open",
    title: "משימה פתוחה",
    due_at: "2026-09-27T10:00:00Z",
    assignee_id: "u1",
    customer_id: null,
    site_id: null,
    lead_id: null,
    quote_id: null,
    job_id: null,
    notes: null,
    time_window: null,
    visit_status: null,
    created_by: "u1",
    created_at: "2026-09-26T08:00:00Z",
    updated_at: "2026-09-26T08:00:00Z",
  },
  {
    id: "t-visit",
    workspace_id: "ws1",
    type: "visit",
    status: "open",
    title: "ביקור לקוח",
    due_at: null,
    assignee_id: "u1",
    customer_id: null,
    site_id: null,
    lead_id: "lead1",
    quote_id: null,
    job_id: null,
    notes: null,
    time_window: "afternoon",
    visit_status: "pending_schedule",
    created_by: "u1",
    created_at: "2026-09-26T09:00:00Z",
    updated_at: "2026-09-26T09:00:00Z",
  },
  {
    id: "t-done",
    workspace_id: "ws1",
    type: "follow_up",
    status: "done",
    title: "משימה שהושלמה",
    due_at: null,
    assignee_id: "u1",
    customer_id: null,
    site_id: null,
    lead_id: null,
    quote_id: null,
    job_id: null,
    notes: null,
    time_window: null,
    visit_status: null,
    created_by: "u1",
    created_at: "2026-09-25T08:00:00Z",
    updated_at: "2026-09-25T12:00:00Z",
  },
];

function renderTasks() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TasksPage />
    </QueryClientProvider>,
  );
}

describe("tasks helpers", () => {
  it("renders Hebrew status and type labels", () => {
    expect(taskStatusLabel("open")).toBe(he.tasksStatusOpen);
    expect(taskStatusLabel("done")).toBe(he.tasksStatusDone);
    expect(taskStatusLabel("cancelled")).toBe(he.tasksStatusCancelled);
    expect(taskTypeLabel("visit")).toBe(he.tasksTypeVisit);
    expect(taskTypeLabel("other")).toBe(he.tasksTypeOther);
  });

  it("formats missing due dates", () => {
    expect(formatTaskDue(null)).toBe(he.tasksNoDue);
    expect(formatTaskDue(undefined)).toBe(he.tasksNoDue);
  });

  it("sorts open tasks first then by due date", () => {
    const sorted = sortTasksForDisplay(sampleTasks as never);
    // open with due before open without due; done last
    expect(sorted.map((t) => t.id)).toEqual(["t-open", "t-visit", "t-done"]);
  });
});

describe("TasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.role_key = "manager";
    sessionState.features = ["core"];
    canMock.mockImplementation((_role: string | undefined, permission: string) =>
      ["calendar.view", "calendar.edit"].includes(permission),
    );
    api.listTasks.mockResolvedValue({ items: sampleTasks.filter((t) => t.status === "open") });
    api.createTask.mockResolvedValue({ ...sampleTasks[0], id: "t-new", title: "חדשה" });
    api.patchTask.mockResolvedValue({ ...sampleTasks[0], status: "done" });
  });

  it("shows honest Hebrew copy without calendar framing", async () => {
    renderTasks();
    expect(await screen.findByRole("heading", { name: he.tasksTitle })).toBeInTheDocument();
    expect(screen.getByText(he.tasksLead)).toBeInTheDocument();
    expect(screen.queryByText(/יומן/)).not.toBeInTheDocument();
  });

  it("gates the page on calendar.view", async () => {
    canMock.mockImplementation(() => false);
    renderTasks();
    expect(await screen.findByText(he.forbiddenTitle)).toBeInTheDocument();
    expect(api.listTasks).not.toHaveBeenCalled();
  });

  it("hides create and complete for viewers without calendar.edit", async () => {
    sessionState.role_key = "viewer";
    canMock.mockImplementation((_role, permission) => permission === "calendar.view");
    renderTasks();
    await screen.findByTestId("tasks-list");
    expect(screen.queryByRole("button", { name: he.tasksCreate })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(he.tasksCompleteAria) })).not.toBeInTheDocument();
  });

  it("creates a task without assignee_id (API defaults assignee)", async () => {
    const user = userEvent.setup();
    api.listTasks.mockResolvedValue({ items: [] });
    renderTasks();
    await screen.findByTestId("tasks-empty");
    await user.click(screen.getAllByRole("button", { name: he.tasksCreate })[0]);
    await user.type(screen.getByLabelText(he.titleField), "משימת טכנאי");
    await user.click(screen.getByRole("button", { name: he.save }));
    await waitFor(() => expect(api.createTask).toHaveBeenCalled());
    expect(api.createTask).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({ title: "משימת טכנאי" }),
    );
    const body = api.createTask.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("assignee_id");
  });

  it("completes an open task from its row", async () => {
    const user = userEvent.setup();
    renderTasks();
    const list = await screen.findByTestId("tasks-list");
    const rows = within(list).getAllByTestId("tasks-row");
    expect(rows.length).toBeGreaterThan(0);
    const completeBtn = within(rows[0]).getByRole("button", {
      name: new RegExp(he.tasksCompleteAria),
    });
    await user.click(completeBtn);
    await waitFor(() => expect(api.patchTask).toHaveBeenCalled());
    expect(api.patchTask).toHaveBeenCalledWith("ws1", expect.any(String), { status: "done" });
  });

  it("renders Hebrew status and visit type on rows", async () => {
    renderTasks();
    const list = await screen.findByTestId("tasks-list");
    expect(within(list).getAllByText(he.tasksStatusOpen).length).toBeGreaterThan(0);
    expect(within(list).getByText(he.tasksTypeVisit)).toBeInTheDocument();
  });

  it("shows empty state with create CTA", async () => {
    api.listTasks.mockResolvedValue({ items: [] });
    renderTasks();
    const empty = await screen.findByTestId("tasks-empty");
    expect(screen.getByText(he.tasksEmptyOpen)).toBeInTheDocument();
    expect(within(empty).getByRole("button", { name: he.tasksCreate })).toBeInTheDocument();
  });

  it("shows error state with retry", async () => {
    const user = userEvent.setup();
    api.listTasks.mockRejectedValueOnce(new ApiClientError(500, "ERR", "fail"));
    api.listTasks.mockResolvedValueOnce({ items: sampleTasks.filter((t) => t.status === "open") });
    renderTasks();
    expect(await screen.findByText(he.tasksError)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: he.tasksRetry }));
    await waitFor(() => expect(screen.getByTestId("tasks-list")).toBeInTheDocument());
    expect(api.listTasks).toHaveBeenCalledTimes(2);
  });

  it("filters open vs all via status tabs", async () => {
    const user = userEvent.setup();
    api.listTasks
      .mockResolvedValueOnce({ items: sampleTasks.filter((t) => t.status === "open") })
      .mockResolvedValueOnce({ items: sampleTasks });
    renderTasks();
    await screen.findByTestId("tasks-list");
    expect(api.listTasks).toHaveBeenCalledWith("ws1", expect.objectContaining({ status: "open" }));
    await user.click(screen.getByRole("tab", { name: he.tasksFilterAll }));
    await waitFor(() =>
      expect(api.listTasks).toHaveBeenLastCalledWith("ws1", expect.objectContaining({ limit: 100 })),
    );
    const last = api.listTasks.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(last).not.toHaveProperty("status");
  });

  it("supports technician create and complete controls", async () => {
    sessionState.role_key = "technician";
    canMock.mockImplementation((_role, permission) =>
      ["calendar.view", "calendar.edit"].includes(permission),
    );
    const user = userEvent.setup();
    renderTasks();
    await screen.findByTestId("tasks-list");
    expect(screen.getAllByRole("button", { name: he.tasksCreate }).length).toBeGreaterThan(0);
    const row = screen.getAllByTestId("tasks-row")[0];
    const completeBtn = within(row).getByRole("button", { name: new RegExp(he.tasksCompleteAria) });
    expect(completeBtn).toBeInTheDocument();
    await user.click(completeBtn);
    await waitFor(() => expect(api.patchTask).toHaveBeenCalled());
  });

  it("uses mobile-friendly complete control class", async () => {
    renderTasks();
    const list = await screen.findByTestId("tasks-list");
    const btn = within(list).getAllByRole("button", { name: new RegExp(he.tasksCompleteAria) })[0];
    expect(btn.className).toMatch(/ss-tasks-complete/);
  });
});
