import { describe, expect, it } from "vitest";
import { resolveVisitSchedule, visitDateMarkerIso } from "../src/components/leads/ScheduleVisitSheet";
import {
  defaultLeadTitle,
  formatEstimatedValue,
  formatVisitWhen,
  isDateOnlyVisitMarker,
  leadPrimaryAction,
  phonesMatch,
  statusAfterVisitCompleted,
  statusAfterVisitScheduled,
} from "../src/lib/leads";
import { quoteCreateHref, quoteCreateSearch } from "../src/lib/workflow-context";

describe("leads helpers", () => {
  it("formats unknown estimated value distinctly from zero", () => {
    expect(formatEstimatedValue(null)).toBe("טרם נקבע");
    expect(formatEstimatedValue(undefined)).toBe("טרם נקבע");
    expect(formatEstimatedValue(0)).toContain("0");
  });

  it("matches phone numbers with normalization", () => {
    expect(phonesMatch("0585378423", "058-537-8423")).toBe(true);
    expect(phonesMatch("0585378423", "0501234567")).toBe(false);
  });

  it("builds contextual lead title from service and address", () => {
    expect(defaultLeadTitle("cctv", "אריה בן אליעזר 1, פתח תקווה")).toContain("מערכת מצלמות");
    expect(defaultLeadTitle("cctv", "אריה בן אליעזר 1, פתח תקווה")).toContain("פתח תקווה");
  });

  it("maps lead status to primary action", () => {
    expect(leadPrimaryAction("visit_scheduling")).toBe("schedule_visit");
    expect(leadPrimaryAction("quote_preparing")).toBe("create_quote");
    expect(leadPrimaryAction("quoted")).toBe("open_quote");
  });

  it("advances visit workflow statuses", () => {
    expect(statusAfterVisitScheduled()).toBe("visit_scheduled");
    expect(statusAfterVisitCompleted()).toBe("quote_preparing");
  });

  it("schedules afternoon window without inventing a clock time", () => {
    const resolved = resolveVisitSchedule({
      visitDate: "2026-08-24",
      visitTime: "",
      timeWindow: "afternoon",
    });
    expect(resolved.dueAt).toBe(visitDateMarkerIso("2026-08-24"));
    expect(resolved.visitStatus).toBe("scheduled");
    expect(resolved.leadStatus).toBe("visit_scheduled");
    expect(isDateOnlyVisitMarker(resolved.dueAt)).toBe(true);
    const label = formatVisitWhen({
      id: "1",
      workspace_id: "w",
      type: "visit",
      status: "open",
      title: "v",
      due_at: resolved.dueAt,
      time_window: "afternoon",
      visit_status: "scheduled",
      created_at: "",
      updated_at: "",
    });
    expect(label).toMatch(/אחר הצהריים/);
    expect(label).not.toMatch(/12:00/);
  });

  it("keeps exact time when provided", () => {
    const resolved = resolveVisitSchedule({
      visitDate: "2026-08-24",
      visitTime: "16:30",
      timeWindow: "afternoon",
    });
    expect(resolved.visitStatus).toBe("scheduled");
    expect(isDateOnlyVisitMarker(resolved.dueAt)).toBe(false);
  });
});

describe("workflow lead context", () => {
  it("passes leadId through quote create routing", () => {
    expect(quoteCreateSearch({ customerId: "c1", siteId: "s1", leadId: "l1" })).toEqual({
      customerId: "c1",
      siteId: "s1",
      leadId: "l1",
    });
    expect(quoteCreateHref({ customerId: "c1", leadId: "l1" })).toBe("/app/quotes/new?customerId=c1&leadId=l1");
  });
});
