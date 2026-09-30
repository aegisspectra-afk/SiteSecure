/**
 * SYSTEM-DESIGNER-1 Slice B — technology-aware recommend body + hybrid validation.
 */
import { describe, expect, it } from "vitest";
import {
  defaultCctvBuildRequirements,
  requirementsToRecommendBody,
  validateCctvBuildRequirements,
} from "../src/lib/cctv-build-requirements";
import { formatReasonHe } from "../src/lib/cctv-recommend-copy";
import { CCTV_COMPONENT_KEYS, commercialLabelHe } from "../src/lib/cctv-component-keys";

describe("SYSTEM-DESIGNER-1 Slice B technology payload", () => {
  it("defaults to IP and preserves Slice A component keys", () => {
    const req = defaultCctvBuildRequirements();
    expect(req.cctvTechnology).toBe("ip");
    expect(req.ipCameraCount).toBe(req.cameraCount);
    expect(req.analogCameraCount).toBe(0);
    const body = requirementsToRecommendBody(req);
    expect(body.cctv_technology).toBe("ip");
    expect(body.ip_camera_count).toBe(body.camera_count);
    expect(body.analog_camera_count).toBe(0);
    expect(body.poe_required).toBe(true);
  });

  it("forces analog PoE off and requests power supply", () => {
    const req = {
      ...defaultCctvBuildRequirements(),
      cctvTechnology: "analog_hd" as const,
      poeRequired: true,
      analogCameraCount: 4,
      ipCameraCount: 0,
    };
    const body = requirementsToRecommendBody(req);
    expect(body.cctv_technology).toBe("analog_hd");
    expect(body.poe_required).toBe(false);
    expect(body.analog_camera_count).toBe(4);
    expect(body.ip_camera_count).toBe(0);
    expect(body.power_supply_requested).toBe(true);
  });

  it("sends hybrid split and totals cameras from IP+analog", () => {
    const req = {
      ...defaultCctvBuildRequirements(),
      cctvTechnology: "hybrid" as const,
      cameraCount: 8,
      ipCameraCount: 5,
      analogCameraCount: 3,
    };
    expect(validateCctvBuildRequirements(req)).toEqual({ ok: true });
    const body = requirementsToRecommendBody(req);
    expect(body.cctv_technology).toBe("hybrid");
    expect(body.ip_camera_count).toBe(5);
    expect(body.analog_camera_count).toBe(3);
    expect(body.camera_count).toBe(8);
  });

  it("rejects invalid hybrid split", () => {
    const bad = {
      ...defaultCctvBuildRequirements(),
      cctvTechnology: "hybrid" as const,
      cameraCount: 8,
      ipCameraCount: 5,
      analogCameraCount: 2,
    };
    const v = validateCctvBuildRequirements(bad);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.messageKey).toBe("hybridSplit");
  });

  it("keeps commercial labels technology-aware for Slice A keys", () => {
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.cameraIp)).toBe("מצלמת IP");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.cameraAnalog)).toBe("מצלמה אנלוגית");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.recorder, { technology: "ip" })).toBe("NVR");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.recorder, { technology: "analog_hd" })).toBe("DVR");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.recorder, { technology: "hybrid" })).toBe("XVR");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.cableAnalog)).toBe("כבל RG59");
  });

  it("formats Slice B reason codes from engine facts", () => {
    expect(
      formatReasonHe({
        code: "RECORDER_TECHNOLOGY_PATH",
        params: { technology: "hybrid", minChannels: 16, ipCameraCount: 5, analogCameraCount: 3 },
      }),
    ).toMatch(/Hybrid|היברידי/);
    expect(formatReasonHe({ code: "POE_NOT_APPLICABLE_ANALOG", params: {} })).toContain("אנלוגי");
    expect(
      formatReasonHe({
        code: "EXTERNAL_SWITCH_REQUIRED",
        params: { technology: "hybrid", ipCameraCount: 5 },
      }),
    ).toContain("5");
  });
});
