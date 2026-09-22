/**
 * R2 — map CCTV drawer state ↔ durable System Design persistence.
 * Does not change CCTV recommend/sizing math. No Apply linkage.
 */

import type {
  CctvRecommendationCandidate,
  CctvRecommendationComponent,
  SystemDesign,
  SystemDesignComponent,
  SystemDesignComponentIn,
  SystemRecommendation,
} from "@site-secure/api-client";
import type { CctvBuildRequirements } from "./cctv-build-requirements";
import { defaultCctvBuildRequirements } from "./cctv-build-requirements";
import {
  initialReviewSelection,
  isCandidateSelectable,
  type ReviewSelectionState,
} from "./cctv-recommend-projection";

export type CctvDesignRequirementsDoc = {
  form: CctvBuildRequirements;
};

export function pickActiveCctvDesign(items: SystemDesign[]): SystemDesign | null {
  const cctv = items.filter((d) => d.engine_type === "cctv");
  if (!cctv.length) return null;
  return [...cctv].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0] ?? null;
}

export function requirementsToDesignDoc(req: CctvBuildRequirements): CctvDesignRequirementsDoc {
  return { form: req };
}

export function requirementsFromDesign(design: SystemDesign): CctvBuildRequirements {
  const raw = design.requirements as Partial<CctvDesignRequirementsDoc> | CctvBuildRequirements | null;
  if (raw && typeof raw === "object" && "form" in raw && raw.form && typeof raw.form === "object") {
    return { ...defaultCctvBuildRequirements(), ...raw.form };
  }
  if (raw && typeof raw === "object" && "cameraCount" in raw) {
    return { ...defaultCctvBuildRequirements(), ...(raw as CctvBuildRequirements) };
  }
  return defaultCctvBuildRequirements();
}

export function selectionOriginForRole(
  role: string,
  selection: ReviewSelectionState,
  enginePreferredId: string | null | undefined,
): "ENGINE_PREFERRED" | "USER_OVERRIDE" | "UNSELECTED" {
  if (selection.removedRoles.has(role)) return "UNSELECTED";
  const selected = selection.selectedByRole[role];
  if (!selected) return "UNSELECTED";
  if (enginePreferredId && selected === enginePreferredId) return "ENGINE_PREFERRED";
  return "USER_OVERRIDE";
}

export function componentsFromRecommendation(
  rec: SystemRecommendation,
  selection: ReviewSelectionState,
  needsReviewRoles: Set<string> = new Set(),
): SystemDesignComponentIn[] {
  return rec.components.map((c) => {
    const enginePreferred = c.selected_product?.id ?? null;
    const removed = selection.removedRoles.has(c.role);
    const userSelected = removed ? null : selection.selectedByRole[c.role] ?? null;
    return {
      role_key: c.role,
      label: c.label || c.role,
      quantity: Number(c.quantity) || 1,
      optional: Boolean(c.optional),
      blocking: Boolean(c.blocking),
      removed,
      resolution_status: c.resolution_status,
      technical_requirements: c.technical_requirements ?? {},
      candidates: c.candidates ?? [],
      engine_preferred_product_id: enginePreferred,
      user_selected_product_id: userSelected,
      selection_origin: selectionOriginForRole(c.role, selection, enginePreferred),
      reason_codes: c.reason_codes ?? [],
      needs_review: needsReviewRoles.has(c.role),
    };
  });
}

export function recommendationMetaFromRec(rec: SystemRecommendation): Record<string, unknown> {
  return {
    status: rec.status,
    blocking: rec.blocking,
    warnings: rec.warnings ?? [],
    assumptions: rec.assumptions ?? [],
    unresolved: rec.unresolved ?? [],
    catalog_stats: rec.catalog_stats ?? null,
    catalog_readiness: rec.catalog_readiness ?? null,
    input: rec.input ?? {},
    system_type: rec.system_type,
  };
}

