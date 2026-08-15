import { he } from "../../i18n/he";

export function AuthStatusStrip() {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border bg-bg-subtle/60 px-3 py-2 lg:hidden"
      dir="ltr"
      aria-label={he.authOpsStatusLabel}
    >
      <p className="public-mono flex items-center gap-2 text-[10px] tracking-[0.14em] text-fg">
        <span className="auth-status-pulse size-1.5 rounded-full bg-success" aria-hidden />
        {he.authOpsStatusValue}
      </p>
      <p className="public-mono text-[10px] tracking-[0.16em] text-action">{he.authOpsBadge}</p>
    </div>
  );
}
