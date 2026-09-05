/**
 * Task 13B — Pure deterministic CCTV sizing engine (TypeScript reference).
 *
 * AUTHORITATIVE implementation as of Task 13C: Python `app.cctv_sizing`
 * (`CCTV_SIZING_ENGINE_VERSION = 1`). Keep this module for parity fixtures /
 * client preview only — do not evolve formulas independently of the Python engine.
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
