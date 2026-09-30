/**
 * SYSTEM-DESIGNER-1 Slice E — Review cards, picker helpers, apply readiness preview.
 * Selection is always by component_key. No client sizing. No products.cost.
 */

import type {
  CctvRecommendationCandidate,
  CctvRecommendationComponent,
  SystemRecommendation,
} from "@site-secure/api-client";
import {
  commercialLabelHe,
  componentKeyOf,
  CCTV_COMPONENT_KEYS,
  semanticRoleOf,
} from "./cctv-component-keys";
import { formatReasonHe, formatUnresolvedRequirementHe } from "./cctv-recommend-copy";
import {
  isCandidateSelectable,
  resolveComponentProduct,
  type ReviewSelectionState,
} from "./cctv-recommend-projection";

export type ReviewCardStatus = "needs" | "selected" | "optional" | "verify" | "incompatible";

export type ReviewSectionId =
  | "summary"
  | "cameras"
  | "recording"
  | "network_power"
  | "infrastructure"
  | "services"
  | "warnings";

export type CompatUi = "PASS" | "UNKNOWN" | "FAIL" | "NONE";

export function reviewStatusLabelHe(status: ReviewCardStatus): string {
  switch (status) {
    case "needs":
      return "נדרש ציוד";
    case "selected":
      return "נבחר";
    case "optional":
      return "אופציונלי";
    case "verify":
      return "דורש אימות";
    case "incompatible":
      return "לא מתאים";
  }
}

export function reviewSectionLabelHe(id: ReviewSectionId): string {
  switch (id) {
    case "summary":
      return "סיכום";
    case "cameras":
      return "מצלמות";
    case "recording":
      return "מקליט ואחסון";
    case "network_power":
      return "רשת וחשמל";
    case "infrastructure":
      return "תשתית";
    case "services":
      return "שירותים";
    case "warnings":
      return "אזהרות";
  }
}

export function sectionForComponentKey(componentKey: string): ReviewSectionId {
  const key = componentKeyOf({ role: componentKey, component_key: componentKey });
  switch (key) {
    case CCTV_COMPONENT_KEYS.cameraIp:
    case CCTV_COMPONENT_KEYS.cameraAnalog:
      return "cameras";
    case CCTV_COMPONENT_KEYS.recorder:
    case CCTV_COMPONENT_KEYS.storage:
      return "recording";
    case CCTV_COMPONENT_KEYS.poeSwitch:
    case CCTV_COMPONENT_KEYS.networkSwitch:
    case CCTV_COMPONENT_KEYS.powerSupply:
    case CCTV_COMPONENT_KEYS.ups:
      return "network_power";
    case CCTV_COMPONENT_KEYS.cableIp:
    case CCTV_COMPONENT_KEYS.cableAnalog:
      return "infrastructure";
    default:
      return "services";
  }
}

export function commercialRoleLabelHe(
  componentKey: string,
  technology?: "ip" | "analog_hd" | "hybrid" | "" | null,
): string {
  return commercialLabelHe(componentKey, { technology });
}

export function overallCompatibility(compat: Record<string, string> | null | undefined): CompatUi {
  if (!compat || !Object.keys(compat).length) return "NONE";
  const values = Object.values(compat);
  if (values.includes("FAIL")) return "FAIL";
  if (values.includes("UNKNOWN")) return "UNKNOWN";
  if (values.every((v) => v === "PASS")) return "PASS";
  return "UNKNOWN";
}

export function compatibilityLabelHe(state: CompatUi): string {
  switch (state) {
    case "PASS":
      return "מתאים";
    case "UNKNOWN":
      return "לא ניתן לאמת אוטומטית";
    case "FAIL":
      return "לא מתאים";
    case "NONE":
      return "";
  }
}

export function deriveReviewCardStatus(
  component: CctvRecommendationComponent,
  picked: CctvRecommendationCandidate | null,
  needsReview: boolean,
): ReviewCardStatus {
  if (picked) {
    const compat = overallCompatibility(picked.compatibility);
    if (compat === "FAIL") return "incompatible";
    if (
      needsReview ||
      picked.confidence === "TEXT_ASSISTED" ||
      picked.confidence === "PARTIAL" ||
      compat === "UNKNOWN"
    ) {
      return "verify";
    }
    return "selected";
  }
  if (component.optional) return "optional";
  return "needs";
}

