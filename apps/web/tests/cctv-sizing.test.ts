import { describe, expect, it } from "vitest";
import {
  buildCctvRequirements,
  calculatePoe,
  calculateStorage,
  CCTV_SIZING_ENGINE_VERSION,
  effectiveCameraCount,
  evaluateNvrPoe,
  evaluatePoeArchitecture,
  packHdds,
  sizeRecorder,
  validateCctvSizingInput,
} from "../src/lib/cctv-sizing";

describe("validateCctvSizingInput", () => {
  it("rejects negative, zero, and split mismatch", () => {
    expect(validateCctvSizingInput({ cameraCount: -1 }).length).toBeGreaterThan(0);
    expect(validateCctvSizingInput({ cameraCount: 0 }).length).toBeGreaterThan(0);
    expect(
      validateCctvSizingInput({ cameraCount: 10, indoorCount: 4, outdoorCount: 5 }).some(
        (e) => e.field.includes("indoor"),
      ),
    ).toBe(true);
    expect(validateCctvSizingInput({ cameraCount: 10, indoorCount: 4, outdoorCount: 6 })).toEqual([]);
  });
});

describe("recorder sizing", () => {
  const cases: Array<[number, number]> = [
    [1, 4],
    [4, 4],
    [5, 8],
    [8, 8],
    [9, 16],
    [16, 16],
    [17, 32],
    [32, 32],
    [33, 64],
    [64, 64],
  ];

  for (const [cams, tier] of cases) {
    it(`${cams} → ${tier}CH`, () => {
      const r = sizeRecorder(cams);
      expect(r.status).toBe("ok");
      expect(r.selectedChannelTier).toBe(tier);
    });
  }

  it("65 → unsupported", () => {
    const r = sizeRecorder(65);
    expect(r.status).toBe("unsupported");
    expect(r.selectedChannelTier).toBeNull();
  });

  it("applies headroom with ceil before tiering", () => {
    expect(effectiveCameraCount(12, 0.2)).toBe(15); // 14.4 → 15
    expect(sizeRecorder(12, 0.2).selectedChannelTier).toBe(16);
    expect(effectiveCameraCount(15, 0.2)).toBe(18);
    expect(sizeRecorder(15, 0.2).selectedChannelTier).toBe(32);
    expect(sizeRecorder(16, 0.2).selectedChannelTier).toBe(32); // 19.2 → 20 → 32
  });
});

describe("storage calculation", () => {
  it("Example A: 12×4Mbps×24h×30d×20%", () => {
    const s = calculateStorage({
      cameraCount: 12,
      bitrateMbpsOverride: 4,
      bitrateMbps: null,
      resolutionMp: null,
      codec: null,
      retentionDays: 30,
      recordingMode: "continuous",
      recordingHoursPerDay: null,
      motionDutyCycle: null,
      storageOverhead: 0.2,
    });
    expect(s.status).toBe("ok");
    // 12 * 4e6 * 86400 * 30 / 8 = 1.5552e13 bytes = 15.552 TB
    expect(s.rawTb).toBeCloseTo(15.552, 6);
    expect(s.requiredTbWithOverhead).toBeCloseTo(18.6624, 6);
    expect(s.bitrateSource).toBe("USER_INPUT");
    expect(s.tbConvention).toBe("decimal_TB");
  });

  it("Example B: 4×2Mbps×12h×14d×20%", () => {
    const s = calculateStorage({
      cameraCount: 4,
      bitrateMbpsOverride: 2,
      bitrateMbps: null,
      resolutionMp: null,
      codec: null,
      retentionDays: 14,
      recordingMode: "scheduled",
      recordingHoursPerDay: 12,
      motionDutyCycle: null,
      storageOverhead: 0.2,
    });
    expect(s.status).toBe("ok");
    expect(s.rawTb).toBeCloseTo(0.6048, 6);
    expect(s.requiredTbWithOverhead).toBeCloseTo(0.72576, 6);
  });

  it("motion duty cycle defaults to 30% with assumption", () => {
    const s = calculateStorage({
      cameraCount: 2,
      bitrateMbpsOverride: 4,
      bitrateMbps: null,
      resolutionMp: null,
      codec: null,
      retentionDays: 7,
      recordingMode: "motion",
      recordingHoursPerDay: null,
      motionDutyCycle: null,
      storageOverhead: 0,
    });
    expect(s.status).toBe("ok");
    expect(s.recordingSecondsPerDay).toBe(86400 * 0.3);
    expect(s.assumptions.some((a) => a.code === "STORAGE_MOTION_DUTY_DEFAULTED")).toBe(true);
  });

  it("engineering default bitrate from resolution", () => {
    const s = calculateStorage({
      cameraCount: 1,
      bitrateMbpsOverride: null,
      bitrateMbps: null,
      resolutionMp: 4,
      codec: "h265",
      retentionDays: 1,
      recordingMode: "continuous",
      recordingHoursPerDay: null,
      motionDutyCycle: null,
      storageOverhead: 0,
    });
    expect(s.status).toBe("ok");
    expect(s.bitrateMbps).toBe(4);
    expect(s.bitrateSource).toBe("ENGINEERING_DEFAULT");
  });

  it("unresolved without bitrate/resolution", () => {
    const s = calculateStorage({
      cameraCount: 4,
      bitrateMbpsOverride: null,
      bitrateMbps: null,
      resolutionMp: null,
      codec: null,
      retentionDays: 30,
      recordingMode: "continuous",
      recordingHoursPerDay: null,
      motionDutyCycle: null,
      storageOverhead: 0.2,
    });
    expect(s.status).toBe("unresolved");
    expect(s.bitrateSource).toBe("UNRESOLVED");
  });

  it("invalid retention / bitrate / scheduled hours", () => {
    expect(
      validateCctvSizingInput({ cameraCount: 1, retentionDays: 0 }).some((e) => e.field === "retentionDays"),
    ).toBe(true);
    expect(
      validateCctvSizingInput({ cameraCount: 1, bitrateMbpsOverride: -1 }).some(
        (e) => e.field === "bitrateMbpsOverride",
      ),
    ).toBe(true);
    const s = calculateStorage({
      cameraCount: 1,
      bitrateMbpsOverride: 2,
      bitrateMbps: null,
      resolutionMp: null,
      codec: null,
      retentionDays: 7,
      recordingMode: "scheduled",
      recordingHoursPerDay: null,
      motionDutyCycle: null,
      storageOverhead: 0.2,
    });
    expect(s.status).toBe("invalid");
  });
});

