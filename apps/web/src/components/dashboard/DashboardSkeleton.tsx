import { Skeleton } from "@site-secure/ui";
import { he } from "../../i18n/he";

export function DashboardSkeleton() {
  return (
    <div
      className="ops-dashboard ops-command-center ops-dashboard-v3 ops-dashboard-skeleton flex flex-col gap-4"
      role="status"
      aria-label={he.loadingOperations}
      aria-busy="true"
    >
      <div className="ops-cmd-header">
        <div className="ops-cmd-header-main min-w-0 space-y-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="hidden h-11 w-64 md:block" />
      </div>
      <div className="ops-signal-strip" aria-hidden>
        <Skeleton className="h-12 w-full rounded-[var(--radius-panel)]" />
        <Skeleton className="h-12 w-full rounded-[var(--radius-panel)]" />
        <Skeleton className="h-12 w-full rounded-[var(--radius-panel)]" />
        <Skeleton className="h-12 w-full rounded-[var(--radius-panel)]" />
      </div>
      <div className="ops-v3-ops-grid">
        <Skeleton className="h-44 w-full rounded-[var(--radius-panel)]" />
        <Skeleton className="h-28 w-full rounded-[var(--radius-panel)]" />
      </div>
      <Skeleton className="h-40 w-full rounded-[var(--radius-panel)]" />
    </div>
  );
}
