import type { DashboardSummary } from "@site-secure/api-client";
import { hasQuoteRecords } from "./ux-metrics";

export type DashboardStage = "setup" | "early" | "operating";

export function dashboardStage(opts: {
  setupComplete: boolean;
  summary: DashboardSummary | null;
  todayCount: number;
  jobsOpen: number;
}): DashboardStage {
  if (!opts.setupComplete) return "setup";
  if (hasQuoteRecords(opts.summary) || opts.todayCount > 0 || opts.jobsOpen > 0) return "operating";
  return "early";
}
