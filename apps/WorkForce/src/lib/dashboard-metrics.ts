import type { WorkforceShiftOut, WorkforceSlotOut, WorkforceTimeOffOut, WorkforceWeekOut } from "@site-secure/api-client";
import { rangeOverlapsDay } from "./week";

/** Night window used for Israeli operational reporting: 22:00–06:00 local. */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;

export type CoverageTone = "none" | "full" | "partial" | "gap";

export type CoverageCell = {
  siteId: string;
  siteName: string;
  dayIndex: number;
  required: number;
  assigned: number;
  unfilled: number;
  tone: CoverageTone;
  slots: WorkforceSlotOut[];
};

export type CoverageRow = {
  siteId: string;
  siteName: string;
  cells: CoverageCell[];
};

export type AttentionItem = {
  id: string;
  title: string;
  meta: string;
};

function toTime(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : value;
}

export function assignmentHours(startsAt: string, endsAt: string): number {
  const ms = toTime(endsAt) - toTime(startsAt);
  return ms > 0 ? ms / 3_600_000 : 0;
}

export function overlapsLocalNight(startsAt: string, endsAt: string): boolean {
  const start = toTime(startsAt);
  const end = toTime(endsAt);
  if (!(end > start)) return false;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() < end) {
    const morningEnd = new Date(cursor);
    morningEnd.setHours(NIGHT_END_HOUR, 0, 0, 0);
    const nightStart = new Date(cursor);
    nightStart.setHours(NIGHT_START_HOUR, 0, 0, 0);
    const nextMidnight = new Date(cursor);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);
    if (start < morningEnd.getTime() && end > cursor.getTime()) return true;
    if (start < nextMidnight.getTime() && end > nightStart.getTime()) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

export function matchesSite(siteId: string | null | undefined, selectedSiteId: string): boolean {
  if (!selectedSiteId) return true;
  return (siteId ?? "") === selectedSiteId;
}

export function weeklyAssignmentCount(assignments: WorkforceShiftOut[], selectedSiteId = ""): number {
  return assignments.filter((row) => row.employee_id && matchesSite(row.site_id, selectedSiteId)).length;
}

export function plannedHours(assignments: WorkforceShiftOut[], selectedSiteId = ""): number {
  return assignments
    .filter((row) => row.employee_id && matchesSite(row.site_id, selectedSiteId))
    .reduce((sum, row) => sum + assignmentHours(row.starts_at, row.ends_at), 0);
}

export function nightShiftCount(assignments: WorkforceShiftOut[], selectedSiteId = ""): number {
  return assignments.filter(
    (row) => row.employee_id && matchesSite(row.site_id, selectedSiteId) && overlapsLocalNight(row.starts_at, row.ends_at),
  ).length;
}

export function unfilledSlotCount(slots: WorkforceSlotOut[], selectedSiteId = ""): number {
  return slots
    .filter((row) => matchesSite(row.site_id, selectedSiteId))
    .reduce((sum, row) => sum + Math.max(row.unfilled_count, 0), 0);
}

export function coverageTone(required: number, assigned: number): CoverageTone {
  if (required <= 0) return "none";
  if (assigned >= required) return "full";
  if (assigned > 0) return "partial";
  return "gap";
}

export function siteLabel(slot: WorkforceSlotOut): { id: string; name: string } {
  const id = slot.site_id || "unassigned";
  const name = slot.site_name?.trim() || (slot.site_id ? slot.site_id : "ללא יחידה");
  return { id, name };
}

export function coverageRows(week: WorkforceWeekOut, days: Date[], selectedSiteId = ""): CoverageRow[] {
  const slots = week.slots.filter((row) => matchesSite(row.site_id, selectedSiteId));
  const bySite = new Map<string, { name: string; slots: WorkforceSlotOut[] }>();
  for (const slot of slots) {
    const site = siteLabel(slot);
    const current = bySite.get(site.id) ?? { name: site.name, slots: [] };
    current.slots.push(slot);
    bySite.set(site.id, current);
  }
  return [...bySite.entries()].map(([siteId, group]) => ({
    siteId,
    siteName: group.name,
    cells: days.map((day, dayIndex) => {
      const daySlots = group.slots.filter((slot) => rangeOverlapsDay(slot.starts_at, slot.ends_at, day));
      const required = daySlots.reduce((sum, slot) => sum + Math.max(slot.required_count, 0), 0);
      const assigned = daySlots.reduce((sum, slot) => sum + Math.max(slot.assigned_count, 0), 0);
      const unfilled = daySlots.reduce((sum, slot) => sum + Math.max(slot.unfilled_count, 0), 0);
      return {
        siteId,
        siteName: group.name,
        dayIndex,
        required,
        assigned,
        unfilled,
        tone: coverageTone(required, assigned),
        slots: daySlots.filter((slot) => slot.unfilled_count > 0),
      };
    }),
  }));
}

export function uncoveredSlots(slots: WorkforceSlotOut[], selectedSiteId = ""): AttentionItem[] {
  return slots
    .filter((row) => matchesSite(row.site_id, selectedSiteId) && row.unfilled_count > 0)
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      title: row.position_name || row.site_name || "עמדה חסרה",
      meta: `${row.assigned_count}/${row.required_count} משובצים`,
    }));
}

export function pendingTimeOff(items: WorkforceTimeOffOut[], selectedSiteId = ""): AttentionItem[] {
  void selectedSiteId;
  return items
    .filter((row) => (row.status || "").toLowerCase() === "pending")
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      title: row.employee_name || "בקשת חופשה",
      meta: row.kind || row.status,
    }));
}

export function blockingIssues(week: WorkforceWeekOut, selectedSiteId = ""): AttentionItem[] {
  return week.issues
    .filter((issue) => {
      const blocking = issue.finding_severity === "blocking" || issue.severity === "hard";
      return blocking && matchesSite(issue.site_id, selectedSiteId);
    })
    .slice(0, 5)
    .map((issue, index) => ({
      id: `${issue.code}-${issue.slot_id ?? issue.employee_id ?? index}`,
      title: issue.message,
      meta: issue.rule_code || issue.code,
    }));
}

export function formatHours(value: number): string {
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(value);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("he-IL").format(value);
}

export function coveragePercent(required: number, assigned: number): string | null {
  if (required <= 0) return null;
  return `${Math.round((Math.min(assigned, required) / required) * 100)}%`;
}