export function requirementTextForCard(
  component: CctvRecommendationComponent,
  channelTier?: number | null,
): string {
  const eng = formatUnresolvedRequirementHe(component);
  if (eng && eng !== "לא נמצא בקטלוג") return eng;
  const t = component.technical_requirements ?? {};
  const parts: string[] = [];
  if (typeof t.resolutionMpMin === "number") parts.push(`≥${t.resolutionMpMin} MP`);
  if (typeof t.minChannels === "number") parts.push(`≥${t.minChannels} ערוצים`);
  if (typeof t.requiredTb === "number") parts.push(`≈${Number(t.requiredTb).toFixed(1)} TB`);
  if (typeof t.minPoePorts === "number") parts.push(`≥${t.minPoePorts} יציאות PoE`);
  if (typeof t.minPoeBudgetW === "number") parts.push(`תקציב ≥${Math.round(t.minPoeBudgetW)}W`);
  if (typeof t.minBudgetW === "number") parts.push(`תקציב ≥${Math.round(t.minBudgetW)}W`);
  if (component.role === "recorder" && channelTier != null && !parts.length) {
    parts.push(`≥${channelTier} ערוצים`);
  }
  if (t.technology === "analog_hd") parts.push("Analog HD");
  if (t.technology === "ip") parts.push("IP");
  return parts.join(" · ");
}

export function whyTextForCard(component: CctvRecommendationComponent): string {
  const why = component.reason_codes?.[0];
  return why ? formatReasonHe(why) : "";
}

export type ReviewSection = {
  id: ReviewSectionId;
  label: string;
  components: CctvRecommendationComponent[];
};

export function groupComponentsForReview(
  components: CctvRecommendationComponent[],
): ReviewSection[] {
  const order: ReviewSectionId[] = [
    "cameras",
    "recording",
    "network_power",
    "infrastructure",
    "services",
  ];
  const buckets = new Map<ReviewSectionId, CctvRecommendationComponent[]>();
  for (const c of components) {
    const id = sectionForComponentKey(componentKeyOf(c));
    const list = buckets.get(id) ?? [];
    list.push(c);
    buckets.set(id, list);
  }
  return order
    .filter((id) => (buckets.get(id)?.length ?? 0) > 0)
    .map((id) => ({ id, label: reviewSectionLabelHe(id), components: buckets.get(id)! }));
}

export type ApplyReadinessPreview = {
  required: number;
  selected: number;
  needsEquipment: number;
  optional: number;
  optionalUnresolved: number;
};

export function buildApplyReadinessPreview(
  rec: SystemRecommendation,
  selection: ReviewSelectionState,
): ApplyReadinessPreview {
  let required = 0;
  let selected = 0;
  let needsEquipment = 0;
  let optional = 0;
  let optionalUnresolved = 0;
  for (const c of rec.components) {
    const key = componentKeyOf(c);
    if (selection.removedComponentIds.has(key)) continue;
    const picked = resolveComponentProduct(c, selection);
    if (c.optional) {
      optional += 1;
      if (!picked) optionalUnresolved += 1;
      else selected += 1;
      continue;
    }
    required += 1;
    if (picked && picked.confidence !== "TEXT_ASSISTED") selected += 1;
    else needsEquipment += 1;
  }
  return { required, selected, needsEquipment, optional, optionalUnresolved };
}

/** Catalog category_key families for focused picker discovery (not PASS proof). */
export function categoryKeysForComponent(
  componentKey: string,
  technology: "ip" | "analog_hd" | "hybrid" | "" | null | undefined,
): string[] {
  const key = componentKeyOf({ role: componentKey, component_key: componentKey });
  switch (key) {
    case CCTV_COMPONENT_KEYS.cameraIp:
      return ["cameras_ip", "cameras_ptz", "cameras_thermal", "cameras_special"];
    case CCTV_COMPONENT_KEYS.cameraAnalog:
      return ["cameras_analog"];
    case CCTV_COMPONENT_KEYS.recorder:
      if (technology === "analog_hd") return ["dvr_xvr"];
      if (technology === "hybrid") return ["dvr_xvr", "nvr"];
      return ["nvr"];
    case CCTV_COMPONENT_KEYS.storage:
      return ["hdd_recorders"];
    case CCTV_COMPONENT_KEYS.poeSwitch:
      return ["switch", "poe", "poe_plus", "poe_plusplus", "switch_managed", "switch_unmanaged"];
    case CCTV_COMPONENT_KEYS.cableIp:
      return ["cat5e", "cat6", "cat6a", "cat7", "fiber", "outdoor_network_cable"];
    case CCTV_COMPONENT_KEYS.cableAnalog:
      return ["coax"];
    case CCTV_COMPONENT_KEYS.powerSupply:
      return ["psu", "power_supply"];
    case CCTV_COMPONENT_KEYS.ups:
      return ["ups", "battery", "power_backup"];
    default:
      return [];
  }
}

export function candidateHasFail(candidate: CctvRecommendationCandidate): boolean {
  return overallCompatibility(candidate.compatibility) === "FAIL";
}

