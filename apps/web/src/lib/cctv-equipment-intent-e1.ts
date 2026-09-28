/**
 * E1 — Engineering / Equipment Resolution UX split (presentation only).
 *
 * Does NOT change CCTV math, Apply/R3 gates, or persistence.
 * Maps existing SystemRecommendation signals into orthogonal UX states.
 */

import type {
  CctvReasonCode,
  CctvRecommendationComponent,
  EquipmentIntent,
  SystemRecommendation,
} from "@site-secure/api-client";
import { groupIdForRole } from "./cctv-recommend-copy";
import {
  resolveComponentProduct,
  type ReviewSelectionState,
} from "./cctv-recommend-projection";
import { hasEquipmentIntent } from "./cctv-equipment-intent-e2";

/** Engineering completeness — independent of catalog matching. */
export type EngineeringStatus = "ENGINEERING_INCOMPLETE" | "ENGINEERING_COMPLETE";

/**
 * Equipment resolution for a known engineering requirement.
 * E2 activates EQUIPMENT_SPECIFIED when durable intent exists (no catalog product).
 */
export type EquipmentResolutionStatus =
  | "REQUIREMENT_READY"
  | "EQUIPMENT_SPECIFIED"
  | "CATALOG_RESOLVED"
  | "NEEDS_REVIEW";

export type WarningClass = "ENGINEERING" | "COMPATIBILITY" | "CATALOG" | "COMMERCIAL";

export type ClassifiedWarning = {
  code: string;
  class: WarningClass;
  reason: CctvReasonCode;
};

/** Hard engineering failures — sizing cannot produce a valid design. */
const ENGINEERING_HARD_CODES = new Set([
  "STORAGE_UNRESOLVED_BITRATE",
  "RECORDER_UNSUPPORTED_COUNT",
  "POE_POWER_UNRESOLVED",
  "INVALID_INPUT",
]);

/** Scope / assumption engineering signals (not catalog). */
const ENGINEERING_WARN_CODES = new Set([
  "CABLE_DISTANCE_UNRESOLVED",
  "ENVIRONMENT_UNSPECIFIED",
  "STORAGE_BITRATE_DEFAULTED",
  "NVR_POE_UNKNOWN",
  "HDD_BAYS_UNKNOWN",
  "EXTERNAL_SWITCH_REQUIRED",
  "EXTERNAL_SWITCH_NOT_REQUIRED",
  "ROLE_CAMERA_FROM_COUNT",
  "ROLE_STORAGE_FROM_RETENTION",
  "RECORDER_TIER_SELECTED",
  "RECORDER_CHANNELS_REQUIRED",
]);

const COMPATIBILITY_CODES = new Set([
  "HDD_SURVEILLANCE_GRADE_UNKNOWN",
  "HDD_NOT_SURVEILLANCE_GRADE",
  "NVR_ONLY_TEXT_ASSISTED",
  "NVR_TEXT_ASSISTED_REQUIRES_VERIFICATION",
  "CAMERA_ENVIRONMENT_UNVERIFIED",
  "PREFERRED_MANUFACTURER_UNAVAILABLE",
  "CABLE_UNIT_REQUIRES_MANUAL_QTY",
  "CABLE_UNIT_UNKNOWN_ASSUMED_METERS",
]);

const CATALOG_CODES = new Set([
  "CATALOG_EMPTY",
  "CATALOG_CORE_INCOMPLETE",
  "COMPONENT_UNRESOLVED",
  "SERVICE_UNRESOLVED",
  "HDD_OPTIONS_EMPTY",
  "CABLE_NO_METER_UNIT_PRODUCT",
]);

const SERVICE_ROLES = new Set([
  "camera_install",
  "recorder_setup",
  "remote_viewing_setup",
  "remote_setup",
  "testing",
  "commissioning",
  "ups",
]);

export function isServiceRole(role: string): boolean {
  return SERVICE_ROLES.has(role) || groupIdForRole(role) === "services";
}

export function classifyWarningCode(code: string): WarningClass {
  if (ENGINEERING_HARD_CODES.has(code) || ENGINEERING_WARN_CODES.has(code)) return "ENGINEERING";
  if (COMPATIBILITY_CODES.has(code)) return "COMPATIBILITY";
  if (CATALOG_CODES.has(code)) return "CATALOG";
  if (code.includes("CATALOG") || code.includes("UNRESOLVED") || code.includes("OPTIONS_EMPTY")) {
    return "CATALOG";
  }
  if (code.includes("COMPAT") || code.includes("FAIL") || code.includes("VERIFY")) {
    return "COMPATIBILITY";
  }
  // Prefer catalog over commercial for unknown matching gaps
  if (code.includes("PRICE") || code.includes("MARGIN") || code.includes("COMMERCIAL")) {
    return "COMMERCIAL";
  }
  return "ENGINEERING";
}

