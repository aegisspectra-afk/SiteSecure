import { Button, EmptyState, PageHeader } from "@site-secure/ui";
import type { DashboardResponse } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { quickActions } from "../../lib/home";
import { ActivityList } from "./ActivityList";
import { AttentionList } from "./AttentionList";
import { TodayList } from "./TodayList";

export function OpsDashboard({
  data,
  roleKey,
  features,
}: {
  data: DashboardResponse;
  roleKey: string | undefined;
  features: string[];
}) {
  const primary = quickActions(roleKey, features)[0];
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={he.overviewTitle}
        action={
          primary ? (
            <Button variant="primary" className="min-w-24" onClick={() => {
              window.location.assign(primary.href);
            }}>
              {primary.label}
            </Button>
          ) : undefined
        }
      />
      {empty ? (
        <EmptyState title={he.dashboardEmptyTitle} description={he.dashboardEmptyBody} />
      ) : (
        <>
          <AttentionList groups={data.attention} />
          <TodayList items={data.today.items} />
          <ActivityList items={data.activity} />
        </>
      )}
    </div>
  );
}

export function ObserveDashboard({ data }: { data: DashboardResponse }) {
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={he.overviewTitle} />
      {empty ? (
        <EmptyState title={he.dashboardEmptyTitle} description={he.viewerEmptyBody} />
      ) : (
        <>
          <AttentionList groups={data.attention} />
          <TodayList items={data.today.items} />
          <ActivityList items={data.activity} />
        </>
      )}
    </div>
  );
}
