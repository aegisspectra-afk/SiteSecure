import { describe, expect, it } from "vitest";
import type { SystemRecommendation } from "@site-secure/api-client";
import {
  defaultCctvBuildRequirements,
  requirementsToRecommendBody,
  validateCctvBuildRequirements,
} from "../src/lib/cctv-build-requirements";
import { buildEngineeringSummary, formatReasonHe, groupComponents } from "../src/lib/cctv-recommend-copy";
import {
  canAddRecommendationToQuote,
  initialReviewSelection,
  isCandidateSelectable,
  linesFingerprint,
  remainingLinesAfterPartial,
} from "../src/lib/cctv-recommend-projection";

function sampleRec(partial: Partial<SystemRecommendation> = {}): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    input: { cameraCount: 12, expansionHeadroom: 0.2 },
    engineering: {
      recorder: { selectedChannelTier: 16, effectiveCameras: 15 },
      storage: { requiredTbWithOverhead: 18.6624 },
      poe: { requiredPorts: 12, requiredBudgetW: 115.2 },
      poeArchitecture: { externalSwitchRequired: true },
      hdd: { status: "ok", driveCount: 2, driveCapacityTb: 10 },
    },
    components: [
      {
        role: "camera",
        label: "camera",
        quantity: 12,
        technical_requirements: {},
        selected_product: { id: "c1", name: "Cam 4MP", attributes: { resolution_mp: 4 } },
        selected_confidence: "STRUCTURED",
        selected_compatibility: { resolution_mp: "PASS", environment: "PASS" },
        candidates: [
          {
            product: { id: "c1", name: "Cam 4MP" },
            confidence: "STRUCTURED",
            compatibility: { resolution_mp: "PASS" },
          },
          {
            product: { id: "c2", name: "Cam 8MP" },
            confidence: "STRUCTURED",
            compatibility: { resolution_mp: "PASS" },
          },
          {
            product: { id: "c-bad", name: "Indoor only" },
            confidence: "STRUCTURED",
            compatibility: { environment: "FAIL" },
          },
        ],
        reason_codes: [{ code: "ROLE_CAMERA_FROM_COUNT", params: { qty: 12 } }],
        optional: false,
        editable: true,
        blocking: false,
        resolution_status: "RESOLVED",
      },
      {
        role: "recorder",
        label: "recorder",
        quantity: 1,
        technical_requirements: {},
        selected_product: { id: "n1", name: "NVR 16" },
        selected_confidence: "STRUCTURED",
        selected_compatibility: { channels: "PASS" },
        candidates: [
          {
            product: { id: "n1", name: "NVR 16" },
            confidence: "STRUCTURED",
            compatibility: { channels: "PASS" },
          },
        ],
        reason_codes: [
          {
            code: "RECORDER_TIER_SELECTED",
            params: { cameraCount: 12, effectiveCameras: 15, selectedChannelTier: 16, expansionHeadroom: 0.2 },
          },
        ],
        optional: false,
        editable: true,
        blocking: false,
        resolution_status: "RESOLVED",
      },
      {
        role: "storage",
        label: "storage",
        quantity: 2,
        technical_requirements: {},
        selected_product: { id: "h1", name: "HDD 10TB" },
        selected_confidence: "STRUCTURED",
        candidates: [
          {
            product: { id: "h1", name: "HDD 10TB" },
            confidence: "STRUCTURED",
            compatibility: { capacity_tb: "PASS" },
          },
        ],
        reason_codes: [{ code: "HDD_STRUCTURED_MATCH", params: { capacityTb: 10, qty: 2 } }],
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
        selected_product: null,
        selected_confidence: null,
        candidates: [],
        reason_codes: [{ code: "CABLE_DISTANCE_UNRESOLVED", params: {} }],
        optional: true,
        editable: true,
        blocking: false,
        resolution_status: "UNRESOLVED",
      },
    ],
    warnings: [{ code: "STORAGE_BITRATE_DEFAULTED", params: {} }],
    assumptions: [],
    unresolved: [{ code: "CABLE_DISTANCE_UNRESOLVED", params: {} }],
    blocking: false,
    status: "OK",
    ...partial,
  };
}

