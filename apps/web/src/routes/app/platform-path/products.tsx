import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlatformPathShell } from "../../../components/platform-path/PlatformPathShell";
import { he } from "../../../i18n/he";
import { planLabel } from "../../../lib/app-nav";
import { markPlatformSetupDone } from "../../../lib/platform-setup";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/platform-path/products")({
  component: PlatformPathProductsPage,
});

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

function PlatformPathProductsPage() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["workspace-products", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkspaceProducts(workspaceId!),
  });

  if (!workspaceId) {
    return (
      <PlatformPathShell step="products">
        <ErrorState title={he.settingsProductsTitle} description={he.workspaceInactive} />
      </PlatformPathShell>
    );
  }

  const products = query.data?.products ?? [];
  const planKey = query.data?.plan_key ?? session?.memberships[0]?.plan_key;

  return (
    <PlatformPathShell step="products">
      <PageHeader title={he.platformPathProductsTitle} description={he.settingsProductsLeadReadOnly} />
      <p className="text-sm text-fg-muted">
        {he.settingsProductsPlan}: {planLabel(planKey)}
      </p>
      <p className="text-xs text-fg-muted">{he.settingsProductsPlatformAdminOnly}</p>
      {query.isError ? (
        <div className="flex flex-col gap-3">
          <ErrorState title={he.settingsProductsTitle} description={he.settingsProductsLoadFailed} />
          <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
            {he.platformPathProductsRetry}
          </Button>
        </div>
      ) : (
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
              <input type="checkbox" className="size-4" checked={p.enabled} disabled readOnly />
            </li>
          ))}
          {!query.isLoading && products.length === 0 ? (
            <li className="px-4 py-6 text-sm text-fg-muted">{he.platformPathProductsEmpty}</li>
          ) : null}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={query.isError || query.isLoading}
          onClick={() => void navigate({ to: "/app/platform-path/plans" })}
        >
          {he.platformPathContinue}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (workspaceId) markPlatformSetupDone(workspaceId);
            void navigate({ to: "/app" });
          }}
        >
          {he.platformPathSkipToApp}
        </Button>
      </div>
    </PlatformPathShell>
  );
}
