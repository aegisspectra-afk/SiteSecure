import { describe, expect, it } from "vitest";
import { relativeAgeLabel } from "../src/lib/relative-age";

describe("relativeAgeLabel", () => {
  const now = new Date("2026-09-05T15:00:00+03:00");

  it("returns null for missing/invalid", () => {
    expect(relativeAgeLabel(null, now)).toBeNull();
    expect(relativeAgeLabel("not-a-date", now)).toBeNull();
  });

  it("formats hours and days", () => {
    expect(relativeAgeLabel("2026-09-05T13:00:00+03:00", now)).toBe("לפני 2 שעות");
    expect(relativeAgeLabel("2026-09-04T10:00:00+03:00", now)).toBe("מאז אתמול");
    expect(relativeAgeLabel("2026-08-31T10:00:00+03:00", now)).toBe("ממתינה 5 ימים");
  });
});
