/**
 * SYSTEM-DESIGNER-1 Slice D — summary / readiness / validation tests A–K.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SystemRecommendation } from "@site-secure/api-client";
import { defaultCctvBuildRequirements } from "../src/lib/cctv-build-requirements";
import { applyTechnology, requirementsCalcFingerprint } from "../src/lib/cctv-designer-workspace";
import {
  buildCalculatedMetrics,
  buildLiveInputFacts,
  buildValidationCenter,
  deriveDesignerReadiness,
  explainabilityLines,
} from "../src/lib/cctv-designer-summary";
import { emptyReviewSelection } from "../src/lib/cctv-recommend-projection";
import { CctvEngineeringSummaryPanel } from "../src/components/quotes/cpq/CctvEngineeringSummaryPanel";

function fakeRec(partial: Partial<SystemRecommendation> = {}): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    status: "OK",
    blocking: false,
    input: { cameraCount: 6, cctvTechnology: "ip", retentionDays: 30 },
    engineering: {
      recorder: { selectedChannelTier: 8 },
      storage: { requiredTbWithOverhead: 4.2 },
      poe: { requiredPorts: 6, requiredBudgetW: 72 },
      poeArchitecture: { externalSwitchRequired: true, evaluation: "INSUFFICIENT_BUDGET" },
      hdd: { status: "ok", driveCount: 1, driveCapacityTb: 6 },
    },
    components: [
      {
        role: "recorder",
        component_key: "recorder_main",
        label: "recorder",
        quantity: 1,
        optional: false,
        editable: true,
        blocking: false,
        resolution_status: "RESOLVED",
        technical_requirements: { minChannels: 8 },
        candidates: [],
        reason_codes: [
          {
            code: "RECORDER_TECHNOLOGY_PATH",
            params: { technology: "ip", minChannels: 8, ipCameraCount: 6, analogCameraCount: 0 },
          },
          {
            code: "RECORDER_TIER_SELECTED",
            params: { cameraCount: 6, selectedChannelTier: 8, expansionHeadroom: 0.2, effectiveCameras: 8 },
          },
          { code: "EXTERNAL_SWITCH_REQUIRED", params: { technology: "ip" } },
        ],
      },
      {
        role: "storage",
        component_key: "storage_main",
        label: "storage",
        quantity: 1,
        optional: false,
        editable: true,
        blocking: false,
        resolution_status: "RESOLVED",
        technical_requirements: { requiredTb: 4.2 },
        candidates: [],
        reason_codes: [{ code: "ROLE_STORAGE_FROM_RETENTION", params: { requiredTb: 4.2 } }],
      },
    ],
    warnings: [],
    assumptions: [{ code: "STORAGE_BITRATE_DEFAULTED", params: {} }],
    unresolved: [],
    ...partial,
  } as SystemRecommendation;
}

describe("SYSTEM-DESIGNER-1 Slice D summary", () => {
  it("A. IP fresh calc summary shows server metrics including PoE", () => {
    const req = defaultCctvBuildRequirements();
    const rec = fakeRec();
    const metrics = buildCalculatedMetrics(rec, "ip");
    expect(metrics.some((m) => m.id === "recorder")).toBe(true);
    expect(metrics.some((m) => m.id === "storage")).toBe(true);
    expect(metrics.some((m) => m.id === "poe")).toBe(true);
    expect(metrics.find((m) => m.id === "storage")?.value).toContain("4.2");

    render(
      <CctvEngineeringSummaryPanel
        req={req}
        recommendation={rec}
        calcState="fresh"
        readiness="ready_for_quote"
        persistState="saved"
        stale={false}
      />,
    );
    const calc = screen.getByTestId("cctv-calculated-metrics");
    expect(calc).toHaveAttribute("data-fresh", "true");
    expect(calc.textContent).toMatch(/PoE/);
  });

  it("B. Analog summary without PoE metrics", () => {
    const req = applyTechnology(defaultCctvBuildRequirements(), "analog_hd");
    const rec = fakeRec({
      input: { cameraCount: 4, cctvTechnology: "analog_hd" },
      engineering: {
        recorder: { selectedChannelTier: 4 },
        storage: { requiredTbWithOverhead: 2.1 },
        poe: { requiredPorts: 0, requiredBudgetW: 0 },
        poeArchitecture: { evaluation: "NOT_APPLICABLE", externalSwitchRequired: false },
      },
    });
    const metrics = buildCalculatedMetrics(rec, "analog_hd");
    expect(metrics.some((m) => m.id === "poe")).toBe(false);
    expect(metrics.some((m) => m.id === "cable_analog")).toBe(true);
    expect(metrics.some((m) => m.id === "psu")).toBe(true);
    const facts = buildLiveInputFacts(req);
    expect(facts.some((f) => f.id === "cameras")).toBe(true);
  });

  it("C. Hybrid split summary facts + dual cable metrics", () => {
    const req = {
      ...applyTechnology(defaultCctvBuildRequirements(), "hybrid"),
      ipCameraCount: 4,
      analogCameraCount: 4,
      cameraCount: 8,
    };
    const facts = buildLiveInputFacts(req);
    expect(facts.find((f) => f.id === "ip")?.value).toBe("4");
    expect(facts.find((f) => f.id === "analog")?.value).toBe("4");
    const rec = fakeRec({
      input: { cameraCount: 8, cctvTechnology: "hybrid", ipCameraCount: 4, analogCameraCount: 4 },
      components: [
        {
          role: "recorder",
          component_key: "recorder_main",
          label: "recorder",
          quantity: 1,
          optional: false,
          editable: true,
          blocking: false,
          resolution_status: "RESOLVED",
          technical_requirements: {},
          candidates: [],
          reason_codes: [
            {
              code: "RECORDER_TECHNOLOGY_PATH",
              params: { technology: "hybrid", minChannels: 8, ipCameraCount: 4, analogCameraCount: 4 },
            },
          ],
        },
      ],
    } as Partial<SystemRecommendation>);
    const metrics = buildCalculatedMetrics(rec, "hybrid");
    expect(metrics.some((m) => m.id === "cable_ip")).toBe(true);
    expect(metrics.some((m) => m.id === "cable_analog")).toBe(true);
    const explain = explainabilityLines(rec);
    expect(explain.some((l) => l.includes("Hybrid") && l.includes("4"))).toBe(true);
  });

  it("D. stale after edit — metrics marked not fresh", () => {
    const req = defaultCctvBuildRequirements();
    const rec = fakeRec();
    render(
      <CctvEngineeringSummaryPanel
        req={{ ...req, cameraCount: 9, ipCameraCount: 9 }}
        recommendation={rec}
        calcState="stale"
        readiness="calc_required"
        persistState="dirty"
        stale
      />,
    );
    expect(screen.getByTestId("cctv-sum-stale")).toBeInTheDocument();
    expect(screen.getByTestId("cctv-calculated-metrics")).toHaveAttribute("data-fresh", "false");
  });

  it("E. recalc clears stale via fingerprint match", () => {
    const req = defaultCctvBuildRequirements();
    const fp = requirementsCalcFingerprint(req);
    expect(requirementsCalcFingerprint(req)).toBe(fp);
    expect(requirementsCalcFingerprint({ ...req, retentionDays: 45 })).not.toBe(fp);
  });

  it("F. blocker state from hybrid split", () => {
    const req = {
      ...defaultCctvBuildRequirements(),
      cctvTechnology: "hybrid" as const,
      cameraCount: 8,
      ipCameraCount: 5,
      analogCameraCount: 2,
    };
    const items = buildValidationCenter({ req, calcState: "draft", recommendation: null });
    expect(items.some((i) => i.severity === "blocker" && i.code === "hybridSplit")).toBe(true);
    expect(
      deriveDesignerReadiness({
        req,
        calcState: "draft",
        recommendation: null,
        selection: emptyReviewSelection(),
        appliedOnce: false,
      }),
    ).toBe("needs_info");
  });

  it("G. warning state for missing cable", () => {
    const req = { ...defaultCctvBuildRequirements(), cableDistanceMeters: "" };
    const items = buildValidationCenter({ req, calcState: "draft", recommendation: null });
    expect(items.some((i) => i.severity === "warning" && i.code === "CABLE_DISTANCE_UNRESOLVED")).toBe(
      true,
    );
  });

  it("H. info state from assumptions / explainability", () => {
    const rec = fakeRec();
    const items = buildValidationCenter({
      req: defaultCctvBuildRequirements(),
      calcState: "fresh",
      recommendation: rec,
    });
    expect(items.some((i) => i.severity === "info")).toBe(true);
    expect(explainabilityLines(rec).length).toBeGreaterThan(0);
  });

  it("I. readiness transitions", () => {
    const req = defaultCctvBuildRequirements();
    const selection = emptyReviewSelection();
    expect(
      deriveDesignerReadiness({
        req,
        calcState: "draft",
        recommendation: null,
        selection,
        appliedOnce: false,
      }),
    ).toBe("planning_draft");

    expect(
      deriveDesignerReadiness({
        req,
        calcState: "stale",
        recommendation: fakeRec(),
        selection,
        appliedOnce: false,
      }),
    ).toBe("calc_required");

    const blocking = fakeRec({
      blocking: true,
      components: [
        {
          role: "recorder",
          component_key: "recorder_main",
          label: "recorder",
          quantity: 1,
          optional: false,
          editable: true,
          blocking: true,
          resolution_status: "UNRESOLVED",
          technical_requirements: {},
          candidates: [],
          reason_codes: [],
        },
      ],
    } as Partial<SystemRecommendation>);
    expect(
      deriveDesignerReadiness({
        req,
        calcState: "fresh",
        recommendation: blocking,
        selection,
        appliedOnce: false,
      }),
    ).toBe("equipment_partial");

    expect(
      deriveDesignerReadiness({
        req,
        calcState: "fresh",
        recommendation: fakeRec(),
        selection,
        appliedOnce: true,
      }),
    ).toBe("added_to_quote");
  });

  it("J. save state vs calc state are independent labels", () => {
    render(
      <CctvEngineeringSummaryPanel
        req={defaultCctvBuildRequirements()}
        recommendation={fakeRec()}
        calcState="stale"
        readiness="calc_required"
        persistState="saved"
        stale
      />,
    );
    const root = screen.getByTestId("cctv-engineering-summary");
    expect(root).toHaveAttribute("data-calc", "stale");
    expect(root).toHaveAttribute("data-persist", "saved");
    expect(root.textContent).toMatch(/נשמר/);
    expect(root.textContent).toMatch(/לא חושבו/);
  });

  it("K. mobile summary behavior — collapsible toggle present", async () => {
    const user = userEvent.setup();
    render(
      <CctvEngineeringSummaryPanel
        req={defaultCctvBuildRequirements()}
        recommendation={null}
        calcState="draft"
        readiness="planning_draft"
        persistState="idle"
        stale={false}
        collapsedDefault
      />,
    );
    const toggle = screen.getByRole("button", { name: "הרחב" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "צמצם" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("cctv-validation-center")).toBeInTheDocument();
  });
});
