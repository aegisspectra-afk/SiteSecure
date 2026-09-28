import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import { parseJobNavSearch, resolveFieldJobBack } from "../src/lib/job-nav";

describe("job-nav contextual back", () => {
  it("parses from and projectId search params", () => {
    expect(parseJobNavSearch({ from: "jobs" })).toEqual({ from: "jobs", projectId: undefined });
    expect(parseJobNavSearch({ from: "project", projectId: "p1" })).toEqual({
      from: "project",
      projectId: "p1",
    });
    expect(parseJobNavSearch({ from: "nope", projectId: 1 })).toEqual({
      from: undefined,
      projectId: undefined,
    });
  });

  it("returns Jobs when opened from jobs list", () => {
    const back = resolveFieldJobBack({ from: "jobs", roleKey: "manager" });
    expect(back).toEqual({ kind: "jobs", to: "/app/jobs", label: he.navJobs });
  });

  it("returns Today when opened from today", () => {
    const back = resolveFieldJobBack({ from: "today", roleKey: "manager" });
    expect(back).toEqual({ kind: "today", to: "/app/today", label: he.navToday });
  });

  it("returns Project when opened from project with id", () => {
    const back = resolveFieldJobBack({ from: "project", projectId: "p9", roleKey: "technician" });
    expect(back).toEqual({
      kind: "project",
      to: "/app/projects/$projectId",
      projectId: "p9",
      label: he.fieldBackToProject,
    });
  });

  it("defaults technicians to Today and managers to Jobs", () => {
    expect(resolveFieldJobBack({ roleKey: "technician" }).to).toBe("/app/today");
    expect(resolveFieldJobBack({ roleKey: "manager" }).to).toBe("/app/jobs");
    expect(resolveFieldJobBack({ roleKey: "owner" }).to).toBe("/app/jobs");
  });
});
