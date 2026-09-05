import type {
  NvrPoeEvaluation,
  PoeArchitectureIntent,
  PoeArchitectureResult,
  PoeLoadResult,
  ProvenanceSource,
  ReasonEntry,
} from "./types";

/** Only used when allowEngineeringPowerDefault=true — never silent. */
export const ENGINEERING_DEFAULT_CAMERA_POWER_W = 8;
export const DEFAULT_POE_HEADROOM = 0.2;

export type PoeLoadInput = {
  cameraCount: number;
  cameraMaxPowerW: number | null | undefined;
  cameraMaxPowerSource?: ProvenanceSource | null;
  allowEngineeringPowerDefault?: boolean | null;
  poeHeadroom?: number | null;
  /** Other PoE devices watts (future extensibility). */
  additionalDevicePowerW?: number | null;
  additionalPoePorts?: number | null;
};

/**
 * PoE load: sum(device max power) × (1 + headroom).
 * Unknown camera power → UNRESOLVED unless engineering default explicitly allowed.
 */
export function calculatePoe(input: PoeLoadInput): PoeLoadResult {
  const headroom =
    input.poeHeadroom != null && Number.isFinite(input.poeHeadroom)
      ? input.poeHeadroom
      : DEFAULT_POE_HEADROOM;
  const reasons: ReasonEntry[] = [];
  const extraPorts = input.additionalPoePorts ?? 0;
  const requiredPorts = input.cameraCount + (extraPorts > 0 ? extraPorts : 0);

  let powerPerCamera = input.cameraMaxPowerW ?? null;
  let powerSource: ProvenanceSource = input.cameraMaxPowerSource ?? "UNRESOLVED";

  if (powerPerCamera == null || !(powerPerCamera >= 0)) {
    if (input.allowEngineeringPowerDefault) {
      powerPerCamera = ENGINEERING_DEFAULT_CAMERA_POWER_W;
      powerSource = "ENGINEERING_DEFAULT";
      reasons.push({
        code: "POE_POWER_ENGINEERING_DEFAULT",
        params: { watts: powerPerCamera },
      });
    } else {
      reasons.push({ code: "POE_POWER_UNRESOLVED", params: {} });
      return {
        status: "unresolved",
        cameraCount: input.cameraCount,
        powerPerCameraW: null,
        powerSource: "UNRESOLVED",
        rawLoadW: null,
        headroom,
        requiredBudgetW: null,
        requiredPorts,
        reasons,
      };
    }
  } else if (!input.cameraMaxPowerSource) {
    powerSource = "USER_INPUT";
  }

  const extraW = input.additionalDevicePowerW ?? 0;
  const rawLoadW = input.cameraCount * powerPerCamera + (extraW > 0 ? extraW : 0);
  const requiredBudgetW = rawLoadW * (1 + headroom);

  reasons.push({
    code: "POE_HEADROOM_APPLIED",
    params: { rawLoadW, headroom, requiredBudgetW },
  });

  return {
    status: "ok",
    cameraCount: input.cameraCount,
    powerPerCameraW: powerPerCamera,
    powerSource,
    rawLoadW,
    headroom,
    requiredBudgetW,
    requiredPorts,
    reasons,
  };
}

