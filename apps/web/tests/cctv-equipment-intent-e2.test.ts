/**
 * E2 — Durable Equipment Intent persistence + resolution states.
 */
import { describe, expect, it } from "vitest";
import type {
  CctvRecommendationComponent,
  EquipmentIntent,
  SystemDesign,
  SystemRecommendation,
} from "@site-secure/api-client";
import {
  countPendingEquipment,
  equipmentResolutionForComponent,
  hasIntentOnlyEquipment,
  isServiceRole,
} from "../src/lib/cctv-equipment-intent-e1";
import {
  deriveSelectionKind,
  hasEquipmentIntent,
  manufacturerSuggestionsFromCandidates,
  normalizeEquipmentIntent,
} from "../src/lib/cctv-equipment-intent-e2";
import {
  componentsFromRecommendation,
  intentFromDesign,
  mergeIntentAfterRecalculate,
  recommendationFromDesign,
  selectionFromDesign,
  techByRoleFromRecommendation,
} from "../src/lib/cctv-design-persistence";
import {
  canAddRecommendationToQuote,
  initialReviewSelection,
} from "../src/lib/cctv-recommend-projection";

function baseComponent(
  partial: Partial<CctvRecommendationComponent> & Pick<CctvRecommendationComponent, "role">,
): CctvRecommendationComponent {
  return {
    label: partial.role,
    quantity: 1,
    technical_requirements: {},
    selected_product: null,
    selected_confidence: null,
    candidates: [],
    reason_codes: [],
    optional: false,
    editable: true,
    blocking: true,
    resolution_status: "UNRESOLVED",
    ...partial,
  };
}

function emptyCatalogRec(): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    input: { cameraCount: 4 },
    engineering: {
      recorder: { selectedChannelTier: 4, effectiveCameras: 4 },
      storage: { requiredTbWithOverhead: 2.9 },
      poe: { requiredPorts: 4, requiredBudgetW: 40 },
      poeArchitecture: { externalSwitchRequired: true },
    },
    components: [
      baseComponent({
        role: "camera",
        quantity: 4,
        technical_requirements: {
          resolutionMp: 8,
          environment: "outdoor",
          formFactor: "turret",
          poeRequired: true,
        },
      }),
      baseComponent({
        role: "recorder",
        technical_requirements: { minChannels: 4 },
      }),
      baseComponent({
        role: "storage",
        technical_requirements: { requiredTb: 2.9 },
      }),
      baseComponent({
        role: "poe_switch",
        technical_requirements: { minPoePorts: 4, minBudgetW: 40 },
      }),
      baseComponent({
        role: "camera_install",
        optional: true,
        blocking: false,
      }),
    ],
    warnings: [{ code: "CATALOG_EMPTY", params: {} }],
    assumptions: [],
    unresolved: [],
    blocking: true,
    status: "BLOCKED",
    catalog_readiness: { empty_catalog: true, ready_for_core: false },
  };
}

function designWithComponents(
  rec: SystemRecommendation,
  selection = initialReviewSelection(rec),
  intentByRole: Record<string, EquipmentIntent | null> = {},
  needsReview = new Set<string>(),
): SystemDesign {
  const comps = componentsFromRecommendation(rec, selection, needsReview, intentByRole);
  return {
    id: "d1",
    workspace_id: "w1",
    quote_id: "q1",
    engine_type: "cctv",
    engine_version: 1,
    lifecycle_status: "calculated",
    requirements: {},
    engineering_result: rec.engineering,
    recommendation_meta: { status: rec.status, blocking: rec.blocking },
    revision: 1,
    components: comps.map((c, i) => ({
      id: `c${i}`,
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
      equipment_intent: c.equipment_intent ?? null,
    })),
  };
}

