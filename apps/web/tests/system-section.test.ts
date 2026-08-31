import { describe, expect, it } from "vitest";
import { resolveSystemSectionName } from "../src/lib/system-section";

describe("resolveSystemSectionName", () => {
  it("uses system name when no collision", () => {
    expect(resolveSystemSectionName("CCTV 4 Cameras", [])).toBe("CCTV 4 Cameras");
  });

  it("appends suffix when name already exists", () => {
    expect(resolveSystemSectionName("Alarm", [{ name: "Alarm" }])).toBe("Alarm (2)");
  });

  it("increments suffix until free", () => {
    expect(
      resolveSystemSectionName("Alarm", [{ name: "Alarm" }, { name: "Alarm (2)" }]),
    ).toBe("Alarm (3)");
  });
});
