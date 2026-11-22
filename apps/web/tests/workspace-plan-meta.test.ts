import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import { planLabel, workspacePlanMetaLine } from "../src/lib/app-nav";

describe("workspace plan meta (C3 header)", () => {
  it("shows plan name only for active workspace", () => {
    expect(workspacePlanMetaLine("free", true)).toBe(planLabel("free"));
    expect(workspacePlanMetaLine("solo", true)).toBe(planLabel("solo"));
    expect(workspacePlanMetaLine("free", true)).not.toContain(he.workspaceMetaActive);
  });

  it("appends inactive label when workspace paused", () => {
    expect(workspacePlanMetaLine("pro", false)).toBe(`${planLabel("pro")} · ${he.workspaceMetaInactive}`);
  });
});