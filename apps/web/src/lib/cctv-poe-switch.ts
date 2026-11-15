export { POE_SWITCH_KEY, switchNeed, type SwitchNeed } from "./cctv-recommend-projection";
import type { SwitchNeed } from "./cctv-recommend-projection";

/** Q2.5 labels for the PoE switch row. */
export function switchNeedLabelHe(need: SwitchNeed): string | null {
  switch (need) {
    case "required":
      return "נדרש: למקליט שנבחר אין מספיק PoE";
    case "not_needed":
      return "לא נדרש: המקליט שנבחר מספק PoE";
    case "conditional":
      return "מותנה: נדרש רק אם המקליט שייבחר ללא PoE או ללא מספיק הספק";
    default:
      return null;
  }
}
