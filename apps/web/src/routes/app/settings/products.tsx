import { ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { planLabel } from "../../../lib/app-nav";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/products")({
  component: ProductsSettingsPage,
});

function ProductsSettingsPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <ProductsSettingsBody />
    </RequirePermission>
  );
}

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

function ProductsSettingsBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;

  const query = useQuery({
    queryKey: ["workspace-products", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkspaceProducts(workspaceId!),
  });

  if (!workspaceId) {
    return <ErrorState title={he.settingsProductsTitle} description={he.workspaceInactive} />;
  }

  if (query.isError) {
    return <ErrorState title={he.settingsProductsTitle} description={he.settingsProductsLoadFailed} />;
  }

  const products = query.data?.products ?? [];
  const planKey = query.data?.plan_key ?? session?.memberships[0]?.plan_key;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={he.settingsProductsTitle} description={he.settingsProductsLeadReadOnly} />
      <p className="text-sm text-fg-muted">
        {he.settingsProductsPlan}: {planLabel(planKey)}
      </p>
      <p className="text-xs text-fg-muted">{he.settingsProductsPlatformAdminOnly}</p>
      <ul className="divide-y divide-border rounded-[var(--radius-control)] border border-border bg-bg-1">
        {products.map((p) => (
          <li key={p.feature_key} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-fg">{productLabel(p.feature_key)}</p>
              <p className="text-xs text-fg-muted">
                {!p.eligible
                  ? he.settingsProductsNotEligible
                  : p.enabled
                    ? he.settingsProductsEnabled
                    : he.settingsProductsDisabled}
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <span className="sr-only">{productLabel(p.feature_key)}</span>
              <input type="checkbox" className="size-4" checked={p.enabled} disabled readOnly />
            </label>
          </li>
        ))}
        {!query.isLoading && products.length === 0 ? (
          <li className="px-4 py-6 text-sm text-fg-muted">{he.settingsProductsNotEligible}</li>
        ) : null}
      </ul>
    </div>
  );
}
