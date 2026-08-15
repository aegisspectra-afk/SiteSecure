import { Skeleton } from "@site-secure/ui";
import { he } from "../../i18n/he";

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label={he.loadingOperations}>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
