import { he } from "../../i18n/he";

export function DashboardFreshness({ generatedAt }: { generatedAt: string }) {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return null;
  const time = date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return (
    <p className="flex items-center gap-2 text-xs text-fg-muted">
      <span className="size-1.5 rounded-full bg-success" aria-hidden />
      <span>{he.dashboardSynced}</span>
      <span>{he.dashboardUpdatedAt(time)}</span>
    </p>
  );
}
