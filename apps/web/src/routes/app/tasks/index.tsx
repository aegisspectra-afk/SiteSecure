import { ApiClientError } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  CreatePanel,
  EmptyRows,
  ErrorState,
  Input,
  ModuleScaffold,
  SearchCreateBar,
  SimpleEntityTable,
  useMutation,
  useQuery,
} from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/tasks/")({
  component: TasksPage,
});

function TasksPage() {
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
  const canEdit = can(membership?.role_key, "calendar.edit", features);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["tasks", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listTasks(workspaceId!, { limit: 100 }),
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
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.tasksError),
  });

  const complete = useMutation({
    mutationFn: (taskId: string) => api.patchTask(workspaceId!, taskId, { status: "done" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] }),
  });

  if (!workspaceId) return <ErrorState title={he.tasksError} />;
  if (listQuery.isError) return <ErrorState title={he.tasksError} />;

  return (
    <ModuleScaffold title={he.tasksTitle} lead={he.tasksLead}>
      <SearchCreateBar
        query=""
        onQuery={() => undefined}
        canCreate={canEdit}
        creating={creating}
        onToggleCreate={() => setCreating((v) => !v)}
        createLabel={he.tasksCreate}
      />
      <CreatePanel
        open={creating}
        pending={create.isPending}
        error={formError}
        onSubmit={(ev: FormEvent) => {
          ev.preventDefault();
          if (!title.trim()) return;
          create.mutate();
        }}
      >
        <Input id="task-title" label={he.titleField} value={title} onChange={(ev) => setTitle(ev.target.value)} required />
        <Input id="task-due" label={he.dueAt} type="datetime-local" value={dueAt} onChange={(ev) => setDueAt(ev.target.value)} />
      </CreatePanel>
      {listQuery.isLoading ? (
        <EmptyRows message={he.loading} />
      ) : (listQuery.data?.items ?? []).length === 0 ? (
        <EmptyRows message={he.tasksEmpty} />
      ) : (
        <div className="space-y-3">
          <SimpleEntityTable
            empty={he.tasksEmpty}
            rows={(listQuery.data?.items ?? []).map((row) => ({
              id: row.id,
              title: row.title,
              meta: row.due_at ? new Date(row.due_at).toLocaleString("he-IL") : undefined,
              status: row.status,
            }))}
          />
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {(listQuery.data?.items ?? [])
                .filter((row) => row.status === "open")
                .map((row) => (
                  <Button key={row.id} type="button" variant="secondary" onClick={() => complete.mutate(row.id)}>
                    {he.tasksMarkDone}: {row.title}
                  </Button>
                ))}
            </div>
          ) : null}
        </div>
      )}
    </ModuleScaffold>
  );
}
