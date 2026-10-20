import { ApiClientError } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { he } from "../../i18n/he";
import { planLabel } from "../../lib/app-nav";
import { useSession } from "../../lib/session";

function productLabel(featureKey: string): string {
  const map: Record<string, string> = {
    fleet: he.settingsProductsFleet,
    ssp: he.settingsProductsSsp,
    inventory: he.settingsProductsInventory,
    finance: he.settingsProductsFinance,
    reports: he.settingsProductsReports,
    automation: he.settingsProductsAutomation,
    team: he.settingsProductsTeam,
    audit: he.settingsProductsAudit,
    api: he.settingsProductsApi,
    ai: he.settingsProductsAi,
    branches: he.settingsProductsBranches,
    accounting_documents: he.settingsProductsAccountingDocuments,
  };
  return map[featureKey] ?? featureKey;
}

type Props = {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
};

export function AdminWorkspaceProductsPanel({ workspaceId, workspaceName, onClose }: Props) {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-workspace-products", workspaceId],
    queryFn: () => api.adminWorkspaceProducts(workspaceId),
  });

  const toggle = useMutation({
    mutationFn: (body: { feature_key: string; enabled: boolean }) =>
      api.adminSetWorkspaceProductOverride(workspaceId, body),
    onSuccess: (data) => {
      setFormError(null);
      queryClient.setQueryData(["admin-workspace-products", workspaceId], data);
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.adminWorkspaceProductsSaveFailed);
    },
  });

  const products = query.data?.products ?? [];
  const planKey = query.data?.plan_key;
  const loadError =
    query.error instanceof ApiClientError
      ? query.error.message
      : query.isError
        ? he.adminWorkspaceProductsLoadFailed
        : null;

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-bg-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-fg">{he.adminWorkspaceProductsTitle}</h2>
          <p className="text-xs text-fg-muted">
            {workspaceName} · {he.settingsProductsPlan}: {planLabel(planKey)}
          </p>
          <p className="mt-1 text-xs text-fg-muted">{he.adminWorkspaceProductsLead}</p>
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
      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-[var(--radius-control)] border border-border bg-bg">
        {products.map((p) => {
          const busy = toggle.isPending && toggle.variables?.feature_key === p.feature_key;
          const canToggle = Boolean(p.toggleable) && !busy && !toggle.isPending;
          return (
            <li key={p.feature_key} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-fg">{productLabel(p.feature_key)}</p>
                <p className="text-xs text-fg-muted">
                  {!p.eligible
                    ? he.settingsProductsNotEligible
                    : p.enabled
                      ? he.settingsProductsEnabled
                      : he.settingsProductsDisabled}
                  {p.override_enabled === null
                    ? ` · ${he.adminWorkspaceProductsDefault}`
                    : ` · ${he.adminWorkspaceProductsOverride}`}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <span className="sr-only">{productLabel(p.feature_key)}</span>
                <input
                  type="checkbox"
                  className="size-4"
                  checked={p.enabled}
                  disabled={!canToggle}
                  onChange={(e) => {
                    if (!canToggle) return;
                    toggle.mutate({ feature_key: p.feature_key, enabled: e.target.checked });
                  }}
                />
              </label>
            </li>
          );
        })}
        {!query.isLoading && !loadError && products.length === 0 ? (
          <li className="px-4 py-6 text-sm text-fg-muted">{he.settingsProductsNotEligible}</li>
        ) : null}
      </ul>
    </section>
  );
}
