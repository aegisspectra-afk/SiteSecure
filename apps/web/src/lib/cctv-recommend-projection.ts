/**
 * Project a reviewed SystemRecommendation into quote catalog lines.
 * Prices are NOT taken from the recommendation — Quote APIs remain authoritative.
 *
 * Unresolved required components become planned free lines (no fake SKU / price).
 * Commercial name/description stay clean; engineering lives on Design + planned.engineeringRequirement.
 * Linkage: package_name = cctv-planned:{component_key}.
 */

import type {
  CctvRecommendationCandidate,
  CctvRecommendationComponent,
  SystemDesign,
  SystemRecommendation,
} from "@site-secure/api-client";
import {
  commercialLabelHe,
  componentKeyFromPlannedPackage,
  componentKeyOf,
  plannedPackageNameFor,
  semanticRoleOf,
} from "./cctv-component-keys";
import { formatUnresolvedRequirementHe } from "./cctv-recommend-copy";

/** Stable marker for planned CCTV equipment free-lines (send-block + idempotent replace). */
export const CCTV_PLANNED_PACKAGE_PREFIX = "cctv-planned:";
/** Legacy status prefix — detection only; must NOT be written into customer-facing description. */
export const CCTV_PLANNED_DESCRIPTION_PREFIX = "נדרש ציוד";

export type CctvBuildQuoteLine = {
  /** Stable component identity. */
  componentKey: string;
  /** Semantic role metadata (camera, recorder, …). */
  role: string;
  productId: string;
  qty: number;
  optional: boolean;
};

/** Unresolved engineering requirement as a commercial free line (no product_id). */
export type CctvPlannedQuoteLine = {
  componentKey: string;
  role: string;
  qty: number;
  optional: boolean;
  /** Customer-facing commercial name — clean. */
  name: string;
  /** Customer-facing description — same commercial label (never status · name · eng). */
  description: string;
  /** Durable Design linkage: cctv-planned:{component_key} */
  package_name: string;
  /** Engineering requirement for UI / Design hydrate — NOT for customer description. */
  engineeringRequirement: string;
};

export function linesFingerprint(lines: CctvBuildQuoteLine[], planned: CctvPlannedQuoteLine[] = []): string {
  const resolved = lines.map((l) => `${l.componentKey}:${l.productId}:${l.qty}`).sort();
  const pending = planned.map((l) => `plan:${l.componentKey}:${l.qty}`).sort();
  return [...resolved, ...pending].join("|");
}

export type PartialApplyRecovery = {
  sectionId: string;
  /** Stable component keys already inserted. */
  addedRoles: string[];
  remaining: CctvBuildQuoteLine[];
  fingerprint: string;
};

export type ReviewSelectionState = {
  /** component_key → selected product id */
  selectedByComponentId: Record<string, string>;
  /** optional component_keys the user removed */
  removedComponentIds: Set<string>;
};

export function emptyReviewSelection(): ReviewSelectionState {
  return { selectedByComponentId: {}, removedComponentIds: new Set() };
}

export function initialReviewSelection(rec: SystemRecommendation): ReviewSelectionState {
  const selectedByComponentId: Record<string, string> = {};
  for (const c of rec.components) {
    const key = componentKeyOf(c);
    const id = c.selected_product?.id;
    if (id && c.selected_confidence !== "TEXT_ASSISTED") {
      selectedByComponentId[key] = id;
    } else if (id && !c.blocking) {
      selectedByComponentId[key] = id;
    }
  }
  return { selectedByComponentId, removedComponentIds: new Set() };
}

export function isCandidateSelectable(candidate: CctvRecommendationCandidate): boolean {
  const compat = candidate.compatibility ?? {};
  if (Object.values(compat).includes("FAIL")) return false;
  return true;
}

export function resolveComponentProduct(
  component: CctvRecommendationComponent,
  selection: ReviewSelectionState,
): CctvRecommendationCandidate | null {
  const key = componentKeyOf(component);
  if (selection.removedComponentIds.has(key)) return null;
  const preferredId = selection.selectedByComponentId[key];
  const fromCandidates = component.candidates.find((c) => c.product.id === preferredId);
  if (fromCandidates && isCandidateSelectable(fromCandidates)) return fromCandidates;
  if (component.selected_product?.id) {
    const sel = component.candidates.find((c) => c.product.id === component.selected_product!.id);
    if (sel && isCandidateSelectable(sel) && component.selected_confidence !== "TEXT_ASSISTED") {
      return sel;
    }
    if (component.selected_confidence === "STRUCTURED" || component.selected_confidence === "PARTIAL") {
      return {
        product: component.selected_product,
        confidence: component.selected_confidence,
        compatibility: component.selected_compatibility ?? undefined,
        reason_codes: component.reason_codes,
      };
    }
  }
  return null;
}

export function engineeringRequirementForComponent(component: CctvRecommendationComponent): string {
  return formatUnresolvedRequirementHe(component).trim();
}

