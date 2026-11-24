import {
  DEFAULT_MOTION_DUTY_CYCLE,
  DEFAULT_STORAGE_OVERHEAD,
  defaultBitrateMbps,
} from "./bitrate-defaults";
import {
  STORAGE_TB_CONVENTION,
  type ProvenanceSource,
  type ReasonEntry,
  type RecordingMode,
  type StorageSizingResult,
} from "./types";

const SECONDS_PER_HOUR = 3600;
const BITS_PER_BYTE = 8;
/** Decimal GB/TB (SI) — consistent with retail HDD TB labels. */
const BYTES_PER_GB = 1e9;
const BYTES_PER_TB = 1e12;

export type StorageCalcInput = {
  cameraCount: number;
  retentionDays: number | null | undefined;
  recordingMode: RecordingMode | null | undefined;
  recordingHoursPerDay: number | null | undefined;
  motionDutyCycle: number | null | undefined;
  resolutionMp: number | null | undefined;
  codec: string | null | undefined;
  bitrateMbpsOverride: number | null | undefined;
  bitrateMbps: number | null | undefined;
  storageOverhead: number | null | undefined;
};

export function resolveBitrate(input: StorageCalcInput): {
  bitrateMbps: number | null;
  source: ProvenanceSource;
  reasons: ReasonEntry[];
  assumptions: ReasonEntry[];
} {
  const reasons: ReasonEntry[] = [];
  const assumptions: ReasonEntry[] = [];

  if (input.bitrateMbpsOverride != null && input.bitrateMbpsOverride > 0) {
    reasons.push({
      code: "STORAGE_BITRATE_OVERRIDE",
      params: { bitrateMbps: input.bitrateMbpsOverride },
    });
    return {
      bitrateMbps: input.bitrateMbpsOverride,
      source: "USER_INPUT",
      reasons,
      assumptions,
    };
  }

  if (input.bitrateMbps != null && input.bitrateMbps > 0) {
    return {
      bitrateMbps: input.bitrateMbps,
      source: "STRUCTURED_CATALOG",
      reasons,
      assumptions,
    };
  }

  if (input.resolutionMp != null) {
    const def = defaultBitrateMbps(input.resolutionMp, input.codec);
    if (def != null) {
      reasons.push({
        code: "STORAGE_BITRATE_DEFAULTED",
        params: {
          resolutionMp: input.resolutionMp,
          codec: input.codec ?? "h265",
          bitrateMbps: def,
        },
      });
      assumptions.push({
        code: "STORAGE_BITRATE_DEFAULTED",
        params: {
          resolutionMp: input.resolutionMp,
          codec: input.codec ?? "h265",
          bitrateMbps: def,
        },
      });
      return { bitrateMbps: def, source: "ENGINEERING_DEFAULT", reasons, assumptions };
    }
  }

  reasons.push({ code: "STORAGE_UNRESOLVED_BITRATE", params: {} });
  return { bitrateMbps: null, source: "UNRESOLVED", reasons, assumptions };
}

export function recordingSecondsPerDay(input: StorageCalcInput): {
  seconds: number | null;
  assumptions: ReasonEntry[];
  invalid: boolean;
} {
  const mode: RecordingMode = input.recordingMode ?? "continuous";
  const assumptions: ReasonEntry[] = [];

  if (mode === "continuous") {
    return { seconds: 24 * SECONDS_PER_HOUR, assumptions, invalid: false };
  }

  if (mode === "scheduled") {
    const hours = input.recordingHoursPerDay;
    if (hours == null || !(hours > 0) || hours > 24) {
      return { seconds: null, assumptions, invalid: true };
    }
    return { seconds: hours * SECONDS_PER_HOUR, assumptions, invalid: false };
  }

  // motion / event
  let duty = input.motionDutyCycle;
  if (duty == null) {
    duty = DEFAULT_MOTION_DUTY_CYCLE;
    assumptions.push({
      code: "STORAGE_MOTION_DUTY_DEFAULTED",
      params: { dutyCycle: duty },
    });
  }
  return { seconds: 24 * SECONDS_PER_HOUR * duty, assumptions, invalid: false };
}

/**
 * Storage formula (exact):
 * bits = cameras × bitrate_Mbps × 1e6 × seconds_per_day × retention_days
 * bytes = bits / 8
 * required = bytes × (1 + overhead)
 * TB = bytes / 1e12 (decimal)
 *
 * Round display values only at the end; never round down required capacity.
 */
export function calculateStorage(input: StorageCalcInput): StorageSizingResult {
  const overhead =
    input.storageOverhead != null && Number.isFinite(input.storageOverhead)
      ? input.storageOverhead
      : DEFAULT_STORAGE_OVERHEAD;

  const bitrate = resolveBitrate(input);
  const recording = recordingSecondsPerDay(input);
  const reasons = [...bitrate.reasons];
  const assumptions = [...bitrate.assumptions, ...recording.assumptions];

  const retention = input.retentionDays;

  if (recording.invalid) {
    return {
      status: "invalid",
      bitrateMbps: bitrate.bitrateMbps,
      bitrateSource: bitrate.source,
      recordingSecondsPerDay: null,
      retentionDays: retention ?? null,
      cameraCount: input.cameraCount,
      overhead,
      rawBytes: null,
      rawGb: null,
      rawTb: null,
      requiredBytesWithOverhead: null,
      requiredGbWithOverhead: null,
      requiredTbWithOverhead: null,
      tbConvention: STORAGE_TB_CONVENTION,
      reasons,
      assumptions,
    };
  }

  if (retention == null || !(retention > 0) || bitrate.bitrateMbps == null || recording.seconds == null) {
    return {
      status: "unresolved",
      bitrateMbps: bitrate.bitrateMbps,
      bitrateSource: bitrate.source,
      recordingSecondsPerDay: recording.seconds,
      retentionDays: retention ?? null,
      cameraCount: input.cameraCount,
      overhead,
      rawBytes: null,
      rawGb: null,
      rawTb: null,
      requiredBytesWithOverhead: null,
      requiredGbWithOverhead: null,
      requiredTbWithOverhead: null,
      tbConvention: STORAGE_TB_CONVENTION,
      reasons,
      assumptions,
    };
  }

  // Mbps × 1e6 = bits/sec
  const rawBits =
    input.cameraCount * bitrate.bitrateMbps * 1_000_000 * recording.seconds * retention;
  const rawBytes = rawBits / BITS_PER_BYTE;
  const requiredBytes = rawBytes * (1 + overhead);

  reasons.push({
    code: "STORAGE_OVERHEAD_APPLIED",
    params: { overhead, rawBytes, requiredBytes },
  });

  return {
    status: "ok",
    bitrateMbps: bitrate.bitrateMbps,
    bitrateSource: bitrate.source,
    recordingSecondsPerDay: recording.seconds,
    retentionDays: retention,
    cameraCount: input.cameraCount,
    overhead,
    rawBytes,
    rawGb: rawBytes / BYTES_PER_GB,
    rawTb: rawBytes / BYTES_PER_TB,
    requiredBytesWithOverhead: requiredBytes,
    requiredGbWithOverhead: requiredBytes / BYTES_PER_GB,
    // Never round down required TB for packing — use exact float; consumers ceil when packing.
    requiredTbWithOverhead: requiredBytes / BYTES_PER_TB,
    tbConvention: STORAGE_TB_CONVENTION,
    reasons,
    assumptions,
  };
}
