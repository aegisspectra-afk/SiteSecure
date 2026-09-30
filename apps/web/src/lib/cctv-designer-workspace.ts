/**
 * SYSTEM-DESIGNER-1 Slice C — requirements workspace IA helpers.
 * Same requirements object for Quick / Professional; no client-side sizing.
 */

import type { CctvBuildRequirements } from "./cctv-build-requirements";

export type DesignerMode = "quick" | "professional";

export type RequirementsSectionId =
  | "system"
  | "site"
  | "cameras"
  | "recording"
  | "network"
  | "power"
  | "infrastructure"
  | "services";

export const REQUIREMENTS_SECTION_ORDER: RequirementsSectionId[] = [
  "system",
  "site",
  "cameras",
  "recording",
  "network",
  "power",
  "infrastructure",
  "services",
];

export function isProfessionalMode(req: CctvBuildRequirements): boolean {
  return req.designerMode === "professional" || req.showAdvanced === true;
}

export function withDesignerMode(
  req: CctvBuildRequirements,
  mode: DesignerMode,
): CctvBuildRequirements {
  return {
    ...req,
    designerMode: mode,
    // Persist legacy flag so older Design docs stay coherent
    showAdvanced: mode === "professional",
  };
}

/** Sections visible for the current technology (hide irrelevant — do not disable). */
export function visibleSectionsFor(
  tech: CctvBuildRequirements["cctvTechnology"],
): RequirementsSectionId[] {
  return REQUIREMENTS_SECTION_ORDER.filter((id) => {
    if (id === "network") return tech !== "analog_hd";
    return true;
  });
}

export function applyTechnology(
  req: CctvBuildRequirements,
  tech: CctvBuildRequirements["cctvTechnology"],
): CctvBuildRequirements {
  const next: CctvBuildRequirements = { ...req, cctvTechnology: tech };
  if (tech === "ip") {
    const n = Math.max(1, Math.floor(req.cameraCount) || 1);
    next.cameraCount = n;
    next.ipCameraCount = n;
    next.analogCameraCount = 0;
    next.poeRequired = true;
    next.powerSupplyRequested = false;
  } else if (tech === "analog_hd") {
    const n = Math.max(1, Math.floor(req.cameraCount) || 1);
    next.cameraCount = n;
    next.analogCameraCount = n;
    next.ipCameraCount = 0;
    next.poeRequired = false;
    next.powerSupplyRequested = true;
  } else {
    let ip = Math.max(0, Math.floor(req.ipCameraCount));
    let an = Math.max(0, Math.floor(req.analogCameraCount));
    if (ip < 1 && an < 1) {
      const total = Math.max(2, Math.floor(req.cameraCount) || 2);
      ip = Math.max(1, Math.floor(total / 2));
      an = Math.max(1, total - ip);
    } else if (ip < 1) {
      ip = 1;
    } else if (an < 1) {
      an = 1;
    }
    next.ipCameraCount = ip;
    next.analogCameraCount = an;
    next.cameraCount = ip + an;
    next.poeRequired = true;
    next.powerSupplyRequested = true;
  }
  return next;
}

/** Sync cameraCount / split when counts change. */
export function patchCameraCounts(
  req: CctvBuildRequirements,
  patch: Partial<Pick<CctvBuildRequirements, "cameraCount" | "ipCameraCount" | "analogCameraCount">>,
): CctvBuildRequirements {
  const tech = req.cctvTechnology;
  if (tech === "hybrid") {
    const ip = patch.ipCameraCount != null ? Math.max(0, Math.floor(patch.ipCameraCount)) : req.ipCameraCount;
    const an =
      patch.analogCameraCount != null
        ? Math.max(0, Math.floor(patch.analogCameraCount))
        : req.analogCameraCount;
    return { ...req, ipCameraCount: ip, analogCameraCount: an, cameraCount: ip + an };
  }
  if (tech === "analog_hd") {
    const n =
      patch.cameraCount != null
        ? Math.max(0, Math.floor(patch.cameraCount))
        : patch.analogCameraCount != null
          ? Math.max(0, Math.floor(patch.analogCameraCount))
          : req.cameraCount;
    return { ...req, cameraCount: n, analogCameraCount: n, ipCameraCount: 0 };
  }
  const n =
    patch.cameraCount != null
      ? Math.max(0, Math.floor(patch.cameraCount))
      : patch.ipCameraCount != null
        ? Math.max(0, Math.floor(patch.ipCameraCount))
        : req.cameraCount;
  return { ...req, cameraCount: n, ipCameraCount: n, analogCameraCount: 0 };
}

/**
 * Fingerprint of engineering-relevant fields for stale detection.
 * Mode / UI-only flags excluded so Quick↔Pro does not mark stale alone.
 */
export function requirementsCalcFingerprint(req: CctvBuildRequirements): string {
  const {
    showAdvanced: _sa,
    designerMode: _dm,
    ...engineering
  } = req;
  return JSON.stringify(engineering);
}

export type SiteContextChip = {
  id: string;
  label: string;
  value: string;
};

export function siteContextChips(opts: {
  customerName?: string | null;
  siteName?: string | null;
  leadLocation?: string | null;
  leadInfra?: string | null;
}): SiteContextChip[] {
  const chips: SiteContextChip[] = [];
  if (opts.customerName?.trim()) {
    chips.push({ id: "customer", label: "לקוח", value: opts.customerName.trim() });
  }
  if (opts.siteName?.trim()) {
    chips.push({ id: "site", label: "אתר", value: opts.siteName.trim() });
  }
  if (opts.leadLocation?.trim()) {
    chips.push({ id: "location", label: "מיקום", value: opts.leadLocation.trim() });
  }
  if (opts.leadInfra?.trim()) {
    chips.push({ id: "infra", label: "תשתית", value: opts.leadInfra.trim() });
  }
  return chips;
}
