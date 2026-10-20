import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { DataModeNote } from "../components/DataModeNote";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { productRoleLabelHe } from "../lib/productAuthz";
import { useSession } from "../lib/session";

export function OfficersPage() {
  return (
    <RequireSspAccess permission="ssp.officers.view">
      <OfficersBody />
    </RequireSspAccess>
  );
}

function OfficersBody() {
  const { api, workspaceId } = useSession();
  const q = useQuery({
    queryKey: ["ssp-officers", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspOfficers(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-officers">
      <PageHeader title={he.officersTitle} description={he.officersLead} />
      <DataModeNote mode={q.data?.data_mode} waitingDb={q.isError} />
      {q.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {q.isError ? (
        <Button type="button" variant="secondary" onClick={() => void q.refetch()}>
          {he.retry}
        </Button>
      ) : null}
      {!q.isLoading && !(q.data?.items.length) && !q.isError ? (
        <p className="text-sm text-fg-muted">{he.noItems}</p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {(q.data?.items ?? []).map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span className="font-mono text-xs text-fg-muted">{m.user_id.slice(0, 8)}…</span>
            <span>{productRoleLabelHe(m.product_role)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
