import { Skeleton } from "@site-secure/ui";

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="טוען">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-3/4" />
    </div>
  );
}
