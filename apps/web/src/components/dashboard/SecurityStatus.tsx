import { Link } from "@tanstack/react-router";
import type { SecuritySignal } from "@site-secure/api-client";
import { he } from "../../i18n/he";

const DASHBOARD_KEYS = ["authentication", "rbac", "tenant_isolation", "api_security"] as const;

function labelFor(key: string, fallback: string): string {
  if (key === "authentication") return he.securityLabelAuth;
  if (key === "rbac") return he.securityLabelRbac;
  if (key === "tenant_isolation") return he.securityLabelTenant;
  if (key === "api_security") return he.securityLabelApi;
  return fallback;
}

function statusLabel(key: string, signal: SecuritySignal): string {
  if (signal.status !== "healthy") return signal.detail_he;
  if (key === "authentication") return he.securitySignalOperational;
  return he.securitySignalEnforced;
}

export function SecurityStatus({ signals }: { signals: SecuritySignal[] }) {
  const rows = DASHBOARD_KEYS.map((key) => {
    const signal = signals.find((row) => row.key === key);
    return signal && signal.status !== "not_built" ? { key, signal } : null;
  }).filter((row): row is { key: (typeof DASHBOARD_KEYS)[number]; signal: SecuritySignal } => Boolean(row));
  if (!rows.length) return null;

  return (
    <section className="ops-card p-5" aria-labelledby="security-status-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.securityStatusKicker}</p>
      <h2 id="security-status-heading" className="mt-1 text-base font-semibold text-fg">
        {he.securityStatusTitle}
      </h2>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map(({ key, signal }) => (
          <li key={key} className="flex items-start justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-fg">
              <span
                className={`size-2 rounded-full ${signal.status === "healthy" ? "bg-success" : "bg-fg-muted"}`}
                aria-hidden
              />
              {labelFor(key, signal.label_he)}
            </span>
            <span className={`public-mono text-xs ${signal.status === "healthy" ? "text-success" : "text-fg-muted"}`}>
              {statusLabel(key, signal)}
            </span>
          </li>
        ))}
      </ul>
      <Link
        to="/app/settings/security"
        className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {he.securityCenterLink}
      </Link>
    </section>
  );
}
