/**
 * Hebrew presentation for SystemRecommendation reason codes / roles / groups.
 * Localization stays in the UI layer — never display raw codes to installers.
 */

import type {
  CctvReasonCode,
  CctvRecommendationComponent,
  SystemRecommendation,
} from "@site-secure/api-client";

export type ReviewGroupId = "cameras" | "recording" | "network" | "infrastructure" | "services";

const ROLE_GROUP: Record<string, ReviewGroupId> = {
  camera: "cameras",
  recorder: "recording",
  storage: "recording",
  poe_switch: "network",
  cable: "infrastructure",
  camera_install: "services",
  recorder_setup: "services",
  remote_viewing_setup: "services",
  remote_setup: "services",
  testing: "services",
  commissioning: "services",
  ups: "services",
};

export function groupIdForRole(role: string): ReviewGroupId {
  return ROLE_GROUP[role] ?? "services";
}

export function groupLabelHe(id: ReviewGroupId): string {
  switch (id) {
    case "cameras":
      return "מצלמות";
    case "recording":
      return "הקלטה ואחסון";
    case "network":
      return "רשת ו־PoE";
    case "infrastructure":
      return "תשתית";
    case "services":
      return "שירותים";
  }
}

export function roleLabelHe(role: string): string {
  switch (role) {
    case "camera":
      return "מצלמה";
    case "recorder":
      return "מקליט / NVR";
    case "storage":
      return "אחסון / HDD";
    case "poe_switch":
      return "מתג PoE";
    case "cable":
      return "כבל / תשתית";
    case "camera_install":
      return "התקנת מצלמות";
    case "recorder_setup":
      return "הגדרת מקליט";
    case "remote_viewing_setup":
    case "remote_setup":
      return "צפייה מרחוק";
    case "testing":
      return "בדיקות";
    case "commissioning":
      return "מסירה / commissioning";
    case "ups":
      return "UPS";
    default:
      return role;
  }
}

