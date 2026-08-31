import { describe, expect, it } from "vitest";
import type { DashboardSummary } from "@site-secure/api-client";
import { shouldShowDashboardKpiRow } from "../src/lib/dashboard-kpi";

const baseSummary: DashboardSummary = {
  quotes_draft: 0,
  quotes_sent: 0,
  quotes_viewed: 0,
  quotes_approved: 0,
  quotes_rejected: 0,
  quotes_open: 0,
  quotes_approved_value: 0,
  quotes_open_value: 0,
  jobs_open: 0,
  jobs_overdue: 0,
  jobs_unassigned: 0,
};

describe("shouldShowDashboardKpiRow", () => {
  it("hides during activation when there is no urgent operational signal", () => {
    expect(
      shouldShowDashboardKpiRow({
        showActivation: true,
        summary: baseSummary,
        showQuotes: true,
        attention: [],
      }),
    ).toBe(false);
  });

  it("shows overdue jobs during activation", () => {
    expect(
      shouldShowDashboardKpiRow({
        showActivation: true,
        summary: { ...baseSummary, jobs_overdue: 2 },
        showQuotes: true,
        attention: [],
      }),
    ).toBe(true);
  });

  it("shows open quotes after activation when pipeline exists", () => {
    expect(
      shouldShowDashboardKpiRow({
        showActivation: false,
        summary: { ...baseSummary, quotes_open: 3, quotes_sent: 3 },
        showQuotes: true,
        attention: [],
      }),
    ).toBe(true);
  });

  it("hides when there is no useful operational data", () => {
    expect(
      shouldShowDashboardKpiRow({
        showActivation: false,
        summary: baseSummary,
        showQuotes: true,
        attention: [],
      }),
    ).toBe(false);
  });
});
