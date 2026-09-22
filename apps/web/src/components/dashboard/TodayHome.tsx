import { EmptyState } from "@site-secure/ui";
import type { DashboardResponse } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { useOnlineStatus } from "../../lib/use-online-status";
import { TodayList } from "./TodayList";

export function TodayHome({
  data,
  onAction,
  busyId,
}: {
  data: DashboardResponse;
  onAction: (id: string, action: string) => void;
  busyId: string | null;
}) {
  const online = useOnlineStatus();
  const count = data.today.items.length;

  return (
    <div className="field-today">
      <header className="field-today-hero">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-subtle">{he.fieldOpsKicker}</p>
        <h1 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.04em] text-fg sm:text-3xl">{he.todayTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{he.fieldTodayLead}</p>
        {count > 0 ? (
          <p className="field-today-count tabular-nums" dir="ltr">
            {count}{" "}
            <span className="public-mono align-middle text-xs font-medium tracking-[0.16em] text-fg-muted">
              {he.fieldJobsCount}
            </span>
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
        <TodayList items={data.today.items} onAction={onAction} busyId={busyId} />
      )}
    </div>
  );
}
