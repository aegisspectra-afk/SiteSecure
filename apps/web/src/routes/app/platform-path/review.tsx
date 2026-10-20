import { planLabel } from "@site-secure/authz";
import { Button, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  PlatformPathShell,
  readDemoPlanKey,
} from "../../../components/platform-path/PlatformPathShell";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/platform-path/review")({
  component: PlatformPathReviewPage,
});

function productLabel(featureKey: string): string {
  const map: Record<string, string> = {
    fleet: he.settingsProductsFleet,
    ssp: he.settingsProductsSsp,
  };
  return map[featureKey] ?? featureKey;
}

function PlatformPathReviewPage() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const currentPlan = session?.memberships[0]?.plan_key ?? "solo";
  const preferred = readDemoPlanKey(currentPlan);
  const navigate = useNavigate();

  const products = useQuery({
    queryKey: ["workspace-products", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkspaceProducts(workspaceId!),
  });

  const enabled = (products.data?.products ?? []).filter((p) => p.enabled);
  const disabledEligible = (products.data?.products ?? []).filter((p) => p.eligible && !p.enabled);

  return (
    <PlatformPathShell step="review">
      <PageHeader title={he.platformPathReviewTitle} description={he.platformPathReviewLead} />

      <section className="rounded-[var(--radius-control)] border border-border bg-bg-1 p-4">
        <h2 className="text-sm font-semibold text-fg">{he.platformPathReviewPlan}</h2>
        <p className="mt-2 text-sm text-fg">
          {he.platformPathPlansCurrent}: <strong>{planLabel(currentPlan)}</strong>
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          {he.platformPathReviewPreferred}: <strong>{planLabel(preferred)}</strong>
        </p>
        {preferred !== currentPlan ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{he.platformPathReviewPlanNotApplied}</p>
        ) : null}
        <p className="mt-2 text-xs text-fg-muted">{he.platformPathNoPayment}</p>
      </section>

      <section className="rounded-[var(--radius-control)] border border-border bg-bg-1 p-4">
        <h2 className="text-sm font-semibold text-fg">{he.platformPathReviewProductsOn}</h2>
        <ul className="mt-2 list-disc space-y-1 pe-5 text-sm text-fg">
          {enabled.length === 0 ? <li className="text-fg-muted">{he.platformPathReviewNone}</li> : null}
          {enabled.map((p) => (
            <li key={p.feature_key}>{productLabel(p.feature_key)}</li>
          ))}
        </ul>
        {disabledEligible.length > 0 ? (
          <>
            <h2 className="mt-4 text-sm font-semibold text-fg">{he.platformPathReviewProductsOff}</h2>
            <ul className="mt-2 list-disc space-y-1 pe-5 text-sm text-fg-muted">
              {disabledEligible.map((p) => (
                <li key={p.feature_key}>{productLabel(p.feature_key)}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void navigate({ to: "/app/platform-path/plans" })}
        >
          {he.platformPathBack}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => void navigate({ to: "/app/platform-path/done" })}
        >
          {he.platformPathConfirmEnter}
        </Button>
      </div>
    </PlatformPathShell>
  );
}
