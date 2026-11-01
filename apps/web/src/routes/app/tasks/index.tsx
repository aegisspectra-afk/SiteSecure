import { ApiClientError } from "@site-secure/api-client";
import { Button, ErrorState, Input } from "@site-secure/ui";
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
  const [filter, setFilter] = useState<TasksStatusFilter>("open");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["tasks", workspaceId, filter],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listTasks(workspaceId!, filter === "open" ? { status: "open", limit: 100 } : { limit: 100 }),
  });

  const create = useMutation({
    mutationFn: () =>
      api.createTask(workspaceId!, {
        title: title.trim(),
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      setCreating(false);
      setTitle("");
      setDueAt("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.tasksError),
  });

  const complete = useMutation({
    mutationFn: (taskId: string) => api.patchTask(workspaceId!, taskId, { status: "done" }),
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
              {canEdit && row.status === "open" ? (
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
