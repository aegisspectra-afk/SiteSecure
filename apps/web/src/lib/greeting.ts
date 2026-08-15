import { he } from "../i18n/he";

export function dayGreeting(now = new Date(), timeZone = "Asia/Jerusalem"): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone }).format(now),
  );
  if (hour < 5) return he.greetingNight;
  if (hour < 12) return he.greetingMorning;
  if (hour < 17) return he.greetingAfternoon;
  if (hour < 21) return he.greetingEvening;
  return he.greetingNight;
}
