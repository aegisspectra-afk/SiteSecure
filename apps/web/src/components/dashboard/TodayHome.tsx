import { EmptyState, PageHeader } from "@site-secure/ui";
import type { DashboardResponse } from "@site-secure/api-client";
import { he } from "../../i18n/he";
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
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={he.todayTitle} description={he.opsPlatform} />
      {data.today.items.length === 0 ? (
        <div className="ops-card">
          <EmptyState title={he.todayEmptyTitle} description={he.todayEmptyBody} />
        </div>
      ) : (
        <div className="ops-card p-5">
          <TodayList
            items={data.today.items}
            onStart={onStart}
            onComplete={onComplete}
            busyId={busyId}
          />
        </div>
      )}
    </div>
  );
}
