import { Button, Card, Select, Status } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyRows, ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/enrollments")({
  validateSearch: (search: Record<string, unknown>): { status?: string } => {
    const status = typeof search.status === "string" ? search.status : undefined;
    return status ? { status } : {};
  },
  component: SspEnrollmentsPage,
});

function statusLabel(status: string) {
  if (status === "pending") return he.sspActivationPendingApproval;
  if (status === "approved") return he.sspEnrollApproved;
  if (status === "denied") return he.sspEnrollDenied;
  if (status === "cancelled") return he.sspEnrollCancelled;
  if (status === "expired") return he.sspEnrollExpired;
  return status;
}

function statusTone(status: string): "neutral" | "warning" | "success" | "danger" {
  if (status === "pending") return "warning";
  if (status === "approved") return "success";
  if (status === "denied") return "danger";
  return "neutral";
}

function SspEnrollmentsPage() {
  const { api, workspaceId, canEdit } = useSspWorkspace();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [status, setStatus] = useState(search.status ?? "pending");
  const [msg, setMsg] = useState<string | null>(null);

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
    <div data-testid="ssp-enrollments">
      <ModuleScaffold title={he.sspNavEnrollments} lead={he.sspEnrollmentsLead}>
        <Select
          id="ssp-enroll-status"
          label={he.sspFilterStatus}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">הכול</option>
          <option value="pending">{he.sspActivationPendingApproval}</option>
          <option value="approved">{he.sspEnrollApproved}</option>
          <option value="denied">{he.sspEnrollDenied}</option>
          <option value="cancelled">{he.sspEnrollCancelled}</option>
          <option value="expired">{he.sspEnrollExpired}</option>
        </Select>
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
        {!list.isLoading && !list.isError && !list.data?.items.length ? (
          <div className="ops-card flex flex-col items-start gap-3 p-6">
            <p className="text-base font-semibold text-fg">{he.sspNoEnrollments}</p>
            <p className="text-sm text-fg-muted">{he.sspEnrollmentsLead}</p>
          </div>
        ) : null}
        {msg ? <p className="text-sm text-danger">{msg}</p> : null}
        <ul className="flex flex-col gap-3">
          {(list.data?.items ?? []).map((e) => (
            <li key={e.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link
                    to="/app/ssp/sites/$siteId"
                    params={{ siteId: e.site_pk }}
                    className="font-medium text-fg hover:underline"
                  >
                    {e.site_name || e.site_pk}
                  </Link>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {e.audience === "user" ? he.sspAudienceUser : he.sspAudienceDevice}
                    {e.requested_user_id ? ` · ${e.requested_user_id}` : ""}
                    {e.site_phone ? ` · ${e.site_phone}` : ""} · {e.created_at.slice(0, 16)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Status label={statusLabel(e.status)} tone={statusTone(e.status)} />
                  {canEdit && e.status === "pending" ? (
                    <>
                      <Button type="button" onClick={() => decide.mutate({ id: e.id, action: "approve" })}>
                        {he.sspApproveEnrollment}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => decide.mutate({ id: e.id, action: "deny" })}>
                        {he.sspDenyEnrollment}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => decide.mutate({ id: e.id, action: "cancel" })}>
                        {he.sspCancelEnrollment}
                      </Button>
                    </>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </ModuleScaffold>
    </div>
  );
}
