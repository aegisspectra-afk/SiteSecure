/**
 * Pure deterministic CCTV sizing engine (Task 13B).
 * No React, HTTP, catalog, or Quote coupling.
 */

export const CCTV_SIZING_ENGINE_VERSION = 1 as const;

export type ProvenanceSource =
  | "USER_INPUT"
  | "STRUCTURED_CATALOG"
  | "ENGINEERING_DEFAULT"
  | "DERIVED"
  | "UNRESOLVED";

export type RecordingMode = "continuous" | "scheduled" | "motion";

export type PoeArchitectureIntent = "prefer_nvr_integrated" | "prefer_external_switch" | "unknown";

export type ReasonCode =
  | "RECORDER_TIER_SELECTED"
  | "RECORDER_HEADROOM_APPLIED"
  | "RECORDER_UNSUPPORTED_COUNT"
  | "STORAGE_BITRATE_OVERRIDE"
  | "STORAGE_BITRATE_DEFAULTED"
  | "STORAGE_OVERHEAD_APPLIED"
  | "STORAGE_MOTION_DUTY_DEFAULTED"
  | "STORAGE_UNRESOLVED_BITRATE"
  | "POE_HEADROOM_APPLIED"
  | "POE_POWER_UNRESOLVED"
  | "POE_POWER_ENGINEERING_DEFAULT"
  | "NVR_POE_SUFFICIENT"
  | "NVR_POE_PORTS_INSUFFICIENT"
  | "NVR_POE_BUDGET_INSUFFICIENT"
  | "NVR_POE_BOTH_INSUFFICIENT"
  | "NVR_POE_UNKNOWN"
  | "EXTERNAL_SWITCH_REQUIRED"
  | "EXTERNAL_SWITCH_NOT_REQUIRED"
  | "CABLE_DISTANCE_UNRESOLVED"
  | "HDD_PACKED"
  | "HDD_CAPACITY_IMPOSSIBLE"
  | "HDD_BAYS_UNKNOWN"
  | "HDD_OPTIONS_EMPTY"
  | "COMPAT_CHANNELS_OK"
  | "COMPAT_CHANNELS_FAIL"
  | "INPUT_VALIDATION_ERROR";

export type ReasonEntry = {
  code: ReasonCode;
  params?: Record<string, number | string | boolean | null>;
};

export type Provenanced<T> = {
  value: T;
  source: ProvenanceSource;
};

/** Decimal TB (10^12 bytes) — aligns with retail HDD capacity labeling. */
export const STORAGE_TB_CONVENTION = "decimal_TB" as const;

export const RECORDER_TIERS = [4, 8, 16, 32, 64] as const;
export type RecorderTier = (typeof RECORDER_TIERS)[number];

export type CctvSizingInput = {
  /** Total cameras (≥1). */
  cameraCount: number;
  indoorCount?: number | null;
  outdoorCount?: number | null;
  /** Megapixels for bitrate default table. */
  resolutionMp?: number | null;
  retentionDays?: number | null;
  recordingMode?: RecordingMode | null;
  /** Hours/day for scheduled mode. */
  recordingHoursPerDay?: number | null;
  /** 0–1 fraction for motion/event; if omitted with motion, default applies. */
  motionDutyCycle?: number | null;
  fps?: number | null;
  codec?: "h264" | "h265" | string | null;
  /** Mbps per camera override. */
  bitrateMbpsOverride?: number | null;
  /** Explicit engineering bitrate (not override, not default table). */
  bitrateMbps?: number | null;
  poeRequired?: boolean | null;
  architectureIntent?: PoeArchitectureIntent | null;
  /** 0–1 future expansion, e.g. 0.2 = 20%. */
  expansionHeadroom?: number | null;
  /** Average or total run meters if known. */
  cableDistanceMeters?: number | null;
  remoteViewing?: boolean | null;
  upsRequested?: boolean | null;
  installationRequested?: boolean | null;
  commissioningRequested?: boolean | null;
  testingRequested?: boolean | null;
  /** Watts per camera when known (catalog or engineering). */
  cameraMaxPowerW?: number | null;
  cameraMaxPowerSource?: Exclude<ProvenanceSource, "DERIVED" | "UNRESOLVED"> | null;
  /** PoE power headroom, default 0.2. */
  poeHeadroom?: number | null;
  /** Storage overhead, default 0.2. */
  storageOverhead?: number | null;
  /**
   * When true and cameraMaxPowerW missing, use ENGINEERING_DEFAULT_CAMERA_POWER_W
   * with a warning. Default false → UNRESOLVED PoE budget.
   */
  allowEngineeringPowerDefault?: boolean | null;
  /** Specs for evaluating an existing/planned recorder (no product id). */
  recorder?: {
    channels?: number | null;
    poePorts?: number | null;
    poeBudgetW?: number | null;
    driveBays?: number | null;
    maxHddTb?: number | null;
  } | null;
  /** Available HDD capacities in decimal TB (no product ids). */
  availableHddCapacitiesTb?: number[] | null;
};

