/**
 * CCTV Build System V1 — requirements form model + lead prefill + API payload.
 * Engineering lives on the server (POST .../cctv/recommend). Do not size here.
 */

import type { CctvRecommendIn } from "@site-secure/api-client";

export type CctvBuildRequirements = {
  cameraCount: number;
  /** SYSTEM-DESIGNER-1 — same engine, different component paths */
  cctvTechnology: "ip" | "analog_hd" | "hybrid";
  ipCameraCount: number;
  analogCameraCount: number;
  analogSignal: "" | "tvi" | "cvi" | "ahd" | "cvbs";
  powerSupplyRequested: boolean;
  environment: "indoor" | "outdoor" | "indoor_outdoor" | "";
  resolutionMp: number;
  retentionDays: number;
  recordingMode: "continuous" | "scheduled" | "motion";
  poeRequired: boolean;
  installationRequested: boolean;
  /** Slice C — independent of installation; defaults true when install on */
  testingRequested: boolean;
  /**
   * Slice C workspace density. showAdvanced mirrors professional for Design doc compat.
   */
  designerMode: "quick" | "professional";
  // Advanced (preserved across Quick↔Pro)
  showAdvanced: boolean;
  fps: string;
  codec: "" | "h264" | "h265";
  bitrateMbpsOverride: string;
  recordingHoursPerDay: string;
  motionDutyCycle: string;
  expansionHeadroomPercent: string;
  manufacturerPreference: string;
  cableDistanceMeters: string;
  remoteViewing: boolean;
  upsRequested: boolean;
  commissioningRequested: boolean;
  cameraMaxPowerW: string;
  formFactor: "" | "dome" | "bullet" | "turret" | "ptz";
  architectureIntent: "prefer_nvr_integrated" | "prefer_external_switch" | "unknown";
  /** Optional infrastructure intents — persist; only cable/UPS/PSU hit recommend today */
  infraRackRequested: boolean;
  infraConduitRequested: boolean;
  infraSurgeRequested: boolean;
  infraJunctionRequested: boolean;
  infraMountsRequested: boolean;
};

export type LeadPrefillSource = {
  cameraCount?: number | null;
  recording?: boolean | null;
  remoteViewing?: boolean | null;
  infrastructure?: string | null;
  location?: string | null;
};

export function defaultCctvBuildRequirements(lead?: LeadPrefillSource | null): CctvBuildRequirements {
  const cameraCount = lead?.cameraCount && lead.cameraCount > 0 ? lead.cameraCount : 4;
  const infra = (lead?.infrastructure ?? "").toLowerCase();
  const likelyNeedsCable = /חדש|new|partial|חלק/.test(infra);
  const location = (lead?.location ?? "").trim();
  let environment: CctvBuildRequirements["environment"] = "";
  if (/חוץ|outdoor/i.test(location) && /פנים|indoor/i.test(location)) {
    environment = "indoor_outdoor";
  } else if (/חוץ|outdoor/i.test(location)) {
    environment = "outdoor";
  } else if (/פנים|indoor/i.test(location)) {
    environment = "indoor";
  }

  return {
    cameraCount,
    cctvTechnology: "ip",
    ipCameraCount: cameraCount,
    analogCameraCount: 0,
    analogSignal: "",
    powerSupplyRequested: false,
    // Unspecified by default — do not invent outdoor when the user has not chosen.
    environment: environment || "",
    resolutionMp: 4,
    retentionDays: 14,
    recordingMode: lead?.recording === false ? "motion" : "continuous",
    poeRequired: true,
    installationRequested: true,
    testingRequested: true,
    designerMode: "quick",
    showAdvanced: false,
    fps: "",
    codec: "",
    bitrateMbpsOverride: "",
    recordingHoursPerDay: "",
    motionDutyCycle: "",
    expansionHeadroomPercent: "",
    manufacturerPreference: "",
    // Do not invent meters — only surface empty field when cabling likely needed
    cableDistanceMeters: likelyNeedsCable ? "" : "",
    remoteViewing: Boolean(lead?.remoteViewing),
    upsRequested: false,
    commissioningRequested: false,
    cameraMaxPowerW: "",
    formFactor: "",
    architectureIntent: "prefer_nvr_integrated",
    infraRackRequested: false,
    infraConduitRequested: false,
    infraSurgeRequested: false,
    infraJunctionRequested: false,
    infraMountsRequested: false,
  };
}

