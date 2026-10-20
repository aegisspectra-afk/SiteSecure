import { Button } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { RequireSspAction } from "../../../components/ssp/RequireSspAction";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { productRoleLabelHe } from "../../../lib/ssp-product-authz";

export const Route = createFileRoute("/app/ssp/officers")({
  component: () => (
    <RequireSspAction permission="ssp.officers.view">
      <SspOfficersPage />
    </RequireSspAction>
  ),
});

function SspOfficersPage() {
  const { api, workspaceId } = useSspWorkspace();
  const list = useQuery({
    queryKey: ["ssp-officers", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspOfficers(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-officers">
      <ModuleScaffold title={he.sspOfficersTitle} lead={he.sspOfficersLead}>
        {list.isLoading ? <EmptyRows message={he.loading} /> : null}
        {list.isError ? (
          <ErrorState
            title={he.apiUnavailable}
            description={he.sspWaitingLocalDb}
            action={
              <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
                {he.retry}
              </Button>
            }
          />
        ) : null}
        {!list.isLoading && !list.isError && !(list.data?.items.length) ? (
          <p className="ss-module-empty-text">{he.sspNoItems}</p>
        ) : null}
        <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
          {(list.data?.items ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-mono text-xs text-fg-muted">{row.user_id.slice(0, 8)}…</span>
              <span>{productRoleLabelHe(row.product_role)}</span>
            </li>
          ))}
        </ul>
      </ModuleScaffold>
    </div>
  );
}
