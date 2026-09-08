/**
 * CCTV Build System V1 — requirements form model + lead prefill + API payload.
 * Engineering lives on the server (POST .../cctv/recommend). Do not size here.
 */

import type { CctvRecommendIn } from "@site-secure/api-client";

export type CctvBuildRequirements = {
  cameraCount: number;
  environment: "indoor" | "outdoor" | "indoor_outdoor" | "";
  resolutionMp: number;
  retentionDays: number;
  recordingMode: "continuous" | "scheduled" | "motion";
  poeRequired: boolean;
  installationRequested: boolean;
  // Advanced
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
    // Unspecified by default — do not invent outdoor when the user has not chosen.
    environment: environment || "",
    resolutionMp: 4,
    retentionDays: 14,
    recordingMode: lead?.recording === false ? "motion" : "continuous",
    poeRequired: true,
    installationRequested: true,
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
  };
}

export type RequirementsValidation =
  | { ok: true }
  | { ok: false; field: string; messageKey: "cameras" | "retention" | "resolution" | "hours" };

export function validateCctvBuildRequirements(req: CctvBuildRequirements): RequirementsValidation {
  if (!Number.isFinite(req.cameraCount) || req.cameraCount < 1) {
    return { ok: false, field: "cameraCount", messageKey: "cameras" };
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
  const body: CctvRecommendIn = {
    camera_count: Math.max(1, Math.floor(req.cameraCount)),
    resolution_mp: req.resolutionMp,
    environment: req.environment || null,
    retention_days: req.retentionDays,
    recording_mode: req.recordingMode,
    poe_required: req.poeRequired,
    installation_requested: req.installationRequested,
    testing_requested: req.installationRequested,
    remote_viewing: req.remoteViewing,
    ups_requested: req.upsRequested,
    commissioning_requested: req.commissioningRequested,
    architecture_intent: req.architectureIntent,
    expansion_headroom: headroomPct != null ? headroomPct / 100 : 0,
  };

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
