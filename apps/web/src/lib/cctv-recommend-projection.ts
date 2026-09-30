/**
 * Project a reviewed SystemRecommendation into quote catalog lines.
 * Prices are NOT taken from the recommendation — Quote APIs remain authoritative.
 *
 * Unresolved required roles become planned free lines (no fake SKU / price).
 */

import type {
  CctvRecommendationCandidate,
  CctvRecommendationComponent,
  SystemRecommendation,
} from "@site-secure/api-client";
import { formatUnresolvedRequirementHe, roleLabelHe } from "./cctv-recommend-copy";

/** Stable marker for planned CCTV equipment free-lines (send-block + idempotent replace). */
export const CCTV_PLANNED_PACKAGE_PREFIX = "cctv-planned:";
export const CCTV_PLANNED_DESCRIPTION_PREFIX = "נדרש ציוד";

export type CctvBuildQuoteLine = {
  role: string;
  productId: string;
  qty: number;
  optional: boolean;
};

/** Unresolved engineering requirement as a commercial free line (no product_id). */
export type CctvPlannedQuoteLine = {
  role: string;
  qty: number;
  optional: boolean;
  name: string;
  description: string;
  package_name: string;
};

export function linesFingerprint(lines: CctvBuildQuoteLine[], planned: CctvPlannedQuoteLine[] = []): string {
  const resolved = lines.map((l) => `${l.role}:${l.productId}:${l.qty}`).sort();
  const pending = planned.map((l) => `plan:${l.role}:${l.qty}`).sort();
  return [...resolved, ...pending].join("|");
}

export type PartialApplyRecovery = {
  sectionId: string;
  addedRoles: string[];
  remaining: CctvBuildQuoteLine[];
  fingerprint: string;
};

export type ReviewSelectionState = {
  /** role → selected product id (user override among candidates) */
  selectedByRole: Record<string, string>;
  /** optional roles the user removed */
  removedRoles: Set<string>;
};

export function initialReviewSelection(rec: SystemRecommendation): ReviewSelectionState {
  const selectedByRole: Record<string, string> = {};
  for (const c of rec.components) {
    const id = c.selected_product?.id;
    if (id && c.selected_confidence !== "TEXT_ASSISTED") {
      selectedByRole[c.role] = id;
    } else if (id && !c.blocking) {
      // optional/non-blocking text-assisted may still be selected if user keeps it
      selectedByRole[c.role] = id;
    }
  }
  return { selectedByRole, removedRoles: new Set() };
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
  if (selection.removedRoles.has(component.role)) return null;
  const preferredId = selection.selectedByRole[component.role];
  const fromCandidates = component.candidates.find((c) => c.product.id === preferredId);
  if (fromCandidates && isCandidateSelectable(fromCandidates)) return fromCandidates;
  if (component.selected_product?.id) {
    const sel = component.candidates.find((c) => c.product.id === component.selected_product!.id);
    if (sel && isCandidateSelectable(sel) && component.selected_confidence !== "TEXT_ASSISTED") {
      return sel;
    }
    // structured/partial selected without FAIL
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

export function plannedLineFromComponent(component: CctvRecommendationComponent): CctvPlannedQuoteLine {
  const qty = Math.max(0.001, Number(component.quantity) || 1);
  const label = roleLabelHe(component.role);
  const detail = formatUnresolvedRequirementHe(component);
  const description = detail
    ? `${CCTV_PLANNED_DESCRIPTION_PREFIX} · ${label} · ${detail}`
    : `${CCTV_PLANNED_DESCRIPTION_PREFIX} · ${label}`;
  return {
    role: component.role,
    qty,
    optional: Boolean(component.optional),
    name: label,
    description,
    package_name: `${CCTV_PLANNED_PACKAGE_PREFIX}${component.role}`,
  };
}

export type AddRecommendationGate =
  | { ok: true; lines: CctvBuildQuoteLine[]; planned: CctvPlannedQuoteLine[]; incomplete: boolean }
  | { ok: false; reason: "blocking" | "empty" };

/**
 * Apply gate: engineering INVALID_INPUT blocks entirely.
 * Resolved catalog products become quote catalog lines.
 * Unresolved REQUIRED (non-optional) roles become planned free lines — no fake SKU/price.
 * Optional unresolved roles are omitted (user may remove or leave out).
 * TEXT_ASSISTED never auto-satisfies a required core role (treated as planned).
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
    if (selection.removedRoles.has(c.role)) continue;
    const picked = resolveComponentProduct(c, selection);
    const textAssistedCore =
      Boolean(picked) && picked!.confidence === "TEXT_ASSISTED" && c.blocking && !c.optional;

    if (picked && !textAssistedCore) {
      lines.push({
        role: c.role,
        productId: picked.product.id,
        qty: Math.max(
          0.001,
          Number((picked as { quantity?: number }).quantity ?? c.quantity ?? 1) || 1,
        ),
        optional: Boolean(c.optional),
      });
      continue;
    }

    // Unresolved or text-assisted core → planned free line for required roles only
    if (c.blocking && !c.optional) {
      incomplete = true;
      planned.push(plannedLineFromComponent(c));
    }
  }
  if (!lines.length && !planned.length) return { ok: false, reason: "empty" };
  if (rec.blocking || rec.status === "BLOCKED") incomplete = true;
  return { ok: true, lines, planned, incomplete };
}

/** Drop roles already inserted during a partial apply. */
export function remainingLinesAfterPartial(
  lines: CctvBuildQuoteLine[],
  addedRoles: string[],
): CctvBuildQuoteLine[] {
  const done = new Set(addedRoles);
  return lines.filter((l) => !done.has(l.role));
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
  return String(item.description || "").startsWith(CCTV_PLANNED_DESCRIPTION_PREFIX);
}
