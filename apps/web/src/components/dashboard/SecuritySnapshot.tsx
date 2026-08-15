import type { SecurityCenter } from "@site-secure/api-client";
import { Status, type StatusTone } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";

function toneFor(status: "healthy" | "not_in_plan" | "not_built"): StatusTone {
  if (status === "healthy") return "success";
  if (status === "not_in_plan") return "warning";
  return "neutral";
}

export function SecuritySnapshot({ data }: { data: SecurityCenter }) {
  return (
    <section className="ops-card p-5" aria-labelledby="security-snapshot-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">SECURITY CENTER</p>
      <h2 id="security-snapshot-heading" className="mt-1 text-base font-semibold text-fg">
        {he.securitySnapshotTitle}
      </h2>
      <ul className="mt-4 flex flex-col gap-3">
        {data.signals.map((signal) => (
          <li key={signal.key} className="flex flex-col gap-1">
            <Status label={signal.label_he} tone={toneFor(signal.status)} />
            <p className="text-xs text-fg-muted">{signal.detail_he}</p>
          </li>
        ))}
      </ul>
      <Link
        to="/app/settings/security"
        className="mt-4 inline-flex text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {he.securitySnapshotAction}
      </Link>
    </section>
  );
}
