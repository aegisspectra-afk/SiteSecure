import type { WorkforceShiftOut, WorkforceSlotOut, WorkforceWeekOut } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import {
  assignmentHours,
  coveragePercent,
  coverageRows,
  coverageTone,
  nightShiftCount,
  overlapsLocalNight,
  plannedHours,
  unfilledSlotCount,
  weeklyAssignmentCount,
} from "./dashboard-metrics";

function shift(partial: Partial<WorkforceShiftOut>): WorkforceShiftOut {
  return {
    id: "s1",
    workspace_id: "ws",
    employee_id: "e1",
    site_id: "site-a",
    region_id: null,
    position_id: null,
    slot_id: null,
    starts_at: new Date(2026, 9, 21, 8, 0).toISOString(),
    ends_at: new Date(2026, 9, 21, 16, 0).toISOString(),
    notes: null,
    created_by: null,
    created_at: null,
    updated_at: null,
    employee_name: "A",
    site_name: "מוקד א",
    region_name: null,
    position_name: null,
    ...partial,
  };
}

function slot(partial: Partial<WorkforceSlotOut>): WorkforceSlotOut {
  return {
    id: "slot-1",
    workspace_id: "ws",
    site_id: "site-a",
    region_id: null,
    position_id: "pos",
    coverage_requirement_id: null,
    starts_at: new Date(2026, 9, 21, 8, 0).toISOString(),
    ends_at: new Date(2026, 9, 21, 16, 0).toISOString(),
    required_count: 2,
    assigned_count: 1,
    unfilled_count: 1,
    notes: null,
    site_name: "מוקד א",
    position_name: "מאח",
    timezone: "Asia/Jerusalem",
    created_by: null,
    created_at: null,
    updated_at: null,
    ...partial,
  };
}

describe("dashboard metric formulas", () => {
  it("counts only assigned shifts and planned hours from those intervals", () => {
    const rows = [
      shift({ id: "a", employee_id: "e1" }),
      shift({ id: "open", employee_id: null }),
      shift({
        id: "b",
        employee_id: "e2",
        starts_at: new Date(2026, 9, 21, 16, 0).toISOString(),
        ends_at: new Date(2026, 9, 21, 20, 0).toISOString(),
      }),
    ];
    expect(weeklyAssignmentCount(rows)).toBe(2);
    expect(plannedHours(rows)).toBe(12);
    expect(assignmentHours(rows[0].starts_at, rows[0].ends_at)).toBe(8);
  });

  it("marks night overlap using 22:00–06:00 local, not every overnight label", () => {
    expect(overlapsLocalNight(new Date(2026, 9, 21, 8, 0).toISOString(), new Date(2026, 9, 21, 16, 0).toISOString())).toBe(
      false,
    );
    expect(overlapsLocalNight(new Date(2026, 9, 21, 20, 0).toISOString(), new Date(2026, 9, 21, 23, 0).toISOString())).toBe(
      true,
    );
    expect(overlapsLocalNight(new Date(2026, 9, 21, 22, 0).toISOString(), new Date(2026, 9, 22, 6, 0).toISOString())).toBe(
      true,
    );
    const rows = [
      shift({
        id: "night",
        starts_at: new Date(2026, 9, 21, 22, 0).toISOString(),
        ends_at: new Date(2026, 9, 22, 6, 0).toISOString(),
      }),
      shift({ id: "day" }),
    ];
    expect(nightShiftCount(rows)).toBe(1);
  });

  it("computes coverage from slot required vs assigned, never from an empty denominator", () => {
    expect(coverageTone(0, 0)).toBe("none");
    expect(coverageTone(2, 2)).toBe("full");
    expect(coverageTone(2, 1)).toBe("partial");
    expect(coverageTone(2, 0)).toBe("gap");
    expect(coveragePercent(0, 3)).toBeNull();
    expect(coveragePercent(2, 1)).toBe("50%");
    const week: WorkforceWeekOut = {
      starts_from: "",
      starts_to: "",
      slots: [slot({}), slot({ id: "slot-2", site_id: "site-b", site_name: "מוקד ב", assigned_count: 2, unfilled_count: 0 })],
      assignments: [],
      coverage: [],
      issues: [],
      policy: { workspace_id: "ws", max_shift_hours: 12, min_rest_hours: null, rest_rule_enabled: false, weekly_hour_cap: null },
      legal_status: "not_certified",
      certified_legal: false,
    };
    const day = new Date(2026, 9, 21);
    const rows = coverageRows(week, [day]);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells[0].required).toBe(2);
    expect(rows[0].cells[0].assigned).toBe(1);
    expect(rows[0].cells[0].tone).toBe("partial");
    expect(unfilledSlotCount(week.slots)).toBe(1);
    expect(unfilledSlotCount(week.slots, "site-b")).toBe(0);
  });
});
