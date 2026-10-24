import { describe, expect, it } from "vitest";
import type { WorkforceMyShiftOut } from "@site-secure/api-client";
import { assignmentStatusLabel, groupMyShiftsByDate, shiftMeta } from "./my-shifts";

function shift(partial: Partial<WorkforceMyShiftOut> & Pick<WorkforceMyShiftOut, "id" | "local_date">): WorkforceMyShiftOut {
  return {
    starts_at: `${partial.local_date}T06:00:00Z`,
    ends_at: `${partial.local_date}T14:00:00Z`,
    starts_local: "09:00",
    ends_local: "17:00",
    timezone: "Asia/Jerusalem",
    site_id: "site-1",
    site_name: "מוקד צפון",
    region_id: null,
    region_name: null,
    position_id: "pos-1",
    position_name: "מאבטח",
    notes: null,
    status: "assigned",
    overnight: false,
    ...partial,
  };
}

describe("my shifts grouping", () => {
  it("groups by local date and sorts within the day", () => {
    const groups = groupMyShiftsByDate([
      shift({ id: "b", local_date: "2026-10-22", starts_at: "2026-10-22T12:00:00Z", starts_local: "15:00" }),
      shift({ id: "a", local_date: "2026-10-21", starts_at: "2026-10-21T08:00:00Z", starts_local: "11:00" }),
      shift({ id: "c", local_date: "2026-10-22", starts_at: "2026-10-22T04:00:00Z", starts_local: "07:00" }),
    ]);
    expect(groups.map((group) => group.date)).toEqual(["2026-10-21", "2026-10-22"]);
    expect(groups[1].items.map((row) => row.id)).toEqual(["c", "b"]);
    expect(groups[0].label).toContain("אוקטובר");
  });

  it("returns no groups for an empty list", () => {
    expect(groupMyShiftsByDate([])).toEqual([]);
  });

  it("labels assigned status and operational meta without other employees", () => {
    const row = shift({ id: "a", local_date: "2026-10-21", notes: "שער דרום" });
    expect(assignmentStatusLabel(row.status)).toBe("משובץ");
    expect(shiftMeta(row)).toBe("מוקד צפון · מאבטח — שער דרום");
    expect(shiftMeta(row)).not.toContain("employee");
  });
});
