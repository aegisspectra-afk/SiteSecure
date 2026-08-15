import { he } from "../../i18n/he";
import { AuthNetwork } from "./AuthNetwork";

const metrics = [
  [he.authOpsJobsLabel, he.authOpsJobsValue],
  [he.authOpsSitesLabel, he.authOpsSitesValue],
  [he.authOpsTechsLabel, he.authOpsTechsValue],
  [he.authOpsCallsLabel, he.authOpsCallsValue],
] as const;

const telemetry = [
  [he.authOpsRegionLabel, he.authOpsRegionValue],
  [he.authOpsLatencyLabel, he.authOpsLatencyValue],
  [he.authOpsSyncLabel, he.authOpsSyncValue],
] as const;

export function AuthOpsBoard() {
  return (
    <section aria-label={he.authOpsAria} className="auth-console auth-float px-5 py-5" dir="ltr">
      <div className="flex items-center justify-between gap-3">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.authOpsPreviewLabel}</p>
        <p className="public-mono text-[10px] tracking-[0.16em] text-action">{he.authOpsBadge}</p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.authOpsStatusLabel}</p>
        <p className="public-mono flex items-center gap-2 text-[11px] text-fg">
          <span className="auth-status-pulse size-1.5 rounded-full bg-success" aria-hidden />
          {he.authOpsStatusValue}
        </p>
      </div>

      <p className="public-mono mt-5 text-[10px] tracking-[0.16em] text-fg-muted">{he.authOpsWorkspaceLabel}</p>
      <p className="ltr-meta mt-1 text-sm font-semibold text-fg">{he.authOpsWorkspaceName}</p>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-border py-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="public-mono text-[10px] tracking-[0.12em] text-fg-muted">{label}</dt>
            <dd className="public-mono text-sm text-fg">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="public-mono mt-4 text-[10px] tracking-[0.16em] text-fg-muted">{he.authOpsNetworkLabel}</p>
      <div className="mt-2">
        <AuthNetwork />
      </div>

      <p className="public-mono mt-4 text-[10px] tracking-[0.16em] text-fg-muted">{he.authOpsSystemsLabel}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {he.authOpsSystems.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-3">
            <span className="public-mono text-[11px] tracking-[0.08em] text-fg-muted">{row.name}</span>
            <span className={row.state === "ACTIVE" ? "public-mono text-[11px] text-action" : "public-mono text-[11px] text-success"}>
              {row.state}
            </span>
          </li>
        ))}
      </ul>

      <p className="public-mono mt-5 text-[10px] tracking-[0.16em] text-fg-muted">{he.authOpsActivityLabel}</p>
      <ul className="mt-2 flex flex-col">
        {he.authOpsActivity.map((row) => (
          <li
            key={row.t}
            className="auth-activity-row -mx-2 flex justify-between gap-4 rounded-[var(--radius-control)] px-2 py-1.5"
          >
            <span className="public-mono text-[11px] text-fg-muted">{row.t}</span>
            <span className="public-mono text-[11px] text-fg">{row.d}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
        <dl className="flex flex-wrap gap-x-5 gap-y-2">
          {telemetry.map(([label, value]) => (
            <div key={label}>
              <dt className="public-mono text-[9px] tracking-[0.14em] text-fg-muted">{label}</dt>
              <dd className="public-mono mt-0.5 text-[11px] text-fg">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="public-mono text-[9px] tracking-[0.14em] text-action">{he.authOpsDemo}</p>
      </div>
    </section>
  );
}