function num(params: Record<string, unknown> | undefined, key: string): number | null {
  const v = params?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function formatReasonHe(reason: CctvReasonCode): string {
  const p = reason.params ?? {};
  const code = reason.code;
  switch (code) {
    case "RECORDER_TIER_SELECTED":
    case "RECORDER_CHANNELS_REQUIRED": {
      const cams = num(p, "cameraCount") ?? num(p, "cameras");
      const effective = num(p, "effectiveCameras") ?? num(p, "effective");
      const tier = num(p, "selectedChannelTier") ?? num(p, "tier") ?? num(p, "channels");
      const headroom = num(p, "expansionHeadroom") ?? num(p, "headroom");
      if (cams != null && effective != null && tier != null && headroom != null && headroom > 0) {
        return `${cams} מצלמות + ${Math.round(headroom * 100)}% מרווח הרחבה → נדרשים ${effective} ערוצים → NVR ${tier}CH`;
      }
      if (cams != null && tier != null) {
        return `${cams} מצלמות → NVR ${tier} ערוצים`;
      }
      if (tier != null) return `נדרש מקליט של לפחות ${tier} ערוצים`;
      break;
    }
    case "ROLE_CAMERA_FROM_COUNT":
      return `כמות מצלמות לפי הדרישות: ${num(p, "qty") ?? "—"}`;
    case "ROLE_STORAGE_FROM_RETENTION": {
      const tb = num(p, "requiredTb");
      return tb != null ? `אחסון נדרש לפי ימי הקלטה: כ־${tb.toFixed(1)}TB` : "אחסון לפי ימי הקלטה";
    }
    case "STORAGE_BITRATE_DEFAULTED":
      return "קצב נתונים משוער לפי ברירת מחדל הנדסית";
    case "EXTERNAL_SWITCH_REQUIRED":
      return "יציאות/תקציב ה־PoE של ה־NVR אינם מספיקים, לכן נוסף מתג PoE חיצוני";
    case "EXTERNAL_SWITCH_NOT_REQUIRED":
      return "ה־NVR מספק PoE מספיק — ללא מתג חיצוני";
    case "CABLE_DISTANCE_UNRESOLVED":
      return "מרחק כבל לא הוזן — תשתית דורשת השלמה ידנית";
    case "PREFERRED_MANUFACTURER_UNAVAILABLE":
      return `יצרן מועדף לא עמד בדרישות${p.preference ? ` (${String(p.preference)})` : ""} — נבחר חלופה תואמת`;
    case "HDD_SURVEILLANCE_GRADE_UNKNOWN":
      return "דרגת surveillance של הכונן לא מאומתת בקטלוג";
    case "HDD_NOT_SURVEILLANCE_GRADE":
      return "הכונן אינו מסומן כ־surveillance-grade";
    case "NVR_ONLY_TEXT_ASSISTED":
    case "NVR_TEXT_ASSISTED_REQUIRES_VERIFICATION":
      return "מועמד NVR לפי תיאור בלבד — דורש אימות מפרט";
    case "CAMERA_STRUCTURED_MATCH":
      return "מתאימה לדרישות המצלמה לפי מפרט מאומת";
    case "HDD_STRUCTURED_MATCH": {
      const cap = num(p, "capacityTb");
      const qty = num(p, "qty");
      if (cap != null && qty != null) return `תצורת אחסון: ${qty} × ${cap}TB`;
      return "התאמת כונן לפי קיבולת מאומתת";
    }
    case "SWITCH_STRUCTURED_MATCH": {
      const ports = num(p, "minPoePorts") ?? num(p, "minPorts");
      const w = num(p, "minBudgetW");
      if (ports != null && w != null) return `מתג קטן ביותר שעומד ב־${ports} יציאות PoE ו־≥${Math.round(w)}W`;
      if (ports != null) return `מתג עם לפחות ${ports} יציאות PoE`;
      return "מתג PoE תואם לדרישות";
    }
    case "COMPONENT_UNRESOLVED":
      return `רכיב לא נפתר: ${roleLabelHe(String(p.role ?? ""))}`;
    case "HDD_BAYS_UNKNOWN":
      return "מספר מפרצי HDD ב־NVR לא ידוע";
    default:
      break;
  }
  // Fallback: readable but not raw-only
  return code.replace(/_/g, " ").toLowerCase();
}

export function confidenceLabelHe(confidence: string | null | undefined): string {
  switch (confidence) {
    case "STRUCTURED":
      return "מפרט מאומת";
    case "PARTIAL":
      return "חלקי";
    case "TEXT_ASSISTED":
      return "דורש אימות";
    case "UNRESOLVED":
      return "לא נפתר";
    default:
      return "";
  }
}

export function resolutionStatusLabelHe(status: string): string {
  switch (status) {
    case "RESOLVED":
      return "נפתר";
    case "PARTIAL":
      return "חלקי";
    case "UNRESOLVED":
      return "לא נפתר";
    case "MANUAL_REVIEW":
      return "סקירה ידנית";
    default:
      return status;
  }
}

export type EngineeringSummary = {
  cameraCount: number;
  channelTier: number | null;
  requiredTb: number | null;
  hddPacking: string | null;
  poePorts: number | null;
  poeBudgetW: number | null;
  architecture: "integrated" | "external_switch" | "unknown";
};

export function buildEngineeringSummary(rec: SystemRecommendation): EngineeringSummary {
  const eng = rec.engineering ?? {};
  const input = (rec.input ?? {}) as Record<string, unknown>;
  const recorder = (eng.recorder ?? {}) as Record<string, unknown>;
  const storage = (eng.storage ?? {}) as Record<string, unknown>;
  const poe = (eng.poe ?? {}) as Record<string, unknown>;
  const arch = (eng.poeArchitecture ?? {}) as Record<string, unknown>;
  const hdd = (eng.hdd ?? {}) as Record<string, unknown>;

  let hddPacking: string | null = null;
  if (hdd.status === "ok" && hdd.driveCount != null && hdd.driveCapacityTb != null) {
    hddPacking = `${hdd.driveCount} × ${hdd.driveCapacityTb}TB`;
  }

  const external = arch.externalSwitchRequired === true;
  return {
    cameraCount: Number(input.cameraCount ?? input.camera_count ?? 0) || 0,
    channelTier:
      typeof recorder.selectedChannelTier === "number" ? recorder.selectedChannelTier : null,
    requiredTb:
      typeof storage.requiredTbWithOverhead === "number" ? storage.requiredTbWithOverhead : null,
    hddPacking,
    poePorts: typeof poe.requiredPorts === "number" ? poe.requiredPorts : null,
    poeBudgetW: typeof poe.requiredBudgetW === "number" ? poe.requiredBudgetW : null,
    architecture: external ? "external_switch" : arch.externalSwitchRequired === false ? "integrated" : "unknown",
  };
}

export function groupComponents(
  components: CctvRecommendationComponent[],
): Array<{ id: ReviewGroupId; label: string; components: CctvRecommendationComponent[] }> {
  const order: ReviewGroupId[] = ["cameras", "recording", "network", "infrastructure", "services"];
  const buckets = new Map<ReviewGroupId, CctvRecommendationComponent[]>();
  for (const c of components) {
    const id = groupIdForRole(c.role);
    const list = buckets.get(id) ?? [];
    list.push(c);
    buckets.set(id, list);
  }
  return order
    .filter((id) => (buckets.get(id)?.length ?? 0) > 0)
    .map((id) => ({ id, label: groupLabelHe(id), components: buckets.get(id)! }));
}

export function compactCompatibilityLines(compat: Record<string, string> | null | undefined): string[] {
  if (!compat) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(compat)) {
    if (value !== "PASS") continue;
    switch (key) {
      case "channels":
        out.push("ערוצים");
        break;
      case "drive_bays":
        out.push("מפרצי HDD");
        break;
      case "max_hdd_tb":
        out.push("גודל דיסק מקסימלי");
        break;
      case "poe_ports":
        out.push("יציאות PoE");
        break;
      case "poe_budget_w":
        out.push("תקציב PoE");
        break;
      case "resolution_mp":
        out.push("רזולוציה");
        break;
      case "environment":
        out.push("סביבה");
        break;
      case "ports":
        out.push("פורטים");
        break;
      case "capacity_tb":
        out.push("קיבולת");
        break;
      default:
        out.push(key);
    }
  }
  return out;
}
