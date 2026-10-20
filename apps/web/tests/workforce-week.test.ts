import { describe, expect, it } from "vitest";
import { addDays, startOfWeekSunday, weekDays } from "../src/lib/workforce-week";

describe("workforce week helpers", () => {
  it("starts the Hebrew week on Sunday", () => {
    const wednesday = new Date(2026, 9, 21, 15, 30);
    const start = startOfWeekSunday(wednesday);
    expect(start.getDay()).toBe(0);
    expect(start.getHours()).toBe(0);
    expect(weekDays(start)).toHaveLength(7);
    expect(addDays(start, 7).getTime()).toBe(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
});
