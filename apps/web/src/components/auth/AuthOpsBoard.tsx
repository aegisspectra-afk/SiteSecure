import { he } from "../../i18n/he";

export function AuthOpsBoard() {
  return (
    <section aria-label={he.authOpsAria} className="public-app px-5 py-5" dir="ltr">
      <div className="flex items-center justify-between gap-3">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.authOpsStatusLabel}</p>
        <p className="public-mono flex items-center gap-2 text-[11px] text-fg">
          <span className="auth-status-pulse size-1.5 rounded-full bg-success" aria-hidden />
          {he.authOpsStatusValue}
        </p>
      </div>
      <p className="public-mono mt-8 text-[10px] tracking-[0.16em] text-fg-muted">{he.authOpsWorkspaceLabel}</p>
      <p className="ltr-meta mt-1 text-sm font-semibold text-fg">{he.authOpsWorkspaceName}</p>
      <p className="public-mono mt-1 text-[10px] tracking-[0.16em] text-action">{he.authOpsBadge}</p>
      <dl className="mt-8 flex flex-col gap-3 border-y border-border py-5">
        {[
          [he.authOpsJobsLabel, he.authOpsJobsValue],
          [he.authOpsSitesLabel, he.authOpsSitesValue],
          [he.authOpsTechsLabel, he.authOpsTechsValue],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="public-mono text-[11px] tracking-[0.12em] text-fg-muted">{label}</dt>
            <dd className="public-mono text-sm text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="public-mono mt-5 text-[10px] tracking-[0.16em] text-fg-muted">{he.authOpsActivityLabel}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {he.authOpsActivity.map((row) => (
          <li key={row.t} className="flex justify-between gap-4">
            <span className="public-mono text-[11px] text-fg-muted">{row.t}</span>
            <span className="public-mono text-[11px] text-fg">{row.d}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