export function plannedLineFromComponent(component: CctvRecommendationComponent): CctvPlannedQuoteLine {
  const qty = Math.max(0.001, Number(component.quantity) || 1);
  const componentKey = componentKeyOf(component);
  const role = semanticRoleOf(componentKey);
  const label = commercialLabelHe(componentKey);
  const engineeringRequirement = engineeringRequirementForComponent(component);
  return {
    componentKey,
    role,
    qty,
    optional: Boolean(component.optional),
    name: label,
    description: label,
    package_name: plannedPackageNameFor(componentKey),
    engineeringRequirement,
  };
}

export type AddRecommendationGate =
  | { ok: true; lines: CctvBuildQuoteLine[]; planned: CctvPlannedQuoteLine[]; incomplete: boolean }
  | { ok: false; reason: "blocking" | "empty" };

/**
 * Apply gate: engineering INVALID_INPUT blocks entirely.
 * Resolved catalog products become quote catalog lines.
 * Unresolved REQUIRED (non-optional) components become planned free lines — no fake SKU/price.
 * Optional unresolved components are omitted.
 * TEXT_ASSISTED never auto-satisfies a required core component (treated as planned).
 */
export function canAddRecommendationToQuote(
  rec: SystemRecommendation,
  selection: ReviewSelectionState,
): AddRecommendationGate {
  if (rec.status === "INVALID_INPUT") {
    return { ok: false, reason: "blocking" };
  }

  const lines: CctvBuildQuoteLine[] = [];
  const planned: CctvPlannedQuoteLine[] = [];
  let incomplete = false;
  for (const c of rec.components) {
    const key = componentKeyOf(c);
    if (selection.removedComponentIds.has(key)) continue;
    const picked = resolveComponentProduct(c, selection);
    const textAssistedCore =
      Boolean(picked) && picked!.confidence === "TEXT_ASSISTED" && c.blocking && !c.optional;

    if (picked && !textAssistedCore) {
      lines.push({
        componentKey: key,
        role: semanticRoleOf(key),
        productId: picked.product.id,
        qty: Math.max(
          0.001,
          Number((picked as { quantity?: number }).quantity ?? c.quantity ?? 1) || 1,
        ),
        optional: Boolean(c.optional),
      });
      continue;
    }

    if (c.blocking && !c.optional) {
      incomplete = true;
      planned.push(plannedLineFromComponent(c));
    }
  }
  if (!lines.length && !planned.length) return { ok: false, reason: "empty" };
  if (rec.blocking || rec.status === "BLOCKED") incomplete = true;
  return { ok: true, lines, planned, incomplete };
}

/** Drop component keys already inserted during a partial apply. */
export function remainingLinesAfterPartial(
  lines: CctvBuildQuoteLine[],
  addedComponentKeys: string[],
): CctvBuildQuoteLine[] {
  const done = new Set(addedComponentKeys);
  return lines.filter((l) => !done.has(l.componentKey));
}

export function componentKindLabel(
  component: CctvRecommendationComponent,
): "CORE" | "OPTIONAL" | "MANUAL" {
  if (component.optional) return "OPTIONAL";
  if (
    component.resolution_status === "UNRESOLVED" ||
    component.selected_confidence === "TEXT_ASSISTED"
  ) {
    return "MANUAL";
  }
  return "CORE";
}

export function isCctvPlannedQuoteItem(item: {
  package_name?: string | null;
  description?: string | null;
}): boolean {
  const pkg = String(item.package_name || "");
  if (pkg.startsWith(CCTV_PLANNED_PACKAGE_PREFIX)) return true;
  // Legacy detection only (old polluted descriptions).
  return String(item.description || "").startsWith(CCTV_PLANNED_DESCRIPTION_PREFIX);
}

/** Format engineering requirement from persisted Design technical_requirements. */
export function engineeringRequirementFromTech(
  tech: Record<string, unknown> | null | undefined,
  roleHint?: string,
): string {
  if (!tech || !Object.keys(tech).length) return "";
  const synthetic: CctvRecommendationComponent = {
    role: roleHint || String(tech.semantic_role || "component"),
    component_key: typeof tech.component_key === "string" ? tech.component_key : undefined,
    label: "",
    quantity: 1,
    technical_requirements: tech,
    candidates: [],
    resolution_status: "UNRESOLVED",
    reason_codes: [],
    optional: false,
    editable: true,
    blocking: true,
  };
  return formatUnresolvedRequirementHe(synthetic).trim();
}

/**
 * Resolve durable engineering requirement for a planned quote line via Design linkage.
 * No quote schema redesign — package_name → component_key → Design.technical_requirements.
 */
export function engineeringRequirementForPlannedItem(
  design: SystemDesign | null | undefined,
  item: { package_name?: string | null },
): string | null {
  if (!design) return null;
  const key = componentKeyFromPlannedPackage(item.package_name);
  if (!key) return null;
  const row = (design.components ?? []).find((c) => componentKeyOf({
    role: c.role_key,
    component_key: typeof c.technical_requirements?.component_key === "string"
      ? String(c.technical_requirements.component_key)
      : c.role_key,
    technical_requirements: (c.technical_requirements as Record<string, unknown>) || {},
  }) === key);
  if (!row) return null;
  const tech = (row.technical_requirements as Record<string, unknown>) || {};
  const text = engineeringRequirementFromTech(tech, semanticRoleOf(key));
  return text || null;
}
