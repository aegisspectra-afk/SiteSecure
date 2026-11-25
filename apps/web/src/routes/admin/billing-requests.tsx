import { Select, PageHeader, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { he } from "../../i18n/he";
import { planLabel } from "../../lib/app-nav";
import { useSession } from "../../lib/session";

const STATUSES = ["pending", "contacted", "closed"] as const;

export const Route = createFileRoute("/admin/billing-requests")({
  component: AdminBillingRequests,
});

function AdminBillingRequests() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["admin-billing-upgrades", status],
    queryFn: () => api.adminBillingUpgradeRequests(status ? { status } : {}),
  });
  const patch = useMutation({
    mutationFn: (input: { id: string; status?: string; internal_note?: string }) =>
      api.adminPatchBillingUpgradeRequest(input.id, {
        status: input.status as (typeof STATUSES)[number] | undefined,
        internal_note: input.internal_note,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-billing-upgrades"] }),
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminBillingUpgradeRequests} description={he.settingsBillingUpgradeHint} />
      <Select
        id="admin-billing-status"
        label={he.adminStatus}
        value={status}
        onChange={(ev) => setStatus(ev.target.value)}
      >
        <option value="">הכול</option>
        {STATUSES.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </Select>
      {query.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {!query.isLoading && (query.data ?? []).length === 0 ? (
        <p className="text-sm text-fg-muted">{he.adminBillingUpgradeEmpty}</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {(query.data ?? []).map((row) => (
          <li key={row.id} className="ops-card px-4 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-fg">{row.workspace_name ?? row.workspace_id}</p>
              <p className="text-xs text-fg-muted">{row.status}</p>
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {planLabel(row.current_plan_key)}
              {row.target_plan_key ? ` → ${planLabel(row.target_plan_key)}` : ""}
              {row.requested_extra_seats ? ` · +${row.requested_extra_seats} משתמשים` : ""}
              {row.estimated_monthly_ils_before_vat != null
                ? ` · ₪${Number(row.estimated_monthly_ils_before_vat).toLocaleString("he-IL")} / חודש`
                : ""}
            </p>
            <p className="mt-1 text-sm text-fg-muted">
              {row.contact_name || row.full_name || row.email || row.user_id}
              {row.contact_phone ? ` · ${row.contact_phone}` : ""}
              {row.contact_email ? ` · ${row.contact_email}` : ""}
            </p>
            {row.message ? <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{row.message}</p> : null}
            <p className="ltr-meta mt-2 text-xs text-fg-subtle">
              {row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : ""}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <Select
                id={`billing-st-${row.id}`}
                label={he.adminStatus}
                value={row.status}
                onChange={(ev) => patch.mutate({ id: row.id, status: ev.target.value })}
              >
                {STATUSES.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </Select>
              <Textarea
                id={`billing-note-${row.id}`}
                label={he.adminWorkspaceSubscriptionNote}
                defaultValue={row.internal_note ?? ""}
                rows={2}
                onBlur={(ev) => {
                  const next = ev.target.value.trim();
                  if (next !== (row.internal_note ?? "")) {
                    patch.mutate({ id: row.id, internal_note: next || undefined });
                  }
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}