export type RequirementsValidation =
  | { ok: true }
  | {
      ok: false;
      field: string;
      messageKey: "cameras" | "retention" | "resolution" | "hours" | "hybridSplit";
    };

export function validateCctvBuildRequirements(req: CctvBuildRequirements): RequirementsValidation {
  if (!Number.isFinite(req.cameraCount) || req.cameraCount < 1) {
    return { ok: false, field: "cameraCount", messageKey: "cameras" };
  }
  if (req.cctvTechnology === "hybrid") {
    const ip = Math.floor(req.ipCameraCount);
    const an = Math.floor(req.analogCameraCount);
    if (!Number.isFinite(ip) || !Number.isFinite(an) || ip < 1 || an < 1 || ip + an !== req.cameraCount) {
      return { ok: false, field: "ipCameraCount", messageKey: "hybridSplit" };
    }
  }
  if (!Number.isFinite(req.retentionDays) || req.retentionDays <= 0) {
    return { ok: false, field: "retentionDays", messageKey: "retention" };
  }
  if (!Number.isFinite(req.resolutionMp) || req.resolutionMp <= 0) {
    return { ok: false, field: "resolutionMp", messageKey: "resolution" };
  }
  if (req.recordingMode === "scheduled") {
    const hours = Number(req.recordingHoursPerDay);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      return { ok: false, field: "recordingHoursPerDay", messageKey: "hours" };
    }
  }
  return { ok: true };
}

function optNumber(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function requirementsToRecommendBody(req: CctvBuildRequirements): CctvRecommendIn {
  const headroomPct = optNumber(req.expansionHeadroomPercent);
  const tech = req.cctvTechnology || "ip";
  const cameraCount = Math.max(1, Math.floor(req.cameraCount));
  const body: CctvRecommendIn = {
    camera_count: cameraCount,
    cctv_technology: tech,
    resolution_mp: req.resolutionMp,
    environment: req.environment || null,
    retention_days: req.retentionDays,
    recording_mode: req.recordingMode,
    // Analog HD never requests PoE; Hybrid sizes PoE for IP subset only on the server.
    poe_required: tech === "analog_hd" ? false : req.poeRequired,
    installation_requested: req.installationRequested,
    testing_requested: req.testingRequested,
    remote_viewing: req.remoteViewing,
    ups_requested: req.upsRequested,
    commissioning_requested: req.commissioningRequested,
    architecture_intent: req.architectureIntent,
    expansion_headroom: headroomPct != null ? headroomPct / 100 : 0,
    power_supply_requested: req.powerSupplyRequested || tech === "analog_hd" || tech === "hybrid",
  };

  if (tech === "hybrid") {
    body.ip_camera_count = Math.max(0, Math.floor(req.ipCameraCount));
    body.analog_camera_count = Math.max(0, Math.floor(req.analogCameraCount));
    body.camera_count = Math.max(1, (body.ip_camera_count ?? 0) + (body.analog_camera_count ?? 0));
  } else if (tech === "analog_hd") {
    body.analog_camera_count = cameraCount;
    body.ip_camera_count = 0;
  } else {
    body.ip_camera_count = cameraCount;
    body.analog_camera_count = 0;
  }
  if (req.analogSignal) body.analog_signal = req.analogSignal;

  const fps = optNumber(req.fps);
  if (fps != null) body.fps = fps;
  if (req.codec) body.codec = req.codec;
  const bitrate = optNumber(req.bitrateMbpsOverride);
  if (bitrate != null) body.bitrate_mbps_override = bitrate;
  const hours = optNumber(req.recordingHoursPerDay);
  if (hours != null) body.recording_hours_per_day = hours;
  const duty = optNumber(req.motionDutyCycle);
  if (duty != null) body.motion_duty_cycle = duty > 1 ? duty / 100 : duty;
  const cable = optNumber(req.cableDistanceMeters);
  if (cable != null) body.cable_distance_meters = cable;
  const power = optNumber(req.cameraMaxPowerW);
  if (power != null) body.camera_max_power_w = power;
  if (req.manufacturerPreference.trim()) {
    body.manufacturer_preference = req.manufacturerPreference.trim();
  }
  if (req.formFactor) body.form_factor = req.formFactor;

  return body;
}
