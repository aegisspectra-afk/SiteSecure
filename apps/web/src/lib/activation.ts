import type { DashboardSummary, WorkspaceUsage } from "@site-secure/api-client";
import { quoteConversion } from "./ux-metrics";

/**
 * Workspace activation — derive from live CRM/quote data only.
 * Do not persist duplicate has_created_* flags.
 *
 * Future analytics taxonomy (NOT emitted until a real pipeline exists):
 * - workspace_created
 * - first_customer_created
 * - first_site_created
 * - first_quote_created
 * - first_quote_builder_opened
 * - first_quote_pdf_previewed
 */

export type ActivationState = {
  /** Counts are known enough to render (no empty-state flicker). */
  ready: boolean;
  /** At least one quote exists — activation card must not dominate. */
  complete: boolean;
  hasCustomer: boolean;
  hasQuote: boolean;
  customerCount: number;
  quoteCount: number;
};

export function quoteCountFromSummary(summary: DashboardSummary | null | undefined): number {
  return quoteConversion(summary).total;
}

/** Prefer usage meter when present; otherwise probe count. */
export function resolveCustomerCount(opts: {
  usage: WorkspaceUsage | null | undefined;
  probedCount: number | null;
}): number | null {
  const meter = opts.usage?.meters.find((row) => row.key === "quota_clients");
  if (meter) return Math.max(0, meter.current);
  return opts.probedCount;
}

export function deriveActivation(opts: {
  customerCount: number | null;
  quoteCount: number | null;
  countsReady: boolean;
}): ActivationState {
  const customerCount = Math.max(0, opts.customerCount ?? 0);
  const quoteCount = Math.max(0, opts.quoteCount ?? 0);
  const hasCustomer = customerCount > 0;
  const hasQuote = quoteCount > 0;
  return {
    ready: opts.countsReady,
    complete: hasQuote,
    hasCustomer,
    hasQuote,
    customerCount,
    quoteCount,
  };
}

export function shouldShowActivationCard(opts: {
  activation: ActivationState;
  canCreateQuote: boolean;
  canCreateCustomer: boolean;
}): boolean {
  if (!opts.activation.ready) return false;
  if (opts.activation.complete) return false;
  return opts.canCreateQuote || opts.canCreateCustomer;
}
