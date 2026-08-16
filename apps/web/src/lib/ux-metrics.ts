import type { DashboardSummary, WorkspaceUsageMeter } from "@site-secure/api-client";

/** Percent = approved / counted quotes. Counted statuses today: draft, sent, viewed, approved, rejected. */
export function quoteConversion(summary: DashboardSummary | null | undefined): {
  percent: number | null;
  approved: number;
  total: number;
} {
  if (!summary) {
    return { percent: null, approved: 0, total: 0 };
  }
  const total =
    summary.quotes_draft +
    summary.quotes_sent +
    summary.quotes_viewed +
    summary.quotes_approved +
    summary.quotes_rejected;
  return {
    percent: total === 0 ? null : Math.round((summary.quotes_approved / total) * 100),
    approved: summary.quotes_approved,
    total,
  };
}

export function quotesInPlay(summary: DashboardSummary | null | undefined): number {
  if (!summary) return 0;
  return summary.quotes_draft + summary.quotes_sent + summary.quotes_viewed;
}

export function hasQuoteRecords(summary: DashboardSummary | null | undefined): boolean {
  return quoteConversion(summary).total > 0;
}

export function seatUtilization(meter: WorkspaceUsageMeter): number | null {
  if (meter.unlimited || meter.limit <= 0) return null;
  return Math.round((meter.current / meter.limit) * 100);
}

/** Blue = progress, green = healthy, amber = full/approaching. */
export function seatTone(meter: WorkspaceUsageMeter): "action" | "success" | "warning" | "neutral" {
  const percent = seatUtilization(meter);
  if (percent == null) return "neutral";
  if (meter.current > meter.limit || meter.at_limit || percent >= 80) return "warning";
  if (meter.current > 0) return "success";
  return "neutral";
}
