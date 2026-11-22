import type { WorkspaceUsageMeter } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { meterTone, meterUtilization, usageMeterQuotaLine } from "../../lib/ux-metrics";

const TONE_CLASS: Record<string, string> = {
  action: "is-action",
  tech: "is-tech",
  analytics: "is-analytics",
  warning: "is-warning",
  danger: "is-danger",
};

function barToneClass(meter: WorkspaceUsageMeter): string {
  const tone = meterTone(meter);
  return TONE_CLASS[tone] ?? "is-action";
}

type Props = {
  meter: WorkspaceUsageMeter;
};

export function UsageMeterBar({ meter }: Props) {
  const util = meterUtilization(meter);
  const percent = meter.unlimited || util == null ? 0 : Math.min(100, Math.round(util * 100));
  const line = meter.unlimited
    ? `${meter.label_he}: ${he.settingsPlanUnlimited}`
    : usageMeterQuotaLine(meter);

  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-fg">{meter.label_he}</span>
        <span className="text-sm text-fg-muted">{line}</span>
      </div>
      {meter.unlimited ? null : (
        <div className="ops-usage-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`ops-usage-bar-fill ${barToneClass(meter)}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {meter.detail_he ? <p className="text-xs text-fg-muted">{meter.detail_he}</p> : null}
    </li>
  );
}