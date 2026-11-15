import type { SystemRecommendation } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import { LABOR_MINUTES, laborHours, laborLineName, normalizeLaborRate } from "../src/lib/cctv-labor";
import { canAddRecommendationToQuote, emptyReviewSelection } from "../src/lib/cctv-recommend-projection";

function service(key: string, role: string, quantity: number) {
  return {
    role,
    component_key: key,
    label: role,
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
    input: { cameraCount: 6, cctvTechnology: "ip" },
    engineering: {},
    unresolved: [],
    components: [
      service("installation_camera", "camera_install", 6),
      service("recorder_setup_main", "recorder_setup", 1),
      service("testing_main", "testing", 1),
    ],
  } as unknown as SystemRecommendation;
}

describe("Q2.6 service durations", () => {
  it("uses 45 min per camera, 30 min recorder setup, 30 min testing", () => {
    expect(LABOR_MINUTES.installation_camera.minutes).toBe(45);
    expect(LABOR_MINUTES.recorder_setup_main.minutes).toBe(30);
    expect(LABOR_MINUTES.testing_main.minutes).toBe(30);
    expect(laborHours("installation_camera", 6)).toBe(4.5);
    expect(laborHours("recorder_setup_main", 1)).toBe(0.5);
    expect(laborHours("testing_main", 3)).toBe(0.5); // not per unit
    expect(laborHours("camera_ip_main", 4)).toBeNull();
  });

  it("names the line with hours and rate", () => {
    expect(laborLineName("installation_camera", 4.5, 250)).toBe("התקנת מצלמות · 4.5 שעות × ₪250");
    expect(laborLineName("recorder_setup_main", 0.5, null)).toBe("הגדרת מקליט · 0.5 שעות");
  });

  it("accepts only a positive rate up to 10,000 (no default)", () => {
    expect(normalizeLaborRate("250")).toBe(250);
    expect(normalizeLaborRate("199,9")).toBe(199.9);
    for (const bad of ["", "0", "-5", "abc", 20000, null, undefined]) expect(normalizeLaborRate(bad)).toBeNull();
  });
});

describe("Q2.6 services become hours × rate lines without a catalog item", () => {
  it("with a rate: hours as quantity, the rate as unit price", () => {
    const gate = canAddRecommendationToQuote(rec(), emptyReviewSelection(), { laborRate: 250 });
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    const byKey = Object.fromEntries(gate.planned.map((p) => [p.componentKey, p]));
    expect(byKey.installation_camera).toMatchObject({ qty: 4.5, unitPrice: 250, labor: { hours: 4.5, rate: 250 } });
    expect(byKey.recorder_setup_main).toMatchObject({ qty: 0.5, unitPrice: 250 });
    expect(byKey.testing_main).toMatchObject({ qty: 0.5, unitPrice: 250 });
    expect(gate.unpricedLabor).toBe(false);
  });

  it("without a rate: lines are added unpriced and the gate says so", () => {
    const gate = canAddRecommendationToQuote(rec(), emptyReviewSelection(), {});
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.planned.every((p) => p.unitPrice === 0)).toBe(true);
    expect(gate.planned).toHaveLength(3);
    expect(gate.unpricedLabor).toBe(true);
  });

  it("a removed service is not added", () => {
    const selection = { ...emptyReviewSelection(), removedComponentIds: new Set(["testing_main"]) };
    const gate = canAddRecommendationToQuote(rec(), selection, { laborRate: 250 });
    expect(gate.ok && gate.planned.map((p) => p.componentKey)).not.toContain("testing_main");
  });
});
