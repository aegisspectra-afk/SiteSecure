import { describe, expect, it } from "vitest";
import type { JobOut } from "@site-secure/api-client";
import { he } from "../src/i18n/he";
import {
  currentJobAssignee,
  deriveProjectJobSummary,
  formatJobScheduleWindow,
  formatProjectJobSummary,
  formatProjectListMeta,
  jobIsUnassigned,
  projectStatusTone,
} from "../src/lib/project-workspace";

function job(partial: Partial<JobOut> & Pick<JobOut, "id" | "status">): JobOut {
  return {
    workspace_id: "ws1",
    number: "J-1",
    title: "התקנה",
    kind: "installation",
    customer_id: "c1",
    site_id: "s1",
    created_at: "2026-09-24T10:00:00Z",
    updated_at: "2026-09-24T10:00:00Z",
    assignees: [],
    is_assigned: false,
    ...partial,
  };
}

describe("project-workspace helpers", () => {
  it("derives summary counts from authoritative job statuses", () => {
    const summary = deriveProjectJobSummary([
      job({ id: "1", status: "scheduled", is_assigned: false, assignees: [] }),
      job({
        id: "2",
        status: "in_progress",
        is_assigned: true,
        assignees: [{ user_id: "t1", display_name: "דני" }],
      }),
      job({ id: "3", status: "completed", is_assigned: true, assignees: [{ user_id: "t1" }] }),
      job({ id: "4", status: "cancelled", is_assigned: false, assignees: [] }),
      job({ id: "5", status: "blocked", is_assigned: false, assignees: [] }),
    ]);
    expect(summary).toEqual({ total: 5, active: 3, completed: 1, unassigned: 3 });
  });

  it("formats empty and populated summaries in Hebrew", () => {
    expect(formatProjectJobSummary({ total: 0, active: 0, completed: 0, unassigned: 0 })).toBe(
      he.projectJobsSummaryEmpty,
    );
    expect(formatProjectJobSummary({ total: 3, active: 1, completed: 1, unassigned: 1 })).toBe(
      "3 עבודות · 1 פעילה · 1 הושלמה · 1 ללא הקצאה",
    );
  });

  it("reads current assignee without inventing assignment heuristics", () => {
    const assigned = job({
      id: "a",
      status: "scheduled",
      is_assigned: true,
      assignees: [
        { user_id: "t1", display_name: "נועה" },
        { user_id: "t2", display_name: "אחר" },
      ],
    });
    expect(currentJobAssignee(assigned)?.display_name).toBe("נועה");
    expect(jobIsUnassigned(assigned)).toBe(false);
    expect(jobIsUnassigned(job({ id: "b", status: "scheduled" }))).toBe(true);
  });

  it("formats schedule windows when present", () => {
    expect(formatJobScheduleWindow(null, null)).toBeNull();
    const label = formatJobScheduleWindow("2026-09-24T16:35:00Z", "2026-09-24T18:35:00Z");
    expect(label).toMatch(/24\.09|24\/09/);
    expect(label).toContain("–");
  });

  it("formats project list meta from real customer/site context", () => {
    expect(
      formatProjectListMeta(
        { customer_id: "c1", site_id: "s1" },
        { customerName: "לקוח", siteName: "אתר" },
      ),
    ).toBe("לקוח · אתר");
    expect(formatProjectListMeta({ customer_id: "c1", site_id: null }, { customerName: "לקוח" })).toBe(
      `לקוח · ${he.projectNoSite}`,
    );
  });

  it("maps project status tones without inventing statuses", () => {
    expect(projectStatusTone("completed")).toBe("success");
    expect(projectStatusTone("on_hold")).toBe("warning");
    expect(projectStatusTone("in_progress")).toBe("info");
    expect(projectStatusTone("draft")).toBe("neutral");
  });
});
