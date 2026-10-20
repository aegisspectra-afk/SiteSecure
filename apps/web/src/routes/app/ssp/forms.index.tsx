import { Button } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useState } from "react";
import {
  EmptyRows,
  ErrorState,
  ModuleScaffold,
  SimpleEntityTable,
  useMutation,
  useQuery,
} from "../../../components/modules/ModuleKit";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/forms/")({
  component: SspFormsPage,
});

function statusLabel(status: string) {
  if (status === "published") return he.sspStatusPublished;
  if (status === "archived") return he.sspStatusArchived;
  return he.sspStatusDraft;
}

function SspFormsPage() {
  const { api, workspaceId, canEdit } = useSspWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["ssp-forms", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspForms(workspaceId!),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createSspForm(workspaceId!, {
        title: "טופס חדש",
        description: "",
      }),
    onSuccess: async (form) => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-forms", workspaceId] });
      void navigate({ to: "/app/ssp/forms/$formId", params: { formId: form.id } });
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : he.apiUnavailable);
    },
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-forms">
      <ModuleScaffold
        title={he.sspNavFormTemplates}
        lead={he.sspFormTemplatesLead}
        action={
          canEdit ? (
            <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
              {he.sspNewForm}
            </Button>
          ) : null
        }
      >
        <SspHubLinks items={[{ to: "/app/ssp/templates", label: he.sspNavTemplatesHub }]} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {listQuery.isError ? (
          <ErrorState
            title={he.apiUnavailable}
            action={
              <Button type="button" variant="secondary" onClick={() => void listQuery.refetch()}>
                {he.retry}
              </Button>
            }
          />
        ) : null}
        {listQuery.isLoading ? <EmptyRows message={he.loading} /> : null}
        {!listQuery.isLoading && !listQuery.isError && !(listQuery.data?.items.length) ? (
          <div className="ops-card flex flex-col items-start gap-3 p-6" data-testid="ssp-no-forms">
            <div>
              <p className="text-base font-semibold text-fg">{he.sspNoForms}</p>
            </div>
            {canEdit ? (
              <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
                {he.sspNewForm}
              </Button>
            ) : null}
          </div>
        ) : !listQuery.isLoading && !listQuery.isError ? (
          <SimpleEntityTable
            empty={he.sspNoForms}
            leadingIcon={FileText}
            statusLabel={statusLabel}
            rows={(listQuery.data?.items ?? []).map((form) => ({
              id: form.id,
              title: form.title,
              meta: form.latest_published_version ? `v${form.latest_published_version}` : "—",
              status: form.status,
              href: `/app/ssp/forms/${form.id}`,
            }))}
          />
        ) : null}
      </ModuleScaffold>
    </div>
  );
}
