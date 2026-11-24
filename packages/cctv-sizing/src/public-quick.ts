/**
 * Browser-safe public CCTV quick calc — same formulas as Python
 * `app.cctv_sizing` / POST /public/tools/cctv-storage/calculate (no prices).
 */
import { packHdds } from "./hdd";
import { sizeRecorder } from "./recorder";
import { calculateStorage } from "./storage";

export const PUBLIC_HDD_CAPACITIES_TB = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] as const;
export const PUBLIC_HDD_DRIVE_BAYS = 4;
export const PUBLIC_HDD_MAX_TB = 20;

export type PublicQuickStorageInput = {
  cameraCount: number;
  resolutionMp: number;
  retentionDays: number;
  recordingMode?: "continuous" | "scheduled" | "motion";
  codec?: string;
  recordingHoursPerDay?: number | null;
  motionDutyCycle?: number | null;
};

export type PublicQuickStorageResult = {
  storage: {
    status: string;
    requiredTb: number | null;
    requiredGb: number | null;
    bitrateMbps: number | null;
  };
  recorder: {
    status: string;
    channels: number | null;
  };
  hdd: {
    status: string | undefined;
    recommendedTbPerDrive: number | null;
    totalCapacityTb: number | null;
    driveCount: number | null;
  };
  input: PublicQuickStorageInput;
};

/** Defaults used by the marketing hero calculator. */
export const HERO_CCTV_DEFAULTS: PublicQuickStorageInput = {
  cameraCount: 8,
  resolutionMp: 4,
  retentionDays: 30,
  recordingMode: "continuous",
  codec: "h265",
};

export function calculatePublicQuickStorage(input: PublicQuickStorageInput): PublicQuickStorageResult {
  const storage = calculateStorage({
    cameraCount: input.cameraCount,
    resolutionMp: input.resolutionMp,
    retentionDays: input.retentionDays,
    recordingMode: input.recordingMode ?? "continuous",
    codec: input.codec ?? "h265",
    recordingHoursPerDay: input.recordingHoursPerDay ?? null,
    motionDutyCycle: input.motionDutyCycle ?? null,
    bitrateMbps: null,
    bitrateMbpsOverride: null,
    storageOverhead: null,
  });

  const recorder = sizeRecorder(input.cameraCount);
  const hdd =
    storage.status === "ok" && storage.requiredTbWithOverhead != null
      ? packHdds({
          requiredTb: storage.requiredTbWithOverhead,
          availableCapacitiesTb: [...PUBLIC_HDD_CAPACITIES_TB],
          driveBays: PUBLIC_HDD_DRIVE_BAYS,
          maxHddTb: PUBLIC_HDD_MAX_TB,
        })
      : null;

  return {
    storage: {
      status: storage.status,
      requiredTb: storage.requiredTbWithOverhead,
      requiredGb: storage.requiredGbWithOverhead,
      bitrateMbps: storage.bitrateMbps,
    },
    recorder: {
      status: recorder.status,
      channels: recorder.selectedChannelTier,
    },
    hdd: {
      status: hdd?.status,
      recommendedTbPerDrive: hdd?.driveCapacityTb ?? null,
      totalCapacityTb: hdd?.totalCapacityTb ?? null,
      driveCount: hdd?.driveCount ?? null,
    },
    input,
  };
}