describe("E2 Equipment Intent shape", () => {
  it("A — creates intent without product_id", () => {
    const rec = emptyCatalogRec();
    const selection = initialReviewSelection(rec);
    const comps = componentsFromRecommendation(rec, selection, new Set(), {
      camera: { manufacturer: "Hikvision" },
    });
    const camera = comps.find((c) => c.role_key === "camera")!;
    expect(camera.user_selected_product_id).toBeNull();
    expect(camera.equipment_intent?.manufacturer).toBe("Hikvision");
    expect((camera.equipment_intent as { product_id?: string } | null)?.product_id).toBeUndefined();
  });

  it("B/C — manufacturer and model are optional", () => {
    expect(hasEquipmentIntent({ manufacturer: "Hikvision" })).toBe(true);
    expect(hasEquipmentIntent({ model_reference: "DS-2CD" })).toBe(true);
    expect(hasEquipmentIntent({})).toBe(false);
    expect(normalizeEquipmentIntent({ manufacturer: "  ", model_reference: "" })).toBeNull();
  });

  it("D — free-text manufacturer persists", () => {
    const intent = normalizeEquipmentIntent({ manufacturer: "Acme-Custom-IL" });
    expect(intent?.manufacturer).toBe("Acme-Custom-IL");
  });

  it("E — catalog manufacturer suggestions do not restrict free text", () => {
    const suggestions = manufacturerSuggestionsFromCandidates(["Hikvision", "hikvision", "Dahua", ""]);
    expect(suggestions).toEqual(["Dahua", "Hikvision"]);
    const free = normalizeEquipmentIntent({ manufacturer: "BrandNotInCatalog" });
    expect(free?.manufacturer).toBe("BrandNotInCatalog");
    expect(suggestions.includes("BrandNotInCatalog")).toBe(false);
  });

  it("O — no fake product_id is created", () => {
    const n = normalizeEquipmentIntent({
      manufacturer: "Hikvision",
      model_reference: "DS-X",
      selected_attributes: { product_id: "fake2", sku: "SKU1", resolution: "8MP" },
    } as EquipmentIntent);
    expect(n).toEqual({
      manufacturer: "Hikvision",
      model_reference: "DS-X",
      selected_attributes: { resolution: "8MP" },
    });
  });

  it("P — no price/cost persisted in intent", () => {
    const n = normalizeEquipmentIntent({
      manufacturer: "Hikvision",
      selected_attributes: {
        cost: 100,
        list_price: 200,
        unit_price: 150,
        margin: 0.3,
        formFactor: "turret",
      },
    });
    expect(n?.selected_attributes).toEqual({ formFactor: "turret" });
    expect(JSON.stringify(n)).not.toMatch(/cost|list_price|unit_price|margin/);
  });
});

describe("E2 resolution states", () => {
  it("G — EQUIPMENT_SPECIFIED derives correctly", () => {
    const rec = emptyCatalogRec();
    const selection = initialReviewSelection(rec);
    const camera = rec.components.find((c) => c.role === "camera")!;
    expect(
      equipmentResolutionForComponent(camera, selection, {
        equipmentIntent: { manufacturer: "Hikvision" },
      }),
    ).toBe("EQUIPMENT_SPECIFIED");
    expect(deriveSelectionKind(null, { manufacturer: "Hikvision" })).toBe("intent");
  });

  it("H — catalog selection derives CATALOG_RESOLVED", () => {
    const rec = emptyCatalogRec();
    const camera = rec.components.find((c) => c.role === "camera")!;
    camera.candidates = [
      {
        product: { id: "p1", name: "Cam", manufacturer: "Hikvision", model: "DS" },
        confidence: "STRUCTURED",
        compatibility: {},
      },
    ];
    camera.selected_product = camera.candidates[0]!.product;
    const selection = { selectedByComponentId: { camera_ip_main: "p1" }, removedComponentIds: new Set<string>() };
    expect(equipmentResolutionForComponent(camera, selection)).toBe("CATALOG_RESOLVED");
    expect(deriveSelectionKind("p1", { manufacturer: "ignored" })).toBe("catalog");
  });

  it("I — requirement-only remains REQUIREMENT_READY", () => {
    const rec = emptyCatalogRec();
    const selection = initialReviewSelection(rec);
    const camera = rec.components.find((c) => c.role === "camera")!;
    expect(equipmentResolutionForComponent(camera, selection)).toBe("REQUIREMENT_READY");
    expect(deriveSelectionKind(null, null)).toBe("unresolved");
  });

  it("J — needs_review remains distinct", () => {
    const rec = emptyCatalogRec();
    const selection = initialReviewSelection(rec);
    const camera = rec.components.find((c) => c.role === "camera")!;
    expect(
      equipmentResolutionForComponent(camera, selection, {
        needsReviewRoles: new Set(["camera"]),
        equipmentIntent: { manufacturer: "Hikvision" },
      }),
    ).toBe("NEEDS_REVIEW");
  });
});

