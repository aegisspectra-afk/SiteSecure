import { ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { activeMembership } from "../../../lib/active-membership";
import { billingHonestyNote, subscriptionAccessLabel } from "../../../lib/billing-honesty";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/plan")({
  component: PlanSettingsPage,
});

function PlanSettingsPage() {
  return (
    <RequirePermission permission="settings.view">
      <PlanSettingsBody />
    </RequirePermission>
  );
}

function PlanSettingsBody() {
  const { api, session } = useSession();
  const membership = activeMembership(session);
  const workspaceId = membership?.workspace_id;
  const query = useQuery({
    queryKey: ["usage", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getUsage(workspaceId!),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const usage = query.data;

  return (
    <div className="settings-panel flex flex-col gap-6" data-testid="settings-plan">
      <PageHeader title={he.settingsPlanTitle} description={he.settingsPlanLead} />
      <p className="text-sm text-fg-muted">{billingHonestyNote()}</p>
      <p className="text-sm text-fg-muted" data-testid="settings-plan-no-pay">
        {he.settingsPlanNoPay}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-border px-4 py-3">
          <dt className="text-xs text-fg-muted">{he.settingsPlanKey}</dt>
          <dd className="mt-1 text-base font-semibold text-fg">{usage?.plan_key || membership?.plan_key || "—"}</dd>
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
            <li
              key={meter.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card)] border border-border px-4 py-3"
            >
              <span className="text-sm font-medium text-fg">{meter.label_he}</span>
              <span className="text-sm text-fg-muted">
                {meter.unlimited
                  ? he.settingsPlanUnlimited
                  : `${meter.current}/${meter.limit}${meter.unit ? ` ${meter.unit}` : ""}`}
              </span>
            </li>
          ))}
        </ul>
      ) : query.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : null}
    </div>
  );
}
