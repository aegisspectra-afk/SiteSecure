import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import type { ActivationState } from "../../lib/activation";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

/**
 * Setup progress — existing completion rules only.
 * `panel` strengthens desktop low-data composition without changing setup logic.
 */
export function ActivationCard({
  activation,
  setupProgress,
  canCreateQuote,
  canCreateCustomer,
  compact = true,
  panel = false,
}: {
  activation: ActivationState;
  setupProgress: { percent: number; done: number; total: number } | null;
  canCreateQuote: boolean;
  canCreateCustomer: boolean;
  compact?: boolean;
  /** Low-data desktop secondary surface — same data, stronger composition. */
  panel?: boolean;
}) {
  const title = canCreateQuote
    ? activation.hasCustomer
      ? he.activationTitleWithCustomer
      : he.activationCompactLead
    : he.activationCreateCustomerTitle;

  if (compact) {
    return (
      <section
        className={`ops-setup-strip is-utility${panel ? " is-panel" : ""}`}
        aria-labelledby="activation-heading"
      >
        <div className="ops-setup-strip-main min-w-0">
          <div className="ops-setup-strip-head">
            <h2 id="activation-heading" className="ops-setup-strip-title">
              {setupProgress ? he.setupPendingLabel : title}
            </h2>
            {setupProgress ? (
              <span className="ops-setup-strip-pct tabular-nums">{he.uxPercent(setupProgress.percent)}</span>
            ) : null}
          </div>
          {setupProgress ? (
            <>
              <div className="ops-setup-bar is-subtle" aria-hidden>
                <span style={{ width: `${Math.max(0, Math.min(100, setupProgress.percent))}%` }} />
              </div>
              <p className="ops-setup-strip-lead">{title}</p>
            </>
          ) : (
            <p className="ops-setup-strip-lead">{title}</p>
          )}
        </div>
        <div className="ops-setup-strip-cta">
          {canCreateQuote ? (
            <NewQuoteButton
              startStep={activation.hasCustomer ? "menu" : "create"}
              className="activation-cta is-compact"
            >
              {he.activationContinue}
            </NewQuoteButton>
          ) : canCreateCustomer ? (
            <Link to="/app/customers" className="ops-setup-strip-link">
              {he.activationCreateCustomer}
            </Link>
          ) : (
            <p className="text-sm text-fg-muted">{he.activationRestricted}</p>
          )}
        </div>
      </section>
    );
  }

  const body = canCreateQuote
    ? activation.hasCustomer
      ? he.activationBodyWithCustomer
      : he.activationBody
    : he.activationBodyCustomerOnly;

  return (
    <section className="ops-card ops-card-priority activation-card p-5" aria-labelledby="activation-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.activationKicker}</p>
      <h2 id="activation-heading" className="mt-1 text-base font-semibold text-fg">
        {canCreateQuote
          ? activation.hasCustomer
            ? he.activationTitleWithCustomer
            : he.activationTitle
          : he.activationCreateCustomerTitle}
      </h2>
      <p className="mt-2 text-sm text-fg-muted">{body}</p>
      <div className="mt-5">
        {canCreateQuote ? (
          <NewQuoteButton startStep={activation.hasCustomer ? "menu" : "create"} className="activation-cta">
            {he.activationCta}
          </NewQuoteButton>
        ) : canCreateCustomer ? (
          <Link
            to="/app/customers"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
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