export type ValidationIssue = {
  code: ReasonCode;
  field: string;
  message: string;
};

export type RecorderSizingResult = {
  status: "ok" | "unsupported";
  requestedCameras: number;
  effectiveCameras: number;
  selectedChannelTier: RecorderTier | null;
  headroomApplied: number;
  reasons: ReasonEntry[];
};

export type StorageSizingResult = {
  status: "ok" | "unresolved" | "invalid";
  bitrateMbps: number | null;
  bitrateSource: ProvenanceSource;
  recordingSecondsPerDay: number | null;
  retentionDays: number | null;
  cameraCount: number;
  overhead: number;
  rawBytes: number | null;
  rawGb: number | null;
  rawTb: number | null;
  requiredBytesWithOverhead: number | null;
  requiredGbWithOverhead: number | null;
  requiredTbWithOverhead: number | null;
  tbConvention: typeof STORAGE_TB_CONVENTION;
  reasons: ReasonEntry[];
  assumptions: ReasonEntry[];
};

export type HddPackingResult = {
  status: "ok" | "unresolved" | "impossible";
  requiredTb: number;
  driveCount: number | null;
  driveCapacityTb: number | null;
  totalCapacityTb: number | null;
  excessTb: number | null;
  baysUsed: number | null;
  bayLimit: number | null;
  maxDriveTb: number | null;
  reasons: ReasonEntry[];
};

export type PoeLoadResult = {
  status: "ok" | "unresolved";
  cameraCount: number;
  powerPerCameraW: number | null;
  powerSource: ProvenanceSource;
  rawLoadW: number | null;
  headroom: number;
  requiredBudgetW: number | null;
  requiredPorts: number;
  reasons: ReasonEntry[];
};

export type NvrPoeEvaluation =
  | "SUFFICIENT"
  | "INSUFFICIENT_PORTS"
  | "INSUFFICIENT_BUDGET"
  | "INSUFFICIENT_BOTH"
  | "UNKNOWN";

export type PoeArchitectureResult = {
  evaluation: NvrPoeEvaluation;
  externalSwitchRequired: boolean;
  switchRequirement: {
    minPorts: number;
    minPoePorts: number;
    minPoeBudgetW: number | null;
  } | null;
  reasons: ReasonEntry[];
};

export type InfrastructureResult = {
  cableMeters: number | null;
  cableStatus: "ok" | "unresolved";
  reasons: ReasonEntry[];
};

export type ServiceRequirement = {
  role: "camera_install" | "recorder_setup" | "remote_viewing_setup" | "testing" | "commissioning" | "ups";
  qty: number;
};

export type CompatibilityCheck = {
  code: string;
  ok: boolean | null;
  severity: "blocking" | "warning" | "info";
  reasons: ReasonEntry[];
};

export type CctvEngineeringResult = {
  version: typeof CCTV_SIZING_ENGINE_VERSION;
  input: CctvSizingInput;
  valid: boolean;
  validationErrors: ValidationIssue[];
  recorder: RecorderSizingResult | null;
  storage: StorageSizingResult | null;
  hdd: HddPackingResult | null;
  poe: PoeLoadResult | null;
  poeArchitecture: PoeArchitectureResult | null;
  infrastructure: InfrastructureResult;
  serviceRequirements: ServiceRequirement[];
  compatibility: CompatibilityCheck[];
  assumptions: ReasonEntry[];
  warnings: ReasonEntry[];
  unresolved: ReasonEntry[];
};
