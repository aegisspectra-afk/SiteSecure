import { getPlan, isUnlimited, planLabel } from "@site-secure/authz";
import { Button, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  PlatformPathShell,
  readDemoPlanKey,
  writeDemoPlanKey,
} from "../../../components/platform-path/PlatformPathShell";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/platform-path/plans")({
  component: PlatformPathPlansPage,
});

const PLAN_KEYS = ["solo", "business", "enterprise"] as const;

function formatLimit(value: number): string {
  if (isUnlimited(value)) return he.platformPathLimitUnlimited;
  return String(value);
}

function PlatformPathPlansPage() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const currentPlan = session?.memberships[0]?.plan_key ?? "solo";
  const navigate = useNavigate();
  const [preferred, setPreferred] = useState(() => readDemoPlanKey(currentPlan));

  const usage = useQuery({
    queryKey: ["workspace-usage", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getUsage(workspaceId!),
  });

  return (
    <PlatformPathShell step="plans">
      <PageHeader title={he.platformPathPlansTitle} description={he.platformPathPlansLead} />
      <p className="rounded-[var(--radius-control)] border border-border bg-bg-subtle px-3 py-2 text-sm text-fg-muted">
        {he.platformPathPlansCurrent}: <span className="font-medium text-fg">{planLabel(currentPlan)}</span>
      </p>
      <p className="text-xs text-amber-700 dark:text-amber-300">{he.platformPathNoPayment}</p>
      <p className="text-xs text-fg-muted">{he.platformPathPricePending}</p>

      <ul className="flex flex-col gap-3">
        {PLAN_KEYS.map((key) => {
          const plan = getPlan(key);
          if (!plan) return null;
          const selected = preferred === key;
          const isCurrent = currentPlan === key;
          return (
            <li key={key}>
              <button
                type="button"
                className={
                  selected
                    ? "w-full rounded-[var(--radius-control)] border-2 border-fg bg-bg-1 p-4 text-start"
                    : "w-full rounded-[var(--radius-control)] border border-border bg-bg-1 p-4 text-start hover:bg-bg-subtle"
                }
                onClick={() => {
                  setPreferred(key);
                  writeDemoPlanKey(key);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-fg">{planLabel(key)}</p>
                  {isCurrent ? (
                    <span className="text-xs text-fg-muted">{he.platformPathPlanCurrentBadge}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-fg-muted">{he.platformPathPricePendingShort}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-fg-muted sm:grid-cols-3">
                  <div>
                    <dt>{he.platformPathLimitSeatsOffice}</dt>
                    <dd className="font-medium text-fg">
                      {formatLimit(Number(plan.limits.seats_operator ?? 0))}
                    </dd>
                  </div>
                  <div>
                    <dt>{he.platformPathLimitSeatsField}</dt>
                    <dd className="font-medium text-fg">
                      {formatLimit(Number(plan.limits.seats_field ?? 0))}
                    </dd>
                  </div>
                  <div>
                    <dt>{he.platformPathLimitStorage}</dt>
                    <dd className="font-medium text-fg">
                      {formatLimit(Number(plan.limits.storage_gb ?? 0))}
                      {isUnlimited(Number(plan.limits.storage_gb ?? 0)) ? "" : " GB"}
                    </dd>
                  </div>
                  <div>
                    <dt>{he.platformPathLimitQuotes}</dt>
                    <dd className="font-medium text-fg">
                      {formatLimit(Number(plan.limits.quota_quotes ?? 0))}
                    </dd>
                  </div>
                  <div>
                    <dt>{he.platformPathLimitClients}</dt>
                    <dd className="font-medium text-fg">
                      {formatLimit(Number(plan.limits.quota_clients ?? 0))}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-fg-muted">
                  {he.platformPathIncludedFeatures}:{" "}
                  {(plan.features ?? []).filter((f) => f === "fleet" || f === "ssp" || f === "workforce" || f === "crm" || f === "quotes").join(" · ") ||
                    "—"}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {usage.data ? (
        <div className="rounded-[var(--radius-control)] border border-border bg-bg-1 p-4 text-sm">
          <p className="font-medium text-fg">{he.usageTitle}</p>
          <p className="mt-1 text-xs text-fg-muted">{he.platformPathUsageLiveNote}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void navigate({ to: "/app/platform-path/products" })}
        >
          {he.platformPathBack}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => void navigate({ to: "/app/platform-path/review" })}
        >
          {he.platformPathContinue}
        </Button>
      </div>
    </PlatformPathShell>
  );
}
