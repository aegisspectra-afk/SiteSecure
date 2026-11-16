/**
 * Hebrew presentation for SystemRecommendation reason codes / roles / groups.
 * Localization stays in the UI layer — never display raw codes to installers.
 */

import type {
  CctvReasonCode,
  CctvRecommendationComponent,
  SystemRecommendation,
} from "@site-secure/api-client";
import { componentKeyOf, semanticRoleOf } from "./cctv-component-keys";
import { commercialDiskLabel, formatTb, storageBitrateAssumptionHe } from "./cctv-storage-display";

export type ReviewGroupId = "cameras" | "recording" | "network" | "infrastructure" | "services";

const ROLE_GROUP: Record<string, ReviewGroupId> = {
  camera: "cameras",
  recorder: "recording",
  storage: "recording",
  poe_switch: "network",
  network_switch: "network",
  cable: "infrastructure",
  power_supply: "infrastructure",
  camera_install: "services",
  recorder_setup: "services",
  remote_viewing_setup: "services",
  remote_setup: "services",
  testing: "services",
  commissioning: "services",
  ups: "services",
};

export function groupIdForRole(roleOrKey: string): ReviewGroupId {
  const semantic = semanticRoleOf(roleOrKey);
  return ROLE_GROUP[semantic] ?? ROLE_GROUP[roleOrKey] ?? "services";
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
    case "power_supply":
      return "ספק כוח";
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

/** DEMO-2.4: short Hebrew text for engine codes that have no dedicated sentence above. */
const REASON_FALLBACK_HE: Record<string, string> = {
  NVR_POE_UNKNOWN: "יכולת ה־PoE של המקליט לא ידועה — יש לבחור מקליט עם נתוני PoE",
  NVR_POE_SUFFICIENT: "ה־PoE של המקליט מספיק למצלמות",
  NVR_POE_PORTS_INSUFFICIENT: "אין במקליט מספיק יציאות PoE",
  NVR_POE_BUDGET_INSUFFICIENT: "תקציב ההספק של המקליט לא מספיק",
  NVR_POE_BOTH_INSUFFICIENT: "אין במקליט מספיק יציאות PoE ותקציב הספק",
  POE_POWER_UNRESOLVED: "צריכת החשמל של המצלמות לא ידועה — לא ניתן לחשב תקציב PoE",
  POE_POWER_ENGINEERING_DEFAULT: "צריכת החשמל חושבה לפי ברירת מחדל הנדסית",
  POE_HEADROOM_APPLIED: "נוסף מרווח ביטחון לתקציב ה־PoE",
  RECORDER_HEADROOM_APPLIED: "נוסף מרווח הרחבה לערוצי המקליט",
  RECORDER_UNSUPPORTED_COUNT: "אין מקליט בקטלוג לכמות המצלמות הזו",
  NVR_ONLY_TEXT_ASSISTED: "המקליט זוהה מתיאור טקסט בלבד — דורש אימות",
  NVR_TEXT_ASSISTED_REQUIRES_VERIFICATION: "המקליט זוהה מתיאור טקסט — דורש אימות מפרט",
  HDD_BAYS_UNKNOWN: "מספר תאי הכוננים במקליט לא ידוע",
  HDD_CAPACITY_IMPOSSIBLE: "נפח האחסון הנדרש גדול מהאפשרי במקליט",
  HDD_NOT_SURVEILLANCE_GRADE: "הכונן אינו מיועד למערכות הקלטה",
  HDD_SURVEILLANCE_GRADE_UNKNOWN: "לא ידוע אם הכונן מיועד למערכות הקלטה",
  HDD_OPTIONS_EMPTY: "אין כוננים מתאימים בקטלוג",
  HDD_PACKED: "האחסון חולק על כמה כוננים",
  STORAGE_UNRESOLVED_BITRATE: "קצב הנתונים לא ידוע — נפח האחסון משוער",
  STORAGE_OVERHEAD_APPLIED: "נוסף מרווח לנפח האחסון",
  STORAGE_MOTION_DUTY_DEFAULTED: "הקלטה בתנועה חושבה לפי ברירת מחדל",
  STORAGE_BITRATE_OVERRIDE: "קצב הנתונים נקבע ידנית",
  CABLE_DISTANCE_UNRESOLVED: "אורך הכבל לא הוזן — התשתית תושלם ידנית",
  CABLE_NO_METER_UNIT_PRODUCT: "אין בקטלוג כבל הנמכר במטרים",
  CABLE_UNIT_REQUIRES_MANUAL_QTY: "יחידת המכירה של הכבל דורשת כמות ידנית",
  CABLE_UNIT_UNKNOWN_ASSUMED_METERS: "יחידת הכבל לא ידועה — הונח שמדובר במטרים",
  CABLE_IP_PATH: "כבל רשת CAT למצלמות IP",
  CABLE_ANALOG_PATH: "כבל קואקסיאלי למצלמות אנלוגיות",
  POWER_SUPPLY_FOR_ANALOG: "נדרש ספק כוח למצלמות האנלוגיות",
  HYBRID_CAMERA_SPLIT_MISMATCH: "פיצול המצלמות במערך ההיברידי לא תואם לסך המצלמות",
  HYBRID_CAMERA_SPLIT_UNRESOLVED: "חסר פיצול מצלמות IP ואנלוגיות במערך ההיברידי",
  PREFERRED_MANUFACTURER_UNAVAILABLE: "היצרן המועדף לא זמין בקטלוג",
  CATALOG_EMPTY: "הקטלוג ריק",
  CATALOG_CORE_INCOMPLETE: "חסרים בקטלוג פריטי ליבה",
  COMPONENT_UNRESOLVED: "רכיב חובה לא נפתר",
  ENVIRONMENT_UNSPECIFIED: "סביבת ההתקנה לא צוינה",
  SERVICE_UNRESOLVED: "שירות מתומחר לפי שעות × תעריף",
  INVALID_INPUT: "נתוני הדרישות לא תקינים",
  INPUT_VALIDATION_ERROR: "נתוני הדרישות לא תקינים",
};

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
        return `נדרש NVR עם לפחות ${tier} ערוצים עבור ${cams} מצלמות + ${Math.round(headroom * 100)}% מרווח הרחבה.`;
      }
      if (cams != null && tier != null) {
        return `נדרש NVR עם לפחות ${tier} ערוצים עבור ${cams} מצלמות.`;
      }
      if (tier != null) return `נדרש מקליט של לפחות ${tier} ערוצים`;
      break;
    }
    case "ROLE_CAMERA_FROM_COUNT":
    case "ROLE_CAMERA_IP_FROM_COUNT":
      return `כמות מצלמות IP לפי הדרישות: ${num(p, "qty") ?? "—"}`;
    case "ROLE_CAMERA_ANALOG_FROM_COUNT":
      return `כמות מצלמות אנלוגיות לפי הדרישות: ${num(p, "qty") ?? "—"}`;
    case "ROLE_STORAGE_FROM_RETENTION": {
      const tb = num(p, "requiredTb");
      return tb != null
        ? `נפח האחסון נגזר מימי השמירה והגדרות ההקלטה שנבחרו (≈${formatTb(tb)}TB מהשרת).`
        : "נפח האחסון נגזר מימי שמירה והגדרות הקלטה (שרת).";
    }
    case "STORAGE_BITRATE_DEFAULTED": {
      const assumption = storageBitrateAssumptionHe({ bitrateMbps: num(p, "bitrateMbps") }, typeof p.codec === "string" ? p.codec : null);
      return assumption ? `הנחת קצב נתונים: ${assumption}` : "קצב נתונים משוער לפי ברירת מחדל הנדסית (H.265)";
    }
    case "EXTERNAL_SWITCH_REQUIRED": {
      const ipCams = num(p, "ipCameraCount");
      if (String(p.technology ?? "") === "hybrid" && ipCams != null) {
        return `נדרש מתג PoE חיצוני עבור ${ipCams} מצלמות IP במערך היברידי.`;
      }
      return "נדרש מתג PoE חיצוני כי יציאות/תקציב ההספק של המקליט אינם מספיקים.";
    }
    case "EXTERNAL_SWITCH_NOT_REQUIRED":
      return "ה־NVR מספק PoE מספיק — ללא מתג חיצוני";
    case "POE_NOT_APPLICABLE_ANALOG":
      return "מערך אנלוגי — PoE אינו רלוונטי";
    case "RECORDER_TECHNOLOGY_PATH": {
      const tech = String(p.technology ?? "");
      const tier = num(p, "minChannels");
      const ip = num(p, "ipCameraCount");
      const an = num(p, "analogCameraCount");
      if (tech === "analog_hd") {
        return tier != null
          ? `נבחר מסלול אנלוגי HD → DVR/XVR עם לפחות ${tier} ערוצים.`
          : "נבחר מסלול אנלוגי HD → DVR/XVR.";
      }
      if (tech === "hybrid") {
        if (ip != null && an != null) {
          return `נבחר מסלול היברידי בגלל שילוב של ${ip} מצלמות IP ו־${an} אנלוגיות${
            tier != null ? ` → מקליט ≥${tier} ערוצים` : ""
          }.`;
        }
        return "נבחר מסלול Hybrid → XVR / Hybrid recorder.";
      }
      return tier != null
        ? `נבחר מסלול IP → NVR עם לפחות ${tier} ערוצים.`
        : "נבחר מסלול IP → NVR.";
    }
    case "CABLE_IP_PATH":
      return `כבל רשת (CAT) לפי מרחק: ${num(p, "meters") ?? "—"} מ׳`;
    case "CABLE_ANALOG_PATH":
      return `כבל קואקס/RG59 לפי מרחק: ${num(p, "meters") ?? "—"} מ׳`;
    case "POWER_SUPPLY_FOR_ANALOG":
      return `ספק כוח ל-${num(p, "analogCameraCount") ?? "—"} מצלמות אנלוגיות`;
    case "HYBRID_CAMERA_SPLIT_UNRESOLVED":
      return "פיצול מצלמות IP/אנלוגי בהיברידי לא הושלם";
    case "HYBRID_CAMERA_SPLIT_MISMATCH":
      return "סכום מצלמות IP + אנלוגי אינו תואם לסך המצלמות";
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
    case "CABLE_UNIT_REQUIRES_MANUAL_QTY":
      return "יחידת הכבל אינה מטר — יש להשלים כמות ידנית";
    case "CABLE_UNIT_UNKNOWN_ASSUMED_METERS":
      return "יחידת הכבל לא מאומתת — חושבה כמות במטרים";
    case "CABLE_NO_METER_UNIT_PRODUCT":
      return "לא נמצא כבל במחיר למטר — תשתית דורשת השלמה ידנית";
    case "CATALOG_EMPTY":
      return "קטלוג CCTV ריק מרכיבים פעילים";
    case "CATALOG_CORE_INCOMPLETE":
      return "חסר מידע טכני מאומת ברכיבי ליבה בקטלוג";
    case "SERVICE_UNRESOLVED":
      return `שירות לפי שעות × תעריף: ${roleLabelHe(String(p.role ?? ""))}`;
    case "CABLE_CATEGORY_MATCH":
      return `כבל לפי מרחק: ${num(p, "meters") ?? "—"} מ׳`;
    case "SERVICE_CATEGORY_MATCH":
      return `שירות לפי קטגוריה: ${roleLabelHe(String(p.role ?? ""))}`;
    case "HDD_BAYS_UNKNOWN":
      return "מספר מפרצי HDD ב־NVR לא ידוע";
    case "HDD_OPTIONS_EMPTY": {
      const tb = num(p, "requiredTb");
      if (tb != null) {
        const disk = commercialDiskLabel(tb);
        return `לא נמצא כונן אחסון מתאים בקטלוג (נדרש ≈${formatTb(tb)}TB${disk ? `, מוצע ${disk}` : ""})`;
      }
      return "לא נמצא כונן אחסון מתאים בקטלוג";
    }
    case "ENVIRONMENT_UNSPECIFIED":
      return "סביבת ההתקנה לא צוינה";
    case "CAMERA_ENVIRONMENT_UNVERIFIED": {
      const req = String(p.requested ?? "");
      if (req === "outdoor") {
        return "התאמת המוצר להתקנת חוץ לא אומתה מנתוני הקטלוג";
      }
      if (req === "indoor") {
        return "התאמת המוצר להתקנת פנים לא אומתה מנתוני הקטלוג";
      }
      return "התאמת המוצר לסביבת ההתקנה לא אומתה מנתוני הקטלוג";
    }
    default:
      break;
  }
  // DEMO-2.4: Hebrew for codes without a dedicated sentence; never the raw code.
  return REASON_FALLBACK_HE[code] ?? "נדרשת בדיקה נוספת בתכנון";
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
  /** Q2: next commercial disk size for the requirement ("4TB", "2 × 12TB"). */
  commercialDisk: string | null;
  /** Q2: "≈4 Mbps למצלמה, H.265" — the bitrate the engine assumed. */
  bitrateAssumption: string | null;
  poePorts: number | null;
  poeBudgetW: number | null;
  architecture: "integrated" | "external_switch" | "conditional" | "unknown";
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
    hddPacking = `${hdd.driveCount} × ${formatTb(Number(hdd.driveCapacityTb))}TB`;
  }

  const external = arch.externalSwitchRequired === true;
  return {
    cameraCount: Number(input.cameraCount ?? input.camera_count ?? 0) || 0,
    channelTier:
      typeof recorder.selectedChannelTier === "number" ? recorder.selectedChannelTier : null,
    requiredTb:
      typeof storage.requiredTbWithOverhead === "number" ? storage.requiredTbWithOverhead : null,
    hddPacking,
    commercialDisk:
      typeof storage.requiredTbWithOverhead === "number" ? commercialDiskLabel(storage.requiredTbWithOverhead) : null,
    bitrateAssumption: storageBitrateAssumptionHe(
      storage as { bitrateMbps?: unknown },
      typeof input.codec === "string" ? input.codec : null,
    ),
    poePorts: typeof poe.requiredPorts === "number" ? poe.requiredPorts : null,
    poeBudgetW: typeof poe.requiredBudgetW === "number" ? poe.requiredBudgetW : null,
    architecture: external
      ? "external_switch"
      : arch.switchConditional === true
        ? "conditional"
        : arch.externalSwitchRequired === false
          ? "integrated"
          : "unknown",
  };
}

