/**
 * DEMO-3.1: job date, time and duration <-> scheduled_for / scheduled_end.
 * The visit is entered in the browser's local time; the API stores timestamps with a zone.
 * Duration is end - start (no separate column).
 */

export type ScheduleInputs = { date: string; time: string; minutes: number };

export const DURATION_OPTIONS: { minutes: number; labelHe: string }[] = [
  { minutes: 30, labelHe: "חצי שעה" },
  { minutes: 60, labelHe: "שעה" },
  { minutes: 90, labelHe: "שעה וחצי" },
  { minutes: 120, labelHe: "שעתיים" },
  { minutes: 180, labelHe: "3 שעות" },
  { minutes: 240, labelHe: "4 שעות" },
  { minutes: 360, labelHe: "6 שעות" },
  { minutes: 480, labelHe: "יום עבודה (8 שעות)" },
];

export const DEFAULT_DURATION_MINUTES = 120;

export function emptySchedule(): ScheduleInputs {
  return { date: "", time: "", minutes: DEFAULT_DURATION_MINUTES };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Prefill the fields from a job (local time). */
export function scheduleFromJob(job: { scheduled_for?: string | null; scheduled_end?: string | null }): ScheduleInputs {
  if (!job.scheduled_for) return emptySchedule();
  const start = new Date(job.scheduled_for);
  if (Number.isNaN(start.getTime())) return emptySchedule();
  const end = job.scheduled_end ? new Date(job.scheduled_end) : null;
  const minutes =
    end && !Number.isNaN(end.getTime()) && end > start
      ? Math.round((end.getTime() - start.getTime()) / 60000)
      : DEFAULT_DURATION_MINUTES;
  return {
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    minutes,
  };
}

export type ScheduleResult =
  | { ok: true; value: { scheduled_for: string; scheduled_end: string } | null }
  | { ok: false; error: string };

/**
 * Fields -> API body. Empty date = no schedule (null). A date needs a time; the duration is
 * between 15 minutes and 24 hours (the server checks the same).
 */
export function scheduleToApi(input: ScheduleInputs): ScheduleResult {
  if (!input.date && !input.time) return { ok: true, value: null };
  if (!input.date) return { ok: false, error: "יש לבחור תאריך" };
  if (!input.time) return { ok: false, error: "יש לבחור שעה" };
  const start = new Date(`${input.date}T${input.time}:00`);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "מועד לא תקין" };
  const minutes = Number(input.minutes);
  if (!Number.isFinite(minutes) || minutes < 15 || minutes > 24 * 60) {
    return { ok: false, error: "משך עבודה בין רבע שעה ל־24 שעות" };
  }
  const end = new Date(start.getTime() + minutes * 60000);
  return { ok: true, value: { scheduled_for: start.toISOString(), scheduled_end: end.toISOString() } };
}

export function sameSchedule(a: ScheduleInputs, b: ScheduleInputs): boolean {
  return a.date === b.date && a.time === b.time && Number(a.minutes) === Number(b.minutes);
}

/** "20.11 · 08:00–10:00" for headers and cards; null when there is no date. */
export function formatScheduleHe(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return null;
  const day = s.toLocaleDateString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit" });
  const time = (d: Date) => d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
  const e = end ? new Date(end) : null;
  return e && !Number.isNaN(e.getTime()) ? `${day} · ${time(s)}–${time(e)}` : `${day} · ${time(s)}`;
}
