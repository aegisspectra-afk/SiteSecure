/**
 * SYSTEM-DESIGNER-1 Slice D — live summary, readiness, validation (no client sizing).
 * Calculated metrics come only from the last SystemRecommendation (server truth).
 */

import type {
  CctvReasonCode,
  SystemRecommendation,
} from "@site-secure/api-client";
import {
  validateCctvBuildRequirements,
  type CctvBuildRequirements,
} from "./cctv-build-requirements";
import { componentKeyOf } from "./cctv-component-keys";
import { isProfessionalMode } from "./cctv-designer-workspace";
import { buildEngineeringSummary, formatReasonHe } from "./cctv-recommend-copy";
import {
  canAddRecommendationToQuote,
  type ReviewSelectionState,
} from "./cctv-recommend-projection";

export type CalcFreshness = "draft" | "fresh" | "stale";

export type DesignerReadiness =
  | "planning_draft"
  | "needs_info"
  | "calc_required"
  | "calc_complete"
  | "equipment_partial"
  | "ready_for_quote"
  | "added_to_quote";

export type PersistTrustState = "idle" | "saving" | "saved" | "dirty" | "error";

export type ValidationSeverity = "blocker" | "warning" | "info";

export type ValidationItem = {
  id: string;
  severity: ValidationSeverity;
  message: string;
  code?: string;
};

export type LiveInputFact = {
  id: string;
  label: string;
  value: string;
  ltr?: boolean;
};

export type CalculatedMetric = {
  id: string;
  label: string;
  value: string;
  ltr?: boolean;
};

export function readinessLabelHe(state: DesignerReadiness): string {
  switch (state) {
    case "planning_draft":
      return "טיוטת תכנון";
    case "needs_info":
      return "נדרש מידע";
    case "calc_required":
      return "חישוב נדרש";
    case "calc_complete":
      return "חישוב הושלם";
    case "equipment_partial":
      return "ציוד חלקי";
    case "ready_for_quote":
      return "מוכן להצעה";
    case "added_to_quote":
      return "נוסף להצעה";
  }
}

export function persistTrustLabelHe(state: PersistTrustState): string {
  switch (state) {
    case "idle":
      return "טרם נשמר";
    case "saving":
      return "שומר…";
    case "saved":
      return "נשמר";
    case "dirty":
      return "יש שינויים שלא נשמרו";
    case "error":
      return "שגיאה בשמירה";
  }
}

export function calcFreshnessLabelHe(state: CalcFreshness): string {
  switch (state) {
    case "draft":
      return "טרם חושב";
    case "fresh":
      return "חישוב עדכני";
    case "stale":
      return "יש שינויים שלא חושבו";
  }
}

export function techLabelShort(tech: CctvBuildRequirements["cctvTechnology"]): string {
  if (tech === "analog_hd") return "Analog HD";
  if (tech === "hybrid") return "Hybrid";
  return "IP";
}

