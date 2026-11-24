import { describe, expect, it } from "vitest";
import {
  calculatePublicQuickStorage,
  calculateStorage,
  HERO_CCTV_DEFAULTS,
  packHdds,
  PUBLIC_HDD_CAPACITIES_TB,
  PUBLIC_HDD_DRIVE_BAYS,
  PUBLIC_HDD_MAX_TB,
  sizeRecorder,
} from "@site-secure/cctv-sizing";

/**
 * Parity vectors must match Python `apps/api/tests/test_cctv_sizing_parity.py`
 * and public marketing calculate (8 cams / 4MP / 30d).
 */
describe("public quick calc ↔ server formula", () => {
  it("hero defaults: 8×4MP×30d continuous → same TB / NVR / HDD as Python public API", () => {
    const quick = calculatePublicQuickStorage(HERO_CCTV_DEFAULTS);
    expect(quick.storage.status).toBe("ok");
    // 8 * 4e6 * 86400 * 30 / 8 = 10.368 TB raw; ×1.2 = 12.4416 TB
    expect(quick.storage.requiredTb).toBeCloseTo(12.4416, 9);
    expect(quick.storage.bitrateMbps).toBe(4);
    expect(quick.recorder.channels).toBe(8);

    const storage = calculateStorage({
      cameraCount: 8,
      resolutionMp: 4,
      retentionDays: 30,
      recordingMode: "continuous",
      codec: "h265",
      recordingHoursPerDay: null,
      motionDutyCycle: null,
      bitrateMbps: null,
      bitrateMbpsOverride: null,
      storageOverhead: null,
    });
    expect(storage.requiredTbWithOverhead).toBeCloseTo(12.4416, 9);

    const hdd = packHdds({
      requiredTb: storage.requiredTbWithOverhead!,
      availableCapacitiesTb: [...PUBLIC_HDD_CAPACITIES_TB],
      driveBays: PUBLIC_HDD_DRIVE_BAYS,
      maxHddTb: PUBLIC_HDD_MAX_TB,
    });
    expect(hdd.status).toBe("ok");
    expect(hdd.driveCount).toBe(quick.hdd.driveCount);
    expect(hdd.driveCapacityTb).toBe(quick.hdd.recommendedTbPerDrive);
    expect(sizeRecorder(8).selectedChannelTier).toBe(8);
  });

  it("Example A from Python parity: 12×4Mbps×30d", () => {
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
    expect(s.rawTb).toBeCloseTo(15.552, 9);
    expect(s.requiredTbWithOverhead).toBeCloseTo(18.6624, 9);
  });
});
