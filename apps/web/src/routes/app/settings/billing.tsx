import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BillingHonestyNote } from "../../../components/billing/BillingHonestyNote";
import { BillingUpgradeDialog } from "../../../components/billing/BillingUpgradeDialog";
import { UsageMeterBar } from "../../../components/billing/UsageMeterBar";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { activeMembership } from "../../../lib/active-membership";
import { planLabel } from "../../../lib/app-nav";
import { subscriptionAccessLabel } from "../../../lib/billing-honesty";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/billing")({
  component: BillingSettingsPage,
});

function BillingSettingsPage() {
  return (
    <RequirePermission permission="settings.view">
      <BillingSettingsBody />
    </RequirePermission>
  );
}

function BillingSettingsBody() {
  const { api, session } = useSession();
  const membership = activeMembership(session);
  const workspaceId = membership?.workspace_id;
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const query = useQuery({
    queryKey: ["usage", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getUsage(workspaceId!),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const usage = query.data;
  const planKey = usage?.plan_key || membership?.plan_key;
  const canBilling = can(membership?.role_key, "workspace.billing", membership?.features, membership?.permissions);

  return (
    <div className="settings-panel flex flex-col gap-6" data-testid="settings-billing">
      <PageHeader title={he.settingsBillingTitle} description={he.settingsBillingLead} />
      <BillingHonestyNote />

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-border px-4 py-3">
          <dt className="text-xs text-fg-muted">{he.settingsPlanKey}</dt>
          <dd className="mt-1 text-base font-semibold text-fg">{planLabel(planKey) || "—"}</dd>
        </div>
        <div className="rounded-[var(--radius-card)] border border-border px-4 py-3">
          <dt className="text-xs text-fg-muted">{he.billingAccessProcessActive}</dt>
          <dd className="mt-1 text-base font-semibold text-fg">
            {subscriptionAccessLabel(membership?.workspace_status)}
          </dd>
        </div>
      </dl>

      {usage ? (
        <ul className="flex flex-col gap-3">
          {usage.meters.map((meter) => (
            <UsageMeterBar key={meter.key} meter={meter} />
          ))}
        </ul>
      ) : query.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canBilling ? (
          <Button type="button" variant="primary" onClick={() => setUpgradeOpen(true)}>
            {he.settingsBillingUpgradeCta}
          </Button>
        ) : null}
        <Link
          to="/app/settings/billing/usage"
          className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium text-fg hover:bg-bg-subtle"
        >
          {he.settingsBillingUsageLink}
        </Link>
      </div>

      <BillingUpgradeDialog
        workspaceId={workspaceId}
        open={upgradeOpen && canBilling}
        onClose={() => setUpgradeOpen(false)}
      />
    </div>
  );
}