describe("cctv build requirements", () => {
  it("prefills lead data without inventing retention/resolution/meters", () => {
    const req = defaultCctvBuildRequirements({
      cameraCount: 9,
      recording: true,
      remoteViewing: true,
      infrastructure: "חדשה",
      location: "חוץ",
    });
    expect(req.cameraCount).toBe(9);
    expect(req.remoteViewing).toBe(true);
    expect(req.environment).toBe("outdoor");
    expect(req.retentionDays).toBe(14);
    expect(req.cableDistanceMeters).toBe("");
  });

  it("validates core fields and maps API body", () => {
    const req = defaultCctvBuildRequirements({ cameraCount: 12 });
    req.expansionHeadroomPercent = "20";
    req.manufacturerPreference = "QABrand";
    expect(validateCctvBuildRequirements(req).ok).toBe(true);
    const body = requirementsToRecommendBody(req);
    expect(body.camera_count).toBe(12);
    expect(body.expansion_headroom).toBe(0.2);
    expect(body.manufacturer_preference).toBe("QABrand");
  });

  it("rejects invalid camera count", () => {
    const req = defaultCctvBuildRequirements();
    req.cameraCount = 0;
    expect(validateCctvBuildRequirements(req)).toEqual({
      ok: false,
      field: "cameraCount",
      messageKey: "cameras",
    });
  });
});

describe("cctv recommendation review helpers", () => {
  it("builds engineering summary for 12-cam / 16CH / storage / PoE", () => {
    const summary = buildEngineeringSummary(sampleRec());
    expect(summary.cameraCount).toBe(12);
    expect(summary.channelTier).toBe(16);
    expect(summary.requiredTb).toBeCloseTo(18.6624);
    expect(summary.hddPacking).toBe("2 × 10TB");
    expect(summary.poePorts).toBe(12);
    expect(summary.architecture).toBe("external_switch");
  });

  it("localizes recorder reason without raw codes", () => {
    const text = formatReasonHe({
      code: "RECORDER_TIER_SELECTED",
      params: { cameraCount: 12, effectiveCameras: 15, selectedChannelTier: 16, expansionHeadroom: 0.2 },
    });
    expect(text).toContain("16");
    expect(text).not.toContain("RECORDER_TIER");
  });

  it("groups components and hides empty groups", () => {
    const groups = groupComponents(sampleRec().components);
    expect(groups.map((g) => g.id)).toEqual(["cameras", "recording", "infrastructure"]);
  });

  it("blocks incompatible candidates and TEXT_ASSISTED core", () => {
    const rec = sampleRec();
    expect(isCandidateSelectable(rec.components[0].candidates[2])).toBe(false);
    const selection = initialReviewSelection(rec);
    const gate = canAddRecommendationToQuote(rec, selection);
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.lines.find((l) => l.role === "camera")?.qty).toBe(12);
      expect(gate.lines.find((l) => l.role === "storage")?.qty).toBe(2);
      expect(gate.lines.some((l) => l.role === "cable")).toBe(false);
    }
  });

  it("blocks add when core recorder is unresolved", () => {
    const rec = sampleRec({
      blocking: true,
      status: "BLOCKED",
      components: [
        sampleRec().components[0],
        {
          ...sampleRec().components[1],
          selected_product: null,
          selected_confidence: null,
          candidates: [
            {
              product: { id: "n-text", name: "NVR maybe 16CH" },
              confidence: "TEXT_ASSISTED",
              compatibility: { channels: "UNKNOWN" },
            },
          ],
          resolution_status: "UNRESOLVED",
          blocking: true,
        },
        sampleRec().components[2],
      ],
    });
    const selection = initialReviewSelection(rec);
    expect(canAddRecommendationToQuote(rec, selection).ok).toBe(false);
  });

  it("supports partial-apply recovery without duplicating roles", () => {
    const lines = [
      { role: "camera", productId: "c1", qty: 4, optional: false },
      { role: "recorder", productId: "n1", qty: 1, optional: false },
      { role: "storage", productId: "h1", qty: 2, optional: false },
    ];
    expect(remainingLinesAfterPartial(lines, ["camera"]).map((l) => l.role)).toEqual([
      "recorder",
      "storage",
    ]);
    expect(linesFingerprint(lines)).toBe(linesFingerprint([...lines].reverse()));
  });
});
