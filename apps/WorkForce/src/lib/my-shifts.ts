import type { WorkforceMyShiftOut } from "@site-secure/api-client";
import { he } from "../i18n/he";

export type MyShiftDayGroup = {
  date: string;
  label: string;
  items: WorkforceMyShiftOut[];
};

export function formatLocalDateLabel(localDate: string): string {
  const parts = localDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return localDate;
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(year, month - 1, day),
  );
}

export function assignmentStatusLabel(status: string): string {
  if (status === "assigned") return he.statusAssigned;
  return status;
}

export function groupMyShiftsByDate(items: WorkforceMyShiftOut[]): MyShiftDayGroup[] {
  const groups = new Map<string, WorkforceMyShiftOut[]>();
  for (const item of items) {
    const date = item.local_date || item.starts_at.slice(0, 10);
    const current = groups.get(date) ?? [];
    current.push(item);
    groups.set(date, current);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, rows]) => ({
      date,
      label: formatLocalDateLabel(date),
      items: [...rows].sort((left, right) => left.starts_at.localeCompare(right.starts_at)),
    }));
}

export function shiftMeta(row: WorkforceMyShiftOut): string {
  const unit = [row.site_name, row.position_name].filter(Boolean).join(" · ");
  const notes = row.notes?.trim();
  return [unit, notes].filter(Boolean).join(" — ");
}
