import { describe, expect, it } from "vitest";
import { addDays, crossesLocalMidnight, rangeOverlapsDay, startOfWeekSunday, weekDays } from "./week";

describe("workforce week helpers", () => {
  it("starts the Hebrew week on Sunday and keeps Saturday across DST", () => {
    const wednesday = new Date(2026, 9, 21, 15, 30);
    const start = startOfWeekSunday(wednesday);
    expect(start.getDay()).toBe(0);
    expect(start.getDate()).toBe(18);
    expect(start.getHours()).toBe(0);
    const days = weekDays(start);
    expect(days).toHaveLength(7);
    expect(days[6].getDay()).toBe(6);
    expect(days[6].getDate()).toBe(24);

    const autumn = startOfWeekSunday(new Date(2026, 9, 28));
    expect(autumn.getDate()).toBe(25);
    expect(addDays(autumn, 6).getDate()).toBe(31);
    expect(addDays(autumn, 6).getDay()).toBe(6);
  });

  it("places overnight shifts on both local dates", () => {
    const start = new Date(2026, 9, 21, 22, 0).toISOString();
    const end = new Date(2026, 9, 22, 6, 0).toISOString();
    const first = new Date(2026, 9, 21);
    const second = new Date(2026, 9, 22);
    const third = new Date(2026, 9, 23);
    expect(rangeOverlapsDay(start, end, first)).toBe(true);
    expect(rangeOverlapsDay(start, end, second)).toBe(true);
    expect(rangeOverlapsDay(start, end, third)).toBe(false);
    expect(crossesLocalMidnight(start, end)).toBe(true);
  });
});
