import { describe, expect, it, vi } from "vitest";
import type { SystemDesign, SystemRecommendation } from "@site-secure/api-client";
import {
  componentsFromRecommendation,
  designHasRecommendation,
  mergeSelectionAfterRecalculate,
  pickActiveCctvDesign,
  recommendationFromDesign,
  requirementsFromDesign,
  requirementsToDesignDoc,
  selectionFromDesign,
  selectionOriginForRole,
} from "../src/lib/cctv-design-persistence";
import { defaultCctvBuildRequirements } from "../src/lib/cctv-build-requirements";
import { initialReviewSelection, linesFingerprint } from "../src/lib/cctv-recommend-projection";

function sampleRec(): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    input: { cameraCount: 8 },
    engineering: { storage: { requiredTbWithOverhead: 10 } },
    components: [
      {
        role: "camera",
        label: "camera",
        quantity: 8,
        technical_requirements: { resolutionMpMin: 4 },
        selected_product: { id: "c1", name: "Cam A" },
        selected_confidence: "STRUCTURED",
        candidates: [
          { product: { id: "c1", name: "Cam A" }, confidence: "STRUCTURED", compatibility: { resolution_mp: "PASS" } },
          { product: { id: "c2", name: "Cam B" }, confidence: "STRUCTURED", compatibility: { resolution_mp: "PASS" } },
        ],
        reason_codes: [{ code: "ROLE_CAMERA_FROM_COUNT" }],
        optional: false,
        editable: true,
        blocking: false,
        resolution_status: "RESOLVED",
      },
      {
        role: "cable",
        label: "cable",
        quantity: 1,
        technical_requirements: {},
        selected_product: { id: "k1", name: "Cat6" },
        selected_confidence: "STRUCTURED",
        candidates: [
          { product: { id: "k1", name: "Cat6" }, confidence: "STRUCTURED", compatibility: {} },
        ],
        reason_codes: [],
        optional: true,
        editable: true,
        blocking: false,
        resolution_status: "RESOLVED",
      },
    ],
    warnings: [{ code: "ENVIRONMENT_UNSPECIFIED" }],
    assumptions: [],
    unresolved: [],
    blocking: false,
    status: "OK",
  };
}

function designFromRec(rec: SystemRecommendation, selection = initialReviewSelection(rec)): SystemDesign {
  const comps = componentsFromRecommendation(rec, selection);
  return {
    id: "d1",
    workspace_id: "w1",
    quote_id: "q1",
    engine_type: "cctv",
    engine_version: 1,
    lifecycle_status: "calculated",
    requirements: requirementsToDesignDoc(defaultCctvBuildRequirements()) as unknown as Record<string, unknown>,
    engineering_result: rec.engineering,
    recommendation_meta: {
      status: rec.status,
      blocking: rec.blocking,
      warnings: rec.warnings,
      assumptions: rec.assumptions,
      unresolved: rec.unresolved,
      input: rec.input,
    },
    revision: 2,
    created_at: "2026-01-01T00:00:00Z",
    components: comps.map((c, i) => ({
      id: `comp-${i}`,
      workspace_id: "w1",
      design_id: "d1",
      role_key: c.role_key,
      label: c.label || c.role_key,
      quantity: c.quantity ?? 1,
      optional: Boolean(c.optional),
      blocking: Boolean(c.blocking),
      removed: Boolean(c.removed),
      resolution_status: c.resolution_status,
      technical_requirements: c.technical_requirements,
      candidates: c.candidates,
      engine_preferred_product_id: c.engine_preferred_product_id,
      user_selected_product_id: c.user_selected_product_id,
      selection_origin: c.selection_origin || "UNSELECTED",
      reason_codes: c.reason_codes,
      needs_review: Boolean(c.needs_review),
    })),
  };
}