describe("E2 hydration / transitions / recalc", () => {
  it("F — intent survives hydration/reopen", () => {
    const rec = emptyCatalogRec();
    const design = designWithComponents(rec, initialReviewSelection(rec), {
      camera: { manufacturer: "Hikvision", model_reference: "DS-XXXX" },
    });
    const hydrated = intentFromDesign(design);
    expect(hydrated.camera).toEqual({ manufacturer: "Hikvision", model_reference: "DS-XXXX" });
    const rebuilt = recommendationFromDesign(design);
    expect(rebuilt?.components.find((c) => c.role === "camera")?.technical_requirements).toEqual(
      rec.components.find((c) => c.role === "camera")?.technical_requirements,
    );
  });

  it("K — recalculate preserves still-valid intent", () => {
    const prior = emptyCatalogRec();
    const next = emptyCatalogRec();
    const priorTech = techByRoleFromRecommendation(prior);
    const merged = mergeIntentAfterRecalculate(
      next,
      { camera: { manufacturer: "Hikvision", model_reference: "DS-X" } },
      priorTech,
    );
    expect(merged.intentByRole.camera?.manufacturer).toBe("Hikvision");
    expect(merged.needsReviewRoles.has("camera")).toBe(false);
  });

  it("L — recalculate marks intent for review when requirement changes", () => {
    const prior = emptyCatalogRec();
    const next = emptyCatalogRec();
    const cam = next.components.find((c) => c.role === "camera")!;
    cam.technical_requirements = {
      ...cam.technical_requirements,
      resolutionMp: 12,
    };
    const merged = mergeIntentAfterRecalculate(
      next,
      { camera: { manufacturer: "Hikvision" } },
      techByRoleFromRecommendation(prior),
    );
    expect(merged.intentByRole.camera?.manufacturer).toBe("Hikvision");
    expect(merged.needsReviewRoles.has("camera")).toBe(true);
  });

  it("M — intent → catalog transition is explicit (catalog clears intent on persist)", () => {
    const rec = emptyCatalogRec();
    const camera = rec.components.find((c) => c.role === "camera")!;
    camera.candidates = [
      {
        product: { id: "p1", name: "Cam", manufacturer: "Hikvision" },
        confidence: "STRUCTURED",
        compatibility: {},
      },
    ];
    const selection = { selectedByComponentId: { camera_ip_main: "p1" }, removedComponentIds: new Set<string>() };
    const comps = componentsFromRecommendation(rec, selection, new Set(), {
      camera: { manufacturer: "Hikvision", model_reference: "old-intent" },
    });
    const row = comps.find((c) => c.role_key === "camera")!;
    expect(row.user_selected_product_id).toBe("p1");
    expect(row.equipment_intent).toBeNull();
  });

  it("N — catalog → intent transition is explicit (intent clears catalog on persist)", () => {
    const rec = emptyCatalogRec();
    const selection = { selectedByComponentId: {}, removedComponentIds: new Set<string>() };
    const comps = componentsFromRecommendation(rec, selection, new Set(), {
      camera: { manufacturer: "Dahua" },
    });
    const row = comps.find((c) => c.role_key === "camera")!;
    expect(row.user_selected_product_id).toBeNull();
    expect(row.equipment_intent?.manufacturer).toBe("Dahua");
    const design = designWithComponents(rec, selection, { camera: { manufacturer: "Dahua" } });
    expect(selectionFromDesign(design).selectedByComponentId.camera_ip_main).toBeUndefined();
    expect(intentFromDesign(design).camera?.manufacturer).toBe("Dahua");
  });

  it("Q — Apply allows planned free-lines for non-catalog intent (QUOTE-11)", () => {
    const rec = emptyCatalogRec();
    const selection = initialReviewSelection(rec);
    const intentByRole = { camera: { manufacturer: "Hikvision" } };
    expect(hasIntentOnlyEquipment(rec, selection, intentByRole)).toBe(true);
    const gate = canAddRecommendationToQuote(rec, selection);
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.planned.length).toBeGreaterThan(0);
      expect(gate.lines).toEqual([]);
    }
    expect(countPendingEquipment(rec, selection, { intentByRole })).toBeGreaterThan(0);
  });

  it("S — empty catalog + complete engineering + saved intent works", () => {
    const rec = emptyCatalogRec();
    const selection = initialReviewSelection(rec);
    const design = designWithComponents(rec, selection, {
      camera: { manufacturer: "Hikvision", model_reference: undefined },
    });
    const cameraRow = design.components.find((c) => c.role_key === "camera")!;
    expect(cameraRow.equipment_intent?.manufacturer).toBe("Hikvision");
    expect(cameraRow.user_selected_product_id).toBeNull();
    expect(equipmentResolutionForComponent(rec.components[0]!, selection, {
      equipmentIntent: cameraRow.equipment_intent,
    })).toBe("EQUIPMENT_SPECIFIED");
  });

  it("T — service/labor components do not receive Equipment Intent UI treatment", () => {
    expect(isServiceRole("camera_install")).toBe(true);
    expect(isServiceRole("testing")).toBe(true);
    expect(isServiceRole("camera")).toBe(false);
    const rec = emptyCatalogRec();
    const selection = initialReviewSelection(rec);
    // Pending count skips services even if somehow intent existed
    const withSvcIntent = countPendingEquipment(rec, selection, {
      intentByRole: { camera_install: { manufacturer: "LaborCo" } },
    });
    const without = countPendingEquipment(rec, selection);
    expect(withSvcIntent).toBe(without);
  });
});