/** Live facts from current requirements only — never invents TB/PoE/tier. */
export function buildLiveInputFacts(req: CctvBuildRequirements): LiveInputFact[] {
  const tech = req.cctvTechnology;
  const facts: LiveInputFact[] = [
    { id: "tech", label: "טכנולוגיה", value: techLabelShort(tech), ltr: true },
  ];

  if (tech === "hybrid") {
    facts.push(
      { id: "ip", label: "מצלמות IP", value: String(req.ipCameraCount), ltr: true },
      { id: "analog", label: "מצלמות אנלוגיות", value: String(req.analogCameraCount), ltr: true },
      { id: "total", label: "סה״כ מצלמות", value: String(req.cameraCount), ltr: true },
    );
  } else if (tech === "analog_hd") {
    facts.push({ id: "cameras", label: "מצלמות אנלוגיות", value: String(req.cameraCount), ltr: true });
    if (req.analogSignal) {
      facts.push({ id: "signal", label: "אות", value: req.analogSignal.toUpperCase(), ltr: true });
    }
  } else {
    facts.push({ id: "cameras", label: "מצלמות IP", value: String(req.cameraCount), ltr: true });
  }

  facts.push(
    { id: "resolution", label: "רזולוציה", value: `${req.resolutionMp} MP`, ltr: true },
    { id: "retention", label: "שמירה", value: `${req.retentionDays} ימים` },
    {
      id: "recording",
      label: "הקלטה",
      value:
        req.recordingMode === "continuous"
          ? "רציף"
          : req.recordingMode === "scheduled"
            ? "מתוזמן"
            : "תנועה",
    },
  );

  if (req.environment) {
    facts.push({
      id: "env",
      label: "סביבה",
      value:
        req.environment === "indoor"
          ? "פנים"
          : req.environment === "outdoor"
            ? "חוץ"
            : "פנים+חוץ",
    });
  }

  if (req.cableDistanceMeters.trim()) {
    facts.push({
      id: "cable",
      label: "אורך כבל",
      value: `${req.cableDistanceMeters} m`,
      ltr: true,
    });
  }
  if (req.cameraMaxPowerW.trim() && tech !== "analog_hd") {
    facts.push({
      id: "power",
      label: "הספק מצלמה",
      value: `${req.cameraMaxPowerW} W`,
      ltr: true,
    });
  }

  const services: string[] = [];
  if (req.installationRequested) services.push("התקנה");
  if (req.remoteViewing) services.push("צפייה מרחוק");
  if (req.testingRequested) services.push("בדיקות");
  if (req.commissioningRequested) services.push("מסירה");
  if (req.upsRequested) services.push("UPS");
  if (tech !== "ip" && req.powerSupplyRequested) services.push("ספק כוח");
  if (services.length) {
    facts.push({ id: "services", label: "שירותים", value: services.join(" · ") });
  }

  if (isProfessionalMode(req)) {
    const infra: string[] = [];
    if (req.infraRackRequested) infra.push("ארון");
    if (req.infraConduitRequested) infra.push("תעלות");
    if (req.infraSurgeRequested) infra.push("הגנת מתח");
    if (req.infraJunctionRequested) infra.push("קופסאות");
    if (req.infraMountsRequested) infra.push("תושבות");
    if (infra.length) {
      facts.push({ id: "infra", label: "תשתית", value: infra.join(" · ") });
    }
  }

  return facts;
}

/**
 * Server-derived metrics only. Empty when no recommendation.
 * Caller marks stale via freshness — values must not be treated as live math.
 */
export function buildCalculatedMetrics(
  rec: SystemRecommendation | null,
  tech: CctvBuildRequirements["cctvTechnology"],
): CalculatedMetric[] {
  if (!rec) return [];
  const summary = buildEngineeringSummary(rec);
  const eng = (rec.engineering ?? {}) as Record<string, unknown>;
  const poeArch = (eng.poeArchitecture ?? {}) as Record<string, unknown>;
  const metrics: CalculatedMetric[] = [];

  if (summary.channelTier != null) {
    const path =
      tech === "analog_hd" ? "DVR/XVR" : tech === "hybrid" ? "XVR/Hybrid" : "NVR";
    metrics.push({
      id: "recorder",
      label: "מקליט (שרת)",
      value: `${path} ≥${summary.channelTier}CH`,
      ltr: true,
    });
  }

  if (summary.requiredTb != null) {
    metrics.push({
      id: "storage",
      label: "אחסון (שרת)",
      value: `≈${summary.requiredTb.toFixed(1)} TB${summary.hddPacking ? ` · ${summary.hddPacking}` : ""}`,
      ltr: true,
    });
  }

  if (tech !== "analog_hd") {
    if (summary.poePorts != null && summary.poePorts > 0) {
      metrics.push({
        id: "poe",
        label: tech === "hybrid" ? "PoE ל־IP (שרת)" : "PoE (שרת)",
        value: `${summary.poePorts} ports${
          summary.poeBudgetW != null ? ` · ≥${Math.round(summary.poeBudgetW)} W` : ""
        }`,
        ltr: true,
      });
    }
    const archLabel =
      summary.architecture === "external_switch"
        ? "מתג PoE חיצוני"
        : summary.architecture === "integrated"
          ? "PoE משולב במקליט"
          : "ארכיטקטורה לא נקבעה";
    if (poeArch.evaluation !== "NOT_APPLICABLE") {
      metrics.push({ id: "arch", label: "רשת/PoE", value: archLabel });
    }
    metrics.push({ id: "cable_ip", label: "כבל רשת", value: "CAT path", ltr: true });
  } else {
    metrics.push({ id: "cable_analog", label: "כבל", value: "RG59 / Coax", ltr: true });
    metrics.push({ id: "psu", label: "חשמל", value: "ספק כוח מרכזי" });
  }

  if (tech === "hybrid") {
    metrics.push({ id: "cable_analog", label: "כבל אנלוגי", value: "RG59 / Coax", ltr: true });
    metrics.push({ id: "psu", label: "חשמל", value: "ספק כוח ל־Analog" });
  }

  return metrics;
}

