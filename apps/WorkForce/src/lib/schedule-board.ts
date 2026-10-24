import type { WorkforceIssue, WorkforceShiftOut, WorkforceSlotOut } from "@site-secure/api-client";
import { he } from "../i18n/he";

export type SlotFill = "gap" | "partial" | "full";
export type BoardStatusFilter = "all" | "gap" | "short" | "full";

export type BoardFilters = {
  siteId: string;
  positionId: string;
  status: BoardStatusFilter;
};

export type NamedOption = { id: string; name: string };

export type OccupancyTotals = {
  required: number;
  assigned: number;
  missing: number;
};

export type EmployeeSearchRow = {
  id: string;
  first_name: string;
  last_name: string;
  employee_number?: string | null;
  site_id?: string | null;
};

export function slotFillStatus(
  slot: Pick<WorkforceSlotOut, "assigned_count" | "required_count" | "unfilled_count">,
): SlotFill {
  if (slot.required_count <= 0) return "full";
  if (slot.assigned_count <= 0) return "gap";
  if (slot.unfilled_count > 0) return "partial";
  return "full";
}

export function occupancyCounts(slot: WorkforceSlotOut): OccupancyTotals & { tone: SlotFill } {
  return {
    required: slot.required_count,
    assigned: slot.assigned_count,
    missing: Math.max(0, slot.unfilled_count),
    tone: slotFillStatus(slot),
  };
}

export function occupancyTotals(slots: WorkforceSlotOut[]): OccupancyTotals {
  return slots.reduce<OccupancyTotals>(
    (acc, slot) => {
      acc.required += slot.required_count;
      acc.assigned += slot.assigned_count;
      acc.missing += Math.max(0, slot.unfilled_count);
      return acc;
    },
    { required: 0, assigned: 0, missing: 0 },
  );
}

export function slotMatchesFilters(slot: WorkforceSlotOut, filters: BoardFilters): boolean {
  if (filters.siteId && slot.site_id !== filters.siteId) return false;
  if (filters.positionId && slot.position_id !== filters.positionId) return false;
  const tone = slotFillStatus(slot);
  if (filters.status === "gap") return tone === "gap";
  if (filters.status === "full") return tone === "full";
  if (filters.status === "short") return tone !== "full";
  return true;
}

export function assignmentMatchesFilters(row: WorkforceShiftOut, filters: BoardFilters): boolean {
  if (filters.siteId && (row.site_id ?? "") !== filters.siteId) return false;
  if (filters.positionId && (row.position_id ?? "") !== filters.positionId) return false;
  if (filters.status !== "all" && !row.slot_id) return false;
  return true;
}

export function assignmentsForSlot(assignments: WorkforceShiftOut[], slotId: string): WorkforceShiftOut[] {
  return assignments.filter((row) => row.slot_id === slotId);
}

export function looseAssignments(assignments: WorkforceShiftOut[], allSlots: WorkforceSlotOut[]): WorkforceShiftOut[] {
  const ids = new Set(allSlots.map((slot) => slot.id));
  return assignments.filter((row) => !row.slot_id || !ids.has(row.slot_id));
}

export function uniqueNamedOptions(rows: Array<{ id: string | null; name: string | null }>): NamedOption[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!row.id) continue;
    if (!seen.has(row.id)) seen.set(row.id, row.name?.trim() || row.id);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

export function boardFilterOptions(
  slots: WorkforceSlotOut[],
  assignments: WorkforceShiftOut[],
): { sites: NamedOption[]; positions: NamedOption[] } {
  return {
    sites: uniqueNamedOptions([
      ...slots.map((row) => ({ id: row.site_id, name: row.site_name })),
      ...assignments.map((row) => ({ id: row.site_id, name: row.site_name })),
    ]),
    positions: uniqueNamedOptions([
      ...slots.map((row) => ({ id: row.position_id, name: row.position_name })),
      ...assignments.map((row) => ({ id: row.position_id, name: row.position_name })),
    ]),
  };
}

export function employeeDisplayName(row: Pick<EmployeeSearchRow, "first_name" | "last_name">): string {
  return `${row.first_name} ${row.last_name}`.trim();
}

export function employeeMatchesQuery(row: EmployeeSearchRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [row.first_name, row.last_name, row.employee_number, employeeDisplayName(row)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function issueShiftId(issue: WorkforceIssue): string | null {
  const extra = issue as WorkforceIssue & { shift_id?: string };
  return extra.shift_id ?? null;
}

export function isBlockingIssue(issue: WorkforceIssue): boolean {
  return issue.severity === "hard" || issue.finding_severity === "blocking";
}

export function splitIssues(issues: WorkforceIssue[]): { hard: WorkforceIssue[]; soft: WorkforceIssue[] } {
  const hard: WorkforceIssue[] = [];
  const soft: WorkforceIssue[] = [];
  for (const issue of issues) {
    if (isBlockingIssue(issue)) hard.push(issue);
    else soft.push(issue);
  }
  return { hard, soft };
}

export function issuesForTarget(
  issues: WorkforceIssue[],
  target: { slotId?: string | null; shiftId?: string | null; employeeId?: string | null },
): WorkforceIssue[] {
  return issues.filter((issue) => {
    if (target.slotId && issue.slot_id === target.slotId) return true;
    if (target.shiftId && issueShiftId(issue) === target.shiftId) return true;
    if (target.employeeId && issue.employee_id === target.employeeId) return true;
    return false;
  });
}

export function issueHeadline(issue: WorkforceIssue): string {
  if (issue.code === "unfilled_slot") return he.unfilledSlot;
  if (issue.code === "coverage_shortfall") return he.coverageWarning;
  if (issue.code === "overlap") return he.issueOverlap;
  if (issue.code === "duplicate_slot_assignment") return he.issueDuplicateSlot;
  if (issue.code === "missing_qualification") return he.issueMissingQual;
  if (issue.code === "expired_qualification") return he.issueExpiredQual;
  if (issue.code === "preferred_qualification_missing") return he.issuePreferredQual;
  if (issue.code === "rest_insufficient") return he.issueRest;
  if (issue.code === "duration_exceeds_policy") return he.issueMaxShift;
  if (issue.code === "weekly_hours_exceed_policy") return he.issueWeeklyCap;
  if (issue.code === "approved_absence") return he.issueTimeOff;
  return issue.message;
}

export function fillLabel(tone: SlotFill): string {
  if (tone === "full") return he.coverageFull;
  if (tone === "partial") return he.coveragePartial;
  return he.coverageGap;
}
