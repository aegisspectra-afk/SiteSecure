import { Skeleton } from "@site-secure/ui";
import { he } from "../../i18n/he";

export function DashboardSkeleton() {
  return (
    <div
      className="ops-dashboard ops-command-center ops-dashboard-visual flex flex-col gap-4"
      role="status"
      aria-label={he.loadingOperations}
    >
      <div className="ops-dash-hero ops-dash-hero-v22">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-28" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <Skeleton className="h-11 w-32" />
      </div>
      <Skeleton className="h-40 w-full rounded-[var(--radius-panel)]" />
      <Skeleton className="h-20 w-full rounded-[var(--radius-panel)]" />
      <Skeleton className="h-36 w-full rounded-[var(--radius-panel)]" />
    </div>
  );
}