export function deriveDesignerReadiness(opts: {
  req: CctvBuildRequirements;
  calcState: CalcFreshness;
  recommendation: SystemRecommendation | null;
  selection: ReviewSelectionState;
  appliedOnce: boolean;
}): DesignerReadiness {
  if (opts.appliedOnce) return "added_to_quote";

  const validation = validateCctvBuildRequirements(opts.req);
  if (!validation.ok) return "needs_info";

  if (opts.calcState === "draft" || opts.calcState === "stale") {
    return opts.calcState === "draft" && !opts.recommendation ? "planning_draft" : "calc_required";
  }

  // fresh
  const rec = opts.recommendation;
  if (!rec) return "calc_required";

  const requiredUnresolved = rec.components.some(
    (c) => c.blocking && !c.optional && c.resolution_status === "UNRESOLVED",
  );
  if (requiredUnresolved || rec.blocking) return "equipment_partial";

  const gate = canAddRecommendationToQuote(rec, opts.selection);
  if (gate.ok) return "ready_for_quote";
  return "equipment_partial";
}

export function buildValidationCenter(opts: {
  req: CctvBuildRequirements;
  calcState: CalcFreshness;
  recommendation: SystemRecommendation | null;
}): ValidationItem[] {
  const items: ValidationItem[] = [];
  const v = validateCctvBuildRequirements(opts.req);
  if (!v.ok) {
    const msg =
      v.messageKey === "hybridSplit"
        ? "פיצול Hybrid לא תקין — סכום IP + Analog חייב להיות ≥1 ושווה לסך המצלמות."
        : v.messageKey === "cameras"
          ? "יש להזין מספר מצלמות תקין (≥1)."
          : v.messageKey === "retention"
            ? "יש להזין ימי הקלטה תקינים."
            : v.messageKey === "hours"
              ? "יש להזין שעות הקלטה ליום עבור מצב מתוזמן."
              : "יש לבחור רזולוציה תקינה.";
    items.push({ id: `blocker-${v.field}`, severity: "blocker", message: msg, code: v.messageKey });
  }

  if (opts.calcState === "stale") {
    items.push({
      id: "stale",
      severity: "warning",
      message: "הדרישות השתנו — יש לחשב מחדש",
      code: "STALE_REQUIREMENTS",
    });
  } else if (opts.calcState === "draft") {
    items.push({
      id: "need-calc",
      severity: "info",
      message: "לא בוצע חישוב מערכת עדיין — לחצו «חשב מערכת» לקבלת מדדים מהשרת.",
      code: "CALC_PENDING",
    });
  }

  if (!opts.req.cableDistanceMeters.trim()) {
    items.push({
      id: "cable-missing",
      severity: "warning",
      message: "אורך כבל לא הוזן — תשתית תישאר להשלמה ידנית.",
      code: "CABLE_DISTANCE_UNRESOLVED",
    });
  }

  if (!opts.req.environment) {
    items.push({
      id: "env-missing",
      severity: "warning",
      message: "סביבת התקנה לא צוינה — התאמת מצלמות לסביבה לא תאומת במלואה.",
      code: "ENVIRONMENT_UNSPECIFIED",
    });
  }

  const rec = opts.recommendation;
  if (rec && (opts.calcState === "fresh" || opts.calcState === "stale")) {
    for (const u of rec.unresolved ?? []) {
      const code = String(u.code || "UNRESOLVED");
      if (code === "NVR_POE_UNKNOWN" && opts.req.cctvTechnology === "analog_hd") continue;
      items.push({
        id: `unresolved-${code}-${items.length}`,
        severity: "blocker",
        message: formatReasonHe(u as CctvReasonCode),
        code,
      });
    }
    for (const c of rec.components ?? []) {
      if (c.blocking && c.resolution_status === "UNRESOLVED") {
        items.push({
          id: `comp-${componentKeyOf(c)}`,
          severity: "blocker",
          message: `רכיב חובה לא נפתר: ${componentKeyOf(c)}`,
          code: "COMPONENT_UNRESOLVED",
        });
      }
      const compat = c.selected_compatibility;
      if (compat && Object.values(compat).includes("UNKNOWN")) {
        items.push({
          id: `unk-${componentKeyOf(c)}`,
          severity: "warning",
          message: `התאמה UNKNOWN עבור ${componentKeyOf(c)} — דורש אימות מפרט.`,
          code: "COMPATIBILITY_UNKNOWN",
        });
      }
    }
    for (const a of rec.assumptions ?? []) {
      items.push({
        id: `assume-${a.code}-${items.length}`,
        severity: "info",
        message: formatReasonHe(a as CctvReasonCode),
        code: String(a.code || ""),
      });
    }
    // Architecture / technology explainability from recorder reasons
    const recorder = rec.components.find((c) => componentKeyOf(c) === "recorder_main");
    for (const r of recorder?.reason_codes ?? []) {
      if (
        r.code === "RECORDER_TECHNOLOGY_PATH" ||
        r.code === "RECORDER_TIER_SELECTED" ||
        r.code === "EXTERNAL_SWITCH_REQUIRED"
      ) {
        items.push({
          id: `explain-${r.code}`,
          severity: "info",
          message: formatReasonHe(r),
          code: r.code,
        });
      }
    }
    const storage = rec.components.find((c) => componentKeyOf(c) === "storage_main");
    for (const r of storage?.reason_codes ?? []) {
      if (r.code === "ROLE_STORAGE_FROM_RETENTION" || r.code === "STORAGE_BITRATE_DEFAULTED") {
        items.push({
          id: `explain-${r.code}`,
          severity: "info",
          message: formatReasonHe(r),
          code: r.code,
        });
      }
    }
  }

  // Dedupe by id
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function explainabilityLines(rec: SystemRecommendation | null): string[] {
  if (!rec) return [];
  const lines: string[] = [];
  const push = (r: CctvReasonCode | undefined) => {
    if (!r) return;
    const text = formatReasonHe(r);
    if (text && !lines.includes(text)) lines.push(text);
  };

  for (const c of rec.components ?? []) {
    for (const r of c.reason_codes ?? []) {
      if (
        [
          "RECORDER_TECHNOLOGY_PATH",
          "RECORDER_TIER_SELECTED",
          "RECORDER_CHANNELS_REQUIRED",
          "ROLE_STORAGE_FROM_RETENTION",
          "EXTERNAL_SWITCH_REQUIRED",
          "POE_NOT_APPLICABLE_ANALOG",
          "CABLE_IP_PATH",
          "CABLE_ANALOG_PATH",
          "POWER_SUPPLY_FOR_ANALOG",
        ].includes(r.code)
      ) {
        push(r);
      }
    }
  }
  return lines.slice(0, 6);
}
