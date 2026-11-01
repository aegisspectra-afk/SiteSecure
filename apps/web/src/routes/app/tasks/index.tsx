import { ApiClientError } from "@site-secure/api-client";
import { Button, ErrorState, Input, Select } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { downloadCsv } from "../../../lib/download-blob";
import { useSession } from "../../../lib/session";
import {
  formatTaskDue,
  sortTasksForDisplay,
  taskStatusLabel,
  taskTypeLabel,
  type TasksStatusFilter,
} from "../../../lib/tasks";

export const Route = createFileRoute("/app/tasks/")({
  component: TasksPage,
});

export function TasksPage() {
  return (
    <RequirePermission permission="calendar.view">
      <TasksBody />
    </RequirePermission>
  );
}

function TasksBody() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const grants = membership?.permissions ?? null;
  const canEdit = can(membership?.role_key, "calendar.edit", features, grants);
  const canExport = can(membership?.role_key, "calendar.export", features, grants);
  const assignedOnly = membership?.role_key === "technician" || membership?.role_key === "workforce_member";
  const actorId = session?.user_id;
  const [filter, setFilter] = useState<TasksStatusFilter>("open");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId && canEdit),
    queryFn: () => api.listMembers(workspaceId!),
  });
  const members = membersQuery.data ?? [];

  const listQuery = useQuery({
    queryKey: ["tasks", workspaceId, filter, search],
    enabled: Boolean(workspaceId),
    queryFn: () => {
      const opts: { limit: number; status?: string; q?: string } = { limit: 100 };
      if (filter === "open") opts.status = "open";
      if (search.trim()) opts.q = search.trim();
      return api.listTasks(workspaceId!, opts);
    },
  });

  const create = useMutation({
    mutationFn: () => {
      const body: { title: string; due_at?: string; assignee_id?: string } = { title: title.trim() };
      if (dueAt) body.due_at = new Date(dueAt).toISOString();
      if (assigneeId) body.assignee_id = assigneeId;
      return api.createTask(workspaceId!, body);
    },
    onSuccess: () => {
      setCreating(false);
      setTitle("");
      setDueAt("");
      setAssigneeId("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.tasksError),
  });

  const complete = useMutation({
    mutationFn: (taskId: string) => api.patchTask(workspaceId!, taskId, { status: "done" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] }),
  });
  const assign = useMutation({
    mutationFn: ({ taskId, next }: { taskId: string; next: string }) =>
      api.patchTask(workspaceId!, taskId, { assignee_id: next || null }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] }),
  });
  const remove = useMutation({
    mutationFn: (taskId: string) => api.deleteTask(workspaceId!, taskId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] }),
  });

  const exportCsv = useMutation({
    mutationFn: async () => {
      if (!workspaceId) return;
      const { blob, filename } = await api.exportTasksCsv(workspaceId, {
        status: filter === "open" ? "open" : undefined,
      });
      downloadCsv(blob, filename);
    },
    onError: () => setExportError(he.exportCsvError),
    onSuccess: () => setExportError(null),
  });

  if (!workspaceId) return <ErrorState title={he.tasksError} />;
  if (listQuery.isError) {
    return (
      <ErrorState
        title={he.tasksError}
        action={
          <Button type="button" variant="secondary" onClick={() => void listQuery.refetch()}>
            {he.tasksRetry}
          </Button>
        }
      />
    );
  }

  const items = sortTasksForDisplay(listQuery.data?.items ?? []);

  return (
    <div className="ss-tasks space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-fg">{he.tasksTitle}</h1>
        <p className="text-sm text-fg-muted">{he.tasksLead}</p>
      </header>

      <div role="tablist" className="flex flex-wrap gap-2" aria-label={he.tasksTitle}>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "open"}
          className="ss-tasks-tab"
          onClick={() => setFilter("open")}
        >
          {he.tasksFilterOpen}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "all"}
          className="ss-tasks-tab"
          onClick={() => setFilter("all")}
        >
          {he.tasksFilterAll}
        </button>
      </div>

      <Input
        id="task-search"
        label={he.tasksSearch}
        value={search}
        onChange={(ev) => setSearch(ev.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        {canExport ? (
          <Button
            type="button"
            variant="secondary"
            data-testid="tasks-export"
            aria-label={he.exportCsvTasks}
            loading={exportCsv.isPending}
            disabled={exportCsv.isPending}
            onClick={() => exportCsv.mutate()}
          >
            {he.exportCsv}
          </Button>
        ) : null}
        {canEdit ? (
          <Button type="button" onClick={() => setCreating((v) => !v)}>
            {creating ? he.cancel : he.tasksCreate}
          </Button>
        ) : null}
      </div>
      {exportError ? <p className="text-sm text-danger">{exportError}</p> : null}

      {creating ? (
        <form
          className="ops-card space-y-3 p-4"
          onSubmit={(ev: FormEvent) => {
            ev.preventDefault();
            if (!title.trim()) return;
            create.mutate();
          }}
        >
          <Input
            id="task-title"
            label={he.titleField}
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            required
          />
          <Input
            id="task-due"
            label={he.dueAt}
            type="datetime-local"
            value={dueAt}
            onChange={(ev) => setDueAt(ev.target.value)}
          />
          {members.length ? (
            <Select
              id="task-assignee"
              label={he.tasksAssignee}
              value={assigneeId}
              onChange={(ev) => setAssigneeId(ev.target.value)}
            >
              <option value="">{he.tasksAssigneeMe}</option>
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.full_name || member.email || member.user_id}
                </option>
              ))}
            </Select>
          ) : null}
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <Button type="submit" loading={create.isPending} disabled={!title.trim() || create.isPending}>
            {he.save}
          </Button>
        </form>
      ) : null}

      {listQuery.isLoading ? (
        <p>{he.loading}</p>
      ) : items.length === 0 ? (
        <div data-testid="tasks-empty" className="ss-tasks-empty">
          <p>{filter === "open" ? he.tasksEmptyOpen : he.tasksEmpty}</p>
          {canEdit ? (
            <Button type="button" className="mt-3" onClick={() => setCreating(true)}>
              {he.tasksCreate}
            </Button>
          ) : null}
        </div>
      ) : (
        <ul data-testid="tasks-list" className="ss-tasks-list space-y-2">
          {items.map((row) => (
            <li key={row.id} data-testid="tasks-row" className="ss-tasks-row ops-card flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{row.title}</p>
                <p className="text-xs text-fg-muted">
                  <span>{taskStatusLabel(row.status)}</span>
                  {" · "}
                  <span>{taskTypeLabel(row.type)}</span>
                  {" · "}
                  <span>{formatTaskDue(row.due_at)}</span>
                </p>
              </div>
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-2">
                  {members.length ? (
                    <Select
                      id={`task-assignee-${row.id}`}
                      label={he.tasksAssignee}
                      value={row.assignee_id ?? ""}
                      onChange={(ev) => assign.mutate({ taskId: row.id, next: ev.target.value })}
                    >
                      <option value="">{he.tasksUnassigned}</option>
                      {members.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.full_name || member.email || member.user_id}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                  {row.status === "open" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="ss-tasks-complete"
                      aria-label={`${he.tasksCompleteAria} ${row.title}`}
                      onClick={() => complete.mutate(row.id)}
                    >
                      {he.tasksMarkDone}
                    </Button>
                  ) : null}
                  {!assignedOnly || row.assignee_id === actorId ? (
                    <Button
                      type="button"
                      variant="secondary"
                      data-testid={`task-delete-${row.id}`}
                      aria-label={`${he.tasksDeleteAria} ${row.title}`}
                      onClick={() => remove.mutate(row.id)}
                    >
                      {he.tasksDelete}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
