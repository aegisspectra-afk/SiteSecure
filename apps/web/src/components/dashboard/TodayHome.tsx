import { EmptyState } from "@site-secure/ui";
import type { DashboardResponse } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { useOnlineStatus } from "../../lib/use-online-status";
import { TodayList } from "./TodayList";

export function TodayHome({
  data,
  onStart,
  onComplete,
  busyId,
}: {
  data: DashboardResponse;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  busyId: string | null;
}) {
  const online = useOnlineStatus();
  const count = data.today.items.length;

  return (
    <div className="field-today">
      <header className="field-today-hero">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-subtle">{he.fieldOpsKicker}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-fg sm:text-3xl">{he.todayTitle}</h1>
        <p className="mt-2 text-sm text-fg-muted">{he.fieldTodayLead}</p>
        {count > 0 ? (
          <p className="public-mono mt-3 text-xs text-fg-muted" dir="ltr">
            {count} {he.fieldJobsCount}
          </p>
        ) : null}
      </header>

      {!online ? (
        <div className="field-offline-banner" role="status">
          <p className="text-sm font-medium text-fg">{he.fieldOfflineTitle}</p>
          <p className="mt-1 text-xs text-fg-muted">{he.fieldOfflineBody}</p>
        </div>
      ) : null}

      {count === 0 ? (
        <div className="field-empty">
          <EmptyState title={he.todayEmptyTitle} description={he.todayEmptyBody} />
        </div>
      ) : (
        <TodayList items={data.today.items} onStart={onStart} onComplete={onComplete} busyId={busyId} />
      )}
    </div>
  );
}
