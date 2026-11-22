import { ApiClientError } from "@site-secure/api-client";
import { Button, Input, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { he } from "../../i18n/he";
import { planLabel } from "../../lib/app-nav";
import { useSession } from "../../lib/session";

function toLocalDatetime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetime(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type Props = {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
};

export function AdminWorkspaceSubscriptionPanel({ workspaceId, workspaceName, onClose }: Props) {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [planKey, setPlanKey] = useState("free");
  const [periodEnd, setPeriodEnd] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-workspace-subscription", workspaceId],
    queryFn: () => api.adminWorkspaceSubscription(workspaceId),
  });

  const sub = query.data?.subscription;

  useEffect(() => {
    if (!sub) return;
    setPlanKey(sub.plan_key || "free");
    setPeriodEnd(toLocalDatetime(sub.override_expires_at || sub.current_period_end));
    setNote(sub.override_reason || "");
  }, [sub]);

  const save = useMutation({
    mutationFn: () =>
      api.adminPatchWorkspaceSubscription(workspaceId, {
        plan_key: planKey,
        period_end: fromLocalDatetime(periodEnd),
        note: note.trim() || null,
        status: "manual",
      }),
    onSuccess: () => {
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-workspace-subscription", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.adminWorkspaceSubscriptionSaveFailed);
    },
  });

  const loadError =
    query.error instanceof ApiClientError
      ? query.error.message
      : query.isError
        ? he.adminWorkspaceSubscriptionLoadFailed
        : null;

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-bg-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-fg">{he.adminWorkspaceSubscriptionTitle}</h2>
          <p className="text-xs text-fg-muted">
            {workspaceName} · {planLabel(sub?.plan_key)}
          </p>
          <p className="mt-1 text-xs text-fg-muted">{he.adminWorkspaceSubscriptionLead}</p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          {he.adminWorkspaceProductsClose}
        </Button>
      </div>

      {query.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {loadError ? (
        <p className="text-sm text-danger" role="alert">
          {loadError}
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">{he.adminOrgPlan}</span>
        <select
          className="h-10 rounded-[var(--radius-control)] border border-border bg-bg px-3 text-fg"
          value={planKey}
          onChange={(ev) => setPlanKey(ev.target.value)}
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </label>

      <Input
        id="admin-sub-period-end"
        type="datetime-local"
        label={he.adminWorkspaceSubscriptionPeriodEnd}
        value={periodEnd}
        onChange={(ev) => setPeriodEnd(ev.target.value)}
      />

      <Textarea
        id="admin-sub-note"
        label={he.adminWorkspaceSubscriptionNote}
        value={note}
        onChange={(ev) => setNote(ev.target.value)}
        rows={3}
      />

      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <Button type="button" variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
        {he.adminWorkspaceSubscriptionSave}
      </Button>

      <SubscriptionAuditList audit={query.data?.audit_log ?? []} />
    </section>
  );
}

function SubscriptionAuditList({ audit }: { audit: Array<{ id: string; note?: string | null; created_at?: string }> }) {
  if (!audit.length) return null;
  return (
    <div className="mt-2 border-t border-border pt-3">
      <h3 className="text-xs font-semibold text-fg">{he.adminWorkspaceSubscriptionAudit}</h3>
      <ul className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto text-xs text-fg-muted">
        {audit.map((row) => (
          <li key={row.id} className="ltr-meta rounded border border-border px-2 py-1.5">
            {row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : "—"}
            {row.note ? ` · ${row.note}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}