export function recommendationFromDesign(design: SystemDesign): SystemRecommendation | null {
  const meta = (design.recommendation_meta ?? {}) as Record<string, unknown>;
  const components = design.components ?? [];
  if (!components.length && !design.engineering_result && !meta.status) {
    return null;
  }
  const rebuilt: CctvRecommendationComponent[] = components.map((row) => componentRowToRec(row));
  const status = (meta.status as SystemRecommendation["status"]) || "OK";
  return {
    system_type: "cctv",
    engine_version: Number(design.engine_version) || 1,
    input: (meta.input as Record<string, unknown>) || {},
    engineering: (design.engineering_result as Record<string, unknown>) || {},
    components: rebuilt,
    warnings: (meta.warnings as SystemRecommendation["warnings"]) || [],
    assumptions: (meta.assumptions as SystemRecommendation["assumptions"]) || [],
    unresolved: (meta.unresolved as SystemRecommendation["unresolved"]) || [],
    blocking: Boolean(meta.blocking),
    status,
    catalog_stats: (meta.catalog_stats as SystemRecommendation["catalog_stats"]) || undefined,
    catalog_readiness: (meta.catalog_readiness as SystemRecommendation["catalog_readiness"]) || undefined,
  };
}

function componentRowToRec(row: SystemDesignComponent): CctvRecommendationComponent {
  const candidates = (row.candidates as CctvRecommendationCandidate[]) || [];
  const selectedId = row.removed ? null : row.user_selected_product_id || row.engine_preferred_product_id;
  const selectedCand = selectedId
    ? candidates.find((c) => c.product?.id === selectedId) ?? null
    : null;
  const engineCand = row.engine_preferred_product_id
    ? candidates.find((c) => c.product?.id === row.engine_preferred_product_id) ?? null
    : null;
  return {
    role: row.role_key,
    label: row.label || row.role_key,
    quantity: Number(row.quantity) || 1,
    technical_requirements: (row.technical_requirements as Record<string, unknown>) || {},
    selected_product: selectedCand?.product ?? engineCand?.product ?? null,
    selected_confidence: selectedCand?.confidence ?? engineCand?.confidence ?? null,
    selected_compatibility: selectedCand?.compatibility ?? engineCand?.compatibility ?? null,
    candidates,
    resolution_status: (row.resolution_status as CctvRecommendationComponent["resolution_status"]) || "UNRESOLVED",
    reason_codes: (row.reason_codes as CctvRecommendationComponent["reason_codes"]) || [],
    optional: Boolean(row.optional),
    editable: true,
    blocking: Boolean(row.blocking),
  };
}

export function selectionFromDesign(design: SystemDesign): ReviewSelectionState {
  const selectedByRole: Record<string, string> = {};
  const removedRoles = new Set<string>();
  for (const row of design.components ?? []) {
    if (row.removed) {
      removedRoles.add(row.role_key);
      continue;
    }
    const id = row.user_selected_product_id || null;
    if (id) selectedByRole[row.role_key] = id;
  }
  return { selectedByRole, removedRoles };
}

/**
 * After recalculate: keep prior explicit selections when still a selectable candidate.
 * Invalid prior selections are dropped and listed in needsReviewRoles (not silently confirmed).
 */
export function mergeSelectionAfterRecalculate(
  rec: SystemRecommendation,
  prior: ReviewSelectionState,
): { selection: ReviewSelectionState; needsReviewRoles: Set<string> } {
  const base = initialReviewSelection(rec);
  const needsReviewRoles = new Set<string>();
  const selectedByRole = { ...base.selectedByRole };
  const removedRoles = new Set<string>();

  for (const role of prior.removedRoles) {
    const comp = rec.components.find((c) => c.role === role);
    if (comp?.optional) removedRoles.add(role);
  }

  for (const [role, productId] of Object.entries(prior.selectedByRole)) {
    if (removedRoles.has(role)) continue;
    const comp = rec.components.find((c) => c.role === role);
    if (!comp) {
      needsReviewRoles.add(role);
      continue;
    }
    const cand = comp.candidates.find((c) => c.product.id === productId);
    if (cand && isCandidateSelectable(cand)) {
      selectedByRole[role] = productId;
      const engineId = comp.selected_product?.id;
      if (engineId && productId !== engineId) {
        // explicit override retained
      }
    } else {
      needsReviewRoles.add(role);
      // leave engine default from base if any; do not force invalid prior
    }
  }

  for (const role of removedRoles) {
    delete selectedByRole[role];
  }

  return { selection: { selectedByRole, removedRoles }, needsReviewRoles };
}

export function designHasRecommendation(design: SystemDesign): boolean {
  return (
    design.lifecycle_status === "calculated" ||
    design.lifecycle_status === "applied" ||
    Boolean(design.engineering_result) ||
    (design.components?.length ?? 0) > 0
  );
}