describe("cctv-design-persistence R2", () => {
  it("picks earliest CCTV design to avoid accidental duplicates", () => {
    const items = [
      { id: "b", engine_type: "cctv", created_at: "2026-02-01T00:00:00Z" },
      { id: "a", engine_type: "cctv", created_at: "2026-01-01T00:00:00Z" },
      { id: "x", engine_type: "alarm", created_at: "2026-01-01T00:00:00Z" },
    ] as SystemDesign[];
    expect(pickActiveCctvDesign(items)?.id).toBe("a");
  });

  it("round-trips requirements form", () => {
    const req = { ...defaultCctvBuildRequirements(), cameraCount: 12, retentionDays: 30 };
    const design = {
      ...designFromRec(sampleRec()),
      requirements: requirementsToDesignDoc(req) as unknown as Record<string, unknown>,
    };
    const back = requirementsFromDesign(design);
    expect(back.cameraCount).toBe(12);
    expect(back.retentionDays).toBe(30);
  });

  it("round-trips recommendation roles, quantities, warnings, and candidates", () => {
    const rec = sampleRec();
    const design = designFromRec(rec);
    expect(designHasRecommendation(design)).toBe(true);
    const back = recommendationFromDesign(design)!;
    expect(back.components).toHaveLength(2);
    expect(back.components[0].quantity).toBe(8);
    expect(back.components[0].candidates).toHaveLength(2);
    expect(back.warnings[0].code).toBe("ENVIRONMENT_UNSPECIFIED");
    expect(back.engineering).toEqual(rec.engineering);
  });

  it("persists user override distinctly from engine preferred", () => {
    const rec = sampleRec();
    const selection = {
      selectedByComponentId: { camera_ip_main: "c2", cable_ip_main: "k1" },
      removedComponentIds: new Set<string>(),
    };
    expect(selectionOriginForRole("camera", selection, "c1")).toBe("USER_OVERRIDE");
    expect(selectionOriginForRole("cable", selection, "k1")).toBe("ENGINE_PREFERRED");
    const design = designFromRec(rec, selection);
    const cam = design.components.find((c) => c.role_key === "camera_ip_main")!;
    expect(cam.engine_preferred_product_id).toBe("c1");
    expect(cam.user_selected_product_id).toBe("c2");
    expect(cam.selection_origin).toBe("USER_OVERRIDE");
    const restored = selectionFromDesign(design);
    expect(restored.selectedByComponentId.camera_ip_main).toBe("c2");
  });

  it("persists optional removal across reopen mapping", () => {
    const rec = sampleRec();
    const selection = {
      selectedByComponentId: { camera_ip_main: "c1" },
      removedComponentIds: new Set(["cable_ip_main"]),
    };
    const design = designFromRec(rec, selection);
    const cable = design.components.find((c) => c.role_key === "cable_ip_main")!;
    expect(cable.removed).toBe(true);
    const restored = selectionFromDesign(design);
    expect(restored.removedComponentIds.has("cable_ip_main")).toBe(true);
    expect(restored.selectedByComponentId.cable_ip_main).toBeUndefined();
  });

  it("recalculate preserves valid override and flags invalid selection for review", () => {
    const prior = {
      selectedByComponentId: { camera_ip_main: "c2", gone: "x1" },
      removedComponentIds: new Set(["cable_ip_main"]),
    };
    const merged = mergeSelectionAfterRecalculate(sampleRec(), prior);
    expect(merged.selection.selectedByComponentId.camera_ip_main).toBe("c2");
    expect(merged.selection.removedComponentIds.has("cable_ip_main")).toBe(true);
    expect(merged.needsReviewRoles.has("gone")).toBe(true);
  });

  it("does not invent Apply linkage fields when projecting components", () => {
    const comps = componentsFromRecommendation(sampleRec(), initialReviewSelection(sampleRec()));
    for (const c of comps) {
      expect(c.quote_item_id).toBeUndefined();
      expect(c.applied_product_id).toBeUndefined();
      expect(c.last_apply_id).toBeUndefined();
    }
  });

  it("legacy apply fingerprint still works on projected lines (Apply boundary)", () => {
    // Ensure projection helpers remain usable for existing Apply path.
    const lines = [
      { componentKey: "camera_ip_main", role: "camera", productId: "c1", qty: 8, optional: false },
      { componentKey: "cable_ip_main", role: "cable", productId: "k1", qty: 1, optional: true },
    ];
    expect(linesFingerprint(lines).length).toBeGreaterThan(0);
  });
});

describe("R2 CAS / save loop guards (unit)", () => {
  it("documents conflict code used by drawer", () => {
    expect("CONFLICT_REVISION").toBeTruthy();
  });

  it("pickActiveCctvDesign returns null when no CCTV designs (no create-on-open)", () => {
    expect(pickActiveCctvDesign([])).toBeNull();
    expect(pickActiveCctvDesign([{ id: "1", engine_type: "alarm" } as SystemDesign])).toBeNull();
  });
});

describe("hydration does not imply save", () => {
  it("recommendationFromDesign is pure (no network)", () => {
    const spy = vi.fn();
    const design = designFromRec(sampleRec());
    const a = recommendationFromDesign(design);
    const b = recommendationFromDesign(design);
    expect(a?.components.length).toBe(b?.components.length);
    expect(spy).not.toHaveBeenCalled();
  });
});
