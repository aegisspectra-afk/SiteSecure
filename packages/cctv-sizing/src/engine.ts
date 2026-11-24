import { packHdds } from "./hdd";
import { buildServiceRequirements, evaluateInfrastructure } from "./infrastructure";
import { calculatePoe, evaluatePoeArchitecture } from "./poe";
import { checkChannelsCompatibility, sizeRecorder } from "./recorder";
import { calculateStorage } from "./storage";
import {
  CCTV_SIZING_ENGINE_VERSION,
  type CompatibilityCheck,
  type CctvEngineeringResult,
  type CctvSizingInput,
  type ReasonEntry,
} from "./types";
import { validateCctvSizingInput } from "./validate";

/**
 * Pure end-to-end CCTV engineering requirements builder.
 * Outputs technical requirements only — no catalog product resolution.
 */
export function buildCctvRequirements(input: CctvSizingInput): CctvEngineeringResult {
  const validationErrors = validateCctvSizingInput(input);
  const assumptions: ReasonEntry[] = [];
  const warnings: ReasonEntry[] = [];
  const unresolved: ReasonEntry[] = [];
  const compatibility: CompatibilityCheck[] = [];

  if (validationErrors.length) {
    return {
      version: CCTV_SIZING_ENGINE_VERSION,
      input,
      valid: false,
      validationErrors,
      recorder: null,
      storage: null,
      hdd: null,
      poe: null,
      poeArchitecture: null,
      infrastructure: evaluateInfrastructure(input.cableDistanceMeters),
      serviceRequirements: [],
      compatibility,
      assumptions,
      warnings,
      unresolved: validationErrors.map((e) => ({ code: e.code, params: { field: e.field } })),
    };
  }

  const headroom = input.expansionHeadroom ?? 0;
  const recorder = sizeRecorder(input.cameraCount, headroom);

  if (recorder.status === "unsupported") {
    unresolved.push(...recorder.reasons.filter((r) => r.code === "RECORDER_UNSUPPORTED_COUNT"));
  }

  const storage = calculateStorage({
    cameraCount: input.cameraCount,
    retentionDays: input.retentionDays,
    recordingMode: input.recordingMode,
    recordingHoursPerDay: input.recordingHoursPerDay,
    motionDutyCycle: input.motionDutyCycle,
    resolutionMp: input.resolutionMp,
    codec: input.codec,
    bitrateMbpsOverride: input.bitrateMbpsOverride,
    bitrateMbps: input.bitrateMbps,
    storageOverhead: input.storageOverhead,
  });

  assumptions.push(...storage.assumptions);
  if (storage.bitrateSource === "ENGINEERING_DEFAULT") {
    warnings.push(...storage.reasons.filter((r) => r.code === "STORAGE_BITRATE_DEFAULTED"));
  }
  if (storage.status === "unresolved" || storage.status === "invalid") {
    unresolved.push(...storage.reasons.filter((r) => r.code === "STORAGE_UNRESOLVED_BITRATE"));
    if (storage.status === "invalid") {
      unresolved.push({ code: "STORAGE_UNRESOLVED_BITRATE", params: { reason: "invalid_recording" } });
    }
  }

  let hdd = null;
  if (storage.status === "ok" && storage.requiredTbWithOverhead != null) {
    hdd = packHdds({
      requiredTb: storage.requiredTbWithOverhead,
      availableCapacitiesTb: input.availableHddCapacitiesTb ?? [],
      driveBays: input.recorder?.driveBays,
      maxHddTb: input.recorder?.maxHddTb,
    });
    if (hdd.status !== "ok") unresolved.push(...hdd.reasons);
  } else if ((input.availableHddCapacitiesTb?.length ?? 0) > 0) {
    unresolved.push({
      code: "HDD_CAPACITY_IMPOSSIBLE",
      params: { reason: "storage_not_resolved" },
    });
  }

  const poeRequired = input.poeRequired !== false;
  const poe = calculatePoe({
    cameraCount: input.cameraCount,
    cameraMaxPowerW: input.cameraMaxPowerW,
    cameraMaxPowerSource: input.cameraMaxPowerSource,
    allowEngineeringPowerDefault: input.allowEngineeringPowerDefault,
    poeHeadroom: input.poeHeadroom,
  });

  if (poe.powerSource === "ENGINEERING_DEFAULT") {
    warnings.push(...poe.reasons.filter((r) => r.code === "POE_POWER_ENGINEERING_DEFAULT"));
  }
  if (poe.status === "unresolved") {
    unresolved.push(...poe.reasons.filter((r) => r.code === "POE_POWER_UNRESOLVED"));
  }

  const poeArchitecture = evaluatePoeArchitecture({
    poeRequired,
    intent: input.architectureIntent ?? "unknown",
    requiredPorts: poe.requiredPorts,
    requiredBudgetW: poe.requiredBudgetW,
    recorderPoePorts: input.recorder?.poePorts,
    recorderPoeBudgetW: input.recorder?.poeBudgetW,
  });

  if (poeArchitecture.evaluation === "UNKNOWN" && poeRequired) {
    unresolved.push({ code: "NVR_POE_UNKNOWN", params: {} });
  }

  const infrastructure = evaluateInfrastructure(input.cableDistanceMeters);
  if (infrastructure.cableStatus === "unresolved") {
    // Infrastructure distance is optional — warning-level unresolved, not a hard blocker for sizing.
    warnings.push(...infrastructure.reasons);
  }

  const serviceRequirements = buildServiceRequirements({
    cameraCount: input.cameraCount,
    installationRequested: input.installationRequested,
    remoteViewing: input.remoteViewing,
    testingRequested: input.testingRequested,
    commissioningRequested: input.commissioningRequested,
    upsRequested: input.upsRequested,
  });

  // Compatibility primitives
  const channelCompat = checkChannelsCompatibility(
    input.cameraCount,
    input.recorder?.channels ?? recorder.selectedChannelTier,
  );
  compatibility.push({
    code: "camera_count_vs_channels",
    ok: channelCompat.ok,
    severity: channelCompat.ok === false ? "blocking" : "info",
    reasons: channelCompat.reasons,
  });

  if (poeRequired && input.recorder?.poePorts != null) {
    const portsOk = input.recorder.poePorts >= poe.requiredPorts;
    compatibility.push({
      code: "poe_ports",
      ok: portsOk,
      severity: portsOk ? "info" : "blocking",
      reasons: [
        {
          code: portsOk ? "NVR_POE_SUFFICIENT" : "NVR_POE_PORTS_INSUFFICIENT",
          params: { available: input.recorder.poePorts, required: poe.requiredPorts },
        },
      ],
    });
  }

  if (poeRequired && poe.requiredBudgetW != null && input.recorder?.poeBudgetW != null) {
    const budgetOk = input.recorder.poeBudgetW >= poe.requiredBudgetW;
    compatibility.push({
      code: "poe_budget",
      ok: budgetOk,
      severity: budgetOk ? "info" : "blocking",
      reasons: [
        {
          code: budgetOk ? "NVR_POE_SUFFICIENT" : "NVR_POE_BUDGET_INSUFFICIENT",
          params: { available: input.recorder.poeBudgetW, required: poe.requiredBudgetW },
        },
      ],
    });
  }

  if (hdd?.status === "ok" && hdd.driveCount != null && input.recorder?.driveBays != null) {
    const baysOk = hdd.driveCount <= input.recorder.driveBays;
    compatibility.push({
      code: "hdd_bays",
      ok: baysOk,
      severity: baysOk ? "info" : "blocking",
      reasons: hdd.reasons,
    });
  }

  return {
    version: CCTV_SIZING_ENGINE_VERSION,
    input,
    valid: true,
    validationErrors: [],
    recorder,
    storage,
    hdd,
    poe,
    poeArchitecture,
    infrastructure,
    serviceRequirements,
    compatibility,
    assumptions,
    warnings,
    unresolved,
  };
}
