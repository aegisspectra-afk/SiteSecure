import { he } from "../i18n/he";

/** Presentation periods — shared by greeting copy and Command Hero atmosphere. */
export type DayPeriod = "morning" | "afternoon" | "evening" | "night";

/**
 * Hero surface tone from effective theme + day period.
 * Theme stays authoritative; time only adds atmosphere (and Light→dark hero at evening/night).
 */
export type HeroSurface = "light-day" | "dark-day" | "dark-evening" | "dark-night";

/**
 * Local-hour boundaries (inclusive start).
 * 05–11 morning · 12–17 afternoon · 18–21 evening · 22–04 night.
 */
export const DAY_PERIOD_BOUNDARIES = {
  morning: 5,
  afternoon: 12,
  evening: 18,
  night: 22,
} as const;

export function localHour(now = new Date()): number {
  return now.getHours();
}

/** Pure hour → period (single source for greeting + hero). */
export function dayPeriodFromHour(hour: number): DayPeriod {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (h < DAY_PERIOD_BOUNDARIES.morning) return "night";
  if (h < DAY_PERIOD_BOUNDARIES.afternoon) return "morning";
  if (h < DAY_PERIOD_BOUNDARIES.evening) return "afternoon";
  if (h < DAY_PERIOD_BOUNDARIES.night) return "evening";
  return "night";
}

/** User's local browser time — no API, no workspace timezone. */
export function dayPeriod(now = new Date()): DayPeriod {
  return dayPeriodFromHour(localHour(now));
}

/** Hebrew greeting from a resolved period (keeps copy in sync with hero time-state). */
export function greetingForPeriod(period: DayPeriod): string {
  switch (period) {
    case "morning":
      return he.greetingMorning;
    case "afternoon":
      return he.greetingAfternoon;
    case "evening":
      return he.greetingEvening;
    case "night":
      return he.greetingNight;
  }
}

export function dayGreeting(now = new Date()): string {
  return greetingForPeriod(dayPeriod(now));
}

export function heroSurface(
  resolvedTheme: "light" | "dark",
  period: DayPeriod,
): HeroSurface {
  if (resolvedTheme === "light") {
    if (period === "morning" || period === "afternoon") return "light-day";
    if (period === "evening") return "dark-evening";
    return "dark-night";
  }
  if (period === "morning" || period === "afternoon") return "dark-day";
  if (period === "evening") return "dark-evening";
  return "dark-night";
}

/** Ms until the next period boundary (local). Minimum 1s to avoid hot loops. */
export function msUntilNextDayPeriod(now = new Date()): number {
  const hour = now.getHours();
  const starts = [
    DAY_PERIOD_BOUNDARIES.morning,
    DAY_PERIOD_BOUNDARIES.afternoon,
    DAY_PERIOD_BOUNDARIES.evening,
    DAY_PERIOD_BOUNDARIES.night,
  ];
  let nextHour = starts.find((boundary) => boundary > hour);
  let dayOffset = 0;
  if (nextHour === undefined) {
    nextHour = DAY_PERIOD_BOUNDARIES.morning;
    dayOffset = 1;
  }
  const target = new Date(now.getTime());
  target.setDate(target.getDate() + dayOffset);
  target.setHours(nextHour, 0, 0, 0);
  return Math.max(1000, target.getTime() - now.getTime());
}
