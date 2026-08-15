import type { WorkspaceUsage } from "@site-secure/api-client";
import { he } from "../../i18n/he";

export function UsageSnapshot({ usage }: { usage: WorkspaceUsage }) {
  return (
    <section className="ops-card p-5" aria-labelledby="usage-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.usageKicker}</p>
      <h2 id="usage-heading" className="mt-1 text-base font-semibold text-fg">
        {he.usageTitle}
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius-panel)] border border-border bg-bg px-4 py-3">
          <dt className="text-xs font-medium text-fg-muted">{he.usageActiveMembers}</dt>
          <dd className="mt-1 text-sm font-semibold text-fg">{usage.active_members}</dd>
        </div>
        {usage.meters.map((row) => (
          <div key={row.key} className="rounded-[var(--radius-panel)] border border-border bg-bg px-4 py-3">
            <dt className="text-xs font-medium text-fg-muted">{row.label_he}</dt>
            <dd className="mt-1 text-sm font-semibold text-fg">
              {row.unlimited ? he.usersUsageUnlimited : `${row.current} / ${row.limit}`}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