export function classifyWarnings(
  reasons: CctvReasonCode[] | null | undefined,
): ClassifiedWarning[] {
  const seen = new Set<string>();
  const out: ClassifiedWarning[] = [];
  for (const reason of reasons ?? []) {
    const code = reason.code;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, class: classifyWarningCode(code), reason });
  }
  return out;
}

/**
 * Derive engineering status from existing recommendation signals.
 * Catalog BLOCKED ≠ engineering incomplete.
 */
export function deriveEngineeringStatus(rec: SystemRecommendation): EngineeringStatus {
  if (rec.status === "INVALID_INPUT") return "ENGINEERING_INCOMPLETE";

  const hardUnresolved = (rec.unresolved ?? []).some((r) => ENGINEERING_HARD_CODES.has(r.code));
  if (hardUnresolved) return "ENGINEERING_INCOMPLETE";

  const eng = rec.engineering ?? {};
  const hasRecorder =
    typeof (eng.recorder as { selectedChannelTier?: unknown } | undefined)?.selectedChannelTier ===
      "number" ||
    typeof (eng.recorder as { effectiveCameras?: unknown } | undefined)?.effectiveCameras === "number";
  const storage = eng.storage as { requiredTbWithOverhead?: unknown; requiredTb?: unknown } | undefined;
  const hasStorage =
    typeof storage?.requiredTbWithOverhead === "number" || typeof storage?.requiredTb === "number";
  const input = rec.input ?? {};
  const cams = Number(input.cameraCount ?? input.camera_count ?? 0) || 0;

  if (cams > 0 && (hasRecorder || hasStorage || Object.keys(eng).length > 0)) {
    return "ENGINEERING_COMPLETE";
  }
  if (Object.keys(eng).length > 0) {
    return "ENGINEERING_COMPLETE";
  }
  return "ENGINEERING_INCOMPLETE";
}

export function equipmentResolutionForComponent(
  component: CctvRecommendationComponent,
  selection: ReviewSelectionState,
  opts?: {
    needsReviewRoles?: Set<string>;
    equipmentIntent?: EquipmentIntent | null;
  },
): EquipmentResolutionStatus {
  if (opts?.needsReviewRoles?.has(component.role) || (component as { needs_review?: boolean }).needs_review) {
    return "NEEDS_REVIEW";
  }

  const picked = resolveComponentProduct(component, selection);
  if (picked) {
    const compat = picked.compatibility ?? {};
    if (Object.values(compat).includes("FAIL")) return "NEEDS_REVIEW";
    if (picked.confidence === "TEXT_ASSISTED" && component.blocking && !component.optional) {
      return "NEEDS_REVIEW";
    }
    return "CATALOG_RESOLVED";
  }

  if (hasEquipmentIntent(opts?.equipmentIntent)) {
    return "EQUIPMENT_SPECIFIED";
  }

  return "REQUIREMENT_READY";
}

export function countPendingEquipment(
  rec: SystemRecommendation,
  selection: ReviewSelectionState,
  opts?: {
    needsReviewRoles?: Set<string>;
    intentByRole?: Record<string, EquipmentIntent | null | undefined>;
  },
): number {
  let n = 0;
  for (const c of rec.components) {
    if (selection.removedRoles.has(c.role)) continue;
    if (isServiceRole(c.role)) continue;
    if (c.optional && !c.blocking) continue;
    const status = equipmentResolutionForComponent(c, selection, {
      needsReviewRoles: opts?.needsReviewRoles,
      equipmentIntent: opts?.intentByRole?.[c.role],
    });
    // Apply still requires catalog product — intent-only counts as pending for Apply.
    if (
      status === "REQUIREMENT_READY" ||
      status === "NEEDS_REVIEW" ||
      status === "EQUIPMENT_SPECIFIED"
    ) {
      n += 1;
    }
  }
  return n;
}

