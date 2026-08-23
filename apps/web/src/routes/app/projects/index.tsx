import { ApiClientError } from "@site-secure/api-client";
import { Select } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { projectStatusLabel } from "../../../lib/customer-profile";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/projects/")({
  component: ProjectsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    quoteId: typeof search.quoteId === "string" ? search.quoteId : undefined,
    customerId: typeof search.customerId === "string" ? search.customerId : undefined,
    siteId: typeof search.siteId === "string" ? search.siteId : undefined,
  }),
});

function ProjectsPage() {
  return (
    <RequirePermission permission="projects.view">
      <ProjectsBody />
    </RequirePermission>
  );
}

function ProjectsBody() {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canCreate = can(membership?.role_key, "projects.create", features);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers-pick", workspaceId],
    enabled: Boolean(workspaceId) && creating,
    queryFn: () => api.listCustomers(workspaceId!, { limit: 100 }),
  });
  const listQuery = useQuery({
    queryKey: ["projects", workspaceId, q],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listProjects(workspaceId!, { q, limit: 100 }),
  });

  const create = useMutation({
    mutationFn: () => api.createProject(workspaceId!, { name: name.trim(), customer_id: customerId }),
    onSuccess: (project) => {
      setCreating(false);
      setName("");
      setCustomerId("");
      void queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      void navigate({ to: "/app/projects/$projectId", params: { projectId: project.id } });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.projectsError),
  });

  if (!workspaceId) return <ErrorState title={he.projectsError} />;
  if (listQuery.isError) return <ErrorState title={he.projectsError} />;

  return (
    <ModuleScaffold title={he.projectsTitle} lead={he.projectsLead}>
      <SearchCreateBar
        query={q}
        onQuery={setQ}
        canCreate={canCreate}
        creating={creating}
        onToggleCreate={() => setCreating((v) => !v)}
        createLabel={he.projectsCreate}
      />
      <CreatePanel
        open={creating}
        pending={create.isPending}
        error={formError}
        onSubmit={(ev: FormEvent) => {
          ev.preventDefault();
          if (!name.trim() || !customerId) return;
          create.mutate();
        }}
      >
        <Select id="project-customer" label={he.pickCustomer} value={customerId} onChange={(ev) => setCustomerId(ev.target.value)}>
          <option value="">{he.pickCustomer}</option>
          {(customersQuery.data?.items ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.display_name}
            </option>
          ))}
        </Select>
        <Input id="project-name" label={he.name} value={name} onChange={(ev) => setName(ev.target.value)} required />
      </CreatePanel>
      {listQuery.isLoading ? (
        <EmptyRows message={he.loading} />
      ) : (
        <SimpleEntityTable
          empty={he.projectsEmpty}
          statusLabel={projectStatusLabel}
          rows={(listQuery.data?.items ?? []).map((row) => ({
            id: row.id,
            title: row.name,
            status: row.status,
            link: { to: "/app/projects/$projectId", params: { projectId: row.id } },
          }))}
        />
      )}
    </ModuleScaffold>
  );
}