describe("HDD packing", () => {
  it("exact one-drive fit", () => {
    const r = packHdds({
      requiredTb: 8,
      availableCapacitiesTb: [4, 8, 10],
      driveBays: 2,
      maxHddTb: 10,
    });
    expect(r.status).toBe("ok");
    expect(r.driveCount).toBe(1);
    expect(r.driveCapacityTb).toBe(8);
    expect(r.excessTb).toBeCloseTo(0, 9);
  });

  it("multi-drive minimal excess then fewer drives", () => {
    const r = packHdds({
      requiredTb: 18,
      availableCapacitiesTb: [8, 10, 12],
      driveBays: 4,
      maxHddTb: 12,
    });
    expect(r.status).toBe("ok");
    // 2×10=20 excess 2; 2×12=24 excess 6; 3×8=24 excess 6 → pick 2×10
    expect(r.driveCount).toBe(2);
    expect(r.driveCapacityTb).toBe(10);
  });

  it("bay-limit and max-size failures", () => {
    expect(
      packHdds({
        requiredTb: 40,
        availableCapacitiesTb: [8],
        driveBays: 2,
        maxHddTb: 8,
      }).status,
    ).toBe("impossible");

    expect(
      packHdds({
        requiredTb: 10,
        availableCapacitiesTb: [12],
        driveBays: 2,
        maxHddTb: 8,
      }).status,
    ).toBe("impossible");
  });

  it("empty options and unknown bays", () => {
    expect(
      packHdds({ requiredTb: 5, availableCapacitiesTb: [], driveBays: 2, maxHddTb: 10 }).status,
    ).toBe("unresolved");
    expect(
      packHdds({ requiredTb: 5, availableCapacitiesTb: [8], driveBays: null, maxHddTb: 10 }).status,
    ).toBe("unresolved");
  });
});

