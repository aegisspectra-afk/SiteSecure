/**
 * SYSTEM-DESIGNER-1 Slice A — commercial quote descriptions + component_key linkage.
 */
import { describe, expect, it } from "vitest";
import type { SystemDesign, SystemRecommendation } from "@site-secure/api-client";
import {
  CCTV_COMPONENT_KEYS,
  commercialLabelHe,
  componentKeyOf,
  normalizeComponentKey,
  plannedPackageNameFor,
} from "../src/lib/cctv-component-keys";
import {
  canAddRecommendationToQuote,
  engineeringRequirementForPlannedItem,
  initialReviewSelection,
  plannedLineFromComponent,
} from "../src/lib/cctv-recommend-projection";
import { componentsFromRecommendation } from "../src/lib/cctv-design-persistence";

function unresolvedPoe(): SystemRecommendation["components"][number] {
  return {
    role: "poe_switch",
    label: "poe_switch",
    quantity: 1,
    technical_requirements: { minPoePorts: 8, minPoeBudgetW: 120 },
    selected_product: null,
    selected_confidence: null,
    candidates: [],
    reason_codes: [{ code: "EXTERNAL_SWITCH_REQUIRED", params: {} }],
    optional: false,
    editable: true,
    blocking: true,
    resolution_status: "UNRESOLVED",
  };
}

describe("SYSTEM-DESIGNER-1A commercial planned lines", () => {
  it("uses clean commercial name/description without status · name · eng concat", () => {
    const line = plannedLineFromComponent(unresolvedPoe());
    expect(line.name).toBe("מתג PoE");
    expect(line.description).toBe("מתג PoE");
    expect(line.description).not.toContain("נדרש ציוד");
    expect(line.description).not.toMatch(/·/);
    expect(line.engineeringRequirement).toMatch(/8/);
    expect(line.engineeringRequirement).toMatch(/120/);
    expect(line.package_name).toBe(plannedPackageNameFor(CCTV_COMPONENT_KEYS.poeSwitch));
    expect(line.componentKey).toBe(CCTV_COMPONENT_KEYS.poeSwitch);
  });

  it("maps legacy roles to stable component keys", () => {
    expect(normalizeComponentKey("camera")).toBe(CCTV_COMPONENT_KEYS.cameraIp);
    expect(normalizeComponentKey("storage")).toBe(CCTV_COMPONENT_KEYS.storage);
    expect(normalizeComponentKey("recorder")).toBe(CCTV_COMPONENT_KEYS.recorder);
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.cameraIp)).toBe("מצלמת IP");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.storage)).toBe("כונן HDD");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.recorder)).toBe("NVR");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.recorder, { technology: "analog_hd" })).toBe("DVR");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.cameraAnalog)).toBe("מצלמה אנלוגית");
  });

  it("gates planned lines with component_key package linkage", () => {
    const rec: SystemRecommendation = {
      system_type: "cctv",
      engine_version: 1,
      input: {},
      engineering: {},
      components: [unresolvedPoe()],
      warnings: [],
      assumptions: [],
      unresolved: [],
      blocking: true,
      status: "BLOCKED",
    };
    const gate = canAddRecommendationToQuote(rec, initialReviewSelection(rec));
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.planned).toHaveLength(1);
    expect(gate.planned[0]!.description).toBe("מתג PoE");
    expect(gate.planned[0]!.name).toBe("מתג PoE");
    expect(gate.planned.every((p) => p.package_name.startsWith("cctv-planned:"))).toBe(true);
    expect(gate.planned.every((p) => !p.description.includes("נדרש ציוד"))).toBe(true);
  });

  it("hydrates engineering requirement from Design via package_name component_key", () => {
    const rec: SystemRecommendation = {
      system_type: "cctv",
      engine_version: 1,
      input: {},
      engineering: {},
      components: [unresolvedPoe()],
      warnings: [],
      assumptions: [],
      unresolved: [],
      blocking: true,
      status: "BLOCKED",
    };
    const comps = componentsFromRecommendation(rec, initialReviewSelection(rec));
    expect(comps[0]!.role_key).toBe(CCTV_COMPONENT_KEYS.poeSwitch);
    const design: SystemDesign = {
      id: "d1",
      workspace_id: "w1",
      quote_id: "q1",
      engine_type: "cctv",
      engine_version: 1,
      lifecycle_status: "calculated",
      requirements: {},
      revision: 1,
      components: comps.map((c, i) => ({
        id: `cid-${i}`,
        workspace_id: "w1",
        design_id: "d1",
        role_key: c.role_key,
        label: c.label || c.role_key,
        quantity: c.quantity ?? 1,
        optional: Boolean(c.optional),
        blocking: Boolean(c.blocking),
        removed: Boolean(c.removed),
        technical_requirements: c.technical_requirements as Record<string, unknown>,
        selection_origin: c.selection_origin || "UNSELECTED",
        needs_review: Boolean(c.needs_review),
      })),
    };
    const eng = engineeringRequirementForPlannedItem(design, {
      package_name: plannedPackageNameFor(CCTV_COMPONENT_KEYS.poeSwitch),
    });
    expect(eng).toBeTruthy();
    expect(eng).toMatch(/8/);
    expect(componentKeyOf({ role: "poe_switch" })).toBe(CCTV_COMPONENT_KEYS.poeSwitch);
  });
});
