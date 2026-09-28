import { describe, expect, it } from "vitest";
import type { CctvRecommendationComponent, SystemRecommendation } from "@site-secure/api-client";
import {
  applyEligibilityPresentation,
  classifyWarningCode,
  classifyWarnings,
  countPendingEquipment,
  deriveEngineeringStatus,
  equipmentResolutionForComponent,
  formatRequirementChips,
  isServiceRole,
  partitionEquipmentAndServices,
} from "../src/lib/cctv-equipment-intent-e1";
import { formatReasonHe } from "../src/lib/cctv-recommend-copy";
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
      hdd: { status: "ok", driveCount: null, driveCapacityTb: null },
    },
    components: [
      baseComponent({
        role: "camera",
        quantity: 4,
        technical_requirements: { resolutionMp: 8, environment: "outdoor", formFactor: "turret", poeRequired: true },
        reason_codes: [{ code: "COMPONENT_UNRESOLVED", params: { role: "camera" } }],
      }),
      baseComponent({
        role: "recorder",
        technical_requirements: { minChannels: 4 },
        reason_codes: [{ code: "COMPONENT_UNRESOLVED", params: { role: "recorder" } }],
      }),
      baseComponent({
        role: "storage",
        technical_requirements: { requiredTb: 2.9 },
        reason_codes: [{ code: "HDD_OPTIONS_EMPTY", params: { requiredTb: 2.9 } }],
      }),
      baseComponent({
        role: "poe_switch",
        technical_requirements: { minPoePorts: 4, minBudgetW: 40 },
        reason_codes: [{ code: "EXTERNAL_SWITCH_REQUIRED", params: {} }],
      }),
      baseComponent({
        role: "cable",
        optional: true,
        blocking: false,
        reason_codes: [{ code: "CABLE_DISTANCE_UNRESOLVED", params: {} }],
      }),
      baseComponent({
        role: "camera_install",
        optional: true,
        blocking: false,
        resolution_status: "UNRESOLVED",
      }),
      baseComponent({
        role: "testing",
        optional: true,
        blocking: false,
      }),
    ],
    warnings: [
      { code: "CATALOG_EMPTY", params: {} },
      { code: "HDD_OPTIONS_EMPTY", params: { requiredTb: 2.9 } },
    ],
    assumptions: [{ code: "CABLE_DISTANCE_UNRESOLVED", params: {} }],
    unresolved: [],
    blocking: true,
    status: "BLOCKED",
    catalog_readiness: { empty_catalog: true, ready_for_core: false },
  };
}

function resolvedRec(): SystemRecommendation {
  const empty = emptyCatalogRec();
  return {
    ...empty,
    blocking: false,
    status: "OK",
    catalog_readiness: { empty_catalog: false, ready_for_core: true },
    components: empty.components.map((c) => {
      if (isServiceRole(c.role) || c.role === "cable") return c;
      return {
        ...c,
        selected_product: { id: `${c.role}-p`, name: `${c.role} product`, manufacturer: "Hikvision", model: "DS-X" },
        selected_confidence: "STRUCTURED" as const,
        selected_compatibility: { channels: "PASS", capacity_tb: "PASS", ports: "PASS", resolution_mp: "PASS" },
        candidates: [
          {
            product: { id: `${c.role}-p`, name: `${c.role} product`, manufacturer: "Hikvision", model: "DS-X" },
            confidence: "STRUCTURED" as const,
            compatibility: { channels: "PASS" },
          },
        ],
        resolution_status: "RESOLVED" as const,
        blocking: false,
        reason_codes: [],
      };
    }),
  };
}

