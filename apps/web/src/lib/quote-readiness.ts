import type { QuoteGap } from "@site-secure/api-client";
import { completenessScore, filterEmptyQuoteMarginGaps, gapSeverity, partitionGaps } from "./quote-cpq";

export type ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  warning?: boolean;
};

export type QuoteReadiness = {
  percent: number;
  checks: ReadinessCheck[];
  critical: QuoteGap[];
  warning: QuoteGap[];
  info: QuoteGap[];
  canSend: boolean;
};

const CHECK_DEFS: Array<{ id: string; code: string; labelKey: "customer" | "site" | "items" | "payment" | "valid" }> = [
  { id: "customer", code: "customer", labelKey: "customer" },
  { id: "items", code: "items", labelKey: "items" },
  { id: "payment", code: "payment_terms", labelKey: "payment" },
  { id: "valid", code: "valid_until", labelKey: "valid" },
];

export function buildQuoteReadiness(
  gaps: QuoteGap[],
  opts: {
    pricedCount: number;
    hasSite?: boolean;
    labels: {
      customer: string;
      site: string;
      items: string;
      payment: string;
      valid: string;
    };
  },
): QuoteReadiness {
  const visible = filterEmptyQuoteMarginGaps(gaps, opts.pricedCount);
  const { critical, warning, info } = partitionGaps(visible);
  const score = completenessScore(visible);
  const missing = new Set(
    visible.filter((g) => gapSeverity(g) === "critical" || g.code).map((g) => g.code),
  );

  const checks: ReadinessCheck[] = CHECK_DEFS.map((def) => ({
    id: def.id,
    label: opts.labels[def.labelKey],
    ok: !missing.has(def.code),
    warning: false,
  }));

  checks.splice(1, 0, {
    id: "site",
    label: opts.labels.site,
    ok: Boolean(opts.hasSite),
    warning: !opts.hasSite,
  });

  // Soft: valid_until missing often warning in UX even if critical in gaps
  const validCheck = checks.find((c) => c.id === "valid");
  if (validCheck && !validCheck.ok) validCheck.warning = true;

  const percent = Math.round((score.done / Math.max(score.total, 1)) * 100);

  return {
    percent,
    checks,
    critical,
    warning,
    info,
    canSend: critical.length === 0,
  };
}