export function formatRequirementChips(component: CctvRecommendationComponent): string[] {
  const t = component.technical_requirements ?? {};
  const chips: string[] = [];
  const push = (v: unknown) => {
    if (v == null || v === "") return;
    chips.push(String(v));
  };

  switch (component.role) {
    case "camera": {
      const mp =
        t.resolutionMp ?? t.resolution_mp ?? t.minResolutionMp ?? t.min_resolution_mp;
      if (mp != null) push(`${mp}MP`);
      const env = String(t.environment ?? t.installEnvironment ?? "");
      if (env === "outdoor") push("חוץ");
      else if (env === "indoor") push("פנים");
      else if (env === "indoor_outdoor") push("פנים/חוץ");
      const ff = t.formFactor ?? t.form_factor;
      if (ff) push(String(ff));
      if (t.poeRequired === true || t.poe === true || t.power === "poe") push("PoE");
      break;
    }
    case "recorder": {
      const ch = t.minChannels ?? t.min_channels ?? t.channels;
      if (ch != null) push(`לפחות ${ch} ערוצים`);
      break;
    }
    case "storage": {
      const tb =
        t.requiredTb ??
        t.required_tb ??
        t.requiredTbWithOverhead ??
        t.required_tb_with_overhead;
      if (tb != null) push(`כ־${Number(tb).toFixed(1)}TB`);
      break;
    }
    case "poe_switch":
    case "switch": {
      push("מתג PoE חיצוני");
      const ports = t.minPoePorts ?? t.min_poe_ports ?? t.minPorts;
      if (ports != null) push(`לפחות ${ports} פורטים`);
      const w = t.minPoeBudgetW ?? t.minBudgetW ?? t.min_budget_w;
      if (w != null) push(`≥${Math.round(Number(w))}W`);
      break;
    }
    case "cable": {
      const m = t.meters ?? t.distanceMeters ?? t.cableDistanceMeters;
      if (m != null) push(`${m} מ׳`);
      else push("מרחק לא הוזן");
      break;
    }
    default:
      break;
  }

  if (!chips.length) {
    // Fall back to quantity hint only — avoid inventing specs
    if (component.quantity > 1) chips.push(`×${component.quantity}`);
  }
  return chips;
}

export type ApplyEligibilityPresentation = {
  engineeringComplete: boolean;
  applyReady: boolean;
  pendingEquipmentCount: number;
  /** Gate result mirrored for UI — do not invent alternate gates. */
  gateOk: boolean;
  gateIncomplete: boolean;
  gateReason: "blocking" | "empty" | null;
};

export function applyEligibilityPresentation(
  rec: SystemRecommendation,
  selection: ReviewSelectionState,
  gate: { ok: true; incomplete: boolean } | { ok: false; reason: "blocking" | "empty" },
  opts?: {
    needsReviewRoles?: Set<string>;
    intentByRole?: Record<string, EquipmentIntent | null | undefined>;
  },
): ApplyEligibilityPresentation {
  const engineeringComplete = deriveEngineeringStatus(rec) === "ENGINEERING_COMPLETE";
  const pendingEquipmentCount = countPendingEquipment(rec, selection, opts);
  return {
    engineeringComplete,
    applyReady: gate.ok && !("incomplete" in gate && gate.incomplete),
    pendingEquipmentCount,
    gateOk: gate.ok,
    gateIncomplete: gate.ok ? gate.incomplete : false,
    gateReason: gate.ok ? null : gate.reason,
  };
}

/** True when any physical role has intent-only resolution (no catalog product). */
export function hasIntentOnlyEquipment(
  rec: SystemRecommendation,
  selection: ReviewSelectionState,
  intentByRole: Record<string, EquipmentIntent | null | undefined>,
  needsReviewRoles?: Set<string>,
): boolean {
  for (const c of rec.components) {
    if (selection.removedRoles.has(c.role) || isServiceRole(c.role)) continue;
    const status = equipmentResolutionForComponent(c, selection, {
      needsReviewRoles,
      equipmentIntent: intentByRole[c.role],
    });
    if (status === "EQUIPMENT_SPECIFIED") return true;
  }
  return false;
}

export function partitionEquipmentAndServices(
  components: CctvRecommendationComponent[],
): {
  equipment: CctvRecommendationComponent[];
  services: CctvRecommendationComponent[];
} {
  const equipment: CctvRecommendationComponent[] = [];
  const services: CctvRecommendationComponent[] = [];
  for (const c of components) {
    if (isServiceRole(c.role)) services.push(c);
    else equipment.push(c);
  }
  return { equipment, services };
}