export function filterPickerCandidates(
  candidates: CctvRecommendationCandidate[],
  opts: { query?: string; includeFail?: boolean } = {},
): CctvRecommendationCandidate[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  return candidates.filter((c) => {
    if (!opts.includeFail && candidateHasFail(c)) return false;
    if (!q) return true;
    const hay = [
      c.product.name,
      c.product.sku,
      c.product.manufacturer,
      c.product.model,
      c.product.category_key,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function attrNum(attrs: Record<string, unknown> | undefined, ...keys: string[]): number | null {
  if (!attrs) return null;
  for (const k of keys) {
    const v = attrs[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function attrStr(attrs: Record<string, unknown> | undefined, ...keys: string[]): string | null {
  if (!attrs) return null;
  for (const k of keys) {
    const v = attrs[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "boolean") return v ? "כן" : "לא";
  }
  return null;
}

/** Role-aware scannable specs for picker rows — only relevant fields. */
export function candidateSpecLines(
  componentKey: string,
  candidate: CctvRecommendationCandidate,
): string[] {
  const key = componentKeyOf({ role: componentKey, component_key: componentKey });
  const attrs = (candidate.product.attributes ?? {}) as Record<string, unknown>;
  const lines: string[] = [];
  const role = semanticRoleOf(key);

  if (role === "camera") {
    const mp = attrNum(attrs, "resolution_mp", "resolutionMp");
    if (mp != null) lines.push(`${mp} MP`);
    const ff = attrStr(attrs, "form_factor", "formFactor");
    if (ff) lines.push(ff);
    const env = attrStr(attrs, "environment");
    if (env) lines.push(env);
    const poe = attrs.poe;
    if (poe === true) lines.push("PoE");
    if (poe === false) lines.push("ללא PoE");
  } else if (role === "recorder") {
    const ch = attrNum(attrs, "channels");
    if (ch != null) lines.push(`${ch}CH`);
    const ip = attrNum(attrs, "ip_channels", "ip_channel_count", "network_channels");
    const an = attrNum(attrs, "analog_channels", "analog_channel_count", "bnc_channels");
    if (ip != null) lines.push(`${ip} IP`);
    if (an != null) lines.push(`${an} Analog`);
    const poePorts = attrNum(attrs, "poe_ports", "poePorts");
    const poeW = attrNum(attrs, "poe_budget_w", "poeBudgetW");
    if (poePorts != null) lines.push(`${poePorts} PoE`);
    if (poeW != null) lines.push(`${Math.round(poeW)}W`);
  } else if (role === "storage") {
    const tb = attrNum(attrs, "capacity_tb", "capacityTb");
    if (tb != null) lines.push(`${tb} TB`);
    const surv = attrs.surveillance_grade ?? attrs.surveillanceGrade;
    if (surv === true) lines.push("surveillance");
  } else if (role === "poe_switch" || role === "network_switch") {
    const ports = attrNum(attrs, "ports", "poe_ports", "poePorts");
    const budget = attrNum(attrs, "poe_budget_w", "poeBudgetW");
    if (ports != null) lines.push(`${ports} ports`);
    if (budget != null) lines.push(`${Math.round(budget)}W`);
  } else if (role === "power_supply") {
    const out = attrNum(attrs, "output_a", "capacity_a", "channels");
    const v = attrNum(attrs, "output_v", "voltage");
    if (v != null) lines.push(`${v}V`);
    if (out != null) lines.push(`${out}A`);
  } else if (role === "cable") {
    const cat = candidate.product.category_key || attrStr(attrs, "cable_type", "category");
    if (cat) lines.push(String(cat));
  }

  return lines;
}

/**
 * After recalc: keep selectable prior product; FAIL drops; UNKNOWN kept but needs review.
 */
export function classifyPriorSelection(
  candidate: CctvRecommendationCandidate | undefined,
): "keep" | "keep_verify" | "drop" {
  if (!candidate) return "drop";
  if (candidateHasFail(candidate)) return "drop";
  if (!isCandidateSelectable(candidate)) return "drop";
  const compat = overallCompatibility(candidate.compatibility);
  if (
    compat === "UNKNOWN" ||
    candidate.confidence === "PARTIAL" ||
    candidate.confidence === "TEXT_ASSISTED"
  ) {
    return "keep_verify";
  }
  return "keep";
}

export function technologyFromRecommendation(
  rec: SystemRecommendation,
): "ip" | "analog_hd" | "hybrid" {
  const input = (rec.input ?? {}) as Record<string, unknown>;
  const raw = String(input.cctvTechnology ?? input.cctv_technology ?? "ip");
  if (raw === "analog_hd" || raw === "hybrid" || raw === "ip") return raw;
  return "ip";
}
