import { Status } from "@site-secure/ui";
import type { SecurityCenter } from "@site-secure/api-client";
import { he } from "../../i18n/he";

export function CommandStatus({
  workspaceStatus,
  setupComplete,
  security,
}: {
  workspaceStatus?: string;
  setupComplete: boolean;
  security?: SecurityCenter | null;
}) {
  const active = workspaceStatus === "active";
  const healthy = security?.signals.filter((row) => row.status === "healthy").length;
  const total = security?.signals.length;

  return (
    <section className="ops-card p-5" aria-labelledby="command-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.commandKicker}</p>
      <h2 id="command-heading" className="mt-1 text-base font-semibold text-fg">
        {he.commandTitle}
      </h2>
      <dl className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8">
        <div>
          <dt className="text-xs text-fg-muted">{he.homeTitle}</dt>
          <dd className="mt-1">
            <Status label={active ? he.workspaceActive : he.workspaceInactive} tone={active ? "success" : "warning"} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">{he.setupTitle}</dt>
          <dd className="mt-1 text-sm font-medium text-fg">
            {setupComplete ? he.setupCompleteLabel : he.setupPendingLabel}
          </dd>
        </div>
        {security && total ? (
          <div>
            <dt className="text-xs text-fg-muted">{he.securitySnapshotTitle}</dt>
            <dd className="mt-1 text-sm font-medium text-fg">
              {healthy}/{total}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
