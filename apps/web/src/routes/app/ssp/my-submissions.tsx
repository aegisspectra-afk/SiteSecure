import { Button } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { EmptyRows, ErrorState, ModuleScaffold, SimpleEntityTable, useQuery } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/my-submissions")({
  component: SspMySubmissionsPage,
});

function SspMySubmissionsPage() {
  const { api, workspaceId } = useSspWorkspace();
  const list = useQuery({
    queryKey: ["ssp-submissions", workspaceId, "mine"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSubmissions(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-my-submissions">
      <ModuleScaffold title={he.sspNavMySubmissions} lead={he.sspMySubmissionsLead}>
        {list.isError ? (
          <ErrorState
            title={he.apiUnavailable}
            action={
              <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
                {he.retry}
              </Button>
            }
          />
        ) : null}
        {list.isLoading ? <EmptyRows message={he.loading} /> : null}
        {!list.isLoading && !list.isError && !list.data?.items.length ? (
          <div className="ops-card p-6">
            <p className="text-base font-semibold text-fg">{he.sspNoSubmissions}</p>
          </div>
        ) : !list.isLoading && !list.isError ? (
          <SimpleEntityTable
            empty={he.sspNoSubmissions}
            leadingIcon={Inbox}
            rows={(list.data?.items ?? []).map((row) => ({
              id: row.id,
              title: row.form_title || row.form_id.slice(0, 8),
              meta: `${he.sspSubmittedAt}: ${new Date(row.submitted_at).toLocaleString("he-IL")}`,
              status: row.status,
              href: `/app/ssp/submissions/${row.id}`,
            }))}
          />
        ) : null}
      </ModuleScaffold>
    </div>
  );
}
