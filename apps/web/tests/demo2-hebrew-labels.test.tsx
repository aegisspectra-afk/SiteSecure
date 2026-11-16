import { describe, expect, it } from "vitest";
import { buildCalculatedMetrics, buildValidationCenter, techLabelShort } from "../src/lib/cctv-designer-summary";
import { defaultCctvBuildRequirements } from "../src/lib/cctv-build-requirements";
import { formatReasonHe } from "../src/lib/cctv-recommend-copy";
import { he } from "../src/i18n/he";
import type { SystemRecommendation } from "@site-secure/api-client";

// Technical terms and units that stay as they are in Hebrew UI copy.
const ALLOWED = new Set(["CCTV", "IP", "NVR", "DVR", "XVR", "PoE", "HDD", "UPS", "PTZ", "HD", "MP", "TB", "W", "CAT", "RG", "Mbps", "H"]);

function englishWords(text: string): string[] {
  return (text.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !ALLOWED.has(w));
}

describe("DEMO-2.4 wizard copy is Hebrew", () => {
  it("technology names, units and field labels", () => {
    for (const t of [he.cpqCctvTechAnalog, he.cpqCctvTechHybrid, he.cpqCctvUnitFps, he.cpqCctvCodec, he.cpqCameraTurret]) {
      expect(englishWords(t)).toEqual([]);
    }
    expect(techLabelShort("hybrid")).toBe("היברידי");
  });

  it("engine codes never reach the user raw", () => {
    for (const code of ["NVR_POE_UNKNOWN", "POE_POWER_UNRESOLVED", "HDD_BAYS_UNKNOWN", "SOMETHING_NEW_FROM_SERVER"]) {
      const text = formatReasonHe({ code } as never);
      expect(text).not.toMatch(/_|unknown|unresolved/i);
      expect(englishWords(text)).toEqual([]);
    }
  });

  it("calculated metrics and validation items have no English words", () => {
    const rec = {
      system_type: "cctv",
      engine_version: 1,
      status: "OK",
      blocking: false,
      input: { cameraCount: 4, cctvTechnology: "ip" },
      engineering: { poe: { requiredPorts: 4, requiredBudgetW: 40 } },
      unresolved: [{ code: "NVR_POE_UNKNOWN" }, { code: "POE_POWER_UNRESOLVED" }],
      components: [
        { role: "recorder", component_key: "recorder_main", quantity: 1, optional: false, blocking: true, resolution_status: "UNRESOLVED", candidates: [], reason_codes: [] },
      ],
    } as unknown as SystemRecommendation;
    const req = { ...defaultCctvBuildRequirements(), cctvTechnology: "ip" as const };
    const metrics = buildCalculatedMetrics(rec, "ip");
    const validation = buildValidationCenter({ req, calcState: "fresh", recommendation: rec });
    for (const text of [...metrics.map((m) => `${m.label} ${m.value}`), ...validation.map((v) => v.message)]) {
      expect(englishWords(text), text).toEqual([]);
    }
  });
});