export function groupComponents(
  components: CctvRecommendationComponent[],
): Array<{ id: ReviewGroupId; label: string; components: CctvRecommendationComponent[] }> {
  const order: ReviewGroupId[] = ["cameras", "recording", "network", "infrastructure", "services"];
  const buckets = new Map<ReviewGroupId, CctvRecommendationComponent[]>();
  for (const c of components) {
    const id = groupIdForRole(componentKeyOf(c));
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
    if (value === "UNKNOWN" && key === "environment") {
      out.push("סביבה לא אומתה בקטלוג");
      continue;
    }
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

/** Short Hebrew for an unresolved required component (engineering still visible). */
export function formatUnresolvedRequirementHe(component: CctvRecommendationComponent): string {
  const t = component.technical_requirements ?? {};
  const role = component.role;
  if (role === "storage") {
    const tb =
      typeof t.requiredTb === "number"
        ? t.requiredTb
        : typeof t.required_tb === "number"
          ? t.required_tb
          : typeof t.requiredTbWithOverhead === "number"
            ? t.requiredTbWithOverhead
            : null;
    if (tb != null) {
      const disk = commercialDiskLabel(Number(tb));
      return disk ? `כונן ${disk} (נדרש ≈${formatTb(Number(tb))}TB)` : `נדרש ≈${formatTb(Number(tb))}TB`;
    }
    return heUnresolvedFallback(component);
  }
  if (role === "poe_switch" || role === "switch") {
    const ports =
      typeof t.minPoePorts === "number"
        ? t.minPoePorts
        : typeof t.min_poe_ports === "number"
          ? t.min_poe_ports
          : null;
    const w =
      typeof t.minPoeBudgetW === "number"
        ? t.minPoeBudgetW
        : typeof t.minBudgetW === "number"
          ? t.minBudgetW
          : typeof t.min_budget_w === "number"
            ? t.min_budget_w
            : null;
    if (ports != null && w != null) return `נדרש ≥${ports} יציאות PoE ו־≥${Math.round(w)}W`;
    if (w != null) return `נדרש תקציב PoE של ≥${Math.round(w)}W`;
    if (ports != null) return `נדרש ≥${ports} יציאות PoE`;
    return heUnresolvedFallback(component);
  }
  if (role === "recorder") {
    const ch = typeof t.minChannels === "number" ? t.minChannels : typeof t.min_channels === "number" ? t.min_channels : null;
    if (ch != null) return `נדרש לפחות ${ch} ערוצים`;
  }
  return heUnresolvedFallback(component);
}

function heUnresolvedFallback(component: CctvRecommendationComponent): string {
  const reasons = component.reason_codes ?? [];
  if (reasons.length) return formatReasonHe(reasons[0]!);
  return "לא נמצא בקטלוג";
}
