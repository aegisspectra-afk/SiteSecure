import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

const enrollmentsRouteApi = getRouteApi("/authenticated/enrollments");

export function EnrollmentsPage() {
  return (
    <RequireSspAccess anyOf={["ssp.sites.view", "ssp.forms.view"]}>
      <EnrollmentsBody />
    </RequireSspAccess>
  );
}

function EnrollmentsBody() {
  const { api, workspaceId } = useSession();
  const { sspCan } = useOrg();
  const qc = useQueryClient();
  const search = enrollmentsRouteApi.useSearch();
  const [status, setStatus] = useState(search.status || "pending");
  const [msg, setMsg] = useState<string | null>(null);
  const canManage = sspCan("ssp.sites.edit");

  const list = useQuery({
    queryKey: ["ssp-enrollments", workspaceId, status],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspEnrollments(workspaceId!, { status: status || undefined }),
    retry: false,
  });
  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "deny" | "cancel" }) => {
      if (action === "approve") return api.approveSspEnrollment(workspaceId!, id);
      if (action === "deny") return api.denySspEnrollment(workspaceId!, id);
      return api.cancelSspEnrollment(workspaceId!, id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-enrollments", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-enrollments">
      <PageHeader title={he.navEnrollments} description={he.enrollmentsLead} />
      <label className="flex max-w-xs flex-col gap-1 text-sm">
        <span>{he.filterStatus}</span>
        <select
          className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">הכול</option>
          <option value="pending">{he.activationPendingApproval}</option>
          <option value="approved">{he.enrollApproved}</option>
          <option value="denied">{he.enrollDenied}</option>
          <option value="cancelled">{he.enrollCancelled}</option>
          <option value="expired">{he.enrollExpired}</option>
        </select>
      </label>
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError} />
      {list.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {!list.isLoading && !list.data?.items.length ? (
        <p className="text-sm text-fg-muted">{he.noEnrollments}</p>
      ) : null}
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {(list.data?.items ?? []).map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <Link to="/sites/$siteId" params={{ siteId: e.site_pk }} className="font-medium underline">
                {e.site_name || e.site_pk}
              </Link>
              <div className="text-xs text-fg-muted">
                {e.site_phone || "—"} · {e.status} · {e.created_at.slice(0, 16)}
              </div>
            </div>
            {canManage && e.status === "pending" ? (
              <div className="flex gap-2">
                <Button type="button" onClick={() => decide.mutate({ id: e.id, action: "approve" })}>
                  {he.approveEnrollment}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => decide.mutate({ id: e.id, action: "deny" })}
                >
                  {he.denyEnrollment}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => decide.mutate({ id: e.id, action: "cancel" })}
                >
                  {he.cancelEnrollment}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