describe("PoE", () => {
  it("calculates load with headroom", () => {
    const p = calculatePoe({
      cameraCount: 12,
      cameraMaxPowerW: 8,
      poeHeadroom: 0.2,
    });
    expect(p.status).toBe("ok");
    expect(p.rawLoadW).toBe(96);
    expect(p.requiredBudgetW).toBeCloseTo(115.2, 6);
    expect(p.requiredPorts).toBe(12);
  });

  it("does not invent power without permission", () => {
    const p = calculatePoe({ cameraCount: 4, cameraMaxPowerW: null });
    expect(p.status).toBe("unresolved");
    expect(p.requiredBudgetW).toBeNull();
  });

  it("engineering default when allowed", () => {
    const p = calculatePoe({
      cameraCount: 4,
      cameraMaxPowerW: null,
      allowEngineeringPowerDefault: true,
    });
    expect(p.status).toBe("ok");
    expect(p.powerSource).toBe("ENGINEERING_DEFAULT");
    expect(p.powerPerCameraW).toBe(8);
  });

  it("evaluates NVR PoE outcomes", () => {
    expect(
      evaluateNvrPoe({ requiredPorts: 12, requiredBudgetW: 100, poePorts: 16, poeBudgetW: 200 }).evaluation,
    ).toBe("SUFFICIENT");
    expect(
      evaluateNvrPoe({ requiredPorts: 12, requiredBudgetW: 100, poePorts: 8, poeBudgetW: 200 }).evaluation,
    ).toBe("INSUFFICIENT_PORTS");
    expect(
      evaluateNvrPoe({ requiredPorts: 12, requiredBudgetW: 200, poePorts: 16, poeBudgetW: 100 }).evaluation,
    ).toBe("INSUFFICIENT_BUDGET");
    expect(
      evaluateNvrPoe({ requiredPorts: 12, requiredBudgetW: 200, poePorts: 8, poeBudgetW: 50 }).evaluation,
    ).toBe("INSUFFICIENT_BOTH");
    expect(
      evaluateNvrPoe({ requiredPorts: 12, requiredBudgetW: 100, poePorts: null, poeBudgetW: null }).evaluation,
    ).toBe("UNKNOWN");
  });

  it("requires external switch on insufficient / unknown / intent", () => {
    const intent = evaluatePoeArchitecture({
      poeRequired: true,
      intent: "prefer_external_switch",
      requiredPorts: 12,
      requiredBudgetW: 115.2,
      recorderPoePorts: 16,
      recorderPoeBudgetW: 200,
    });
    expect(intent.externalSwitchRequired).toBe(true);
    expect(intent.switchRequirement?.minPoePorts).toBe(12);

    const insuff = evaluatePoeArchitecture({
      poeRequired: true,
      intent: "prefer_nvr_integrated",
      requiredPorts: 12,
      requiredBudgetW: 115.2,
      recorderPoePorts: 8,
      recorderPoeBudgetW: 200,
    });
    expect(insuff.externalSwitchRequired).toBe(true);

    const unknown = evaluatePoeArchitecture({
      poeRequired: true,
      intent: "unknown",
      requiredPorts: 12,
      requiredBudgetW: 115.2,
      recorderPoePorts: null,
      recorderPoeBudgetW: null,
    });
    expect(unknown.externalSwitchRequired).toBe(true);
    expect(unknown.evaluation).toBe("UNKNOWN");
  });
});

describe("buildCctvRequirements integration", () => {
  it("12 outdoor 4MP, 30d continuous, PoE, 20% headroom", () => {
    const result = buildCctvRequirements({
      cameraCount: 12,
      outdoorCount: 12,
      indoorCount: 0,
      resolutionMp: 4,
      retentionDays: 30,
      recordingMode: "continuous",
      expansionHeadroom: 0.2,
      poeRequired: true,
      cameraMaxPowerW: 8,
      cameraMaxPowerSource: "STRUCTURED_CATALOG",
      architectureIntent: "prefer_nvr_integrated",
      storageOverhead: 0.2,
      poeHeadroom: 0.2,
      installationRequested: true,
      remoteViewing: true,
      availableHddCapacitiesTb: [4, 6, 8, 10, 12],
      recorder: {
        channels: 16,
        poePorts: 8,
        poeBudgetW: 100,
        driveBays: 4,
        maxHddTb: 12,
      },
    });

    expect(result.version).toBe(CCTV_SIZING_ENGINE_VERSION);
    expect(result.valid).toBe(true);
    expect(result.recorder?.selectedChannelTier).toBe(16);
    expect(result.recorder?.effectiveCameras).toBe(15);
    expect(result.storage?.status).toBe("ok");
    expect(result.storage?.bitrateSource).toBe("ENGINEERING_DEFAULT");
    expect(result.storage?.requiredTbWithOverhead).toBeCloseTo(18.6624, 4);
    expect(result.hdd?.status).toBe("ok");
    expect(result.hdd?.driveCount).toBe(2);
    expect(result.hdd?.driveCapacityTb).toBe(10);
    expect(result.poe?.requiredBudgetW).toBeCloseTo(115.2, 4);
    expect(result.poeArchitecture?.externalSwitchRequired).toBe(true); // ports 8 < 12 and budget 100 < 115.2
    expect(result.poeArchitecture?.switchRequirement?.minPoePorts).toBe(12);
    expect(result.serviceRequirements.some((s) => s.role === "camera_install" && s.qty === 12)).toBe(
      true,
    );
    expect(result.warnings.some((w) => w.code === "STORAGE_BITRATE_DEFAULTED")).toBe(true);
    expect(result.infrastructure.cableStatus).toBe("unresolved");
  });

  it("rejects invalid input without fabricating sizing", () => {
    const result = buildCctvRequirements({ cameraCount: 0 });
    expect(result.valid).toBe(false);
    expect(result.recorder).toBeNull();
  });
});