export function evaluateNvrPoe(opts: {
  requiredPorts: number;
  requiredBudgetW: number | null;
  poePorts: number | null | undefined;
  poeBudgetW: number | null | undefined;
}): { evaluation: NvrPoeEvaluation; reasons: ReasonEntry[] } {
  const reasons: ReasonEntry[] = [];
  const portsKnown = opts.poePorts != null && Number.isFinite(opts.poePorts);
  const budgetKnown = opts.poeBudgetW != null && Number.isFinite(opts.poeBudgetW);
  const budgetNeeded = opts.requiredBudgetW != null && Number.isFinite(opts.requiredBudgetW);

  if (!portsKnown && (!budgetKnown || !budgetNeeded)) {
    reasons.push({ code: "NVR_POE_UNKNOWN", params: {} });
    return { evaluation: "UNKNOWN", reasons };
  }

  // Zero PoE ports known → insufficient ports when PoE devices needed
  const portsOk = portsKnown ? opts.poePorts! >= opts.requiredPorts : null;
  const budgetOk =
    budgetKnown && budgetNeeded ? opts.poeBudgetW! + 1e-9 >= opts.requiredBudgetW! : null;

  if (portsOk === false && budgetOk === false) {
    reasons.push({
      code: "NVR_POE_BOTH_INSUFFICIENT",
      params: {
        poePorts: opts.poePorts ?? null,
        requiredPorts: opts.requiredPorts,
        poeBudgetW: opts.poeBudgetW ?? null,
        requiredBudgetW: opts.requiredBudgetW,
      },
    });
    return { evaluation: "INSUFFICIENT_BOTH", reasons };
  }
  if (portsOk === false) {
    reasons.push({
      code: "NVR_POE_PORTS_INSUFFICIENT",
      params: { poePorts: opts.poePorts, requiredPorts: opts.requiredPorts },
    });
    return { evaluation: "INSUFFICIENT_PORTS", reasons };
  }
  if (budgetOk === false) {
    reasons.push({
      code: "NVR_POE_BUDGET_INSUFFICIENT",
      params: { poeBudgetW: opts.poeBudgetW, requiredBudgetW: opts.requiredBudgetW },
    });
    return { evaluation: "INSUFFICIENT_BUDGET", reasons };
  }

  // Partial unknown: if ports ok but budget unknown (and budget needed) → UNKNOWN
  if (portsOk === true && budgetNeeded && !budgetKnown) {
    reasons.push({ code: "NVR_POE_UNKNOWN", params: { reason: "budget_unknown" } });
    return { evaluation: "UNKNOWN", reasons };
  }
  if (portsOk == null && budgetOk === true) {
    reasons.push({ code: "NVR_POE_UNKNOWN", params: { reason: "ports_unknown" } });
    return { evaluation: "UNKNOWN", reasons };
  }

  reasons.push({
    code: "NVR_POE_SUFFICIENT",
    params: {
      poePorts: opts.poePorts ?? null,
      poeBudgetW: opts.poeBudgetW ?? null,
      requiredPorts: opts.requiredPorts,
      requiredBudgetW: opts.requiredBudgetW,
    },
  });
  return { evaluation: "SUFFICIENT", reasons };
}

export function evaluatePoeArchitecture(opts: {
  poeRequired: boolean;
  intent: PoeArchitectureIntent;
  requiredPorts: number;
  requiredBudgetW: number | null;
  recorderPoePorts: number | null | undefined;
  recorderPoeBudgetW: number | null | undefined;
}): PoeArchitectureResult {
  const reasons: ReasonEntry[] = [];

  if (!opts.poeRequired) {
    reasons.push({ code: "EXTERNAL_SWITCH_NOT_REQUIRED", params: { reason: "poe_not_required" } });
    return {
      evaluation: "SUFFICIENT",
      externalSwitchRequired: false,
      switchRequirement: null,
      reasons,
    };
  }

  if (opts.intent === "prefer_external_switch") {
    reasons.push({
      code: "EXTERNAL_SWITCH_REQUIRED",
      params: { reason: "user_architecture_intent" },
    });
    return {
      evaluation: "INSUFFICIENT_PORTS",
      externalSwitchRequired: true,
      switchRequirement: {
        minPorts: opts.requiredPorts,
        minPoePorts: opts.requiredPorts,
        minPoeBudgetW: opts.requiredBudgetW,
      },
      reasons,
    };
  }

  const nvr = evaluateNvrPoe({
    requiredPorts: opts.requiredPorts,
    requiredBudgetW: opts.requiredBudgetW,
    poePorts: opts.recorderPoePorts,
    poeBudgetW: opts.recorderPoeBudgetW,
  });
  reasons.push(...nvr.reasons);

  const needSwitch =
    nvr.evaluation === "INSUFFICIENT_PORTS" ||
    nvr.evaluation === "INSUFFICIENT_BUDGET" ||
    nvr.evaluation === "INSUFFICIENT_BOTH" ||
    nvr.evaluation === "UNKNOWN" ||
    (opts.recorderPoePorts != null && opts.recorderPoePorts === 0);

  if (needSwitch) {
    reasons.push({
      code: "EXTERNAL_SWITCH_REQUIRED",
      params: { evaluation: nvr.evaluation },
    });
    return {
      evaluation: nvr.evaluation,
      externalSwitchRequired: true,
      switchRequirement: {
        minPorts: opts.requiredPorts,
        minPoePorts: opts.requiredPorts,
        // If budget unresolved, still expose null — 13C must not invent watts.
        minPoeBudgetW: opts.requiredBudgetW,
      },
      reasons,
    };
  }

  reasons.push({ code: "EXTERNAL_SWITCH_NOT_REQUIRED", params: { evaluation: nvr.evaluation } });
  return {
    evaluation: nvr.evaluation,
    externalSwitchRequired: false,
    switchRequirement: null,
    reasons,
  };
}
