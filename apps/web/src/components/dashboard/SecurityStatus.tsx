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

function formatUpdatedAt(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function SecurityStatusBar({
  signals,
  updatedAt,
}: {
  signals: SecuritySignal[];
  updatedAt?: string | null;
}) {
  const rows = DASHBOARD_KEYS.map((key) => {
    const signal = signals.find((row) => row.key === key);
    return signal && signal.status !== "not_built" ? { key, signal } : null;
  }).filter((row): row is { key: (typeof DASHBOARD_KEYS)[number]; signal: SecuritySignal } => Boolean(row));
  if (!rows.length) return null;
  const allHealthy = rows.every(({ signal }) => signal.status === "healthy");
  const time = formatUpdatedAt(updatedAt);

  const content = (
    <>
      <span
        className={`size-2 shrink-0 rounded-full ${allHealthy ? "bg-success" : "bg-warning"}`}
        aria-hidden
      />
      <span className="text-sm text-fg-muted">
        {allHealthy ? he.securityBarHealthy : he.securityBarAttention}
        {time ? ` · ${he.securityBarUpdated(time)}` : ""}
      </span>
      <span className="sr-only">
        {rows.map(({ key, signal }) => `${labelFor(key, signal.label_he)}: ${signal.status}`).join(", ")}
      </span>
    </>
  );

  if (allHealthy) {
    return (
      <div className="ops-security-footer" aria-label={he.securityBarHealthy}>
        {content}
      </div>
    );
  }

  return (
    <Link
      to="/app/settings/security"
      className="ops-security-bar"
      aria-label={he.securityBarAttention}
    >
      {content}
      <span className="ms-auto text-sm font-medium text-action">{he.securityCenterLink}</span>
    </Link>
  );
}

/** Full security card — used outside the dashboard when detail is needed. */
export function SecurityStatus({ signals }: { signals: SecuritySignal[] }) {
  const rows = DASHBOARD_KEYS.map((key) => {
    const signal = signals.find((row) => row.key === key);
    return signal && signal.status !== "not_built" ? { key, signal } : null;
  }).filter((row): row is { key: (typeof DASHBOARD_KEYS)[number]; signal: SecuritySignal } => Boolean(row));
  if (!rows.length) return null;
  const allHealthy = rows.every(({ signal }) => signal.status === "healthy");

  return (
    <section className="ops-card px-4 py-3" aria-labelledby="security-status-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.securityStatusKicker}</p>
      <h2 id="security-status-heading" className="mt-1 text-base font-semibold text-fg">
        {he.securityStatusTitle}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map(({ key, signal }) => (
          <li key={key} className="flex items-center gap-2 text-sm text-fg">
            <span
              className={`size-2 shrink-0 rounded-full ${signal.status === "healthy" ? "bg-success" : "bg-fg-muted"}`}
              aria-hidden
            />
            <span>{labelFor(key, signal.label_he)}</span>
            <span className="sr-only">
              {signal.status === "healthy" ? he.securitySignalOperational : signal.detail_he}
            </span>
          </li>
        ))}
      </ul>
      {allHealthy ? <p className="mt-3 text-sm text-fg-muted">{he.securityAllHealthy}</p> : null}
      <Link
        to="/app/settings/security"
        className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {he.securityCenterLink}
      </Link>
    </section>
  );
}
