/**
 * R2 — map CCTV drawer state ↔ durable System Design persistence.
 * Does not change CCTV recommend/sizing math. No Apply linkage.
 *
 * SYSTEM-DESIGNER-1A: Design role_key stores stable component_key.
 * Semantic role is kept in technical_requirements.semantic_role.
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
  commercialLabelHe,
  componentKeyOf,
  normalizeComponentKey,
  semanticRoleOf,
} from "./cctv-component-keys";
import {
  emptyReviewSelection,
  initialReviewSelection,
  type ReviewSelectionState,
} from "./cctv-recommend-projection";
import { classifyPriorSelection } from "./cctv-designer-review";

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
  let merged: CctvBuildRequirements;
  if (raw && typeof raw === "object" && "form" in raw && raw.form && typeof raw.form === "object") {
    merged = { ...defaultCctvBuildRequirements(), ...raw.form };
  } else if (raw && typeof raw === "object" && "cameraCount" in raw) {
    merged = { ...defaultCctvBuildRequirements(), ...(raw as CctvBuildRequirements) };
  } else {
    return defaultCctvBuildRequirements();
  }
  // Legacy Design docs only had showAdvanced
  if (!merged.designerMode) {
    merged.designerMode = merged.showAdvanced ? "professional" : "quick";
  }
  if (merged.testingRequested == null) {
    merged.testingRequested = merged.installationRequested !== false;
  }
  return merged;
}

export function selectionOriginForComponent(
  componentKey: string,
  selection: ReviewSelectionState,
  enginePreferredId: string | null | undefined,
): "ENGINE_PREFERRED" | "USER_OVERRIDE" | "UNSELECTED" {
  const key = normalizeComponentKey(componentKey);
  if (selection.removedComponentIds.has(key)) return "UNSELECTED";
  const selected = selection.selectedByComponentId[key];
  if (!selected) return "UNSELECTED";
  if (enginePreferredId && selected === enginePreferredId) return "ENGINE_PREFERRED";
  return "USER_OVERRIDE";
}

/** @deprecated use selectionOriginForComponent — kept for older tests during Slice A. */
export function selectionOriginForRole(
  roleOrKey: string,
  selection: ReviewSelectionState,
  enginePreferredId: string | null | undefined,
): "ENGINE_PREFERRED" | "USER_OVERRIDE" | "UNSELECTED" {
  return selectionOriginForComponent(normalizeComponentKey(roleOrKey), selection, enginePreferredId);
}

export function componentsFromRecommendation(
  rec: SystemRecommendation,
  selection: ReviewSelectionState,
  needsReviewKeys: Set<string> = new Set(),
): SystemDesignComponentIn[] {
  return rec.components.map((c) => {
    const componentKey = componentKeyOf(c);
    const semanticRole = semanticRoleOf(componentKey);
    const enginePreferred = c.selected_product?.id ?? null;
    const removed = selection.removedComponentIds.has(componentKey);
    const userSelected = removed ? null : selection.selectedByComponentId[componentKey] ?? null;
    const tech = {
      ...(c.technical_requirements ?? {}),
      component_key: componentKey,
      semantic_role: semanticRole,
    };
    return {
      role_key: componentKey,
      label: commercialLabelHe(componentKey) || c.label || componentKey,
      quantity: Number(c.quantity) || 1,
      optional: Boolean(c.optional),
      blocking: Boolean(c.blocking),
      removed,
      resolution_status: c.resolution_status,
      technical_requirements: tech,
      candidates: c.candidates ?? [],
      engine_preferred_product_id: enginePreferred,
      user_selected_product_id: userSelected,
      selection_origin: selectionOriginForComponent(componentKey, selection, enginePreferred),
      reason_codes: c.reason_codes ?? [],
      needs_review: needsReviewKeys.has(componentKey),
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
  const tech = (row.technical_requirements as Record<string, unknown>) || {};
  const componentKey = componentKeyOf({
    role: row.role_key,
    component_key: typeof tech.component_key === "string" ? tech.component_key : row.role_key,
    technical_requirements: tech,
  });
  const semanticRole =
    typeof tech.semantic_role === "string" && tech.semantic_role
      ? tech.semantic_role
      : semanticRoleOf(componentKey);
  return {
    component_key: componentKey,
    role: semanticRole,
    label: row.label || commercialLabelHe(componentKey) || componentKey,
    quantity: Number(row.quantity) || 1,
    technical_requirements: { ...tech, component_key: componentKey, semantic_role: semanticRole },
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
  const selectedByComponentId: Record<string, string> = {};
  const removedComponentIds = new Set<string>();
  for (const row of design.components ?? []) {
    const key = componentKeyOf({
      role: row.role_key,
      technical_requirements: (row.technical_requirements as Record<string, unknown>) || {},
    });
    if (row.removed) {
      removedComponentIds.add(key);
      continue;
    }
    const id = row.user_selected_product_id || null;
    if (id) selectedByComponentId[key] = id;
  }
  return { selectedByComponentId, removedComponentIds };
}

/**
 * After recalculate: keep prior explicit selections when still a selectable candidate.
 * Invalid prior selections are dropped and listed in needsReviewRoles (component keys).
 */
export function mergeSelectionAfterRecalculate(
  rec: SystemRecommendation,
  prior: ReviewSelectionState,
): { selection: ReviewSelectionState; needsReviewRoles: Set<string> } {
  const base = initialReviewSelection(rec);
  const needsReviewRoles = new Set<string>();
  const selectedByComponentId = { ...base.selectedByComponentId };
  const removedComponentIds = new Set<string>();

  for (const key of prior.removedComponentIds) {
    const comp = rec.components.find((c) => componentKeyOf(c) === key);
    if (comp?.optional) removedComponentIds.add(key);
  }

  for (const [key, productId] of Object.entries(prior.selectedByComponentId)) {
    if (removedComponentIds.has(key)) continue;
    const comp = rec.components.find((c) => componentKeyOf(c) === key);
    if (!comp) {
      needsReviewRoles.add(key);
      continue;
    }
    const cand = comp.candidates.find((c) => c.product.id === productId);
    const verdict = classifyPriorSelection(cand);
    if (verdict === "keep" || verdict === "keep_verify") {
      selectedByComponentId[key] = productId;
      if (verdict === "keep_verify") needsReviewRoles.add(key);
    } else {
      needsReviewRoles.add(key);
    }
  }

  for (const key of removedComponentIds) {
    delete selectedByComponentId[key];
  }

  return { selection: { selectedByComponentId, removedComponentIds }, needsReviewRoles };
}

export function designHasRecommendation(design: SystemDesign): boolean {
  return (
    design.lifecycle_status === "calculated" ||
    design.lifecycle_status === "applied" ||
    Boolean(design.engineering_result) ||
    (design.components?.length ?? 0) > 0
  );
}

export { emptyReviewSelection };
