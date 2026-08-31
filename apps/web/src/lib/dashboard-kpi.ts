import type { AttentionGroup, DashboardSummary } from "@site-secure/api-client";
import { attentionUrgentCount } from "./attention-queue";

/** Show compact operational KPIs only when they support a same-day decision. */
export function shouldShowDashboardKpiRow(opts: {
  showActivation: boolean;
  summary: DashboardSummary | null | undefined;
  showQuotes: boolean;
  attention?: AttentionGroup[];
}): boolean {
  if (!opts.summary) return false;
  const { summary } = opts;
  const hasOverdue = summary.jobs_overdue > 0;
  const hasOpenQuotes = opts.showQuotes && summary.quotes_open > 0;
  const urgent = attentionUrgentCount(opts.attention ?? []);

  if (opts.showActivation) {
    return hasOverdue || urgent > 0;
  }
  return hasOverdue || hasOpenQuotes;
}
