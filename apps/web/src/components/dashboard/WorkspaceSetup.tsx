import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import type { SetupStep } from "../../lib/workspace-setup";

export function WorkspaceSetup({
  steps,
  percent,
}: {
  steps: SetupStep[];
  percent: number;
}) {
  return (
    <section className="ops-card p-5" aria-labelledby="setup-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">WORKSPACE SETUP</p>
          <h2 id="setup-heading" className="mt-1 text-base font-semibold text-fg">
            {he.setupTitle}
          </h2>
        </div>
        <p className="public-mono text-sm text-fg" aria-label={`${percent}%`}>
          {percent}%
        </p>
      </div>
      <div className="ops-setup-bar mb-4" aria-hidden>
        <span style={{ width: `${percent}%` }} />
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center justify-between gap-3 text-sm">
            <span className={step.done ? "text-fg" : "text-fg-muted"}>
              <span className="public-mono me-2" aria-hidden>
                {step.done ? "✓" : "○"}
              </span>
              {step.label}
            </span>
            {!step.done && step.href ? (
              <Link
                to={step.href}
                className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {he.inviteUser}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
