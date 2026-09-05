/**
 * Task 13B — Pure deterministic CCTV sizing engine.
 *
 * Long-term ownership: prefer Python server authority in Task 13C+ (see completion report).
 * This TypeScript module is the V1 reference implementation and remains the source of truth
 * until a server port is explicitly introduced — do not silently duplicate.
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
