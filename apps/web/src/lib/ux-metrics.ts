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
  const progressed =
    summary.quotes_sent + summary.quotes_viewed + summary.quotes_approved + summary.quotes_rejected;
  return {
    percent: total === 0 || progressed === 0 ? null : Math.round((summary.quotes_approved / total) * 100),
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

export function meterUtilization(meter: WorkspaceUsageMeter): number | null {
  if (meter.unlimited || meter.limit <= 0) return null;
  return Math.round((meter.current / meter.limit) * 100);
}

/** @deprecated prefer meterUtilization */
export function seatUtilization(meter: WorkspaceUsageMeter): number | null {
  return meterUtilization(meter);
}

export type MeterTone =
  | "action"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "tech"
  | "analytics";

/** Semantic quota tone: amber ≥80%, critical ≥90% / at limit. */
export function meterTone(meter: WorkspaceUsageMeter): MeterTone {
  const percent = meterUtilization(meter);
  if (percent == null) return "neutral";
  if (meter.at_limit || percent >= 90 || meter.current > meter.limit) return "danger";
  if (percent >= 80) return "warning";
  if (meter.current > 0) return "success";
  return "neutral";
}

/** @deprecated prefer meterTone */
export function seatTone(meter: WorkspaceUsageMeter): "action" | "success" | "warning" | "neutral" {
  const tone = meterTone(meter);
  if (tone === "danger" || tone === "warning") return "warning";
  if (tone === "success") return "success";
  if (tone === "neutral") return "neutral";
  return "action";
}

export function formatStorageBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 10) return `${Math.round(gb)} GB`;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  if (bytes <= 0) return "0 GB";
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function storageHint(meter: WorkspaceUsageMeter): string {
  if (meter.unit !== "bytes") return `${meter.current} / ${meter.limit}`;
  if (meter.unlimited || meter.limit <= 0) return formatStorageBytes(meter.current);
  return `${formatStorageBytes(meter.current)} / ${formatStorageBytes(meter.limit)}`;
}

export function storageNext(meter: WorkspaceUsageMeter): string | undefined {
  if (meter.unit !== "bytes") return undefined;
  if (meter.unlimited || meter.limit <= 0) return undefined;
  if (meter.at_limit) return undefined;
  if (meter.current <= 0) return undefined;
  return undefined;
}
