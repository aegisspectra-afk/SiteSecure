import type { WorkforceIssue, WorkforceShiftOut, WorkforceSlotOut } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import {
  assignmentMatchesFilters,
  assignmentsForSlot,
  boardFilterOptions,
  employeeDisplayName,
  employeeMatchesQuery,
  fillLabel,
  issueHeadline,
  issuesForTarget,
  looseAssignments,
  occupancyTotals,
  slotFillStatus,
  slotMatchesFilters,
  splitIssues,
  type BoardFilters,
} from "./schedule-board";

function slot(partial: Partial<WorkforceSlotOut>): WorkforceSlotOut {
  return {
    id: "slot-1",
    workspace_id: "ws",
    site_id: "site-a",
    region_id: null,
    position_id: "pos-guard",
    coverage_requirement_id: null,
    starts_at: "2026-10-21T06:00:00.000Z",
    ends_at: "2026-10-21T14:00:00.000Z",
    required_count: 2,
    assigned_count: 1,
    unfilled_count: 1,
    notes: null,
    site_name: "מוקד צפון",
    position_name: "מאבטח",
    timezone: "Asia/Jerusalem",
    created_by: null,
    created_at: null,
    updated_at: null,
    ...partial,
  };
}

function assignment(partial: Partial<WorkforceShiftOut>): WorkforceShiftOut {
  return {
    id: "asg-1",
    workspace_id: "ws",
    employee_id: "emp-1",
    site_id: "site-a",
    region_id: null,
    position_id: "pos-guard",
    slot_id: "slot-1",
    starts_at: "2026-10-21T06:00:00.000Z",
    ends_at: "2026-10-21T14:00:00.000Z",
    notes: null,
    created_by: null,
    created_at: null,
    updated_at: null,
    employee_name: "רותי כהן",
    site_name: "מוקד צפון",
    region_name: null,
    position_name: "מאבטח",
    ...partial,
  };
}

function issue(partial: Partial<WorkforceIssue> & Pick<WorkforceIssue, "code" | "severity" | "message">): WorkforceIssue {
  return partial;
}

const all: BoardFilters = { siteId: "", positionId: "", status: "all" };

describe("schedule board occupancy", () => {
  it("marks gap, partial, and full from assigned vs required", () => {
    expect(slotFillStatus(slot({ assigned_count: 0, unfilled_count: 2 }))).toBe("gap");
    expect(slotFillStatus(slot({ assigned_count: 1, unfilled_count: 1 }))).toBe("partial");
    expect(slotFillStatus(slot({ assigned_count: 2, unfilled_count: 0 }))).toBe("full");
    expect(fillLabel("gap")).toBe("חסר");
  });

  it("sums occupancy without inventing coverage", () => {
    expect(
      occupancyTotals([
        slot({ required_count: 2, assigned_count: 1, unfilled_count: 1 }),
        slot({ id: "slot-2", required_count: 3, assigned_count: 3, unfilled_count: 0 }),
      ]),
    ).toEqual({ required: 5, assigned: 4, missing: 1 });
  });
});

describe("schedule board filters", () => {
  it("filters slots by site, position, and fill status", () => {
    const north = slot({});
    const south = slot({ id: "slot-s", site_id: "site-b", site_name: "דרום", assigned_count: 0, unfilled_count: 2 });
    expect(slotMatchesFilters(north, { ...all, siteId: "site-a" })).toBe(true);
    expect(slotMatchesFilters(south, { ...all, siteId: "site-a" })).toBe(false);
    expect(slotMatchesFilters(north, { ...all, status: "short" })).toBe(true);
    expect(slotMatchesFilters(slot({ assigned_count: 2, unfilled_count: 0 }), { ...all, status: "short" })).toBe(false);
    expect(slotMatchesFilters(south, { ...all, status: "gap" })).toBe(true);
    expect(slotMatchesFilters(north, { ...all, positionId: "pos-other" })).toBe(false);
  });

  it("hides unattached assignments when a fill status is selected", () => {
    const loose = assignment({ slot_id: null });
    expect(assignmentMatchesFilters(loose, all)).toBe(true);
    expect(assignmentMatchesFilters(loose, { ...all, status: "short" })).toBe(false);
    expect(assignmentMatchesFilters(loose, { ...all, siteId: "site-b" })).toBe(false);
  });

  it("builds site and position options from real week rows only", () => {
    const options = boardFilterOptions(
      [slot({}), slot({ id: "slot-2", site_id: "site-a", position_id: "pos-guard" })],
      [assignment({ id: "asg-2", site_id: "site-b", site_name: "דרום", position_id: null, position_name: null })],
    );
    expect(options.sites.map((row) => row.id)).toEqual(["site-a", "site-b"]);
    expect(options.positions).toEqual([{ id: "pos-guard", name: "מאבטח" }]);
  });
});

describe("schedule board grouping", () => {
  it("lists people on a slot and loose assignments separately", () => {
    const rows = [
      assignment({ id: "on" }),
      assignment({ id: "other", slot_id: "slot-missing" }),
      assignment({ id: "loose", slot_id: null }),
    ];
    expect(assignmentsForSlot(rows, "slot-1").map((row) => row.id)).toEqual(["on"]);
    expect(looseAssignments(rows, [slot({})]).map((row) => row.id)).toEqual(["other", "loose"]);
  });
});

describe("employee search", () => {
  it("matches name and employee number without requiring quals", () => {
    const row = { id: "e1", first_name: "רותי", last_name: "כהן", employee_number: "1042", site_id: "site-a" };
    expect(employeeDisplayName(row)).toBe("רותי כהן");
    expect(employeeMatchesQuery(row, "כהן")).toBe(true);
    expect(employeeMatchesQuery(row, "1042")).toBe(true);
    expect(employeeMatchesQuery(row, "דני")).toBe(false);
  });
});

describe("validation presentation", () => {
  it("splits blocking errors from warnings and never treats them as legal certification", () => {
    const hard = issue({ code: "overlap", severity: "hard", message: "חופף", employee_id: "emp-1" });
    const soft = issue({ code: "unfilled_slot", severity: "soft", message: "חסר", slot_id: "slot-1" });
    expect(splitIssues([hard, soft])).toEqual({ hard: [hard], soft: [soft] });
    expect(issueHeadline(hard)).toBe("התנגשות משמרות");
    expect(issueHeadline({ code: "duplicate_slot_assignment", severity: "hard", message: "כפול" })).toBe(
      "העובד כבר משובץ לעמדה זו",
    );
    expect(issuesForTarget([hard, soft], { employeeId: "emp-1" })).toEqual([hard]);
    expect(issuesForTarget([hard, soft], { slotId: "slot-1" })).toEqual([soft]);
  });
});
