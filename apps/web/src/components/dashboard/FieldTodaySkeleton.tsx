import { Skeleton } from "@site-secure/ui";
import { he } from "../../i18n/he";

/** Field Today loading — not the manager command-center skeleton. */
export function FieldTodaySkeleton() {
  return (
    <div className="field-today" role="status" aria-label={he.loading} aria-busy="true">
      <header className="field-today-hero space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </header>
      <ul className="field-job-stack mt-6" aria-hidden>
        {[0, 1, 2].map((key) => (
          <li key={key} className="field-job-card space-y-3 p-4">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
            <Skeleton className="h-3 w-36 max-w-full" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-24" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
