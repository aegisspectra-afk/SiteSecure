export function startOfWeekSunday(value: Date): Date {
  const local = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  local.setDate(local.getDate() - local.getDay());
  local.setHours(0, 0, 0, 0);
  return local;
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function toIso(value: Date): string {
  return value.toISOString();
}

export function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export function formatDayHeading(value: Date): string {
  return new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "numeric" }).format(value);
}

export function formatTimeRange(startsAt: string, endsAt: string): string {
  const fmt = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" });
  return `${fmt.format(new Date(startsAt))}–${fmt.format(new Date(endsAt))}`;
}

export function rangeOverlapsDay(startsAt: string, endsAt: string, day: Date): boolean {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  return start < dayEnd && end > dayStart;
}

export function crossesLocalMidnight(startsAt: string, endsAt: string): boolean {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start.toDateString() !== end.toDateString();
}

export function formatWeekLabel(start: Date): string {
  const end = addDays(start, 6);
  const fmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}
