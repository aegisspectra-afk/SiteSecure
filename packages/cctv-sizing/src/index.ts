/**
 * Shared CCTV sizing engine (browser + Node).
 *
 * Formulas must stay in lockstep with Python `app.cctv_sizing`
 * (`CCTV_SIZING_ENGINE_VERSION = 1`). Do not evolve independently.
 */

export { CCTV_SIZING_ENGINE_VERSION, RECORDER_TIERS, STORAGE_TB_CONVENTION } from "./types";
export type * from "./types";

export { validateCctvSizingInput } from "./validate";
export { sizeRecorder, effectiveCameraCount, checkChannelsCompatibility } from "./recorder";
export {
  calculateStorage,
  resolveBitrate,
  recordingSecondsPerDay,
} from "./storage";
export type { StorageCalcInput } from "./storage";
export {
  BITRATE_DEFAULTS_H265_MBPS,
  DEFAULT_MOTION_DUTY_CYCLE,
  DEFAULT_STORAGE_OVERHEAD,
  DEFAULT_FPS,
  DEFAULT_CODEC,
  defaultBitrateMbps,
} from "./bitrate-defaults";
export { packHdds, checkHddCompatibility } from "./hdd";
export {
  calculatePoe,
  evaluateNvrPoe,
  evaluatePoeArchitecture,
  ENGINEERING_DEFAULT_CAMERA_POWER_W,
  DEFAULT_POE_HEADROOM,
} from "./poe";
export { evaluateInfrastructure, buildServiceRequirements } from "./infrastructure";
export { buildCctvRequirements } from "./engine";
export {
  calculatePublicQuickStorage,
  HERO_CCTV_DEFAULTS,
  PUBLIC_HDD_CAPACITIES_TB,
  PUBLIC_HDD_DRIVE_BAYS,
  PUBLIC_HDD_MAX_TB,
} from "./public-quick";
export type { PublicQuickStorageInput, PublicQuickStorageResult } from "./public-quick";
