import type { SystemRecommendation } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import {
  canAddRecommendationToQuote,
  emptyReviewSelection,
  isCctvPlannedQuoteItem,
} from "../src/lib/cctv-recommend-projection";

function service(key: string, quantity: number) {
  return {
    role: key,
    component_key: key,
    label: key,
    quantity,
    optional: false,
    editable: true,
    blocking: false,
    resolution_status: "UNRESOLVED",
    technical_requirements: {},
    candidates: [],
    reason_codes: [],
  };
}

function rec(): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    status: "OK",
    blocking: false,
    input: { cameraCount: 4, cctvTechnology: "ip" },
    engineering: {},
    unresolved: [],
    components: [service("installation_camera", 4), service("recorder_setup_main", 1), service("testing_main", 1)],
  } as unknown as SystemRecommendation;
}

describe("DEMO-2.2 labor lines are work, not missing equipment", () => {
  it("builds labor lines as item_type labor under cctv-labor:", () => {
    const gate = canAddRecommendationToQuote(rec(), emptyReviewSelection(), { laborRate: 250 });
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.planned).toHaveLength(3);
    for (const line of gate.planned) {
      expect(line.itemType).toBe("labor");
      expect(line.unitPrice).toBe(250);
      expect(line.package_name?.startsWith("cctv-labor:")).toBe(true);
      expect(isCctvPlannedQuoteItem({ package_name: line.package_name, description: line.description })).toBe(false);
    }
  });

  it("an older priced labor line is not shown as missing equipment; an unpriced equipment line is", () => {
    expect(
      isCctvPlannedQuoteItem({ package_name: "cctv-planned:installation_camera", description: "התקנת מצלמות", unit_price: 250 }),
    ).toBe(false);
    expect(isCctvPlannedQuoteItem({ package_name: "cctv-planned:recorder_main", description: "מקליט", unit_price: 0 })).toBe(true);
  });
});

describe("DEMO-2.2 review screen", () => {
  it("labor components are not 'needs equipment' and are not counted as required", async () => {
    const { buildApplyReadinessPreview, deriveReviewCardStatus, reviewStatusLabelHe } = await import(
      "../src/lib/cctv-designer-review"
    );
    const r = rec();
    const status = deriveReviewCardStatus(r.components[0]!, null, false);
    expect(status).toBe("labor");
    expect(reviewStatusLabelHe(status)).not.toContain("נדרש ציוד");
    const preview = buildApplyReadinessPreview(r, emptyReviewSelection());
    expect(preview.required).toBe(0);
    expect(preview.needsEquipment).toBe(0);
  });
});
