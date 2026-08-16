import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import type { SetupStep } from "../../lib/workspace-setup";

export function WorkspaceSetup({
  steps,
  percent,
  canInvite = false,
}: {
  steps: SetupStep[];
  percent: number;
  canInvite?: boolean;
}) {
  const current = steps.find((step) => step.current);
  return (
    <section className="ops-card p-5" aria-labelledby="setup-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.setupKicker}</p>
      <div className="mt-1 flex items-baseline justify-between gap-4">
        <h2 id="setup-heading" className="text-base font-semibold text-fg">
          {he.setupTitle}
        </h2>
        <p className="text-2xl font-semibold tracking-tight text-fg">{he.uxPercent(percent)}</p>
      </div>
      <ol className="mt-4 flex flex-col gap-2" aria-label={he.setupTitle}>
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <span className="public-mono text-fg-muted" aria-hidden>
              {step.done ? "✓" : step.current ? "●" : "○"}
            </span>
            <span className={step.done || step.current ? "text-fg" : "text-fg-muted"}>{step.label}</span>
          </li>
        ))}
      </ol>
      {current?.href && canInvite ? (
        <Link
          to={current.href}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.setupInviteCta}
        </Link>
      ) : null}
    </section>
  );
}
