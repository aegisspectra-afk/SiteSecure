/**
 * Project a reviewed SystemRecommendation into quote catalog lines.
 * Prices are NOT taken from the recommendation — Quote APIs remain authoritative.
 */

import type {
  CctvRecommendationCandidate,
  CctvRecommendationComponent,
  SystemRecommendation,
} from "@site-secure/api-client";

export type CctvBuildQuoteLine = {
  role: string;
  productId: string;
  qty: number;
  optional: boolean;
};

export function linesFingerprint(lines: CctvBuildQuoteLine[]): string {
  return lines
    .map((l) => `${l.role}:${l.productId}:${l.qty}`)
    .sort()
    .join("|");
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

export function canAddRecommendationToQuote(
  rec: SystemRecommendation,
  selection: ReviewSelectionState,
): { ok: true; lines: CctvBuildQuoteLine[] } | { ok: false; reason: "blocking" | "empty" } {
  if (rec.blocking || rec.status === "BLOCKED" || rec.status === "INVALID_INPUT") {
    // Re-evaluate after removals: blocking only for remaining core unresolved without product
    const coreBlocking = rec.components.some((c) => {
      if (!c.blocking) return false;
      if (selection.removedRoles.has(c.role)) return false;
      if (c.optional) return false;
      const product = resolveComponentProduct(c, selection);
      return !product || product.confidence === "TEXT_ASSISTED";
    });
    if (coreBlocking) return { ok: false, reason: "blocking" };
  }

  const lines: CctvBuildQuoteLine[] = [];
  for (const c of rec.components) {
    if (selection.removedRoles.has(c.role)) continue;
    const picked = resolveComponentProduct(c, selection);
    if (!picked) {
      if (c.blocking && !c.optional) return { ok: false, reason: "blocking" };
      continue;
    }
    if (picked.confidence === "TEXT_ASSISTED" && c.blocking && !c.optional) {
      return { ok: false, reason: "blocking" };
    }
    lines.push({
      role: c.role,
      productId: picked.product.id,
      qty: Math.max(
        0.001,
        Number(
          (picked as { quantity?: number }).quantity ??
            c.quantity ??
            1,
        ) || 1,
      ),
      optional: Boolean(c.optional),
    });
  }
  if (!lines.length) return { ok: false, reason: "empty" };
  return { ok: true, lines };
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
