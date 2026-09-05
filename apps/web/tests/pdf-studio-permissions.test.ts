import { describe, expect, it } from "vitest";
import { can } from "../src/lib/can";

describe("PDF Template Studio permissions alignment", () => {
  const features = ["core", "settings", "quotes", "team"];

  it("Owner/Admin can edit workspace settings (templates)", () => {
    expect(can("owner", "workspace.edit", features)).toBe(true);
    expect(can("administrator", "workspace.edit", features)).toBe(true);
  });

  it("Manager/Sales/Technician/Viewer cannot edit templates", () => {
    expect(can("manager", "workspace.edit", features)).toBe(false);
    expect(can("sales", "workspace.edit", features)).toBe(false);
    expect(can("technician", "workspace.edit", features)).toBe(false);
    expect(can("viewer", "workspace.edit", features)).toBe(false);
  });

  it("settings.branding alone is not enough for template studio page", () => {
    // Page gates on workspace.edit; branding-only must not imply template mutation.
    expect(can("manager", "settings.branding", features)).toBe(false);
    expect(can("administrator", "settings.branding", features)).toBe(true);
    expect(can("administrator", "workspace.edit", features)).toBe(true);
  });
});