describe("E1 engineering vs equipment resolution", () => {
  it("marks engineering complete with empty catalog / BLOCKED status", () => {
    const rec = emptyCatalogRec();
    expect(deriveEngineeringStatus(rec)).toBe("ENGINEERING_COMPLETE");
    expect(rec.status).toBe("BLOCKED");
  });

  it("marks engineering incomplete on INVALID_INPUT", () => {
    expect(
      deriveEngineeringStatus({
        ...emptyCatalogRec(),
        status: "INVALID_INPUT",
        engineering: {},
      }),
    ).toBe("ENGINEERING_INCOMPLETE");
  });

  it("treats empty catalog components as REQUIREMENT_READY not failure", () => {
    const rec = emptyCatalogRec();
    const selection = initialReviewSelection(rec);
    const camera = rec.components.find((c) => c.role === "camera")!;
    expect(equipmentResolutionForComponent(camera, selection)).toBe("REQUIREMENT_READY");
    expect(countPendingEquipment(rec, selection)).toBeGreaterThanOrEqual(4);
  });

  it("marks catalog-resolved components", () => {
    const rec = resolvedRec();
    const selection = initialReviewSelection(rec);
    const camera = rec.components.find((c) => c.role === "camera")!;
    expect(equipmentResolutionForComponent(camera, selection)).toBe("CATALOG_RESOLVED");
    expect(countPendingEquipment(rec, selection)).toBe(0);
  });

  it("classifies engineering vs catalog warnings", () => {
    expect(classifyWarningCode("CABLE_DISTANCE_UNRESOLVED")).toBe("ENGINEERING");
    expect(classifyWarningCode("CATALOG_EMPTY")).toBe("CATALOG");
    expect(classifyWarningCode("HDD_OPTIONS_EMPTY")).toBe("CATALOG");
    expect(classifyWarningCode("CAMERA_ENVIRONMENT_UNVERIFIED")).toBe("COMPATIBILITY");
    const classified = classifyWarnings([
      { code: "CABLE_DISTANCE_UNRESOLVED", params: {} },
      { code: "HDD_OPTIONS_EMPTY", params: { requiredTb: 2.9 } },
    ]);
    expect(classified.map((c) => c.class)).toEqual(["ENGINEERING", "CATALOG"]);
  });

  it("does not render HDD_OPTIONS_EMPTY as english debug text", () => {
    const text = formatReasonHe({ code: "HDD_OPTIONS_EMPTY", params: { requiredTb: 2.9 } });
    expect(text.toLowerCase()).not.toContain("hdd options empty");
    expect(text).toContain("2.9");
    expect(text).toMatch(/קטלוג|אחסון/);
  });

  it("shows storage / PoE requirement chips without catalog product", () => {
    const storage = baseComponent({
      role: "storage",
      technical_requirements: { requiredTb: 2.9 },
    });
    const poe = baseComponent({
      role: "poe_switch",
      technical_requirements: { minPoePorts: 4, minBudgetW: 48 },
    });
    expect(formatRequirementChips(storage).join(" ")).toContain("2.9");
    expect(formatRequirementChips(poe).join(" ")).toMatch(/PoE|פורטים/);
  });

  it("separates services from physical equipment", () => {
    const { equipment, services } = partitionEquipmentAndServices(emptyCatalogRec().components);
    expect(equipment.every((c) => !isServiceRole(c.role))).toBe(true);
    expect(services.map((c) => c.role).sort()).toEqual(["camera_install", "testing"]);
  });

  it("keeps Apply gate unchanged for empty catalog", () => {
    const rec = emptyCatalogRec();
    const selection = initialReviewSelection(rec);
    const gate = canAddRecommendationToQuote(rec, selection);
    expect(gate).toEqual({ ok: false, reason: "empty" });
    const presentation = applyEligibilityPresentation(rec, selection, gate);
    expect(presentation.engineeringComplete).toBe(true);
    expect(presentation.gateOk).toBe(false);
    expect(presentation.pendingEquipmentCount).toBeGreaterThan(0);
  });

  it("keeps Apply gate unchanged for partial catalog", () => {
    const rec = emptyCatalogRec();
    rec.components = rec.components.map((c) =>
      c.role === "camera"
        ? {
            ...c,
            selected_product: { id: "cam1", name: "Cam" },
            selected_confidence: "STRUCTURED",
            candidates: [
              {
                product: { id: "cam1", name: "Cam" },
                confidence: "STRUCTURED",
                compatibility: { resolution_mp: "PASS" },
              },
            ],
            resolution_status: "RESOLVED",
            blocking: false,
          }
        : c,
    );
    const selection = initialReviewSelection(rec);
    const gate = canAddRecommendationToQuote(rec, selection);
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.incomplete).toBe(true);
      expect(gate.lines.map((l) => l.role)).toEqual(["camera"]);
      expect(gate.lines.every((l) => Boolean(l.productId))).toBe(true);
    }
  });

  it("never invents product ids for unresolved equipment", () => {
    const rec = emptyCatalogRec();
    const selection = initialReviewSelection(rec);
    const gate = canAddRecommendationToQuote(rec, selection);
    expect(gate.ok).toBe(false);
  });
});
