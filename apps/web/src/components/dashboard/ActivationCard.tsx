import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import type { ActivationState } from "../../lib/activation";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

/**
 * Lightweight first-value card for empty / pre-quote workspaces.
 * Reuses NewQuoteDialog → real Quote Builder (no parallel onboarding quote).
 */
export function ActivationCard({
  activation,
  setupProgress,
  canCreateQuote,
  canCreateCustomer,
}: {
  activation: ActivationState;
  setupProgress: { percent: number; done: number; total: number } | null;
  canCreateQuote: boolean;
  canCreateCustomer: boolean;
}) {
  const title = canCreateQuote
    ? activation.hasCustomer
      ? he.activationTitleWithCustomer
      : he.activationTitle
    : he.activationCreateCustomerTitle;
  const body = canCreateQuote
    ? activation.hasCustomer
      ? he.activationBodyWithCustomer
      : he.activationBody
    : he.activationBodyCustomerOnly;

  return (
    <section className="ops-card ops-card-priority activation-card p-5" aria-labelledby="activation-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.activationKicker}</p>
      <h2 id="activation-heading" className="mt-1 text-base font-semibold text-fg">
        {title}
      </h2>
      <p className="mt-2 text-sm text-fg-muted">{body}</p>

      <ol className="activation-steps mt-4 flex flex-wrap gap-2" aria-label={he.activationPathLabel}>
        <li className={`activation-step${activation.hasCustomer ? " is-done" : ""}`}>
          <span className="activation-step-mark" aria-hidden>
            {activation.hasCustomer ? "✓" : "1"}
          </span>
          <span>{he.activationStepCustomer}</span>
        </li>
        <li className="activation-step is-optional">
          <span className="activation-step-mark" aria-hidden>
            ·
          </span>
          <span>{he.activationOptionalSite}</span>
        </li>
        <li className={`activation-step${activation.hasQuote ? " is-done" : ""}`}>
          <span className="activation-step-mark" aria-hidden>
            {activation.hasQuote ? "✓" : "2"}
          </span>
          <span>{he.activationStepQuote}</span>
        </li>
      </ol>

      {setupProgress ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-fg-muted">
            <span>{he.setupPendingLabel}</span>
            <span className="tabular-nums">
              {setupProgress.done}/{setupProgress.total} · {he.uxPercent(setupProgress.percent)}
            </span>
          </div>
          <div className="ops-setup-bar" aria-hidden>
            <span style={{ width: `${Math.max(0, Math.min(100, setupProgress.percent))}%` }} />
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {canCreateQuote ? (
          <NewQuoteButton
            startStep={activation.hasCustomer ? "menu" : "create"}
            className="activation-cta"
          >
            {he.activationCta}
          </NewQuoteButton>
        ) : canCreateCustomer ? (
          <Link
            to="/app/customers"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg transition-colors duration-200 hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.activationCreateCustomer}
          </Link>
        ) : (
          <p className="text-sm text-fg-muted">{he.activationRestricted}</p>
        )}
      </div>
    </section>
  );
}
