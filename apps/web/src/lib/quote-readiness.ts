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

export type UnifiedReadinessItem = {
  id: string;
  label: string;
  status: "ok" | "warning" | "critical";
  message?: string;
  field: string;
};

const CHECK_FIELD: Record<string, string> = {
  customer: "customer_id",
  site: "site_id",
  items: "items",
  payment: "payment_terms",
  valid: "valid_until",
};

const CORE_GAP_FIELDS = new Set([
  "customer",
  "customer_id",
  "site_id",
  "items",
  "payment_terms",
  "valid_until",
  "title",
]);

export function buildUnifiedReadinessItems(
  readiness: QuoteReadiness,
  gaps: QuoteGap[],
  pricedCount: number,
): UnifiedReadinessItem[] {
  const items: UnifiedReadinessItem[] = readiness.checks.map((check) => ({
    id: check.id,
    label: check.label,
    status: check.ok ? "ok" : check.warning ? "warning" : "critical",
    field: CHECK_FIELD[check.id] ?? check.id,
  }));

  const visible = filterEmptyQuoteMarginGaps(gaps, pricedCount);
  const seen = new Set(items.map((item) => item.id));

  for (const gap of visible) {
    const field = gap.field || "items";
    const code = gap.code || field;
    if (CORE_GAP_FIELDS.has(field) && items.some((item) => item.field === field || item.id === code)) {
      const match = items.find((item) => item.id === code || item.field === field);
      if (match && match.status === "ok") {
        const severity = gapSeverity(gap);
        match.status = severity === "critical" ? "critical" : severity === "warning" ? "warning" : match.status;
        match.message = gap.message;
      }
      continue;
    }
    const id = `${field}-${code}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const severity = gapSeverity(gap);
    items.push({
      id,
      label: gap.message,
      status: severity === "critical" ? "critical" : severity === "warning" ? "warning" : "ok",
      field,
      message: gap.message,
    });
  }

  return items;
}
